import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { getPermissionsFromDB } from "@/lib/rbac";

export async function GET(request: Request) {
  const { userId, companyId, role, branchId } = getUserFromHeaders(request);
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
      avatarUrl: true,
      companies: {
        include: { company: { select: { id: true, name: true, isActive: true, type: true, logoUrl: true } } },
      },
      userBranches: companyId
        ? {
            where: { branch: { companyId, isActive: true } },
            include: { branch: { select: { id: true, name: true, address: true, city: true, phone: true, isActive: true } } },
          }
        : false,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const activeCompanies = user.companies.filter((uc) => uc.company.isActive);
  const activeAssignment = activeCompanies.find((uc) => uc.companyId === companyId);
  const companyType = activeAssignment?.company.type || null;

  const effectiveRole = role || user.role;

  const permissions = companyId
    ? await getPermissionsFromDB(companyId, effectiveRole, companyType)
    : (await import("@/lib/rbac")).getPermissions(effectiveRole, companyType);

  const rawBranches = (user.userBranches ?? []) as unknown as Array<{
    id: string;
    branchId: string;
    branch: { id: string; name: string; address: string | null; city: string | null; phone: string | null; isActive: boolean };
  }>;
  const branches = rawBranches.map((ub) => ({
    id: ub.branch.id,
    name: ub.branch.name,
    address: ub.branch.address,
    city: ub.branch.city,
    phone: ub.branch.phone,
    isActive: ub.branch.isActive,
  }));

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: effectiveRole,
    avatarUrl: user.avatarUrl ? `/api/profile/avatar?t=${Date.now()}` : null,
    companyId,
    companyName: activeAssignment?.company.name || null,
    companyType,
    companyLogoUrl: activeAssignment?.company.logoUrl ? "/api/company/logo" : null,
    branchId: branchId || null,
    permissions,
    companies: activeCompanies.map((uc) => ({
      id: uc.company.id,
      name: uc.company.name,
      role: uc.role,
      type: uc.company.type,
    })),
    branches,
  });
}
