import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const includeMemberships = searchParams.get("include") === "memberships";

  const plans = await prisma.membershipPlan.findMany({
    where: { companyId },
    include: {
      _count: { select: { memberships: true } },
    },
    orderBy: { name: "asc" },
  });

  if (!includeMemberships) {
    return NextResponse.json({ plans });
  }

  const memberships = await prisma.membership.findMany({
    where: { companyId },
    include: {
      member: { include: { customer: true } },
      plan: true,
    },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ plans, memberships });
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const action = body.action;

  if (action === "create-plan") {
    const plan = await prisma.membershipPlan.create({
      data: {
        companyId,
        name: body.name,
        durationDays: Number(body.durationDays),
        price: Number(body.price),
        description: body.description || null,
        features: body.features || null,
      },
    });
    return NextResponse.json(plan, { status: 201 });
  }

  if (action === "update-plan") {
    const existing = await prisma.membershipPlan.findFirst({
      where: { id: body.id, companyId },
    });
    if (!existing) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });

    const plan = await prisma.membershipPlan.update({
      where: { id: body.id },
      data: {
        ...(body.name != null && { name: body.name }),
        ...(body.durationDays != null && { durationDays: Number(body.durationDays) }),
        ...(body.price != null && { price: Number(body.price) }),
        ...(body.description != null && { description: body.description }),
        ...(body.features != null && { features: body.features }),
        ...(body.isActive != null && { isActive: body.isActive }),
      },
    });
    return NextResponse.json(plan);
  }

  if (action === "create-membership") {
    const plan = await prisma.membershipPlan.findFirst({
      where: { id: body.planId, companyId },
    });
    if (!plan) return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });

    const member = await prisma.gymMember.findFirst({
      where: { id: body.memberId, companyId },
    });
    if (!member) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const membership = await prisma.membership.create({
      data: {
        companyId,
        memberId: body.memberId,
        planId: body.planId,
        startDate,
        endDate,
        status: "ACTIVE",
        paymentStatus: body.paymentStatus || "PENDING",
      },
      include: {
        member: { include: { customer: true } },
        plan: true,
      },
    });
    return NextResponse.json(membership, { status: 201 });
  }

  if (action === "renew") {
    const existing = await prisma.membership.findFirst({
      where: { id: body.id, companyId },
      include: { plan: true },
    });
    if (!existing) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + existing.plan.durationDays);

    const membership = await prisma.membership.create({
      data: {
        companyId,
        memberId: existing.memberId,
        planId: existing.planId,
        startDate,
        endDate,
        status: "ACTIVE",
        paymentStatus: body.paymentStatus || "PENDING",
      },
      include: {
        member: { include: { customer: true } },
        plan: true,
      },
    });
    return NextResponse.json(membership, { status: 201 });
  }

  if (action === "update-status") {
    const existing = await prisma.membership.findFirst({
      where: { id: body.id, companyId },
    });
    if (!existing) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    const validStatuses = ["ACTIVE", "SUSPENDED", "FROZEN", "CANCELLED"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    const membership = await prisma.membership.update({
      where: { id: body.id },
      data: { status: body.status },
      include: {
        member: { include: { customer: true } },
        plan: true,
      },
    });
    return NextResponse.json(membership);
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
