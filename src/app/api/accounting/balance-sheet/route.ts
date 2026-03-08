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
      type: { in: ["ASSET", "LIABILITY", "EQUITY"] },
    },
    orderBy: { code: "asc" },
  });

  const assets = accounts.filter((a) => a.type === "ASSET");
  const liabilities = accounts.filter((a) => a.type === "LIABILITY");
  const equity = accounts.filter((a) => a.type === "EQUITY");

  const totalAssets = assets.reduce((s, a) => s + Number(a.balance), 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + Number(a.balance), 0);
  const totalEquity = equity.reduce((s, a) => s + Number(a.balance), 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return NextResponse.json({
    assets: assets.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      balance: Number(a.balance),
    })),
    liabilities: liabilities.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      balance: Number(a.balance),
    })),
    equity: equity.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      balance: Number(a.balance),
    })),
    totals: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
      balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    },
  });
}
