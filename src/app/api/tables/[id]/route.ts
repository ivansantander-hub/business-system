import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const table = await prisma.restaurantTable.update({
    where: { id: Number(id) },
    data: {
      number: body.number,
      capacity: body.capacity ? Number(body.capacity) : undefined,
      section: body.section,
      status: body.status,
    },
  });
  return NextResponse.json(table);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.restaurantTable.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
