import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { createSale } from "@/lib/sale";

export async function GET(request: Request) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = { companyId };
  if (status) where.status = status;
  if (from || to) {
    where.date = {};
    if (from) (where.date as Record<string, unknown>).gte = new Date(from);
    if (to) (where.date as Record<string, unknown>).lte = new Date(to + "T23:59:59");
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      customer: { select: { name: true, nit: true } },
      user: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(invoices);
}

export async function POST(request: Request) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  try {
    const body = await request.json();

    const result = await createSale({
      companyId,
      userId,
      items: body.items,
      paymentMethod: body.paymentMethod || "CASH",
      paidAmount: body.paidAmount ? Number(body.paidAmount) : undefined,
      discount: body.discount ? Number(body.discount) : 0,
      customerId: body.customerId ? Number(body.customerId) : null,
      orderId: body.orderId ? Number(body.orderId) : null,
      notes: body.notes || null,
    });

    return NextResponse.json(result.invoice, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_CASH_SESSION") {
      return NextResponse.json({ error: "Debe abrir una caja antes de realizar ventas" }, { status: 400 });
    }
    console.error("Create invoice error:", error);
    return NextResponse.json({ error: "Error al crear factura" }, { status: 500 });
  }
}
