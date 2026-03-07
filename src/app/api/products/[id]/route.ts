import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    include: { category: true },
  });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const { id } = await params;
  await prisma.product.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
