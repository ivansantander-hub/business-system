import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const now = new Date();
  let startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  if (from) startOfDay = new Date(from);
  if (to) {
    endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
  }

  const checkIns = await prisma.checkIn.findMany({
    where: {
      companyId,
      timestamp: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      member: {
        include: {
          customer: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { timestamp: "desc" },
  });

  return NextResponse.json(checkIns);
}

async function validateMembershipMethod(
  member: { memberships: { status: string; endDate: Date }[] }
): Promise<NextResponse | null> {
  const now = new Date();
  const activeMembership = member.memberships.find(
    (m) => m.status === "ACTIVE" && new Date(m.endDate) >= now
  );
  if (!activeMembership) {
    return NextResponse.json(
      { error: "El miembro no tiene membresía activa" },
      { status: 400 }
    );
  }
  return null;
}

async function validateAndUseDayPass(
  dayPassId: number,
  companyId: number
): Promise<NextResponse | null> {
  const dayPass = await prisma.dayPass.findFirst({
    where: { id: dayPassId, companyId, status: "ACTIVE" },
  });
  if (!dayPass) {
    return NextResponse.json(
      { error: "Pase de día no encontrado o no está activo" },
      { status: 400 }
    );
  }
  await prisma.dayPass.update({
    where: { id: dayPassId },
    data: { status: "USED" },
  });
  return null;
}

function resolveMethod(method: string): "MEMBERSHIP" | "DAY_PASS" | "MANUAL" {
  if (method === "DAY_PASS") return "DAY_PASS";
  if (method === "MANUAL") return "MANUAL";
  return "MEMBERSHIP";
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { memberId, type, method, dayPassId, notes } = body;

  if (!memberId || !type || !method) {
    return NextResponse.json(
      { error: "memberId, type y method son requeridos" },
      { status: 400 }
    );
  }

  const member = await prisma.gymMember.findFirst({
    where: { id: Number(memberId), companyId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { endDate: "desc" },
      },
    },
  });

  if (!member) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  if (method === "MEMBERSHIP") {
    const err = await validateMembershipMethod(member);
    if (err) return err;
  }

  if (method === "DAY_PASS") {
    if (!dayPassId) {
      return NextResponse.json(
        { error: "dayPassId es requerido para método DAY_PASS" },
        { status: 400 }
      );
    }
    const err = await validateAndUseDayPass(Number(dayPassId), companyId);
    if (err) return err;
  }

  const methodVal = resolveMethod(method);
  const checkIn = await prisma.checkIn.create({
    data: {
      companyId,
      memberId: Number(memberId),
      type: type === "EXIT" ? "EXIT" : "ENTRY",
      method: methodVal,
      dayPassId: dayPassId ? Number(dayPassId) : null,
      notes: notes || null,
    },
    include: {
      member: {
        include: {
          customer: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json(checkIn, { status: 201 });
}
