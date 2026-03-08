import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const member = await prisma.gymMember.findFirst({
    where: { id: Number(id), companyId },
    include: {
      customer: true,
      memberships: { include: { plan: true } },
      checkIns: {
        orderBy: { timestamp: "desc" },
        take: 10,
      },
    },
  });

  if (!member) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.gymMember.findFirst({
    where: { id: Number(id), companyId },
  });

  if (!existing) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

  const body = await request.json();
  const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
  const data: {
    emergencyContact?: string | null;
    emergencyPhone?: string | null;
    birthDate?: Date | null;
    gender?: string | null;
    bloodType?: string | null;
    medicalNotes?: string | null;
    status?: (typeof validStatuses)[number];
  } = {};

  if (body.emergencyContact !== undefined) data.emergencyContact = body.emergencyContact?.trim() || null;
  if (body.emergencyPhone !== undefined) data.emergencyPhone = body.emergencyPhone?.trim() || null;
  if (body.birthDate !== undefined) data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
  if (body.gender !== undefined) data.gender = body.gender?.trim() || null;
  if (body.bloodType !== undefined) data.bloodType = body.bloodType?.trim() || null;
  if (body.medicalNotes !== undefined) data.medicalNotes = body.medicalNotes?.trim() || null;
  if (body.status !== undefined) {
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    data.status = body.status;
  }

  const member = await prisma.gymMember.update({
    where: { id: Number(id) },
    data,
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  return NextResponse.json(member);
}
