import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.restaurantTable.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await request.json();
  const table = await prisma.restaurantTable.update({
    where: { id: existing.id },
    data: {
      number: body.number,
      capacity: body.capacity ? Number(body.capacity) : undefined,
      section: body.section,
      status: body.status,
    },
  });
  return NextResponse.json(table);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.restaurantTable.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.restaurantTable.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
