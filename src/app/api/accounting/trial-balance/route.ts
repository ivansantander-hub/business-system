import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: "asc" },
    include: {
      journalLines: {
        select: { debit: true, credit: true },
      },
    },
  });

  const rows = accounts.map((a) => {
    const debitTotal = a.journalLines.reduce((s, l) => s + Number(l.debit), 0);
    const creditTotal = a.journalLines.reduce((s, l) => s + Number(l.credit), 0);
    const balance = debitTotal - creditTotal;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      debitTotal,
      creditTotal,
      balance,
    };
  });

  const totalDebits = rows.reduce((s, r) => s + r.debitTotal, 0);
  const totalCredits = rows.reduce((s, r) => s + r.creditTotal, 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return NextResponse.json({
    accounts: rows,
    totals: {
      totalDebits,
      totalCredits,
      balanced,
    },
  });
}
