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

  const result = await prisma.$transaction(async (tx) => {
    const prefixSetting = await tx.setting.findFirst({
      where: { companyId, key: "invoice_prefix" },
    });
    const taxRateSetting = await tx.setting.findFirst({
      where: { companyId, key: "tax_rate" },
    });

    const prefix = prefixSetting?.value || "FE-";
    const taxRate = Number(taxRateSetting?.value || "0.19");

    const invoiceCount = await tx.invoice.count({ where: { companyId } });
    const lastInvoice = await tx.invoice.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { number: true },
    });

    let nextNum = invoiceCount + 1;
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

    for (const item of itemsData) {
      if (item.productId) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          const previousStock = Number(product.stock);
          const newStock = Math.max(0, previousStock - Number(item.quantity));
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: newStock },
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

    await createJournalEntry(
      tx,
      companyId,
      `Venta ${invoiceNumber}`,
      invoiceNumber,
      journalLines
    );

    return { invoice: inv as unknown as SaleResult["invoice"], cashSession: { id: cashSession.id } };
  });

  return result;
}
