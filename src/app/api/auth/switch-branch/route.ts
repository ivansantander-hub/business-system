import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, signToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { userId, role, name, companyId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { branchId } = await request.json();

  if (branchId === undefined) {
    return NextResponse.json({ error: "branchId requerido (puede ser null)" }, { status: 400 });
  }

  let branchIdToUse: string | null = null;
  if (branchId) {
    const assignment = await prisma.userBranch.findUnique({
      where: { userId_branchId: { userId, branchId } },
      include: {
        branch: { select: { id: true, name: true, isActive: true, companyId: true } },
      },
    });

    if (!assignment || !assignment.branch.isActive || assignment.branch.companyId !== companyId) {
      return NextResponse.json({ error: "No tiene acceso a esta sucursal" }, { status: 403 });
    }
    branchIdToUse = assignment.branchId;
  }

  const token = await signToken({
    userId,
    role,
    name,
    companyId,
    branchId: branchIdToUse,
  });

  const response = NextResponse.json({ ok: true });

  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
