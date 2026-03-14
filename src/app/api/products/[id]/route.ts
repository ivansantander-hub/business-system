import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireValidCompanyId } from "@/lib/auth";
import { getPermissionsFromDB } from "@/lib/rbac";
import { auditApiRequest, serializeEntity } from "@/lib/api-audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { role } = getUserFromHeaders(_req);
  let companyId: string;
  try {
    companyId = await requireValidCompanyId(_req);
  } catch (e) {
    const isNotFound = e instanceof Error && e.message === "Company not found";
    return NextResponse.json(
      { error: isNotFound ? "Empresa no encontrada" : "Se requiere contexto de empresa" },
      { status: isNotFound ? 404 : 403 }
    );
  }
  if (role !== "SUPER_ADMIN") {
    const perms = await getPermissionsFromDB(companyId, role);
    if (!perms.includes("products")) {
      return NextResponse.json({ error: "No tienes permiso para ver productos" }, { status: 403 });
    }
  }

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, companyId },
    include: { category: true },
  });
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { role } = getUserFromHeaders(request);
  let companyId: string;
  try {
    companyId = await requireValidCompanyId(request);
  } catch (e) {
    const isNotFound = e instanceof Error && e.message === "Company not found";
    return NextResponse.json(
      { error: isNotFound ? "Empresa no encontrada" : "Se requiere contexto de empresa" },
      { status: isNotFound ? 404 : 403 }
    );
  }
  if (role !== "SUPER_ADMIN") {
    const perms = await getPermissionsFromDB(companyId, role);
    if (!perms.includes("inventory")) {
      return NextResponse.json({ error: "No tienes permiso para editar productos" }, { status: 403 });
    }
  }

  const { id } = await params;
  const existing = await prisma.product.findFirst({
    where: { id, companyId },
    include: { category: true },
  });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const beforeState = serializeEntity(existing as unknown as Record<string, unknown>);

  try {
    const body = await request.json();
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        barcode: body.barcode || null,
        categoryId: body.categoryId || null,
        unit: body.unit,
        costPrice: Number(body.costPrice),
        salePrice: Number(body.salePrice),
        stock: Number(body.stock),
        minStock: Number(body.minStock),
        isActive: body.isActive ?? true,
      },
      include: { category: true },
    });
    const afterState = serializeEntity(product as unknown as Record<string, unknown>);

    auditApiRequest(request, "product.update", {
      entity: "Product",
      entityId: id,
      statusCode: 200,
      details: { name: product.name },
      beforeState,
      afterState,
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { role } = getUserFromHeaders(_req);
  let companyId: string;
  try {
    companyId = await requireValidCompanyId(_req);
  } catch (e) {
    const isNotFound = e instanceof Error && e.message === "Company not found";
    return NextResponse.json(
      { error: isNotFound ? "Empresa no encontrada" : "Se requiere contexto de empresa" },
      { status: isNotFound ? 404 : 403 }
    );
  }
  if (role !== "SUPER_ADMIN") {
    const perms = await getPermissionsFromDB(companyId, role);
    if (!perms.includes("inventory")) {
      return NextResponse.json({ error: "No tienes permiso para eliminar productos" }, { status: 403 });
    }
  }

  const { id } = await params;
  const existing = await prisma.product.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const beforeState = serializeEntity(existing as unknown as Record<string, unknown>);

  await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  auditApiRequest(_req, "product.delete", {
    entity: "Product",
    entityId: id,
    details: { name: existing.name },
    beforeState,
    afterState: { ...beforeState, isActive: false },
  });
  return NextResponse.json({ ok: true });
}
