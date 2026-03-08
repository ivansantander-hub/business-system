import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id: Number(id), companyId },
    include: { category: true },
  });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.product.findFirst({
    where: { id: Number(id), companyId },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    const body = await request.json();
    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        name: body.name,
        description: body.description || null,
        barcode: body.barcode || null,
        categoryId: body.categoryId ? Number(body.categoryId) : null,
        unit: body.unit,
        costPrice: Number(body.costPrice),
        salePrice: Number(body.salePrice),
        stock: Number(body.stock),
        minStock: Number(body.minStock),
        isActive: body.isActive ?? true,
      },
      include: { category: true },
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const result = await prisma.product.updateMany({
    where: { id: Number(id), companyId },
    data: { isActive: false },
  });
  if (result.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
