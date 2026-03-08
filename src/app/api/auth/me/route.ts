import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { getPermissions } from "@/lib/rbac";

export async function GET(request: Request) {
  const { userId, companyId, role } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companies: {
        include: { company: { select: { id: true, name: true, isActive: true } } },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const activeCompanies = user.companies.filter((uc) => uc.company.isActive);
  const activeAssignment = activeCompanies.find((uc) => uc.companyId === companyId);

  const effectiveRole = role || user.role;

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: effectiveRole,
    companyId,
    companyName: activeAssignment?.company.name || null,
    permissions: getPermissions(effectiveRole),
    companies: activeCompanies.map((uc) => ({
      id: uc.company.id,
      name: uc.company.name,
      role: uc.role,
    })),
  });
}
