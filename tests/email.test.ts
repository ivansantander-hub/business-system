import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EMAIL_EVENTS,
  EVENT_LABELS,
  EVENT_META,
  emailUserCreated,
  emailPasswordReset,
  emailSaleCompleted,
  emailPurchaseCreated,
  emailPurchaseReceived,
  emailMembershipCreated,
  emailDayPassCreated,
  emailCashSessionClosed,
  formatCurrency,
} from "@/lib/email";

describe("Email Event Constants", () => {
  it("should define all expected event types", () => {
    expect(Object.keys(EMAIL_EVENTS).length).toBe(10);
    expect(EMAIL_EVENTS.USER_CREATED).toBe("user_created");
    expect(EMAIL_EVENTS.PASSWORD_RESET).toBe("password_reset");
    expect(EMAIL_EVENTS.SALE_COMPLETED).toBe("sale_completed");
    expect(EMAIL_EVENTS.INVOICE_GENERATED).toBe("invoice_generated");
    expect(EMAIL_EVENTS.PURCHASE_CREATED).toBe("purchase_created");
    expect(EMAIL_EVENTS.PURCHASE_RECEIVED).toBe("purchase_received");
    expect(EMAIL_EVENTS.MEMBERSHIP_CREATED).toBe("membership_created");
    expect(EMAIL_EVENTS.DAYPASS_CREATED).toBe("daypass_created");
    expect(EMAIL_EVENTS.CASH_SESSION_CLOSED).toBe("cash_session_closed");
    expect(EMAIL_EVENTS.ORDER_PAID).toBe("order_paid");
  });

  it("should have labels for all events", () => {
    for (const eventType of Object.values(EMAIL_EVENTS)) {
      expect(EVENT_LABELS[eventType]).toBeDefined();
      expect(typeof EVENT_LABELS[eventType]).toBe("string");
    }
  });

  it("should have meta (recipientType) for all events", () => {
    for (const eventType of Object.values(EMAIL_EVENTS)) {
      expect(EVENT_META[eventType]).toBeDefined();
      expect(EVENT_META[eventType].recipientType).toMatch(/^(internal|external|system)$/);
      expect(typeof EVENT_META[eventType].recipientLabel).toBe("string");
    }
  });

  it("should classify sale_completed and membership_created as external", () => {
    expect(EVENT_META.sale_completed.recipientType).toBe("external");
    expect(EVENT_META.membership_created.recipientType).toBe("external");
    expect(EVENT_META.daypass_created.recipientType).toBe("external");
  });

  it("should classify purchase_created and cash_session_closed as internal", () => {
    expect(EVENT_META.purchase_created.recipientType).toBe("internal");
    expect(EVENT_META.cash_session_closed.recipientType).toBe("internal");
  });

  it("should classify password_reset as system", () => {
    expect(EVENT_META.password_reset.recipientType).toBe("system");
  });
});

describe("formatCurrency", () => {
  it("should format Colombian Pesos correctly", () => {
    const formatted = formatCurrency(50000);
    expect(formatted).toContain("50");
    expect(formatted).toContain("000");
  });

  it("should handle zero", () => {
    const formatted = formatCurrency(0);
    expect(formatted).toContain("0");
  });
});

describe("Email Template Functions", () => {
  it("emailUserCreated should generate correct email params", () => {
    const result = emailUserCreated("Juan", "juan@test.com", "pass123", "Mi Empresa");
    expect(result.to).toBe("juan@test.com");
    expect(result.toName).toBe("Juan");
    expect(result.subject).toContain("Mi Empresa");
    expect(result.subject).toContain("Bienvenido");
    expect(result.htmlContent).toContain("Juan");
    expect(result.htmlContent).toContain("pass123");
    expect(result.htmlContent).toContain("juan@test.com");
  });

  it("emailPasswordReset should generate correct email params", () => {
    const result = emailPasswordReset("Maria", "maria@test.com", "https://example.com/reset?token=abc123");
    expect(result.to).toBe("maria@test.com");
    expect(result.subject).toContain("Recuperación");
    expect(result.htmlContent).toContain("https://example.com/reset?token=abc123");
    expect(result.htmlContent).toContain("Maria");
  });

  it("emailSaleCompleted should include items and total", () => {
    const items = [
      { name: "Producto A", qty: 2, price: 10000 },
      { name: "Producto B", qty: 1, price: 5000 },
    ];
    const result = emailSaleCompleted("cli@test.com", "Cliente", "FE-0001", 25000, items, "Tienda");
    expect(result.to).toBe("cli@test.com");
    expect(result.subject).toContain("FE-0001");
    expect(result.htmlContent).toContain("Producto A");
    expect(result.htmlContent).toContain("Producto B");
    expect(result.htmlContent).toContain("25");
  });

  it("emailPurchaseCreated should include supplier and total", () => {
    const result = emailPurchaseCreated("admin@test.com", "Admin", "OC-0001", "Proveedor X", 150000, "Mi Empresa");
    expect(result.to).toBe("admin@test.com");
    expect(result.subject).toContain("OC-0001");
    expect(result.htmlContent).toContain("Proveedor X");
    expect(result.htmlContent).toContain("150");
  });

  it("emailPurchaseReceived should include purchase number", () => {
    const result = emailPurchaseReceived("admin@test.com", "Admin", "OC-0001", 150000, "Mi Empresa");
    expect(result.to).toBe("admin@test.com");
    expect(result.subject).toContain("recibida");
    expect(result.htmlContent).toContain("OC-0001");
  });

  it("emailMembershipCreated should include plan details", () => {
    const result = emailMembershipCreated("miembro@test.com", "Miembro", "Plan Gold", "01/01/2026", "01/02/2026", 80000, "Gym");
    expect(result.to).toBe("miembro@test.com");
    expect(result.subject).toContain("Membresía");
    expect(result.htmlContent).toContain("Plan Gold");
    expect(result.htmlContent).toContain("01/01/2026");
    expect(result.htmlContent).toContain("01/02/2026");
  });

  it("emailDayPassCreated should include entries count", () => {
    const result = emailDayPassCreated("cli@test.com", "Cliente", 10, 50000, "Gym");
    expect(result.to).toBe("cli@test.com");
    expect(result.subject).toContain("Tiquetera");
    expect(result.htmlContent).toContain("10");
  });

  it("emailCashSessionClosed should include session details", () => {
    const result = emailCashSessionClosed("cajero@test.com", "Cajero", 500000, 100000, 590000, -10000, "Tienda");
    expect(result.to).toBe("cajero@test.com");
    expect(result.subject).toContain("caja");
    expect(result.htmlContent).toContain("500");
    expect(result.htmlContent).toContain("100");
    expect(result.htmlContent).toContain("#ef4444");
  });

  it("emailCashSessionClosed should use green for surplus", () => {
    const result = emailCashSessionClosed("cajero@test.com", "Cajero", 500000, 100000, 610000, 10000, "Tienda");
    expect(result.htmlContent).toContain("#22c55e");
  });
});
