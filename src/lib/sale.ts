import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createJournalEntry } from "@/lib/accounting";

interface SaleItem {
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface CreateSaleParams {
  companyId: string;
  userId: string;
  items: SaleItem[];
  paymentMethod: string;
  paidAmount?: number;
  discount?: number;
  customerId?: string | null;
  orderId?: string | null;
  notes?: string | null;
}

interface SaleResult {
  invoice: {
    id: string;
    number: string;
    total: number;
    [key: string]: unknown;
  };
  cashSession: { id: string };
}

const MAX_RETRIES = 3;

export async function createSale(params: CreateSaleParams): Promise<SaleResult> {
  const {
    companyId,
    userId,
    items,
    paymentMethod,
    discount: rawDiscount,
    customerId,
    orderId,
    notes,
  } = params;

  const cashSession = await prisma.cashSession.findFirst({
    where: { userId, companyId, status: "OPEN" },
  });

  if (!cashSession) {
    throw new Error("NO_CASH_SESSION");
  }

  let subtotal = 0;
  const itemsData = items.map((item) => {
    const total = Number(item.quantity) * Number(item.unitPrice);
    subtotal += total;
    return {
      productId: item.productId || null,
      productName: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total,
    };
  });

  const discount = Number(rawDiscount) || 0;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const prefixSetting = await tx.setting.findFirst({
          where: { companyId, key: "invoice_prefix" },
        });
        const taxRateSetting = await tx.setting.findFirst({
          where: { companyId, key: "tax_rate" },
        });

        const prefix = prefixSetting?.value || "FE-";
        const taxRate = Number(taxRateSetting?.value || "0.19");

        // Atomic invoice number: read count + setting inside Serializable tx
        const invoiceCount = await tx.invoice.count({ where: { companyId } });
        let nextNum = invoiceCount + 1;

        const lastInvoice = await tx.invoice.findFirst({
          where: { companyId },
          orderBy: { createdAt: "desc" },
          select: { number: true },
        });
        if (lastInvoice?.number) {
          const numericPart = lastInvoice.number.replaceAll(/\D/g, "");
          if (numericPart) {
            const parsed = Number.parseInt(numericPart, 10);
            if (parsed >= nextNum) nextNum = parsed + 1;
          }
        }

        const setting = await tx.setting.findFirst({
          where: { companyId, key: "invoice_next_number" },
        });
        if (setting) {
          const settingNum = Number(setting.value);
          if (settingNum > nextNum) nextNum = settingNum;
        }
        const invoiceNumber = `${prefix}${String(nextNum).padStart(8, "0")}`;

        const taxableAmount = subtotal - discount;
        const tax = taxableAmount * taxRate;
        const total = taxableAmount + tax;
        const paidAmount = params.paidAmount ?? total;
        const changeAmount = Math.max(0, paidAmount - total);

        const inv = await tx.invoice.create({
          data: {
            companyId,
            orderId: orderId || null,
            customerId: customerId || null,
            userId,
            cashSessionId: cashSession.id,
            number: invoiceNumber,
            subtotal,
            taxRate,
            tax,
            discount,
            total,
            paidAmount,
            changeAmount,
            paymentMethod: paymentMethod as "CASH" | "CARD" | "TRANSFER" | "CREDIT",
            status: paymentMethod === "CREDIT" ? "PENDING" : "PAID",
            notes: notes || null,
            items: { create: itemsData },
          },
          include: {
            customer: { select: { name: true, nit: true } },
            items: true,
          },
        });

        // Update invoice_next_number setting
        if (setting) {
          await tx.setting.update({
            where: { id: setting.id },
            data: { value: String(nextNum + 1) },
          });
        } else {
          await tx.setting.create({
            data: { companyId, key: "invoice_next_number", value: String(nextNum + 1) },
          });
        }

        // Atomic stock decrement using Prisma's atomic increment
        for (const item of itemsData) {
          if (item.productId) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { id: true, stock: true },
            });
            if (!product) continue;

            const previousStock = Number(product.stock);
            const decremented = Math.min(Number(item.quantity), previousStock);
            const newStock = previousStock - decremented;

            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: decremented } },
            });

            await tx.inventoryMovement.create({
              data: {
                companyId,
                productId: item.productId,
                userId,
                type: "OUT",
                quantity: Number(item.quantity),
                previousStock,
                newStock,
                reason: `Venta ${invoiceNumber}`,
                referenceId: inv.id,
                referenceType: "invoice",
              },
            });
          }
        }

        if (orderId) {
          const order = await tx.order.findFirst({ where: { id: orderId, companyId } });
          if (order) {
            await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
            if (order.tableId) {
              await tx.restaurantTable.update({
                where: { id: order.tableId },
                data: { status: "AVAILABLE" },
              });
            }
          }
        }

        // Atomic salesTotal increment
        await tx.cashSession.update({
          where: { id: cashSession.id },
          data: { salesTotal: { increment: total } },
        });

        const debitAccountCode = paymentMethod === "CREDIT" ? "130505" : "110505";
        const incomeAccountCode = "4135";

        const journalLines = [
          { accountCode: debitAccountCode, debit: total, credit: 0, description: `Venta ${invoiceNumber}` },
          { accountCode: incomeAccountCode, debit: 0, credit: subtotal - discount, description: `Ingreso venta ${invoiceNumber}` },
        ];
        if (tax > 0.01) {
          journalLines.push({
            accountCode: "240801",
            debit: 0,
            credit: tax,
            description: `IVA venta ${invoiceNumber}`,
          });
        }

        await createJournalEntry(tx, companyId, `Venta ${invoiceNumber}`, invoiceNumber, journalLines);

        return { invoice: inv as unknown as SaleResult["invoice"], cashSession: { id: cashSession.id } };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });

      return result;
    } catch (error) {
      lastError = error;
      const isRetryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002");
      if (!isRetryable || attempt === MAX_RETRIES - 1) throw error;
      // Exponential backoff with jitter
      await new Promise((r) => setTimeout(r, (2 ** attempt) * 50 + Math.random() * 100));
    }
  }

  throw lastError;
}
