import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dayOfWeek = searchParams.get("dayOfWeek");
  const trainerId = searchParams.get("trainerId");
  const date = searchParams.get("date");

  const where: { companyId: string; dayOfWeek?: number; trainerId?: string } = { companyId };

  if (dayOfWeek !== null && dayOfWeek !== undefined && dayOfWeek !== "") {
    const d = Number(dayOfWeek);
    if (d >= 0 && d <= 6) where.dayOfWeek = d;
  }

  if (trainerId) {
    where.trainerId = trainerId;
  }

  const classes = await prisma.gymClass.findMany({
    where,
    include: {
      trainer: { select: { id: true, name: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  if (date) {
    const classDate = new Date(date + "T00:00:00");
    const nextDay = new Date(classDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const enrollmentsForDate = await prisma.classEnrollment.findMany({
      where: {
        companyId,
        classId: { in: classes.map((c) => c.id) },
        date: { gte: classDate, lt: nextDay },
        status: { not: "CANCELLED" },
      },
      include: { member: { include: { customer: { select: { name: true, email: true } } } } },
    });

    const byClass = new Map<string, (typeof enrollmentsForDate)[0][]>();
    for (const e of enrollmentsForDate) {
      const list = byClass.get(e.classId) || [];
      list.push(e);
      byClass.set(e.classId, list);
    }

    const result = classes.map((c) => ({
      ...c,
      enrollmentCountForDate: byClass.get(c.id)?.length ?? 0,
      enrollmentsForDate: byClass.get(c.id) ?? [],
    }));
    return NextResponse.json(result);
  }

  return NextResponse.json(classes);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const dayOfWeek = Number(body.dayOfWeek);
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return NextResponse.json({ error: "dayOfWeek debe ser 0-6" }, { status: 400 });
  }

  const gymClass = await prisma.gymClass.create({
    data: {
      companyId,
      name: body.name,
      description: body.description?.trim() || null,
      trainerId: body.trainerId || null,
      dayOfWeek,
      startTime: body.startTime || "09:00",
      endTime: body.endTime || "10:00",
      maxCapacity: body.maxCapacity ? Number(body.maxCapacity) : 20,
      room: body.room?.trim() || null,
    },
    include: {
      trainer: { select: { id: true, name: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return NextResponse.json(gymClass, { status: 201 });
}

export async function PUT(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const action = body.action;

  if (action === "enroll") {
    const { classId, memberId, date } = body;
    if (!classId || !memberId || !date) {
      return NextResponse.json({ error: "classId, memberId y date requeridos" }, { status: 400 });
    }

    const gymClass = await prisma.gymClass.findFirst({
      where: { id: classId, companyId },
    });
    if (!gymClass) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });

    const member = await prisma.gymMember.findFirst({
      where: { id: memberId, companyId },
    });
    if (!member) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

    const classDate = new Date(date);
    classDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(classDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const enrolledCount = await prisma.classEnrollment.count({
      where: {
        classId,
        companyId,
        date: { gte: classDate, lt: nextDay },
        status: { not: "CANCELLED" },
      },
    });

    if (enrolledCount >= gymClass.maxCapacity) {
      return NextResponse.json({ error: "Capacidad máxima alcanzada para esta fecha" }, { status: 400 });
    }

    const existing = await prisma.classEnrollment.findFirst({
      where: {
        classId,
        memberId,
        companyId,
        date: { gte: classDate, lt: nextDay },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Ya inscrito en esta clase" }, { status: 400 });
    }

    const enrollment = await prisma.classEnrollment.create({
      data: {
        companyId,
        classId,
        memberId,
        date: classDate,
        status: "ENROLLED",
      },
      include: {
        member: { include: { customer: { select: { name: true, email: true } } } },
      },
    });

    return NextResponse.json(enrollment, { status: 201 });
  }

  if (action === "attendance") {
    const { enrollmentId, status: enrollmentStatus } = body;
    if (!enrollmentId || !enrollmentStatus) {
      return NextResponse.json({ error: "enrollmentId y status requeridos" }, { status: 400 });
    }
    if (enrollmentStatus !== "ATTENDED" && enrollmentStatus !== "ABSENT") {
      return NextResponse.json({ error: "status debe ser ATTENDED o ABSENT" }, { status: 400 });
    }

    const existing = await prisma.classEnrollment.findFirst({
      where: { id: enrollmentId, companyId },
    });
    if (!existing) return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });

    const enrollment = await prisma.classEnrollment.update({
      where: { id: enrollmentId },
      data: { status: enrollmentStatus },
      include: {
        member: { include: { customer: { select: { name: true } } } },
      },
    });

    return NextResponse.json(enrollment);
  }

  if (action === "update-class") {
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const existing = await prisma.gymClass.findFirst({
      where: { id, companyId },
    });
    if (!existing) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description?.trim() || null;
    if (updates.trainerId !== undefined) data.trainerId = updates.trainerId || null;
    if (updates.dayOfWeek !== undefined) {
      const d = Number(updates.dayOfWeek);
      if (d >= 0 && d <= 6) data.dayOfWeek = d;
    }
    if (updates.startTime !== undefined) data.startTime = updates.startTime;
    if (updates.endTime !== undefined) data.endTime = updates.endTime;
    if (updates.maxCapacity !== undefined) data.maxCapacity = Number(updates.maxCapacity);
    if (updates.room !== undefined) data.room = updates.room?.trim() || null;
    if (updates.isActive !== undefined) data.isActive = Boolean(updates.isActive);

    const gymClass = await prisma.gymClass.update({
      where: { id },
      data,
      include: {
        trainer: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    });

    return NextResponse.json(gymClass);
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
