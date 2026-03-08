import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = new Date(from);
    if (to) (where.date as Record<string, unknown>).lte = new Date(to + "T23:59:59");
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: { select: { name: true, nit: true } },
      user: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(invoices);
}

export async function POST(request: Request) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  try {
    const body = await request.json();

    const setting = await prisma.setting.findFirst({
      where: { companyId, key: "invoice_next_number" },
    });
    const prefixSetting = await prisma.setting.findFirst({
      where: { companyId, key: "invoice_prefix" },
    });
    const prefix = prefixSetting?.value || "FE-";
    const nextNum = Number(setting?.value || 1);
    const invoiceNumber = `${prefix}${String(nextNum).padStart(8, "0")}`;

    const taxRateSetting = await prisma.setting.findFirst({
      where: { companyId, key: "tax_rate" },
    });
    const taxRate = Number(taxRateSetting?.value || "0.19");

    let subtotal = 0;
    const itemsData = body.items.map(
      (item: { productId?: number; productName: string; quantity: number; unitPrice: number }) => {
        const total = Number(item.quantity) * Number(item.unitPrice);
        subtotal += total;
        return {
          productId: item.productId ? Number(item.productId) : null,
          productName: item.productName,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          total,
        };
      }
    );

    const discount = Number(body.discount) || 0;
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * taxRate;
    const total = taxableAmount + tax;
    const paidAmount = Number(body.paidAmount) || total;
    const changeAmount = Math.max(0, paidAmount - total);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          companyId,
          orderId: body.orderId ? Number(body.orderId) : null,
          customerId: body.customerId ? Number(body.customerId) : null,
          userId,
          number: invoiceNumber,
          subtotal,
          taxRate,
          tax,
          discount,
          total,
          paidAmount,
          changeAmount,
          paymentMethod: body.paymentMethod || "CASH",
          status: body.paymentMethod === "CREDIT" ? "PENDING" : "PAID",
          notes: body.notes || null,
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

      if (body.orderId) {
        const order = await tx.order.findFirst({ where: { id: Number(body.orderId), companyId } });
        if (order) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: "PAID" },
          });
          if (order.tableId) {
            await tx.restaurantTable.update({
              where: { id: order.tableId },
              data: { status: "AVAILABLE" },
            });
          }
        }
      }

      const cashSession = await tx.cashSession.findFirst({
        where: { userId, companyId, status: "OPEN" },
      });
      if (cashSession) {
        await tx.cashSession.update({
          where: { id: cashSession.id },
          data: { salesTotal: { increment: total } },
        });
      }

      return inv;
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Create invoice error:", error);
    return NextResponse.json({ error: "Error al crear factura" }, { status: 500 });
  }
}
