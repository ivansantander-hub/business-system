import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { runPayrollCalculation } from "@/lib/payroll-engine";
import { generatePayrollJournalEntries } from "@/lib/payroll-accounting";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const run = await prisma.payrollRun.findFirst({
    where: { id, companyId },
    include: {
      items: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, docNumber: true, position: true } },
          details: true,
          electronicDoc: true,
        },
      },
    },
  });
  if (!run) return NextResponse.json({ error: "Nómina no encontrada" }, { status: 404 });
  return NextResponse.json(run);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { companyId, userId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { action } = body;

  const run = await prisma.payrollRun.findFirst({ where: { id, companyId } });
  if (!run) return NextResponse.json({ error: "Nómina no encontrada" }, { status: 404 });

  try {
    switch (action) {
      case "calculate": {
        if (run.status !== "DRAFT") return NextResponse.json({ error: "Solo se puede calcular en estado BORRADOR" }, { status: 400 });
        await prisma.payrollItemDetail.deleteMany({ where: { payrollItem: { payrollRunId: id } } });
        await prisma.payrollItem.deleteMany({ where: { payrollRunId: id } });
        await runPayrollCalculation(id);
        break;
      }
      case "approve": {
        if (run.status !== "CALCULATED") return NextResponse.json({ error: "Solo se puede aprobar en estado CALCULADO" }, { status: 400 });
        await prisma.payrollRun.update({
          where: { id },
          data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
        });
        break;
      }
      case "pay": {
        if (run.status !== "APPROVED") return NextResponse.json({ error: "Solo se puede pagar en estado APROBADO" }, { status: 400 });
        await generatePayrollJournalEntries(id);
        await prisma.payrollRun.update({
          where: { id },
          data: { status: "PAID", paidAt: new Date() },
        });
        break;
      }
      case "cancel": {
        if (run.status === "PAID") return NextResponse.json({ error: "No se puede cancelar una nómina ya pagada" }, { status: 400 });
        await prisma.payrollRun.update({ where: { id }, data: { status: "CANCELLED" } });
        break;
      }
      default:
        return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error procesando nómina";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const updated = await prisma.payrollRun.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });

  auditApiRequest(request, `payroll_run.${action}`, {
    entity: "PayrollRun",
    entityId: id,
    details: { action, period: run.period, previousStatus: run.status, newStatus: updated?.status },
    beforeState: serializeEntity(run as unknown as Record<string, unknown>),
    afterState: serializeEntity(updated as unknown as Record<string, unknown>),
  });

  return NextResponse.json(updated);
}
