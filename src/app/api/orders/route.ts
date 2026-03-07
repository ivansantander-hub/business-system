import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const orders = await prisma.order.findMany({
    where,
    include: {
      table: { select: { number: true } },
      customer: { select: { name: true } },
      user: { select: { name: true } },
      waiter: { select: { name: true } },
      items: { include: { product: { select: { name: true, salePrice: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const { userId } = getUserFromHeaders(request);
  const body = await request.json();

  const order = await prisma.order.create({
    data: {
      tableId: body.tableId ? Number(body.tableId) : null,
      customerId: body.customerId ? Number(body.customerId) : null,
      userId,
      waiterId: body.waiterId ? Number(body.waiterId) : null,
      type: body.type || "TABLE",
      notes: body.notes || null,
    },
    include: {
      table: { select: { number: true } },
      waiter: { select: { name: true } },
    },
  });

  if (body.tableId) {
    await prisma.restaurantTable.update({
      where: { id: Number(body.tableId) },
      data: { status: "OCCUPIED" },
    });
  }

  return NextResponse.json(order, { status: 201 });
}
