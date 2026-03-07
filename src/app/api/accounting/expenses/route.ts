import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
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
  const { userId } = getUserFromHeaders(request);
  const body = await request.json();

  const expense = await prisma.expense.create({
    data: {
      category: body.category,
      description: body.description,
      amount: Number(body.amount),
      date: body.date ? new Date(body.date) : new Date(),
      paymentMethod: body.paymentMethod || "CASH",
      userId,
      receiptNumber: body.receiptNumber || null,
      notes: body.notes || null,
    },
    include: { user: { select: { name: true } } },
  });
  return NextResponse.json(expense, { status: 201 });
}
