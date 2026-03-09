import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const runs = await prisma.payrollRun.findMany({
    where: { companyId },
    include: { _count: { select: { items: true } } },
    orderBy: { period: "desc" },
    take: 50,
  });
  return NextResponse.json(runs);
}

export async function POST(request: Request) {
  const { companyId, branchId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { period, periodStart, periodEnd, frequency, notes } = body;

  if (!period || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "Campos requeridos: period, periodStart, periodEnd" }, { status: 400 });
  }

  const run = await prisma.payrollRun.create({
    data: {
      companyId,
      branchId: branchId || body.branchId || null,
      period: new Date(period),
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      frequency: frequency || "MONTHLY",
      notes: notes || null,
    },
  });

  auditApiRequest(request, "payroll_run.create", {
    entity: "PayrollRun",
    entityId: run.id,
    statusCode: 201,
    details: { period, frequency: frequency || "MONTHLY" },
    afterState: serializeEntity(run as unknown as Record<string, unknown>),
  });

  return NextResponse.json(run, { status: 201 });
}
