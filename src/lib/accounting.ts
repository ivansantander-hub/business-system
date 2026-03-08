import type { PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

interface JournalLineInput {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
}

/**
 * Creates a journal entry within an existing Prisma transaction.
 * Looks up accounts by PUC code for the given company, creates
 * the entry + lines, and updates account balances.
 */
export async function createJournalEntry(
  tx: Tx,
  companyId: string,
  description: string,
  reference: string | null,
  lines: JournalLineInput[]
) {
  const resolvedLines: { accountId: string; debit: number; credit: number; description: string | null }[] = [];

  for (const line of lines) {
    const account = await tx.account.findFirst({
      where: { companyId, code: line.accountCode },
    });
    if (!account) {
      console.warn(`Account ${line.accountCode} not found for company ${companyId}, skipping journal line`);
      continue;
    }
    resolvedLines.push({
      accountId: account.id,
      debit: line.debit,
      credit: line.credit,
      description: line.description || null,
    });
  }

  if (resolvedLines.length === 0) return null;

  const totalDebit = resolvedLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = resolvedLines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    console.warn(`Journal entry imbalanced: debit=${totalDebit} credit=${totalCredit} for "${description}"`);
    return null;
  }

  const je = await tx.journalEntry.create({
    data: {
      companyId,
      date: new Date(),
      description,
      reference,
      lines: { create: resolvedLines },
    },
  });

  for (const line of resolvedLines) {
    const account = await tx.account.findFirst({
      where: { id: line.accountId, companyId },
    });
    if (!account) continue;

    let balanceChange = line.debit - line.credit;
    if (["LIABILITY", "EQUITY", "INCOME"].includes(account.type)) {
      balanceChange = -balanceChange;
    }

    await tx.account.update({
      where: { id: account.id },
      data: { balance: { increment: balanceChange } },
    });
  }

  return je;
}
