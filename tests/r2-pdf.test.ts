import { describe, it, expect } from "vitest";
import { invoicePdfKey, purchasePdfKey, avatarKey, isR2Configured } from "@/lib/r2";
import { generateInvoicePdf } from "@/lib/pdf";

describe("R2 Key Generation", () => {
  it("should generate correct invoice PDF key", () => {
    const key = invoicePdfKey("company-123", "FE-00000001");
    expect(key).toBe("companies/company-123/invoices/FE-00000001.pdf");
  });

  it("should sanitize special characters in invoice number", () => {
    const key = invoicePdfKey("c-1", "FE/001 (test)");
    const filename = key.split("/").pop()!;
    expect(filename).not.toContain("/");
    expect(filename).not.toContain("(");
    expect(filename).not.toContain(" ");
    expect(key).toMatch(/^companies\/c-1\/invoices\/.*\.pdf$/);
  });

  it("should generate correct purchase PDF key", () => {
    const key = purchasePdfKey("company-456", "OC-000001");
    expect(key).toBe("companies/company-456/purchases/OC-000001.pdf");
  });

  it("should generate correct avatar key", () => {
    const key = avatarKey("user-789", "jpg");
    expect(key).toBe("users/user-789/avatar.jpg");
  });

  it("should handle different avatar extensions", () => {
    expect(avatarKey("u1", "png")).toBe("users/u1/avatar.png");
    expect(avatarKey("u2", "webp")).toBe("users/u2/avatar.webp");
  });
});

describe("R2 Configuration Check", () => {
  it("isR2Configured should return a boolean", () => {
    const result = isR2Configured();
    expect(typeof result).toBe("boolean");
  });
});

describe("PDF Generation", () => {
  it("should generate a valid PDF buffer for a sale invoice", async () => {
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: "FE-00000001",
      date: "08/03/2026",
      companyName: "Empresa Test",
      companyNit: "900123456-1",
      companyAddress: "Calle 123",
      companyPhone: "3001234567",
      companyEmail: "test@empresa.com",
      customerName: "Cliente Test",
      customerNit: "800654321-2",
      customerAddress: null,
      paymentMethod: "CASH",
      items: [
        { name: "Producto A", quantity: 2, unitPrice: 10000, total: 20000 },
        { name: "Producto B", quantity: 1, unitPrice: 50000, total: 50000 },
      ],
      subtotal: 70000,
      taxRate: 0.19,
      tax: 13300,
      discount: 0,
      total: 83300,
      paidAmount: 100000,
      changeAmount: 16700,
      notes: "Gracias por su compra",
      type: "sale",
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);
    // PDF magic bytes: %PDF
    expect(String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3])).toBe("%PDF");
  });

  it("should generate a valid PDF buffer for a purchase order", async () => {
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: "OC-000001",
      date: "08/03/2026",
      companyName: "Empresa Test",
      companyNit: "900123456-1",
      companyAddress: null,
      companyPhone: null,
      companyEmail: null,
      supplierName: "Proveedor ABC",
      supplierNit: "900999888-3",
      paymentMethod: "CREDIT",
      items: [
        { name: "Materia Prima X", quantity: 100, unitPrice: 500, total: 50000 },
      ],
      subtotal: 50000,
      taxRate: 0.19,
      tax: 9500,
      discount: 0,
      total: 59500,
      paidAmount: 59500,
      changeAmount: 0,
      notes: null,
      type: "purchase",
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(500);
    expect(String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3])).toBe("%PDF");
  });

  it("should handle empty items array", async () => {
    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: "FE-EMPTY",
      date: "01/01/2026",
      companyName: "Co",
      companyNit: "123",
      paymentMethod: "CASH",
      items: [],
      subtotal: 0,
      taxRate: 0.19,
      tax: 0,
      discount: 0,
      total: 0,
      paidAmount: 0,
      changeAmount: 0,
      type: "sale",
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(100);
  });
});
