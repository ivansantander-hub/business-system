import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(request: Request) {
  const { companyId, branchId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("active") !== "false";

  const where: Record<string, unknown> = { companyId };
  if (branchId) where.branchId = branchId;
  if (activeOnly) where.isActive = true;

  const employees = await prisma.employee.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } }, branch: { select: { id: true, name: true } } },
    orderBy: { lastName: "asc" },
  });
  return NextResponse.json(employees);
}

export async function POST(request: Request) {
  const { companyId, branchId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { firstName, lastName, docType, docNumber, email, phone, contractType, startDate, position, baseSalary, salaryType, userId, bank, accountType, accountNumber, eps, pensionFund, arl, arlRiskLevel, compensationFund, birthDate, address, gender, costCenter, workSchedule, endDate, paymentMethod, dependents, voluntaryDeductions } = body;

  if (!firstName || !lastName || !docNumber || !startDate) {
    return NextResponse.json({ error: "Campos requeridos: firstName, lastName, docNumber, startDate" }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      companyId,
      branchId: branchId || body.branchId || null,
      userId: userId || null,
      firstName,
      lastName,
      docType: docType || "CC",
      docNumber,
      email: email || null,
      phone: phone || null,
      contractType: contractType || "INDEFINITE",
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      position: position || null,
      baseSalary: baseSalary || 0,
      salaryType: salaryType || "ORDINARY",
      bank: bank || null,
      accountType: accountType || null,
      accountNumber: accountNumber || null,
      eps: eps || null,
      pensionFund: pensionFund || null,
      arl: arl || null,
      arlRiskLevel: arlRiskLevel || 1,
      compensationFund: compensationFund || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      address: address || null,
      gender: gender || null,
      costCenter: costCenter || null,
      workSchedule: workSchedule || "Lunes a Viernes",
      paymentMethod: paymentMethod || "TRANSFER",
      dependents: dependents || 0,
      voluntaryDeductions: voluntaryDeductions || 0,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  auditApiRequest(request, "employee.create", {
    entity: "Employee",
    entityId: employee.id,
    statusCode: 201,
    details: { name: `${firstName} ${lastName}`, docNumber },
    afterState: serializeEntity(employee as unknown as Record<string, unknown>),
  });

  return NextResponse.json(employee, { status: 201 });
}
