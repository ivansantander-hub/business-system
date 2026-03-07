import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchase = await prisma.purchase.findUnique({
    where: { id: Number(id) },
    include: {
      supplier: true,
      user: { select: { name: true } },
      items: { include: { product: true } },
    },
  });
  if (!purchase) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(purchase);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = getUserFromHeaders(request);
  const body = await request.json();

  if (body.status === "RECEIVED") {
    const purchase = await prisma.purchase.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });
    if (!purchase) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      for (const item of purchase.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        const previousStock = Number(product.stock);
        const newStock = previousStock + Number(item.quantity);

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: newStock },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            userId,
            type: "IN",
            quantity: Number(item.quantity),
            previousStock,
            newStock,
            reason: `Compra ${purchase.number}`,
            referenceId: purchase.id,
            referenceType: "purchase",
          },
        });
      }

      await tx.purchase.update({
        where: { id: Number(id) },
        data: { status: "RECEIVED" },
      });
    });

    return NextResponse.json({ ok: true });
  }

  if (body.status === "CANCELLED") {
    await prisma.purchase.update({
      where: { id: Number(id) },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
