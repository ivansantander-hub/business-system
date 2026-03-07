import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(id) },
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
  const { id } = await params;
  const body = await request.json();

  if (body.status === "CANCELLED") {
    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });

    if (!invoice || invoice.status === "CANCELLED") {
      return NextResponse.json({ error: "No se puede anular" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Restore stock
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
