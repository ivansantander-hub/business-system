import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { createJournalEntry } from "@/lib/accounting";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";
import { sendNotification, EMAIL_EVENTS, emailCashSessionClosed } from "@/lib/email";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const { userId, companyId } = getUserFromHeaders(request);

  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  if (action === "current") {
    const session = await prisma.cashSession.findFirst({
      where: { userId, companyId, status: "OPEN" },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json(session);
  }

  const sessions = await prisma.cashSession.findMany({
    where: { companyId },
    include: { user: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();

  if (body.action === "open") {
    try {
      // Serializable to prevent two sessions opening simultaneously
      const session = await prisma.$transaction(async (tx) => {
        const existing = await tx.cashSession.findFirst({
          where: { userId, companyId, status: "OPEN" },
        });
        if (existing) {
          throw new Error("ALREADY_OPEN");
        }

        return tx.cashSession.create({
          data: {
            companyId,
            userId,
            openingAmount: Number(body.openingAmount) || 0,
          },
          include: { user: { select: { name: true } } },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      });

      auditApiRequest(request, "cash.open", { entity: "CashSession", entityId: session.id, statusCode: 201, details: { openingAmount: Number(session.openingAmount) } });
      return NextResponse.json(session, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "ALREADY_OPEN") {
        return NextResponse.json({ error: "Ya tiene una caja abierta" }, { status: 400 });
      }
      console.error("Cash open error:", error);
      return NextResponse.json({ error: "Error al abrir caja" }, { status: 500 });
    }
  }

  if (body.action === "close") {
    try {
      let sessionBeforeState: Record<string, unknown> | null = null;
      const updated = await prisma.$transaction(async (tx) => {
        // Lock the session to prevent double-close
        const session = await tx.cashSession.findFirst({
          where: { userId, companyId, status: "OPEN" },
        });
        if (!session) {
          throw new Error("NO_OPEN_SESSION");
        }
        sessionBeforeState = session as unknown as Record<string, unknown>;

        const expectedAmount = Number(session.openingAmount) + Number(session.salesTotal);
        const closingAmount = Number(body.closingAmount) || 0;
        const difference = closingAmount - expectedAmount;

        const closed = await tx.cashSession.update({
          where: { id: session.id },
          data: {
            closingAmount,
            expectedAmount,
            difference,
            closedAt: new Date(),
            status: "CLOSED",
          },
          include: { user: { select: { name: true } } },
        });

        if (Math.abs(difference) > 0.01) {
          if (difference < 0) {
            await createJournalEntry(
              tx, companyId,
              `Faltante cierre de caja #${session.id}`,
              `CAJA-${session.id}`,
              [
                { accountCode: "5195", debit: Math.abs(difference), credit: 0, description: "Faltante en caja" },
                { accountCode: "110505", debit: 0, credit: Math.abs(difference), description: "Faltante en caja" },
              ]
            );
          } else {
            await createJournalEntry(
              tx, companyId,
              `Sobrante cierre de caja #${session.id}`,
              `CAJA-${session.id}`,
              [
                { accountCode: "110505", debit: difference, credit: 0, description: "Sobrante en caja" },
                { accountCode: "4250", debit: 0, credit: difference, description: "Sobrante en caja" },
              ]
            );
          }
        }

        return closed;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      });

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
      if (user?.email) {
        sendNotification(companyId, EMAIL_EVENTS.CASH_SESSION_CLOSED,
          emailCashSessionClosed(
            user.email, user.name,
            Number(updated.salesTotal), Number(updated.openingAmount),
            Number(updated.closingAmount), Number(updated.difference),
            company?.name || "SGC"
          ),
          userId,
        ).catch(() => {});
      }

      auditApiRequest(request, "cash.close", {
        entity: "CashSession",
        entityId: updated.id,
        details: { salesTotal: Number(updated.salesTotal), closingAmount: Number(updated.closingAmount) },
        beforeState: serializeEntity(sessionBeforeState),
        afterState: serializeEntity(updated as unknown as Record<string, unknown>),
      });
      return NextResponse.json(updated);
    } catch (error) {
      if (error instanceof Error && error.message === "NO_OPEN_SESSION") {
        return NextResponse.json({ error: "No tiene caja abierta" }, { status: 400 });
      }
      console.error("Cash close error:", error);
      return NextResponse.json({ error: "Error al cerrar caja" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
