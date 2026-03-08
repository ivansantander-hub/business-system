import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { role } = getUserFromHeaders(request);
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id: Number(id) },
    include: {
      _count: { select: { users: true, products: true, invoices: true } },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  return NextResponse.json(company);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { role } = getUserFromHeaders(request);
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const company = await prisma.company.update({
      where: { id: Number(id) },
      data: {
        name: body.name,
        legalName: body.legalName,
        nit: body.nit,
        address: body.address,
        city: body.city,
        department: body.department,
        phone: body.phone,
        email: body.email,
        taxRegime: body.taxRegime,
        isActive: body.isActive,
      },
    });
    return NextResponse.json(company);
  } catch (error) {
    console.error("Update company error:", error);
    return NextResponse.json({ error: "Error al actualizar empresa" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { role } = getUserFromHeaders(request);
  if (role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await prisma.company.update({
      where: { id: Number(id) },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete company error:", error);
    return NextResponse.json({ error: "Error al desactivar empresa" }, { status: 500 });
  }
}
