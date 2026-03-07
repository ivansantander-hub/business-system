import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supplier = await prisma.supplier.update({
    where: { id: Number(id) },
    data: {
      name: body.name,
      nit: body.nit,
      contactName: body.contactName,
      phone: body.phone,
      email: body.email,
      address: body.address,
    },
  });
  return NextResponse.json(supplier);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.supplier.update({ where: { id: Number(id) }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
