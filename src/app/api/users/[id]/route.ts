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
    const assignment = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
  }

  const body = await request.json();

  const data: Record<string, unknown> = {
    name: body.name,
    email: body.email,
    isActive: body.isActive,
  };

  if (body.password) {
    data.password = await bcrypt.hash(body.password, 10);
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    if (role === "SUPER_ADMIN" && body.companyAssignments) {
      await prisma.userCompany.deleteMany({ where: { userId } });
      const assignments: { companyId: number; role: string }[] = body.companyAssignments;
      if (assignments.length > 0) {
        await prisma.userCompany.createMany({
          data: assignments.map((a) => ({
            userId,
            companyId: a.companyId,
            role: a.role as "ADMIN" | "CASHIER" | "WAITER" | "ACCOUNTANT",
          })),
        });
      }
    }

    if (role === "ADMIN" && companyId && body.role) {
      await prisma.userCompany.update({
        where: { userId_companyId: { userId, companyId } },
        data: { role: body.role },
      });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
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
    const assignment = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
