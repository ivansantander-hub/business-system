import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { createSale } from "@/lib/sale";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const memberId = searchParams.get("memberId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { companyId };

  if (!from && !to) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    where.date = { gte: startOfDay, lte: endOfDay };
  } else {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.date = dateFilter;
  }

  if (memberId) where.memberId = memberId;
  if (status) where.status = status;

  const dayPasses = await prisma.dayPass.findMany({
    where,
    include: {
      member: {
        include: {
          customer: { select: { id: true, name: true, email: true, nit: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(dayPasses);
}

export async function POST(request: Request) {
  const { companyId, userId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { guestName, price, totalEntries } = body;
  let resolvedMemberId: string | null = body.memberId ? body.memberId : null;
  let resolvedCustomerId: string | null = null;

  if (body.customerId && !resolvedMemberId) {
    const customerId = body.customerId;
    resolvedCustomerId = customerId;
    let gymMember = await prisma.gymMember.findFirst({
      where: { companyId, customerId },
    });
    if (!gymMember) {
      gymMember = await prisma.gymMember.create({
        data: { companyId, customerId },
      });
    }
    resolvedMemberId = gymMember.id;
  }

  if (!resolvedMemberId && !guestName) {
    return NextResponse.json({ error: "Se requiere un cliente o nombre de invitado" }, { status: 400 });
  }

  if (resolvedMemberId) {
    const member = await prisma.gymMember.findFirst({
      where: { id: resolvedMemberId, companyId },
      include: { customer: { select: { id: true } } },
    });
    if (!member) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }
    if (!resolvedCustomerId) resolvedCustomerId = member.customerId;
  }

  const entries = Number(totalEntries) || 1;
  const salePrice = Number(price) || 0;

  try {
    const saleResult = await createSale({
      companyId,
      userId,
      items: [{ productName: `Tiquetera ${entries} entradas`, quantity: 1, unitPrice: salePrice }],
      paymentMethod: body.paymentMethod || "CASH",
      paidAmount: body.paidAmount ? Number(body.paidAmount) : undefined,
      customerId: resolvedCustomerId,
    });

    const dayPass = await prisma.dayPass.create({
      data: {
        companyId,
        memberId: resolvedMemberId,
        guestName: guestName || null,
        price: salePrice,
        totalEntries: entries,
        usedEntries: 0,
        status: "ACTIVE",
        invoiceId: saleResult.invoice.id,
      },
      include: {
        member: {
          include: {
            customer: { select: { id: true, name: true, email: true, nit: true } },
          },
        },
      },
    });

    return NextResponse.json(dayPass, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CASH_SESSION") {
      return NextResponse.json({ error: "Debe abrir una caja antes de vender tiqueteras" }, { status: 400 });
    }
    console.error("Create day pass error:", error);
    return NextResponse.json({ error: "Error al crear tiquetera" }, { status: 500 });
  }
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
    where: { id, companyId },
  });

  if (!dayPass) {
    return NextResponse.json({ error: "Pase no encontrado" }, { status: 404 });
  }

  if (action === "use-entry") {
    if (dayPass.status !== "ACTIVE") {
      return NextResponse.json({ error: "La tiquetera no está activa" }, { status: 400 });
    }
    const newUsed = dayPass.usedEntries + 1;
    const newStatus = newUsed >= dayPass.totalEntries ? "USED" : "ACTIVE";
    const updated = await prisma.dayPass.update({
      where: { id },
      data: { usedEntries: newUsed, status: newStatus },
    });
    return NextResponse.json({
      success: true,
      remaining: updated.totalEntries - updated.usedEntries,
      status: updated.status,
    });
  }

  if (action === "expire") {
    await prisma.dayPass.update({
      where: { id },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ success: true, status: "EXPIRED" });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
