import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const memberId = searchParams.get("memberId");
  const status = searchParams.get("status");

  const now = new Date();
  let startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  if (from) startOfDay = new Date(from);
  if (to) {
    endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
  }

  const where: Record<string, unknown> = {
    companyId,
    date: { gte: startOfDay, lte: endOfDay },
  };
  if (memberId) where.memberId = Number(memberId);
  if (status) where.status = status;

  const dayPasses = await prisma.dayPass.findMany({
    where,
    include: {
      member: {
        include: {
          customer: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(dayPasses);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { memberId, guestName, price } = body;

  if (!memberId && !guestName) {
    return NextResponse.json(
      { error: "Se requiere memberId o guestName" },
      { status: 400 }
    );
  }

  if (memberId) {
    const member = await prisma.gymMember.findFirst({
      where: { id: Number(memberId), companyId },
    });
    if (!member) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }
  }

  const dayPass = await prisma.dayPass.create({
    data: {
      companyId,
      memberId: memberId ? Number(memberId) : null,
      guestName: guestName || null,
      price: Number(price) || 0,
      status: "ACTIVE",
    },
    include: {
      member: {
        include: {
          customer: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json(dayPass, { status: 201 });
}

export async function PUT(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { id, action } = body;

  if (!id || !action) {
    return NextResponse.json({ error: "id y action son requeridos" }, { status: 400 });
  }

  const dayPass = await prisma.dayPass.findFirst({
    where: { id: Number(id), companyId },
  });

  if (!dayPass) {
    return NextResponse.json({ error: "Pase no encontrado" }, { status: 404 });
  }

  if (action === "use") {
    await prisma.dayPass.update({
      where: { id: Number(id) },
      data: { status: "USED" },
    });
    return NextResponse.json({ success: true, status: "USED" });
  }

  if (action === "expire") {
    await prisma.dayPass.update({
      where: { id: Number(id) },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ success: true, status: "EXPIRED" });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
