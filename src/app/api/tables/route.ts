import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const tables = await prisma.restaurantTable.findMany({
    where: { companyId },
    include: {
      orders: {
        where: { status: "OPEN" },
        include: {
          waiter: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      },
    },
    orderBy: { number: "asc" },
  });
  return NextResponse.json(tables);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const table = await prisma.restaurantTable.create({
    data: {
      companyId,
      number: body.number,
      capacity: Number(body.capacity) || 4,
      section: body.section || null,
    },
  });
  return NextResponse.json(table, { status: 201 });
}
