import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { generateInvoiceXml, generateInvoiceExcel } from "@/lib/invoice-export";
import { generateInvoicePdf } from "@/lib/pdf";
import { uploadToR2, isR2Configured } from "@/lib/r2";
import { auditApiRequest } from "@/lib/api-audit";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "pdf";

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      customer: true,
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

  const exportData = {
    invoiceNumber: invoice.number,
    date: new Date(invoice.date).toISOString().split("T")[0],
    companyName: company.name,
    companyNit: company.nit,
    companyAddress: company.address,
    companyPhone: company.phone,
    companyEmail: company.email,
    companyCity: company.city,
    companyDepartment: company.department,
    taxRegime: company.taxRegime,
    economicActivity: company.economicActivity,
    dianResolution: company.dianResolution,
    customerName: invoice.customer?.name,
    customerNit: invoice.customer?.nit,
    customerAddress: invoice.customer?.address,
    customerEmail: invoice.customer?.email,
    customerPhone: invoice.customer?.phone,
    items: invoice.items.map((item) => ({
      name: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate),
    tax: Number(invoice.tax),
    discount: Number(invoice.discount),
    total: Number(invoice.total),
    paymentMethod: invoice.paymentMethod,
    status: invoice.status,
    notes: invoice.notes,
  };

  auditApiRequest(request, "invoice.export", {
    entity: "Invoice",
    entityId: id,
    details: { number: invoice.number, format },
  });

  if (format === "xml") {
    const xml = generateInvoiceXml(exportData);
    const buffer = Buffer.from(xml, "utf-8");

    if (isR2Configured()) {
      uploadToR2(
        `companies/${companyId}/invoices/${invoice.number}/factura.xml`,
        buffer,
        "application/xml"
      ).catch(() => {});
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${invoice.number}.xml"`,
      },
    });
  }

  if (format === "excel") {
    const excelBuffer = await generateInvoiceExcel(exportData);

    if (isR2Configured()) {
      uploadToR2(
        `companies/${companyId}/invoices/${invoice.number}/factura.xlsx`,
        excelBuffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ).catch(() => {});
    }

    return new Response(new Uint8Array(excelBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${invoice.number}.xlsx"`,
      },
    });
  }

  if (format === "pdf") {
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: invoice.number,
      date: exportData.date,
      companyName: company.name,
      companyNit: company.nit,
      companyAddress: company.address,
      companyPhone: company.phone,
      companyEmail: company.email,
      customerName: invoice.customer?.name,
      customerNit: invoice.customer?.nit,
      items: exportData.items,
      subtotal: exportData.subtotal,
      taxRate: exportData.taxRate,
      tax: exportData.tax,
      discount: exportData.discount,
      total: exportData.total,
      paidAmount: Number(invoice.paidAmount),
      changeAmount: Number(invoice.changeAmount),
      paymentMethod: invoice.paymentMethod,
      type: "sale",
    });

    if (isR2Configured()) {
      uploadToR2(
        `companies/${companyId}/invoices/${invoice.number}/factura.pdf`,
        pdfBytes,
        "application/pdf"
      ).catch(() => {});
    }

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      },
    });
  }

  if (format === "all") {
    const xml = generateInvoiceXml(exportData);
    const excelBuffer = await generateInvoiceExcel(exportData);
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: invoice.number,
      date: exportData.date,
      companyName: company.name,
      companyNit: company.nit,
      companyAddress: company.address,
      companyPhone: company.phone,
      companyEmail: company.email,
      customerName: invoice.customer?.name,
      customerNit: invoice.customer?.nit,
      items: exportData.items,
      subtotal: exportData.subtotal,
      taxRate: exportData.taxRate,
      tax: exportData.tax,
      discount: exportData.discount,
      total: exportData.total,
      paidAmount: Number(invoice.paidAmount),
      changeAmount: Number(invoice.changeAmount),
      paymentMethod: invoice.paymentMethod,
      type: "sale",
    });

    if (isR2Configured()) {
      const prefix = `companies/${companyId}/invoices/${invoice.number}`;
      await Promise.allSettled([
        uploadToR2(`${prefix}/factura.pdf`, pdfBytes, "application/pdf"),
        uploadToR2(`${prefix}/factura.xml`, Buffer.from(xml, "utf-8"), "application/xml"),
        uploadToR2(`${prefix}/factura.xlsx`, excelBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      ]);
    }

    return NextResponse.json({
      message: "Archivos generados y subidos a R2",
      formats: ["pdf", "xml", "xlsx"],
      invoice: invoice.number,
    });
  }

  return NextResponse.json({ error: "Formato no soportado. Use: pdf, xml, excel, all" }, { status: 400 });
}
