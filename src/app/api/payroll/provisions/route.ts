import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const year = searchParams.get("year");

  const where: Record<string, unknown> = { companyId };
  if (employeeId) where.employeeId = employeeId;
  if (year) {
    where.period = {
      gte: new Date(`${year}-01-01`),
      lt: new Date(`${Number(year) + 1}-01-01`),
    };
  }

  const provisions = await prisma.payrollProvision.findMany({
    where,
    include: { employee: { select: { firstName: true, lastName: true, docNumber: true } } },
    orderBy: { period: "desc" },
    take: 200,
  });
  return NextResponse.json(provisions);
}
