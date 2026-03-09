import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const employee = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      branch: { select: { id: true, name: true } },
      payrollItems: { take: 5, orderBy: { createdAt: "desc" }, include: { payrollRun: { select: { period: true, status: true } } } },
    },
  });
  if (!employee) return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const existing = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });

  const beforeState = serializeEntity(existing as unknown as Record<string, unknown>);

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      ...Object.fromEntries(
        Object.entries(body).filter(([k, v]) => v !== undefined && !["id", "companyId", "createdAt", "updatedAt"].includes(k))
      ),
      ...(body.startDate ? { startDate: new Date(body.startDate) } : {}),
      ...(body.endDate ? { endDate: new Date(body.endDate) } : {}),
      ...(body.birthDate ? { birthDate: new Date(body.birthDate) } : {}),
    },
  });

  auditApiRequest(request, "employee.update", {
    entity: "Employee",
    entityId: id,
    details: { name: `${updated.firstName} ${updated.lastName}` },
    beforeState,
    afterState: serializeEntity(updated as unknown as Record<string, unknown>),
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const existing = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });

  await prisma.employee.update({ where: { id }, data: { isActive: false } });

  auditApiRequest(request, "employee.deactivate", {
    entity: "Employee",
    entityId: id,
    details: { name: `${existing.firstName} ${existing.lastName}` },
    beforeState: serializeEntity(existing as unknown as Record<string, unknown>),
    afterState: { ...serializeEntity(existing as unknown as Record<string, unknown>), isActive: false },
  });

  return NextResponse.json({ success: true });
}
