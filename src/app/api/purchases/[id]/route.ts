import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { createJournalEntry } from "@/lib/accounting";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const purchase = await prisma.purchase.findFirst({
    where: { id: Number(id), companyId },
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
  const { userId, companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (body.status === "RECEIVED") {
    const purchase = await prisma.purchase.findFirst({
      where: { id: Number(id), companyId },
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
            companyId,
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

      const purchaseTotal = Number(purchase.total);
      await createJournalEntry(
        tx,
        companyId,
        `Compra recibida ${purchase.number}`,
        purchase.number,
        [
          { accountCode: "1435", debit: purchaseTotal, credit: 0, description: `Inventario - Compra ${purchase.number}` },
          { accountCode: "2205", debit: 0, credit: purchaseTotal, description: `Proveedor - Compra ${purchase.number}` },
        ]
      );
    });

    return NextResponse.json({ ok: true });
  }

  if (body.status === "CANCELLED") {
    const existing = await prisma.purchase.findFirst({ where: { id: Number(id), companyId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await prisma.purchase.update({
      where: { id: Number(id) },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
