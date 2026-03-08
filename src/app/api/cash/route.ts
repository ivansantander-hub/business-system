import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { createJournalEntry } from "@/lib/accounting";

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
    const existing = await prisma.cashSession.findFirst({
      where: { userId, companyId, status: "OPEN" },
    });
    if (existing) {
      return NextResponse.json({ error: "Ya tiene una caja abierta" }, { status: 400 });
    }

    const session = await prisma.cashSession.create({
      data: {
        companyId,
        userId,
        openingAmount: Number(body.openingAmount) || 0,
      },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json(session, { status: 201 });
  }

  if (body.action === "close") {
    const session = await prisma.cashSession.findFirst({
      where: { userId, companyId, status: "OPEN" },
    });
    if (!session) {
      return NextResponse.json({ error: "No tiene caja abierta" }, { status: 400 });
    }

    const expectedAmount = Number(session.openingAmount) + Number(session.salesTotal);
    const closingAmount = Number(body.closingAmount) || 0;
    const difference = closingAmount - expectedAmount;

    const updated = await prisma.$transaction(async (tx) => {
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
            tx,
            companyId,
            `Faltante cierre de caja #${session.id}`,
            `CAJA-${session.id}`,
            [
              { accountCode: "5195", debit: Math.abs(difference), credit: 0, description: "Faltante en caja" },
              { accountCode: "110505", debit: 0, credit: Math.abs(difference), description: "Faltante en caja" },
            ]
          );
        } else {
          await createJournalEntry(
            tx,
            companyId,
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
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
