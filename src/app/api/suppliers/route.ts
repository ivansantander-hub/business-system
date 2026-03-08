import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = { isActive: true, companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { nit: { contains: search, mode: "insensitive" } },
    ];
  }

  const suppliers = await prisma.supplier.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json(suppliers);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const supplier = await prisma.supplier.create({
    data: {
      companyId,
      name: body.name,
      nit: body.nit || null,
      contactName: body.contactName || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
    },
  });
  return NextResponse.json(supplier, { status: 201 });
}
