import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = { isActive: true, companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nit: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: {
      gymMember: {
        select: {
          id: true,
          status: true,
          memberships: {
            where: { status: "ACTIVE" },
            orderBy: { endDate: "desc" },
            take: 1,
            include: { plan: { select: { name: true } } },
          },
          dayPasses: {
            where: { status: "ACTIVE" },
            take: 5,
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const customer = await prisma.customer.create({
    data: {
      companyId,
      name: body.name,
      nit: body.nit || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      creditLimit: Number(body.creditLimit) || 0,
    },
  });

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { type: true },
  });

  if (company?.type === "GYM") {
    await prisma.gymMember.create({
      data: {
        companyId,
        customerId: customer.id,
        emergencyContact: body.emergencyContact || null,
        emergencyPhone: body.emergencyPhone || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        gender: body.gender || null,
        bloodType: body.bloodType || null,
        medicalNotes: body.medicalNotes || null,
      },
    });
  }

  auditApiRequest(request, "customer.create", {
    entity: "Customer",
    entityId: customer.id,
    statusCode: 201,
    details: { name: customer.name },
    afterState: serializeEntity(customer as unknown as Record<string, unknown>),
  });
  return NextResponse.json(customer, { status: 201 });
}
