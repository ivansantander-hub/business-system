import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { createJournalEntry } from "@/lib/accounting";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      user: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
      order: { select: { id: true, type: true, table: { select: { number: true } } } },
      creditNotes: true,
      debitNotes: true,
    },
  });
  if (!invoice) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (body.status === "CANCELLED") {
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { items: true },
    });

    if (!invoice || invoice.status === "CANCELLED") {
      return NextResponse.json({ error: "No se puede anular" }, { status: 400 });
    }

    const beforeState = serializeEntity(invoice as unknown as Record<string, unknown>);

    try {
      await prisma.$transaction(async (tx) => {
        for (const item of invoice.items) {
          if (item.productId) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: { stock: true },
            });
            const previousStock = Number(product?.stock ?? 0);
            const newStock = previousStock + Number(item.quantity);

            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: Number(item.quantity) } },
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
                reason: `Anulación factura ${invoice.number}`,
                referenceId: invoice.id,
                referenceType: "invoice_cancel",
              },
            });
          }
        }

        await tx.invoice.update({
          where: { id },
          data: { status: "CANCELLED" },
        });

        const total = Number(invoice.total);
        const subtotal = Number(invoice.subtotal);
        const discount = Number(invoice.discount);
        const tax = Number(invoice.tax);
        const debitAccountCode = invoice.paymentMethod === "CREDIT" ? "130505" : "110505";

        const reversalLines = [
          { accountCode: "4135", debit: subtotal - discount, credit: 0, description: `Reverso venta ${invoice.number}` },
          { accountCode: debitAccountCode, debit: 0, credit: total, description: `Reverso cobro ${invoice.number}` },
        ];
        if (tax > 0.01) {
          reversalLines.push({
            accountCode: "240801",
            debit: tax,
            credit: 0,
            description: `Reverso IVA ${invoice.number}`,
          });
        }

        await createJournalEntry(
          tx,
          companyId,
          `Anulación factura ${invoice.number}`,
          `ANU-${invoice.number}`,
          reversalLines
        );

        if (invoice.cashSessionId) {
          await tx.cashSession.update({
            where: { id: invoice.cashSessionId },
            data: { salesTotal: { decrement: total } },
          });
        }
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });

      auditApiRequest(request, "invoice.cancel", {
        entity: "Invoice",
        entityId: id,
        details: { number: invoice.number, total: Number(invoice.total) },
        beforeState,
        afterState: { ...beforeState, status: "CANCELLED" },
        changeReason: body.reason || "Anulación de factura",
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("Invoice cancel error:", error);
      return NextResponse.json({ error: "Error al anular factura" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
