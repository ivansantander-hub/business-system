import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tables = await prisma.restaurantTable.findMany({
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
  const body = await request.json();
  const table = await prisma.restaurantTable.create({
    data: {
      number: body.number,
      capacity: Number(body.capacity) || 4,
      section: body.section || null,
    },
  });
  return NextResponse.json(table, { status: 201 });
}
