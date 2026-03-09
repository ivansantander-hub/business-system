import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId) {
    return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  }

  const branches = await prisma.branch.findMany({
    where: { companyId },
    include: {
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });

  const result = branches.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.city,
    phone: b.phone,
    isActive: b.isActive,
    createdAt: b.createdAt,
    userCount: b._count.users,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId) {
    return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  }
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Solo administradores pueden crear sucursales" }, { status: 403 });
  }

  const body = await request.json();
  const branch = await prisma.branch.create({
    data: {
      companyId,
      name: body.name,
      address: body.address || null,
      city: body.city || null,
      phone: body.phone || null,
    },
  });
  return NextResponse.json(branch, { status: 201 });
}
