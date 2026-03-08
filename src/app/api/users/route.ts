import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  const { role, companyId } = getUserFromHeaders(request);
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  if (role === "ADMIN") {
    if (companyId === null) {
      return NextResponse.json({ error: "Company context required" }, { status: 403 });
    }
    const users = await prisma.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  }

  // SUPER_ADMIN: show all users or filter by ?companyId=X
  const { searchParams } = new URL(request.url);
  const qsCompanyId = searchParams.get("companyId");
  const where = qsCompanyId ? { companyId: Number(qsCompanyId) } : {};

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, companyId: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const { role, companyId } = getUserFromHeaders(request);
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const body = await request.json();

  let targetCompanyId: number;

  if (role === "ADMIN") {
    if (companyId === null) {
      return NextResponse.json({ error: "Company context required" }, { status: 403 });
    }
    targetCompanyId = companyId;
  } else {
    // SUPER_ADMIN: companyId must be provided in body
    if (body.companyId == null || body.companyId === "") {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }
    targetCompanyId = Number(body.companyId);
  }

  const hashedPassword = await bcrypt.hash(body.password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        companyId: targetCompanyId,
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: body.role || "CASHIER",
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 });
  }
}
