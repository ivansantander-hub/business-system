import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { createJournalEntry } from "@/lib/accounting";
import { auditApiRequest } from "@/lib/api-audit";

const EXPENSE_CATEGORY_ACCOUNTS: Record<string, string> = {
  "Personal": "5105",
  "Honorarios": "5110",
  "Impuestos": "5115",
  "Arriendo": "5120",
  "Seguros": "5130",
  "Servicios": "5135",
  "Mantenimiento": "5145",
  "Diversos": "5195",
};

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = { companyId };
  if (category) where.category = category;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = new Date(from);
    if (to) (where.date as Record<string, unknown>).lte = new Date(to + "T23:59:59");
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();
  const amount = Number(body.amount);
  const paymentMethod = body.paymentMethod || "CASH";

  const expense = await prisma.$transaction(async (tx) => {
    const exp = await tx.expense.create({
      data: {
        companyId,
        category: body.category,
        description: body.description,
        amount,
        date: body.date ? new Date(body.date) : new Date(),
        paymentMethod,
        userId,
        receiptNumber: body.receiptNumber || null,
        notes: body.notes || null,
      },
      include: { user: { select: { name: true } } },
    });

    const debitAccountCode = EXPENSE_CATEGORY_ACCOUNTS[body.category] || "5195";
    const creditAccountCode = (paymentMethod === "TRANSFER" || paymentMethod === "CARD") ? "111005" : "110505";

    await createJournalEntry(
      tx,
      companyId,
      `Gasto: ${body.description}`,
      exp.receiptNumber || `GASTO-${exp.id}`,
      [
        { accountCode: debitAccountCode, debit: amount, credit: 0, description: body.description },
        { accountCode: creditAccountCode, debit: 0, credit: amount, description: `Pago gasto: ${body.description}` },
      ]
    );

    return exp;
  });

  auditApiRequest(request, "expense.create", { entity: "Expense", entityId: expense.id, statusCode: 201 });
  return NextResponse.json(expense, { status: 201 });
}
