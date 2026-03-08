import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

const now = new Date();

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");

  const where: { companyId: string; section?: string } = { companyId };
  if (section) where.section = section;

  const lockers = await prisma.locker.findMany({
    where,
    include: {
      assignments: {
        where: {
          OR: [{ endDate: null }, { endDate: { gte: now } }],
        },
        orderBy: { startDate: "desc" },
        take: 1,
        include: { member: { include: { customer: true } } },
      },
    },
    orderBy: [{ section: "asc" }, { number: "asc" }],
  });

  const lockersWithCurrentAssignment = lockers.map((l) => ({
    ...l,
    currentAssignment: l.assignments[0] ?? null,
  }));

  return NextResponse.json(lockersWithCurrentAssignment);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { number, section } = body;

  if (!number) return NextResponse.json({ error: "number requerido" }, { status: 400 });

  const locker = await prisma.locker.create({
    data: {
      companyId,
      number: String(number),
      section: section || null,
    },
  });

  return NextResponse.json(locker, { status: 201 });
}

export async function PUT(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const action = body.action;

  if (!action) return NextResponse.json({ error: "action requerido" }, { status: 400 });

  if (action === "assign") {
    const { lockerId, memberId, monthlyFee } = body;
    if (!lockerId || !memberId)
      return NextResponse.json({ error: "lockerId y memberId requeridos" }, { status: 400 });

    const [locker, assignment] = await prisma.$transaction([
      prisma.locker.update({
        where: { id: lockerId, companyId },
        data: { status: "ASSIGNED" },
      }),
      prisma.lockerAssignment.create({
        data: {
          companyId,
          lockerId,
          memberId,
          startDate: now,
          monthlyFee: monthlyFee != null ? Number(monthlyFee) : 0,
        },
        include: { member: { include: { customer: true } } },
      }),
    ]);
    return NextResponse.json({ locker, assignment });
  }

  if (action === "release") {
    const { lockerId } = body;
    if (!lockerId) return NextResponse.json({ error: "lockerId requerido" }, { status: 400 });

    const currentAssignment = await prisma.lockerAssignment.findFirst({
      where: {
        lockerId,
        companyId,
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });

    if (!currentAssignment)
      return NextResponse.json({ error: "No hay asignación activa" }, { status: 400 });

    await prisma.$transaction([
      prisma.lockerAssignment.update({
        where: { id: currentAssignment.id },
        data: { endDate: now },
      }),
      prisma.locker.update({
        where: { id: lockerId, companyId },
        data: { status: "AVAILABLE" },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "maintenance") {
    const { lockerId } = body;
    if (!lockerId) return NextResponse.json({ error: "lockerId requerido" }, { status: 400 });

    const locker = await prisma.locker.update({
      where: { id: lockerId, companyId },
      data: { status: "MAINTENANCE" },
    });
    return NextResponse.json(locker);
  }

  if (action === "set_available") {
    const { lockerId } = body;
    if (!lockerId) return NextResponse.json({ error: "lockerId requerido" }, { status: 400 });

    const locker = await prisma.locker.update({
      where: { id: lockerId, companyId },
      data: { status: "AVAILABLE" },
    });
    return NextResponse.json(locker);
  }

  if (action === "update") {
    const { lockerId, number, section } = body;
    if (!lockerId) return NextResponse.json({ error: "lockerId requerido" }, { status: 400 });

    const locker = await prisma.locker.update({
      where: { id: lockerId, companyId },
      data: {
        ...(number != null && { number: String(number) }),
        ...(section !== undefined && { section: section || null }),
      },
    });
    return NextResponse.json(locker);
  }

  return NextResponse.json({ error: "action inválido" }, { status: 400 });
}
