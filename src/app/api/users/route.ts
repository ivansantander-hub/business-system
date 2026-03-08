import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { auditApiRequest } from "@/lib/api-audit";
import { sendNotification, EMAIL_EVENTS, emailUserCreated } from "@/lib/email";

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
      where: { companyId: qsCompanyId },
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

      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
      sendNotification(companyId, EMAIL_EVENTS.USER_CREATED,
        emailUserCreated(body.name, body.email, body.password, company?.name || "SGC"),
        user.id
      ).catch(() => {});

      auditApiRequest(request, "user.create", { entity: "User", entityId: user.id, statusCode: 201, details: { name: user.name, email: user.email } });
      return NextResponse.json(user, { status: 201 });
    }

    // SUPER_ADMIN: companyIds is an array of { companyId, role }
    const companyAssignments: { companyId: string; role: string }[] = body.companyAssignments || [];

    if (companyAssignments.length === 0 && body.companyId) {
      companyAssignments.push({
        companyId: body.companyId,
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

    if (companyAssignments.length > 0) {
      const firstCompanyId = companyAssignments[0].companyId;
      const company = await prisma.company.findUnique({ where: { id: firstCompanyId }, select: { name: true } });
      sendNotification(firstCompanyId, EMAIL_EVENTS.USER_CREATED,
        emailUserCreated(body.name, body.email, body.password, company?.name || "SGC"),
        user.id
      ).catch(() => {});
    }

    auditApiRequest(request, "user.create", { entity: "User", entityId: user.id, statusCode: 201, details: { name: user.name, email: user.email } });
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
