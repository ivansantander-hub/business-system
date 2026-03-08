import { prisma } from "@/lib/prisma";
import { generateInvoicePdf } from "@/lib/pdf";
import { generateInvoiceXml, generateInvoiceExcel } from "@/lib/invoice-export";
import { uploadToR2, invoicePdfKey, invoiceXmlKey, invoiceExcelKey, purchasePdfKey, isR2Configured } from "@/lib/r2";

/**
 * Generates and uploads an invoice PDF to R2 in the background.
 * Should be called fire-and-forget after an invoice is created.
 */
export async function generateAndUploadInvoicePdf(invoiceId: string, companyId: string): Promise<void> {
  if (!isR2Configured()) return;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true, items: true },
    });
    if (!invoice) return;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return;

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

    const key = invoicePdfKey(companyId, invoice.number);
    await uploadToR2(key, Buffer.from(pdfBytes), "application/pdf");

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
      paymentMethod: invoice.paymentMethod,
      status: invoice.status,
      notes: invoice.notes,
    };

    const xml = generateInvoiceXml(exportData);
    const excelBuffer = await generateInvoiceExcel(exportData);

    await Promise.allSettled([
      uploadToR2(invoiceXmlKey(companyId, invoice.number), Buffer.from(xml, "utf-8"), "application/xml"),
      uploadToR2(invoiceExcelKey(companyId, invoice.number), excelBuffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ]);
    console.log(`Invoice documents uploaded: PDF + XML + Excel for ${invoice.number}`);
  } catch (err) {
    console.error("Background invoice PDF generation failed:", err);
  }
}

/**
 * Generates and uploads a purchase order PDF to R2 in the background.
 */
export async function generateAndUploadPurchasePdf(purchaseId: string, companyId: string): Promise<void> {
  if (!isR2Configured()) return;

  try {
    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, companyId },
      include: {
        supplier: true,
        items: { include: { product: { select: { name: true } } } },
      },
    });
    if (!purchase) return;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return;

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

    const key = purchasePdfKey(companyId, purchase.number);
    await uploadToR2(key, Buffer.from(pdfBytes), "application/pdf");
    console.log(`Purchase PDF uploaded: ${key}`);
  } catch (err) {
    console.error("Background purchase PDF generation failed:", err);
  }
}
