import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
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
  const { userId } = getUserFromHeaders(request);
  const body = await request.json();

  // Get next invoice number
  const setting = await prisma.setting.findUnique({ where: { key: "invoice_next_number" } });
  const prefix = (await prisma.setting.findUnique({ where: { key: "invoice_prefix" } }))?.value || "FAC-";
  const nextNum = Number(setting?.value || 1);
  const invoiceNumber = `${prefix}${String(nextNum).padStart(8, "0")}`;

  const taxRate = Number(
    (await prisma.setting.findUnique({ where: { key: "tax_rate" } }))?.value || "0.12"
  );

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
  const changeAmount = paidAmount - total;

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
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
        changeAmount: changeAmount > 0 ? changeAmount : 0,
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

    // Update invoice number counter
    await tx.setting.update({
      where: { key: "invoice_next_number" },
      data: { value: String(nextNum + 1) },
    });

    // Deduct stock for each item
    for (const item of itemsData) {
      if (item.productId) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          const previousStock = Number(product.stock);
          const newStock = previousStock - Number(item.quantity);
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: Math.max(0, newStock) },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              userId,
              type: "OUT",
              quantity: Number(item.quantity),
              previousStock,
              newStock: Math.max(0, newStock),
              reason: `Venta ${invoiceNumber}`,
              referenceId: inv.id,
              referenceType: "invoice",
            },
          });
        }
      }
    }

    // Close order if linked
    if (body.orderId) {
      const order = await tx.order.findUnique({ where: { id: Number(body.orderId) } });
      await tx.order.update({
        where: { id: Number(body.orderId) },
        data: { status: "PAID" },
      });
      if (order?.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: "AVAILABLE" },
        });
      }
    }

    // Update cash session if open
    const cashSession = await tx.cashSession.findFirst({
      where: { userId, status: "OPEN" },
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
}
