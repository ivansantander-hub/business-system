import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id: orderId } = await params;

  const order = await prisma.order.findFirst({ where: { id: Number(orderId), companyId } });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const body = await request.json();

  const product = await prisma.product.findFirst({ where: { id: Number(body.productId), companyId } });
  if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  const quantity = Number(body.quantity) || 1;
  const unitPrice = Number(product.salePrice);
  const total = quantity * unitPrice;

  const item = await prisma.orderItem.create({
    data: {
      orderId: Number(orderId),
      productId: product.id,
      quantity,
      unitPrice,
      total,
      notes: body.notes || null,
    },
    include: { product: { select: { name: true } } },
  });

  const items = await prisma.orderItem.findMany({
    where: { orderId: Number(orderId), status: { not: "CANCELLED" } },
  });
  const subtotal = items.reduce((sum, i) => sum + Number(i.total), 0);
  const discount = Number(order.discount) || 0;
  const tax = (subtotal - discount) * 0.19;
  const orderTotal = subtotal - discount + tax;

  await prisma.order.update({
    where: { id: Number(orderId) },
    data: { subtotal, tax, total: orderTotal },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id: orderId } = await params;

  const order = await prisma.order.findFirst({ where: { id: Number(orderId), companyId } });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) return NextResponse.json({ error: "itemId requerido" }, { status: 400 });

  await prisma.orderItem.update({
    where: { id: Number(itemId) },
    data: { status: "CANCELLED" },
  });

  const items = await prisma.orderItem.findMany({
    where: { orderId: Number(orderId), status: { not: "CANCELLED" } },
  });
  const subtotal = items.reduce((sum, i) => sum + Number(i.total), 0);
  const discount = Number(order.discount) || 0;
  const tax = (subtotal - discount) * 0.19;
  const total = subtotal - discount + tax;

  await prisma.order.update({
    where: { id: Number(orderId) },
    data: { subtotal, tax, total },
  });

  return NextResponse.json({ ok: true });
}
