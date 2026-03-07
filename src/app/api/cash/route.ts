import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const { userId } = getUserFromHeaders(request);

  if (action === "current") {
    const session = await prisma.cashSession.findFirst({
      where: { userId, status: "OPEN" },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json(session);
  }

  // List sessions
  const sessions = await prisma.cashSession.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { openedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  const { userId } = getUserFromHeaders(request);
  const body = await request.json();

  if (body.action === "open") {
    const existing = await prisma.cashSession.findFirst({
      where: { userId, status: "OPEN" },
    });
    if (existing) {
      return NextResponse.json({ error: "Ya tiene una caja abierta" }, { status: 400 });
    }

    const session = await prisma.cashSession.create({
      data: {
        userId,
        openingAmount: Number(body.openingAmount) || 0,
      },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json(session, { status: 201 });
  }

  if (body.action === "close") {
    const session = await prisma.cashSession.findFirst({
      where: { userId, status: "OPEN" },
    });
    if (!session) {
      return NextResponse.json({ error: "No tiene caja abierta" }, { status: 400 });
    }

    const expectedAmount = Number(session.openingAmount) + Number(session.salesTotal);
    const closingAmount = Number(body.closingAmount) || 0;
    const difference = closingAmount - expectedAmount;

    const updated = await prisma.cashSession.update({
      where: { id: session.id },
      data: {
        closingAmount,
        expectedAmount,
        difference,
        closedAt: new Date(),
        status: "CLOSED",
      },
      include: { user: { select: { name: true } } },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
