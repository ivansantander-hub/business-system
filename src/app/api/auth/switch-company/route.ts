import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, signToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { userId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { companyId } = await request.json();
  if (!companyId) {
    return NextResponse.json({ error: "companyId requerido" }, { status: 400 });
  }

  const assignment = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    include: {
      company: { select: { id: true, name: true, isActive: true } },
      user: { select: { name: true } },
    },
  });

  if (!assignment || !assignment.company.isActive) {
    return NextResponse.json({ error: "No tiene acceso a esta empresa" }, { status: 403 });
  }

  const firstBranch = await prisma.userBranch.findFirst({
    where: { userId, branch: { companyId, isActive: true } },
    include: { branch: { select: { id: true } } },
    orderBy: { branch: { createdAt: "asc" } },
  });
  let activeBranchId = firstBranch?.branch.id ?? null;
  if (!activeBranchId) {
    const defaultBranch = await prisma.branch.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    activeBranchId = defaultBranch?.id ?? null;
  }

  const token = await signToken({
    userId,
    role: assignment.role,
    name: assignment.user.name,
    companyId: assignment.companyId,
    branchId: activeBranchId,
  });

  const response = NextResponse.json({
    companyId: assignment.companyId,
    companyName: assignment.company.name,
    role: assignment.role,
  });

  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
