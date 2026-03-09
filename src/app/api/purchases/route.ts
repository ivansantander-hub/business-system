import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { sendNotification, EMAIL_EVENTS, emailPurchaseCreated } from "@/lib/email";
import { auditApiRequest } from "@/lib/api-audit";
import { generateAndUploadPurchasePdf } from "@/lib/pdf-worker";

export async function GET(request: Request) {
  const { companyId, branchId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const where: Record<string, unknown> = { companyId };
  if (branchId) where.branchId = branchId;

  const purchases = await prisma.purchase.findMany({
    where,
    include: {
      supplier: { select: { name: true } },
      user: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(purchases);
}

export async function POST(request: Request) {
  const { userId, companyId, branchId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  if (!branchId) return NextResponse.json({ error: "Debe seleccionar una sucursal" }, { status: 400 });

  const body = await request.json();

  const count = await prisma.purchase.count({ where: { companyId } });
  const number = `OC-${String(count + 1).padStart(6, "0")}`;

  let subtotal = 0;
  const itemsData = body.items.map((item: { productId: number; quantity: number; unitPrice: number }) => {
    const total = Number(item.quantity) * Number(item.unitPrice);
    subtotal += total;
    return {
      productId: item.productId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total,
    };
  });

  const taxRate = 0.19;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const purchase = await prisma.purchase.create({
    data: {
      companyId,
      branchId,
      supplierId: body.supplierId,
      userId,
      number,
      date: new Date(),
      subtotal,
      tax,
      total,
      notes: body.notes || null,
      items: { create: itemsData },
    },
    include: {
      supplier: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (user?.email) {
    sendNotification(companyId, EMAIL_EVENTS.PURCHASE_CREATED,
      emailPurchaseCreated(user.email, user.name, number, purchase.supplier?.name || "", total, company?.name || "SGC"),
      userId,
    ).catch(() => {});
  }

  generateAndUploadPurchasePdf(purchase.id, companyId).catch(() => {});

  auditApiRequest(request, "purchase.create", { entity: "Purchase", entityId: purchase.id, statusCode: 201, details: { number: purchase.number, total: Number(purchase.total) } });
  return NextResponse.json(purchase, { status: 201 });
}
