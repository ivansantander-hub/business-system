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
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const customers = await prisma.customer.findMany({ where, orderBy: { name: "asc" } });
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const customer = await prisma.customer.create({
    data: {
      companyId,
      name: body.name,
      nit: body.nit || null,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      creditLimit: Number(body.creditLimit) || 0,
    },
  });
  return NextResponse.json(customer, { status: 201 });
}
