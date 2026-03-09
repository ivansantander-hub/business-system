import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const concepts = await prisma.payrollConcept.findMany({
    where: { companyId },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });
  return NextResponse.json(concepts);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { code, name, type, subtype, isAutomatic, formula, rate } = body;

  if (!code || !name || !type) {
    return NextResponse.json({ error: "Campos requeridos: code, name, type" }, { status: 400 });
  }

  const concept = await prisma.payrollConcept.create({
    data: {
      companyId,
      code,
      name,
      type,
      subtype: subtype || null,
      isAutomatic: isAutomatic || false,
      formula: formula || null,
      rate: rate || null,
    },
  });

  auditApiRequest(request, "payroll_concept.create", {
    entity: "PayrollConcept",
    entityId: concept.id,
    statusCode: 201,
    details: { code, name, type },
    afterState: serializeEntity(concept as unknown as Record<string, unknown>),
  });

  return NextResponse.json(concept, { status: 201 });
}
