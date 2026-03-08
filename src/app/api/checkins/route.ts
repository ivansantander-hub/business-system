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
          customer: { select: { id: true, name: true, nit: true, email: true } },
        },
      },
    },
    orderBy: { timestamp: "desc" },
  });

  return NextResponse.json(checkIns);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { document, type, memberId } = body;

  if (!type || (type !== "ENTRY" && type !== "EXIT")) {
    return NextResponse.json({ error: "type debe ser ENTRY o EXIT" }, { status: 400 });
  }

  let gymMember;

  if (memberId) {
    gymMember = await prisma.gymMember.findFirst({
      where: { id: Number(memberId), companyId },
      include: {
        customer: true,
        memberships: {
          where: { status: "ACTIVE" },
          orderBy: { endDate: "desc" },
        },
        dayPasses: {
          where: { status: "ACTIVE", companyId },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } else if (document) {
    const customer = await prisma.customer.findFirst({
      where: { companyId, nit: document.trim() },
    });
    if (!customer) {
      return NextResponse.json({ error: "No se encontró cliente con ese documento" }, { status: 404 });
    }
    gymMember = await prisma.gymMember.findFirst({
      where: { companyId, customerId: customer.id },
      include: {
        customer: true,
        memberships: {
          where: { status: "ACTIVE" },
          orderBy: { endDate: "desc" },
        },
        dayPasses: {
          where: { status: "ACTIVE", companyId },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!gymMember) {
      return NextResponse.json({ error: "El cliente no está registrado como miembro del gimnasio" }, { status: 404 });
    }
  } else {
    return NextResponse.json({ error: "Se requiere document o memberId" }, { status: 400 });
  }

  if (!gymMember) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  if (type === "EXIT") {
    const checkIn = await prisma.checkIn.create({
      data: {
        companyId,
        memberId: gymMember.id,
        type: "EXIT",
        method: "MANUAL",
        notes: null,
      },
      include: {
        member: { include: { customer: { select: { id: true, name: true, nit: true } } } },
      },
    });
    return NextResponse.json({ checkIn, accessGranted: true, reason: "Salida registrada" }, { status: 201 });
  }

  const now = new Date();
  const activeMembership = gymMember.memberships.find(
    (m) => m.status === "ACTIVE" && new Date(m.endDate) >= now
  );

  if (activeMembership) {
    const checkIn = await prisma.checkIn.create({
      data: {
        companyId,
        memberId: gymMember.id,
        type: "ENTRY",
        method: "MEMBERSHIP",
      },
      include: {
        member: { include: { customer: { select: { id: true, name: true, nit: true } } } },
      },
    });
    const daysRemaining = Math.ceil((new Date(activeMembership.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return NextResponse.json({
      checkIn,
      accessGranted: true,
      reason: `Membresía activa - ${daysRemaining} días restantes`,
      method: "MEMBERSHIP",
    }, { status: 201 });
  }

  const activeDayPass = gymMember.dayPasses.find(
    (dp) => dp.status === "ACTIVE" && dp.usedEntries < dp.totalEntries
  );

  if (activeDayPass) {
    const newUsed = activeDayPass.usedEntries + 1;
    const newStatus = newUsed >= activeDayPass.totalEntries ? "USED" : "ACTIVE";
    await prisma.dayPass.update({
      where: { id: activeDayPass.id },
      data: { usedEntries: newUsed, status: newStatus },
    });

    const checkIn = await prisma.checkIn.create({
      data: {
        companyId,
        memberId: gymMember.id,
        type: "ENTRY",
        method: "DAY_PASS",
        dayPassId: activeDayPass.id,
      },
      include: {
        member: { include: { customer: { select: { id: true, name: true, nit: true } } } },
      },
    });
    const remaining = activeDayPass.totalEntries - newUsed;
    return NextResponse.json({
      checkIn,
      accessGranted: true,
      reason: `Tiquetera - ${remaining} entradas restantes`,
      method: "DAY_PASS",
    }, { status: 201 });
  }

  return NextResponse.json({
    accessGranted: false,
    reason: "Sin membresía activa ni tiquetera con entradas disponibles",
    memberName: gymMember.customer.name,
    memberId: gymMember.id,
  }, { status: 403 });
}
