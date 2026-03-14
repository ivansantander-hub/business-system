import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders, requireValidCompanyId } from "@/lib/auth";
import { getPermissionsFromDB } from "@/lib/rbac";
import { auditApiRequest } from "@/lib/api-audit";

export async function GET(request: Request) {
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
    if (!perms.includes("products")) {
      return NextResponse.json({ error: "No tienes permiso para ver productos" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId");
  const active = searchParams.get("active");

  const where: Record<string, unknown> = { companyId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (active !== null && active !== "") where.isActive = active === "true";

  const products = await prisma.product.findMany({
    where,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(request: Request) {
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
      return NextResponse.json({ error: "No tienes permiso para crear productos" }, { status: 403 });
    }
  }

  try {
    const body = await request.json();
    const product = await prisma.product.create({
      data: {
        companyId,
        name: body.name,
        description: body.description || null,
        barcode: body.barcode || null,
        categoryId: body.categoryId || null,
        unit: body.unit || "unidad",
        costPrice: Number(body.costPrice) || 0,
        salePrice: Number(body.salePrice) || 0,
        stock: Number(body.stock) || 0,
        minStock: Number(body.minStock) || 5,
      },
      include: { category: true },
    });
    auditApiRequest(request, "product.create", { entity: "Product", entityId: product.id, statusCode: 201, details: { name: product.name, salePrice: Number(product.salePrice) } });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}
