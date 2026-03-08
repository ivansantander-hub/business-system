import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { generateInvoicePdf } from "@/lib/pdf";
import { uploadToR2, getBufferFromR2, purchasePdfKey, isR2Configured } from "@/lib/r2";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId } = getUserFromHeaders(_req);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;

  const purchase = await prisma.purchase.findFirst({
    where: { id, companyId },
    include: {
      supplier: true,
      user: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!purchase) return NextResponse.json({ error: "Compra no encontrada" }, { status: 404 });

  const r2Key = purchasePdfKey(companyId, purchase.number);

  if (isR2Configured()) {
    const existing = await getBufferFromR2(r2Key);
    if (existing) {
      return new Response(existing.buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${purchase.number}.pdf"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  const pdfBytes = await generateInvoicePdf({
    invoiceNumber: purchase.number,
    date: new Date(purchase.date).toLocaleDateString("es-CO"),
    companyName: company.name,
    companyNit: company.nit,
    companyAddress: company.address,
    companyPhone: company.phone,
    companyEmail: company.email,
    supplierName: purchase.supplier?.name,
    supplierNit: purchase.supplier?.nit,
    paymentMethod: "CREDIT",
    items: purchase.items.map((i) => ({
      name: i.product?.name || "Producto",
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    subtotal: Number(purchase.subtotal),
    taxRate: 0.19,
    tax: Number(purchase.tax),
    discount: 0,
    total: Number(purchase.total),
    paidAmount: Number(purchase.total),
    changeAmount: 0,
    notes: purchase.notes,
    type: "purchase",
  });

  if (isR2Configured()) {
    uploadToR2(r2Key, Buffer.from(pdfBytes), "application/pdf").catch((err) =>
      console.error("R2 upload error (purchase PDF):", err)
    );
  }

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${purchase.number}.pdf"`,
    },
  });
}
