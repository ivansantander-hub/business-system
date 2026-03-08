import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { auditLogger, extractRequestMeta } from "@/lib/audit-logger";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        companies: {
          include: { company: { select: { id: true, name: true, isActive: true } } },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    let activeCompanyId: string | null = null;
    let activeRole = user.role as string;
    let activeCompanyName: string | null = null;

    if (user.role !== "SUPER_ADMIN") {
      const activeAssignments = user.companies.filter((uc) => uc.company.isActive);
      if (activeAssignments.length === 0) {
        return NextResponse.json({ error: "No tiene empresas activas asignadas. Contacte al administrador." }, { status: 403 });
      }
      activeCompanyId = activeAssignments[0].companyId;
      activeRole = activeAssignments[0].role;
      activeCompanyName = activeAssignments[0].company.name;
    }

    const token = await signToken({
      userId: user.id,
      role: activeRole,
      name: user.name,
      companyId: activeCompanyId,
    });

    const companiesList = user.companies
      .filter((uc) => uc.company.isActive)
      .map((uc) => ({
        id: uc.company.id,
        name: uc.company.name,
        role: uc.role,
      }));

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: activeRole,
        companyId: activeCompanyId,
        companyName: activeCompanyName,
        companies: companiesList,
      },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    const { ipAddress, userAgent } = extractRequestMeta(request);
    auditLogger.info("auth.login", { userId: user.id, userName: user.name, companyId: activeCompanyId, entity: "User", entityId: user.id, ipAddress, userAgent, path: "/api/auth/login", method: "POST" });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
