import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = { companyId };
  if (productId) where.productId = productId;
  if (type) where.type = type;

  const movements = await prisma.inventoryMovement.findMany({
    where,
    include: {
      product: { select: { name: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(movements);
}

export async function POST(request: Request) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();

  const product = await prisma.product.findFirst({
    where: { id: body.productId, companyId },
  });
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const previousStock = Number(product.stock);
  let newStock: number;

  if (body.type === "IN") {
    newStock = previousStock + Number(body.quantity);
  } else if (body.type === "OUT") {
    newStock = previousStock - Number(body.quantity);
    if (newStock < 0) {
      return NextResponse.json({ error: "Stock insuficiente" }, { status: 400 });
    }
  } else {
    newStock = Number(body.newStock);
  }

  const [movement] = await prisma.$transaction([
    prisma.inventoryMovement.create({
      data: {
        companyId,
        productId: body.productId,
        userId,
        type: body.type,
        quantity: Number(body.quantity),
        previousStock,
        newStock,
        reason: body.reason || null,
      },
      include: { product: { select: { name: true } }, user: { select: { name: true } } },
    }),
    prisma.product.updateMany({
      where: { id: body.productId, companyId },
      data: { stock: newStock },
    }),
  ]);

  return NextResponse.json(movement, { status: 201 });
}
