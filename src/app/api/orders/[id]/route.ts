import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id: Number(id) },
    include: {
      table: true,
      customer: true,
      user: { select: { name: true } },
      waiter: { select: { name: true } },
      items: { include: { product: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(order);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  if (body.status === "CANCELLED") {
    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      select: { tableId: true },
    });

    await prisma.order.update({
      where: { id: Number(id) },
      data: { status: "CANCELLED" },
    });

    if (order?.tableId) {
      await prisma.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: "AVAILABLE" },
      });
    }

    return NextResponse.json({ ok: true });
  }

  const order = await prisma.order.update({
    where: { id: Number(id) },
    data: {
      status: body.status,
      notes: body.notes,
      discount: body.discount !== undefined ? Number(body.discount) : undefined,
    },
    include: {
      items: { include: { product: { select: { name: true } } } },
    },
  });

  return NextResponse.json(order);
}
