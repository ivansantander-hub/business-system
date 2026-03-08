import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id: Number(id), companyId },
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
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.order.findFirst({
    where: { id: Number(id), companyId },
    select: { id: true, tableId: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (body.status === "PAID") {
    return NextResponse.json(
      { error: "Para marcar como pagada, debe crear una factura a través de la caja" },
      { status: 400 }
    );
  }

  const shouldReleaseTable = body.status === "CANCELLED" && existing.tableId;

  if (shouldReleaseTable) {
    await prisma.restaurantTable.update({
      where: { id: existing.tableId! },
      data: { status: "AVAILABLE" },
    });
  }

  const order = await prisma.order.update({
    where: { id: existing.id },
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
