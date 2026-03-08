import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { role, companyId } = getUserFromHeaders(request);
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);

  if (role === "ADMIN") {
    if (companyId === null) {
      return NextResponse.json({ error: "Company context required" }, { status: 403 });
    }
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!targetUser || targetUser.companyId !== companyId) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
  }

  const body = await request.json();

  const data: Record<string, unknown> = {
    name: body.name,
    email: body.email,
    role: body.role,
    isActive: body.isActive,
  };

  if (body.password) {
    data.password = await bcrypt.hash(body.password, 10);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json(user);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { role, companyId } = getUserFromHeaders(request);
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);

  if (role === "ADMIN") {
    if (companyId === null) {
      return NextResponse.json({ error: "Company context required" }, { status: 403 });
    }
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!targetUser || targetUser.companyId !== companyId) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
