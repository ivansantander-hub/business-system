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
    const assignments = await prisma.userCompany.findMany({
      where: { companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true, createdAt: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    });
    const users = assignments.map((a) => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email,
      role: a.role,
      isActive: a.user.isActive,
      createdAt: a.user.createdAt,
      companies: [{ id: a.companyId, role: a.role }],
    }));
    return NextResponse.json(users);
  }

  const { searchParams } = new URL(request.url);
  const qsCompanyId = searchParams.get("companyId");

  if (qsCompanyId) {
    const assignments = await prisma.userCompany.findMany({
      where: { companyId: Number(qsCompanyId) },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    });
    const users = assignments.map((a) => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email,
      role: a.role,
      globalRole: a.user.role,
      isActive: a.user.isActive,
      createdAt: a.user.createdAt,
    }));
    return NextResponse.json(users);
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      companies: {
        include: { company: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt,
      companies: u.companies.map((uc) => ({
        id: uc.company.id,
        name: uc.company.name,
        role: uc.role,
      })),
    }))
  );
}

export async function POST(request: Request) {
  const { role, companyId } = getUserFromHeaders(request);
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const body = await request.json();
  const hashedPassword = await bcrypt.hash(body.password, 10);

  try {
    if (role === "ADMIN") {
      if (companyId === null) {
        return NextResponse.json({ error: "Company context required" }, { status: 403 });
      }
      const user = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          password: hashedPassword,
          role: body.role || "CASHIER",
          companies: {
            create: { companyId, role: body.role || "CASHIER" },
          },
        },
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      });
      return NextResponse.json(user, { status: 201 });
    }

    // SUPER_ADMIN: companyIds is an array of { companyId, role }
    const companyAssignments: { companyId: number; role: string }[] = body.companyAssignments || [];

    if (companyAssignments.length === 0 && body.companyId) {
      companyAssignments.push({
        companyId: Number(body.companyId),
        role: body.role || "CASHIER",
      });
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: body.role || "CASHIER",
        companies: {
          create: companyAssignments.map((ca) => ({
            companyId: ca.companyId,
            role: (ca.role as "ADMIN" | "CASHIER" | "WAITER" | "ACCOUNTANT" | "TRAINER") || "CASHIER",
          })),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        companies: {
          include: { company: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json(
      {
        ...user,
        companies: user.companies.map((uc) => ({
          id: uc.company.id,
          name: uc.company.name,
          role: uc.role,
        })),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "El email ya está registrado" }, { status: 400 });
  }
}
