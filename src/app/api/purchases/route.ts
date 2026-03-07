import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET() {
  const purchases = await prisma.purchase.findMany({
    include: {
      supplier: { select: { name: true } },
      user: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(purchases);
}

export async function POST(request: Request) {
  const { userId } = getUserFromHeaders(request);
  const body = await request.json();

  const count = await prisma.purchase.count();
  const number = `OC-${String(count + 1).padStart(6, "0")}`;

  let subtotal = 0;
  const itemsData = body.items.map((item: { productId: number; quantity: number; unitPrice: number }) => {
    const total = Number(item.quantity) * Number(item.unitPrice);
    subtotal += total;
    return {
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total,
    };
  });

  const taxRate = 0.12;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const purchase = await prisma.purchase.create({
    data: {
      supplierId: Number(body.supplierId),
      userId,
      number,
      date: new Date(),
      subtotal,
      tax,
      total,
      notes: body.notes || null,
      items: { create: itemsData },
    },
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  return NextResponse.json(purchase, { status: 201 });
}
