import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const entries = await prisma.journalEntry.findMany({
    where: { companyId },
    include: {
      lines: {
        include: { account: { select: { code: true, name: true } } },
      },
    },
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (companyId === null) {
    return NextResponse.json({ error: "Company context required" }, { status: 403 });
  }

  const body = await request.json();

  // Validate debits = credits
  const totalDebit = body.lines.reduce((sum: number, l: { debit: number }) => sum + Number(l.debit), 0);
  const totalCredit = body.lines.reduce((sum: number, l: { credit: number }) => sum + Number(l.credit), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return NextResponse.json({ error: "Débitos y créditos deben ser iguales" }, { status: 400 });
  }

  const entry = await prisma.$transaction(async (tx) => {
    const je = await tx.journalEntry.create({
      data: {
        companyId,
        date: body.date ? new Date(body.date) : new Date(),
        description: body.description,
        reference: body.reference || null,
        lines: {
          create: body.lines.map((l: { accountId: number; debit: number; credit: number; description?: string }) => ({
            accountId: Number(l.accountId),
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || null,
          })),
        },
      },
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
      },
    });

    // Update account balances (accounts must belong to company)
    for (const line of body.lines) {
      const account = await tx.account.findFirst({
        where: { id: Number(line.accountId), companyId },
      });
      if (!account) continue;

      let balanceChange = Number(line.debit) - Number(line.credit);
      // For liability, equity, income: credit increases balance
      if (["LIABILITY", "EQUITY", "INCOME"].includes(account.type)) {
        balanceChange = -balanceChange;
      }

      await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: balanceChange } },
      });
    }

    return je;
  });

  return NextResponse.json(entry, { status: 201 });
}
