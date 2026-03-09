import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  let config = await prisma.payrollConfig.findUnique({ where: { companyId } });
  if (!config) {
    config = await prisma.payrollConfig.create({ data: { companyId } });
  }
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const filtered = Object.fromEntries(
    Object.entries(body).filter(([k]) => !["id", "companyId", "createdAt", "updatedAt"].includes(k))
  );

  const beforeConfig = await prisma.payrollConfig.findUnique({ where: { companyId } });
  const beforeState = serializeEntity(beforeConfig as unknown as Record<string, unknown>);

  const config = await prisma.payrollConfig.upsert({
    where: { companyId },
    update: filtered,
    create: { companyId, ...filtered },
  });

  auditApiRequest(request, "payroll_config.update", {
    entity: "PayrollConfig",
    entityId: config.id,
    details: { updatedFields: Object.keys(filtered) },
    beforeState,
    afterState: serializeEntity(config as unknown as Record<string, unknown>),
  });

  return NextResponse.json(config);
}
