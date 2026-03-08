import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
      type: { in: ["INCOME", "EXPENSE", "COST"] },
    },
    orderBy: { code: "asc" },
  });

  const income = accounts.filter((a) => a.type === "INCOME");
  const costOfSales = accounts.filter((a) => a.type === "COST");
  const expenses = accounts.filter((a) => a.type === "EXPENSE");

  const totalIncome = income.reduce((s, a) => s + Number(a.balance), 0);
  const totalCostOfSales = costOfSales.reduce((s, a) => s + Number(a.balance), 0);
  const totalExpenses = expenses.reduce((s, a) => s + Number(a.balance), 0);

  const grossProfit = totalIncome - totalCostOfSales;
  const netIncome = grossProfit - totalExpenses;

  return NextResponse.json({
    income: income.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      balance: Number(a.balance),
    })),
    costOfSales: costOfSales.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      balance: Number(a.balance),
    })),
    expenses: expenses.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      balance: Number(a.balance),
    })),
    totals: {
      totalIncome,
      totalCostOfSales,
      grossProfit,
      totalExpenses,
      netIncome,
    },
  });
}
