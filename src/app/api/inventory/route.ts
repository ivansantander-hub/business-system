import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (productId) where.productId = Number(productId);
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
  const { userId } = getUserFromHeaders(request);
  const body = await request.json();

  const product = await prisma.product.findUnique({ where: { id: Number(body.productId) } });
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
        productId: Number(body.productId),
        userId,
        type: body.type,
        quantity: Number(body.quantity),
        previousStock,
        newStock,
        reason: body.reason || null,
      },
      include: { product: { select: { name: true } }, user: { select: { name: true } } },
    }),
    prisma.product.update({
      where: { id: Number(body.productId) },
      data: { stock: newStock },
    }),
  ]);

  return NextResponse.json(movement, { status: 201 });
}
