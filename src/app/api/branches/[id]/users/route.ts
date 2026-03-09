import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { companyId } = getUserFromHeaders(_request);
  if (!companyId) {
    return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  }

  const { id } = await params;
  const branch = await prisma.branch.findFirst({
    where: { id, companyId },
    include: {
      users: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!branch) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const users = branch.users.map((ub) => ({
    id: ub.user.id,
    name: ub.user.name,
    email: ub.user.email,
  }));

  return NextResponse.json(users);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) {
    return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  }

  const { id } = await params;
  const branch = await prisma.branch.findFirst({
    where: { id, companyId },
  });
  if (!branch) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : [];

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const companyUserIds = await prisma.userCompany.findMany({
    where: { companyId },
    select: { userId: true },
  });
  const validUserIds = new Set(companyUserIds.map((uc) => uc.userId));

  const toCreate = userIds.filter((uid) => validUserIds.has(uid));

  await prisma.userBranch.createMany({
    data: toCreate.map((userId) => ({ userId, branchId: id })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) {
    return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  }

  const { id } = await params;
  const branch = await prisma.branch.findFirst({
    where: { id, companyId },
  });
  if (!branch) {
    return NextResponse.json({ error: "Sucursal no encontrada" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = body.userId ?? new URL(request.url).searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
  }

  await prisma.userBranch.deleteMany({
    where: { branchId: id, userId },
  });

  return NextResponse.json({ ok: true });
}
