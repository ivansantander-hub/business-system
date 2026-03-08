import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface PdfInvoiceData {
  invoiceNumber: string;
  date: string;
  companyName: string;
  companyNit: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  customerName?: string | null;
  customerNit?: string | null;
  customerAddress?: string | null;
  paymentMethod: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  notes?: string | null;
  type: "sale" | "purchase";
  supplierName?: string | null;
  supplierNit?: string | null;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT: "Crédito",
};

function formatCOP(value: number): string {
  return `$ ${value.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export async function generateInvoicePdf(data: PdfInvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  const page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (text: string, x: number, yPos: number, size = 10, bold = false) => {
    page.drawText(text, { x, y: yPos, size, font: bold ? fontBold : font, color: rgb(0.1, 0.1, 0.1) });
  };

  const drawLine = (yPos: number) => {
    page.drawLine({
      start: { x: margin, y: yPos },
      end: { x: pageWidth - margin, y: yPos },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
  };

  const drawRect = (x: number, yPos: number, w: number, h: number, color = rgb(0.95, 0.95, 0.97)) => {
    page.drawRectangle({ x, y: yPos, width: w, height: h, color });
  };

  // Header background
  drawRect(margin, y - 60, contentWidth, 65, rgb(0.12, 0.08, 0.25));

  const title = data.type === "purchase" ? "ORDEN DE COMPRA" : "FACTURA DE VENTA";
  page.drawText(title, { x: margin + 15, y: y - 22, size: 16, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(data.invoiceNumber, { x: margin + 15, y: y - 40, size: 12, font, color: rgb(0.7, 0.65, 1) });
  page.drawText(`Fecha: ${data.date}`, { x: pageWidth - margin - 150, y: y - 22, size: 10, font, color: rgb(0.85, 0.85, 0.9) });

  y -= 80;

  // Company info
  drawText("EMPRESA", margin, y, 8, true);
  y -= 14;
  drawText(data.companyName, margin, y, 11, true);
  y -= 13;
  drawText(`NIT: ${data.companyNit}`, margin, y, 9);
  if (data.companyAddress) { y -= 12; drawText(data.companyAddress, margin, y, 9); }
  if (data.companyPhone) { y -= 12; drawText(`Tel: ${data.companyPhone}`, margin, y, 9); }
  if (data.companyEmail) { y -= 12; drawText(data.companyEmail, margin, y, 9); }

  // Client / Supplier info
  const rightCol = pageWidth / 2 + 20;
  let yRight = y + (data.companyAddress ? 12 : 0) + (data.companyPhone ? 12 : 0) + (data.companyEmail ? 12 : 0) + 14 + 13;

  if (data.type === "purchase" && data.supplierName) {
    drawText("PROVEEDOR", rightCol, yRight, 8, true);
    yRight -= 14;
    drawText(data.supplierName, rightCol, yRight, 11, true);
    if (data.supplierNit) { yRight -= 13; drawText(`NIT: ${data.supplierNit}`, rightCol, yRight, 9); }
  } else if (data.customerName) {
    drawText("CLIENTE", rightCol, yRight, 8, true);
    yRight -= 14;
    drawText(data.customerName, rightCol, yRight, 11, true);
    if (data.customerNit) { yRight -= 13; drawText(`NIT: ${data.customerNit}`, rightCol, yRight, 9); }
    if (data.customerAddress) { yRight -= 12; drawText(data.customerAddress, rightCol, yRight, 9); }
  }

  y -= 25;
  drawLine(y);
  y -= 5;

  // Table header
  const colX = [margin, margin + 30, margin + 250, margin + 330, margin + 420];
  drawRect(margin, y - 15, contentWidth, 18, rgb(0.93, 0.93, 0.96));
  y -= 2;
  const headers = ["#", "Producto / Servicio", "Cant.", "P. Unit.", "Total"];
  const headerX = colX;
  headers.forEach((h, i) => drawText(h, headerX[i], y - 11, 8, true));
  y -= 22;

  // Items
  data.items.forEach((item, idx) => {
    if (idx % 2 === 0) drawRect(margin, y - 12, contentWidth, 16, rgb(0.97, 0.97, 0.99));
    drawText(String(idx + 1), colX[0], y - 9, 9);
    const nameText = item.name.length > 35 ? item.name.slice(0, 35) + "..." : item.name;
    drawText(nameText, colX[1], y - 9, 9);
    drawText(String(item.quantity), colX[2], y - 9, 9);
    drawText(formatCOP(item.unitPrice), colX[3], y - 9, 9);
    drawText(formatCOP(item.total), colX[4], y - 9, 9, true);
    y -= 18;
  });

  y -= 10;
  drawLine(y);
  y -= 20;

  // Totals
  const totalsX = pageWidth - margin - 200;
  const totalsValX = pageWidth - margin - 60;

  drawText("Subtotal:", totalsX, y, 10);
  drawText(formatCOP(data.subtotal), totalsValX, y, 10);
  y -= 15;

  if (data.discount > 0) {
    drawText("Descuento:", totalsX, y, 10);
    drawText(`- ${formatCOP(data.discount)}`, totalsValX, y, 10);
    y -= 15;
  }

  drawText(`IVA (${(data.taxRate * 100).toFixed(0)}%):`, totalsX, y, 10);
  drawText(formatCOP(data.tax), totalsValX, y, 10);
  y -= 18;

  drawRect(totalsX - 5, y - 5, 210, 22, rgb(0.12, 0.08, 0.25));
  page.drawText("TOTAL:", { x: totalsX, y: y, size: 12, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(formatCOP(data.total), { x: totalsValX - 10, y: y, size: 12, font: fontBold, color: rgb(1, 1, 1) });
  y -= 30;

  if (data.type === "sale") {
    drawText(`Método de Pago: ${PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod}`, margin, y, 9);
    y -= 13;
    drawText(`Monto Pagado: ${formatCOP(data.paidAmount)}`, margin, y, 9);
    if (data.changeAmount > 0) {
      y -= 13;
      drawText(`Cambio: ${formatCOP(data.changeAmount)}`, margin, y, 9);
    }
    y -= 20;
  }

  if (data.notes) {
    drawText("Notas:", margin, y, 8, true);
    y -= 13;
    drawText(data.notes.slice(0, 120), margin, y, 9);
    y -= 20;
  }

  // Footer
  drawLine(margin + 30);
  page.drawText("SGC - Sistema de Gestión Comercial", {
    x: margin,
    y: margin + 15,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  page.drawText(`Generado: ${new Date().toLocaleString("es-CO")}`, {
    x: pageWidth - margin - 160,
    y: margin + 15,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return doc.save();
}
