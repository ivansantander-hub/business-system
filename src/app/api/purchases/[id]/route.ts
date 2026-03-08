import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { createJournalEntry } from "@/lib/accounting";
import { auditApiRequest } from "@/lib/api-audit";
import { sendNotification, EMAIL_EVENTS, emailPurchaseReceived } from "@/lib/email";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const purchase = await prisma.purchase.findFirst({
    where: { id, companyId },
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
    try {
      await prisma.$transaction(async (tx) => {
        // Lock the purchase row to prevent double-receive
        const purchase = await tx.purchase.findFirst({
          where: { id, companyId, status: { not: "RECEIVED" } },
          include: { items: true },
        });
        if (!purchase) {
          throw new Error("PURCHASE_NOT_FOUND_OR_ALREADY_RECEIVED");
        }

        for (const item of purchase.items) {
          // Atomic stock increment
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: Number(item.quantity) } },
          });

          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true },
          });
          const newStock = Number(product?.stock ?? 0);
          const previousStock = newStock - Number(item.quantity);

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
          where: { id },
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
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });

      const updatedPurchase = await prisma.purchase.findFirst({ where: { id, companyId }, select: { number: true, total: true } });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
      if (user?.email && updatedPurchase) {
        sendNotification(companyId, EMAIL_EVENTS.PURCHASE_RECEIVED,
          emailPurchaseReceived(user.email, user.name, updatedPurchase.number, Number(updatedPurchase.total), company?.name || "SGC"),
          userId,
        ).catch(() => {});
      }

      auditApiRequest(request, "purchase.receive", { entity: "Purchase", entityId: id });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "PURCHASE_NOT_FOUND_OR_ALREADY_RECEIVED") {
        return NextResponse.json({ error: "Compra no encontrada o ya recibida" }, { status: 409 });
      }
      console.error("Purchase receive error:", error);
      return NextResponse.json({ error: "Error al recibir compra" }, { status: 500 });
    }
  }

  if (body.status === "CANCELLED") {
    const existing = await prisma.purchase.findFirst({ where: { id, companyId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (existing.status === "RECEIVED") {
      return NextResponse.json({ error: "No se puede cancelar una compra ya recibida" }, { status: 409 });
    }

    await prisma.purchase.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    auditApiRequest(request, "purchase.cancel", { entity: "Purchase", entityId: id });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
