import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");

  const where: {
    companyId: string;
    customer?: { OR: { name?: { contains: string; mode: "insensitive" }; email?: { contains: string; mode: "insensitive" } }[] };
    status?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  } = { companyId };

  if (search.trim()) {
    where.customer = {
      OR: [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ],
    };
  }

  if (status === "ACTIVE" || status === "INACTIVE" || status === "SUSPENDED") {
    where.status = status;
  }

  const members = await prisma.gymMember.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      memberships: {
        where: { status: "ACTIVE" },
        include: { plan: { select: { name: true } } },
        orderBy: { endDate: "desc" },
        take: 1,
      },
      checkIns: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(members);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  let customerId = body.customerId ? body.customerId : null;

  if (customerId) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!existing) customerId = null;
  }

  if (!customerId) {
    const { name, phone, email } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: "Nombre requerido para nuevo cliente" }, { status: 400 });
    }
    const customer = await prisma.customer.create({
      data: {
        companyId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
      },
    });
    customerId = customer.id;
  }

  const member = await prisma.gymMember.create({
    data: {
      companyId,
      customerId,
      emergencyContact: body.emergencyContact?.trim() || null,
      emergencyPhone: body.emergencyPhone?.trim() || null,
      birthDate: body.birthDate ? new Date(body.birthDate) : null,
      gender: body.gender?.trim() || null,
      bloodType: body.bloodType?.trim() || null,
      medicalNotes: body.medicalNotes?.trim() || null,
    },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  return NextResponse.json(member, { status: 201 });
}
