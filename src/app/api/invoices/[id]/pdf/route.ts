import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { generateInvoicePdf } from "@/lib/pdf";
import { uploadToR2, getBufferFromR2, invoicePdfKey, isR2Configured } from "@/lib/r2";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId, userId } = getUserFromHeaders(_req);
  if (!companyId && !userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;

  let invoice = await prisma.invoice.findFirst({
    where: { id, ...(companyId ? { companyId } : {}) },
    include: {
      customer: true,
      user: { select: { name: true } },
      items: true,
    },
  });

  if (!invoice && companyId) {
    invoice = await prisma.invoice.findFirst({
      where: { id },
      include: {
        customer: true,
        user: { select: { name: true } },
        items: true,
      },
    });
    if (invoice && userId) {
      const hasAccess = await prisma.userCompany.findFirst({
        where: { userId, companyId: invoice.companyId },
      });
      if (!hasAccess) invoice = null;
    }
  }

  if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  const effectiveCompanyId = invoice.companyId;
  const r2Key = invoicePdfKey(effectiveCompanyId, invoice.number);

  if (isR2Configured()) {
    const existing = await getBufferFromR2(r2Key);
    if (existing) {
      return new Response(existing.buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const company = await prisma.company.findUnique({ where: { id: effectiveCompanyId } });
  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  const pdfBytes = await generateInvoicePdf({
    invoiceNumber: invoice.number,
    date: new Date(invoice.date).toLocaleDateString("es-CO"),
    companyName: company.name,
    companyNit: company.nit,
    companyAddress: company.address,
    companyPhone: company.phone,
    companyEmail: company.email,
    customerName: invoice.customer?.name,
    customerNit: invoice.customer?.nit,
    customerAddress: invoice.customer?.address,
    paymentMethod: invoice.paymentMethod,
    items: invoice.items.map((i) => ({
      name: i.productName,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate),
    tax: Number(invoice.tax),
    discount: Number(invoice.discount),
    total: Number(invoice.total),
    paidAmount: Number(invoice.paidAmount),
    changeAmount: Number(invoice.changeAmount),
    notes: invoice.notes,
    type: "sale",
  });

  if (isR2Configured()) {
    uploadToR2(r2Key, Buffer.from(pdfBytes), "application/pdf").catch(() => {});
  }

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  });
}
