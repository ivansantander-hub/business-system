import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id: Number(id), companyId },
  });
  if (!customer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.customer.findFirst({ where: { id: Number(id), companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await request.json();
  const customer = await prisma.customer.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      nit: body.nit,
      phone: body.phone,
      email: body.email,
      address: body.address,
      creditLimit: Number(body.creditLimit) || 0,
    },
  });
  return NextResponse.json(customer);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.customer.findFirst({ where: { id: Number(id), companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.customer.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
