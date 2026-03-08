import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id: Number(id), companyId },
    include: {
      customer: true,
      user: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
      order: { select: { id: true, type: true, table: { select: { number: true } } } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (body.status === "CANCELLED") {
    const invoice = await prisma.invoice.findFirst({
      where: { id: Number(id), companyId },
      include: { items: true },
    });

    if (!invoice || invoice.status === "CANCELLED") {
      return NextResponse.json({ error: "No se puede anular" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of invoice.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: Number(item.quantity) } },
          });
        }
      }

      await tx.invoice.update({
        where: { id: Number(id) },
        data: { status: "CANCELLED" },
      });
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
