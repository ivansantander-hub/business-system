import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.category.findFirst({
    where: { id: Number(id), companyId },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const body = await request.json();
    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: { name: body.name, description: body.description },
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.category.findFirst({
    where: { id: Number(id), companyId },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.category.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
