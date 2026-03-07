import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id: Number(id) } });
  if (!customer) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const { id } = await params;
  await prisma.customer.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
