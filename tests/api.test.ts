import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import {
  getOrCreateTestCompany,
  getOrCreateTestUser,
  getOrCreateTestBranch,
} from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
let serverAvailable = true;

let token: string;
let companyId: string;
let userId: string;
let branchId: string;

async function apiRequest(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `token=${token}`,
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

function requireServer(ctx: { skip: () => void }) {
  if (!serverAvailable) ctx.skip();
}

beforeAll(async () => {
  const company = await getOrCreateTestCompany();
  companyId = company.id;
  const user = await getOrCreateTestUser(companyId);
  userId = user.id;
  const branch = await getOrCreateTestBranch(companyId);
  branchId = branch.id;

  token = await signToken({
    userId: user.id,
    role: "ADMIN",
    name: user.name,
    companyId: company.id,
    branchId: branch.id,
  });

  try {
    await fetch(`${BASE_URL}/api/auth/me`, { signal: AbortSignal.timeout(3000) });
    serverAvailable = true;
  } catch {
    serverAvailable = false;
    console.warn(`Server not available at ${BASE_URL} - API tests will be skipped`);
  }
});

describe("Auth API", () => {
  it("POST /api/auth/login should return token on valid credentials", async (ctx) => {
    requireServer(ctx);
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test-concurrency@test.com",
        password: "test123",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("test-concurrency@test.com");
  });

  it("POST /api/auth/login should reject invalid credentials", async (ctx) => {
    requireServer(ctx);
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@test.com",
        password: "wrong",
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("GET /api/auth/me should return user data with valid token", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/auth/me");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBeTruthy();
    expect(data.companyId).toBe(companyId);
  });
});

describe("Products API", () => {
  let productId: string;

  it("POST /api/products should create a product", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: `API Test Product ${Date.now()}`,
        salePrice: 15000,
        costPrice: 8000,
        stock: 25,
        minStock: 3,
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(Number(data.salePrice)).toBe(15000);
    productId = data.id;
  });

  it("GET /api/products should list products", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/products");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it("PUT /api/products/:id should update a product", async (ctx) => {
    requireServer(ctx);
    if (!productId) return;
    const res = await apiRequest(`/api/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Updated Product Name", salePrice: 15000, costPrice: 8000, stock: 25, minStock: 3 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Product Name");
  });
});

describe("Customers API", () => {
  it("POST /api/customers should create a customer", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/customers", {
      method: "POST",
      body: JSON.stringify({
        name: `API Test Customer ${Date.now()}`,
        nit: `${Date.now()}`,
        email: `customer-${Date.now()}@test.com`,
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  it("GET /api/customers should list customers", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/customers");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Cash Session API", () => {
  it("POST /api/cash (open) should open a cash session", async (ctx) => {
    requireServer(ctx);
    await prisma.cashSession.updateMany({
      where: { userId, companyId, status: "OPEN" },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    const res = await apiRequest("/api/cash", {
      method: "POST",
      body: JSON.stringify({ action: "open", openingAmount: 50000 }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("OPEN");
    expect(Number(data.openingAmount)).toBe(50000);
  });

  it("GET /api/cash?action=current should return the open session", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/cash?action=current");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).not.toBeNull();
    expect(data.status).toBe("OPEN");
  });

  it("POST /api/cash (close) should close the session", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/cash", {
      method: "POST",
      body: JSON.stringify({ action: "close", closingAmount: 50000 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("CLOSED");
  });

  it("POST /api/cash (close) should fail when no session is open", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/cash", {
      method: "POST",
      body: JSON.stringify({ action: "close", closingAmount: 0 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Invoices API", () => {
  it("GET /api/invoices should return a list", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/invoices");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Purchases API", () => {
  let purchaseId: string;

  it("POST /api/purchases should create a purchase", async (ctx) => {
    requireServer(ctx);
    let supplier = await prisma.supplier.findFirst({ where: { companyId } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { companyId, name: "API Test Supplier", nit: "111111111-0" },
      });
    }

    const product = await prisma.product.findFirst({ where: { companyId } });

    const res = await apiRequest("/api/purchases", {
      method: "POST",
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ productId: product?.id, quantity: 10, unitPrice: 5000 }],
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    purchaseId = data.id;
  });

  it("PUT /api/purchases/:id (RECEIVED) should update stock", async (ctx) => {
    requireServer(ctx);
    if (!purchaseId) return;
    const res = await apiRequest(`/api/purchases/${purchaseId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "RECEIVED" }),
    });
    expect(res.status).toBe(200);
  });

  it("PUT /api/purchases/:id (RECEIVED) again should fail with 409", async (ctx) => {
    requireServer(ctx);
    if (!purchaseId) return;
    const res = await apiRequest(`/api/purchases/${purchaseId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "RECEIVED" }),
    });
    expect(res.status).toBe(409);
  });
});

describe("Reports API", () => {
  it("GET /api/reports should return data", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/reports?type=dashboard");
    expect(res.status).toBe(200);
  });
});

describe("Forgot Password API", () => {
  it("POST /api/auth/forgot-password should always return 200", async (ctx) => {
    requireServer(ctx);
    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@nowhere.com" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBeDefined();
  });

  it("POST /api/auth/reset-password should reject invalid token", async (ctx) => {
    requireServer(ctx);
    const res = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid-token", password: "newpass123" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Notifications API", () => {
  it("GET /api/notifications should return event templates with recipient info", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/notifications");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("eventType");
    expect(data[0]).toHaveProperty("label");
    expect(data[0]).toHaveProperty("enabled");
    expect(data[0]).toHaveProperty("recipientType");
    expect(data[0]).toHaveProperty("recipientLabel");
    const external = data.find((t: { eventType: string }) => t.eventType === "sale_completed");
    if (external) expect(external.recipientType).toBe("external");
  });

  it("PUT /api/notifications should toggle a notification", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/notifications", {
      method: "PUT",
      body: JSON.stringify({ eventType: "user_created", enabled: false }),
    });
    expect(res.status).toBe(200);

    const check = await apiRequest("/api/notifications");
    const data = await check.json();
    const userCreated = data.find((t: { eventType: string }) => t.eventType === "user_created");
    expect(userCreated.enabled).toBe(false);

    await apiRequest("/api/notifications", {
      method: "PUT",
      body: JSON.stringify({ eventType: "user_created", enabled: true }),
    });
  });

  it("GET /api/notifications/users should return user preferences", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/notifications/users");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/notifications/roles should return role groups", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/notifications/roles");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("RBAC API", () => {
  it("GET /api/rbac should return role permission configs", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/rbac");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("role");
    expect(data[0]).toHaveProperty("permissions");
    expect(Array.isArray(data[0].permissions)).toBe(true);
    expect(data[0].permissions[0]).toHaveProperty("permission");
    expect(data[0].permissions[0]).toHaveProperty("label");
    expect(data[0].permissions[0]).toHaveProperty("enabled");
  });

  it("PUT /api/rbac should toggle a single permission", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/rbac", {
      method: "PUT",
      body: JSON.stringify({ role: "CASHIER", permission: "reports", enabled: true }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("POST /api/rbac should bulk-update permissions for a role", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/rbac", {
      method: "POST",
      body: JSON.stringify({
        role: "WAITER",
        permissions: [
          { permission: "dashboard", enabled: true },
          { permission: "tables", enabled: true },
          { permission: "orders", enabled: true },
          { permission: "products", enabled: false },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.updated).toBeGreaterThan(0);
  });

  it("PUT /api/rbac should reject invalid role", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/rbac", {
      method: "PUT",
      body: JSON.stringify({ role: "SUPER_ADMIN", permission: "dashboard", enabled: true }),
    });
    expect(res.status).toBe(400);
  });
});

describe("Profile API", () => {
  it("GET /api/profile should return user info", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/profile");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("email");
    expect(data).toHaveProperty("role");
  });

  it("PUT /api/profile should update user name", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ name: "Test User Updated" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Test User Updated");

    await apiRequest("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ name: "Test Concurrency" }),
    });
  });

  it("PUT /api/profile should reject wrong current password", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/profile", {
      method: "PUT",
      body: JSON.stringify({ currentPassword: "wrongpassword", newPassword: "newpass123" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("incorrecta");
  });
});

describe("Invoice PDF API", () => {
  it("GET /api/invoices/nonexistent/pdf should return 404", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/invoices/nonexistent-uuid/pdf");
    expect(res.status).toBe(404);
  });
});

describe("Purchase PDF API", () => {
  it("GET /api/purchases/nonexistent/pdf should return 404", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/purchases/nonexistent-uuid/pdf");
    expect(res.status).toBe(404);
  });
});

describe("Audit API", () => {
  it("GET /api/audit/stats should return audit statistics", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/audit/stats");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("totalLogs");
    expect(typeof data.totalLogs).toBe("number");
    expect(data).toHaveProperty("byEntity");
    expect(Array.isArray(data.byEntity)).toBe(true);
    expect(data).toHaveProperty("byUser");
    expect(Array.isArray(data.byUser)).toBe(true);
    expect(data).toHaveProperty("byAction");
    expect(Array.isArray(data.byAction)).toBe(true);
  });

  it("GET /api/audit/timeline should return timeline for entity", async (ctx) => {
    requireServer(ctx);
    const product = await prisma.product.findFirst({ where: { companyId } });
    const entityId = product?.id || "00000000-0000-0000-0000-000000000000";
    const res = await apiRequest(`/api/audit/timeline?entity=Product&entityId=${entityId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("entity", "Product");
    expect(data).toHaveProperty("entityId", entityId);
    expect(data).toHaveProperty("events");
    expect(Array.isArray(data.events)).toBe(true);
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("page");
    expect(data).toHaveProperty("limit");
    expect(data).toHaveProperty("totalPages");
  });

  it("GET /api/audit/entity-search should search entities", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/audit/entity-search?q=test&type=all");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("results");
    expect(Array.isArray(data.results)).toBe(true);
  });

  it("GET /api/audit/entity-detail should return entity detail", async (ctx) => {
    requireServer(ctx);
    const prodRes = await apiRequest("/api/products");
    const products = await prodRes.json();
    if (products.length > 0) {
      const res = await apiRequest(`/api/audit/entity-detail?entity=Product&entityId=${products[0].id}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("entityData");
      expect(data).toHaveProperty("relatedData");
      expect(data).toHaveProperty("auditLogs");
    }
  });
});

describe("Invoice Export API", () => {
  let invoiceId: string;

  it("GET /api/invoices/:id/export?format=xml should return XML", async (ctx) => {
    requireServer(ctx);
    await prisma.cashSession.updateMany({
      where: { userId, companyId, status: "OPEN" },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    const openRes = await apiRequest("/api/cash", {
      method: "POST",
      body: JSON.stringify({ action: "open", openingAmount: 50000 }),
    });
    expect(openRes.status).toBe(201);

    let product = await prisma.product.findFirst({ where: { companyId } });
    if (!product) {
      product = await prisma.product.create({
        data: {
          companyId,
          name: `Export Test Product ${Date.now()}`,
          salePrice: 10000,
          costPrice: 5000,
          stock: 100,
          minStock: 5,
        },
      });
    }

    const saleRes = await apiRequest("/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        items: [{ productId: product.id, productName: product.name, quantity: 1, unitPrice: 10000 }],
        paymentMethod: "CASH",
        paidAmount: 10000,
      }),
    });
    expect(saleRes.status).toBe(201);
    const invoice = await saleRes.json();
    invoiceId = invoice.id;

    const res = await apiRequest(`/api/invoices/${invoiceId}/export?format=xml`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const text = await res.text();
    expect(text).toContain("<?xml");
    expect(text.length).toBeGreaterThan(100);
  });
});

describe("Company Config API", () => {
  it("GET /api/company/config should return company config", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/company/config");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("retentionYears");
    expect(typeof data.retentionYears).toBe("number");
    expect(data).toHaveProperty("dianResolution");
    expect(data).toHaveProperty("dianPrefix");
    expect(data).toHaveProperty("dianRangeFrom");
    expect(data).toHaveProperty("dianRangeTo");
    expect(data).toHaveProperty("economicActivity");
    expect(data).toHaveProperty("taxResponsibilities");
  });

  it("GET /api/company/config should include e-invoicing fields", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/company/config");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("electronicInvoicingEnabled");
    expect(typeof data.electronicInvoicingEnabled).toBe("boolean");
  });

  it("GET /api/company/config should include e-invoice provider fields", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/company/config");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("eInvoiceProvider");
    expect(data).toHaveProperty("eInvoiceProviderApiUrl");
    expect(data).toHaveProperty("dianTechnicalKey");
    expect(data).toHaveProperty("dianEnvironment");
    expect(data).toHaveProperty("dianSoftwareId");
  });

  it("PUT /api/company/config should update e-invoice provider config", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/company/config", {
      method: "PUT",
      body: JSON.stringify({
        electronicInvoicingEnabled: true,
        eInvoiceProvider: "dian",
        eInvoiceProviderApiUrl: "https://api.example.com",
        dianEnvironment: "test",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const getRes = await apiRequest("/api/company/config");
    const config = await getRes.json();
    expect(config.electronicInvoicingEnabled).toBe(true);
    expect(config.eInvoiceProvider).toBe("dian");
    expect(config.eInvoiceProviderApiUrl).toBe("https://api.example.com");
    expect(config.dianEnvironment).toBe("test");
  });
});

describe("Company Logo API", () => {
  it("POST /api/company/logo without file should return 400", async (ctx) => {
    requireServer(ctx);
    const formData = new FormData();
    const res = await fetch(`${BASE_URL}/api/company/logo`, {
      method: "POST",
      headers: { Cookie: `token=${token}` },
      body: formData,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it("POST /api/company/logo with invalid file type should return 400", async (ctx) => {
    requireServer(ctx);
    const formData = new FormData();
    formData.append("logo", new Blob(["not an image"], { type: "text/plain" }), "file.txt");
    const res = await fetch(`${BASE_URL}/api/company/logo`, {
      method: "POST",
      headers: { Cookie: `token=${token}` },
      body: formData,
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/company/logo without logo may return 404", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/company/logo");
    expect([200, 404]).toContain(res.status);
  });
});

describe("Accounting API", () => {
  it("GET /api/accounting/balance-sheet should return balance sheet data", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/accounting/balance-sheet");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("assets");
    expect(Array.isArray(data.assets)).toBe(true);
    expect(data).toHaveProperty("liabilities");
    expect(Array.isArray(data.liabilities)).toBe(true);
    expect(data).toHaveProperty("equity");
    expect(Array.isArray(data.equity)).toBe(true);
    expect(data).toHaveProperty("totals");
    expect(data.totals).toHaveProperty("totalAssets");
    expect(data.totals).toHaveProperty("totalLiabilities");
    expect(data.totals).toHaveProperty("totalEquity");
    expect(data.totals).toHaveProperty("balanced");
  });

  it("GET /api/accounting/income-statement should return income statement data", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/accounting/income-statement");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("income");
    expect(Array.isArray(data.income)).toBe(true);
    expect(data).toHaveProperty("costOfSales");
    expect(Array.isArray(data.costOfSales)).toBe(true);
    expect(data).toHaveProperty("expenses");
    expect(Array.isArray(data.expenses)).toBe(true);
    expect(data).toHaveProperty("totals");
    expect(data.totals).toHaveProperty("totalIncome");
    expect(data.totals).toHaveProperty("grossProfit");
    expect(data.totals).toHaveProperty("netIncome");
  });

  it("GET /api/accounting/trial-balance should return trial balance data", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/accounting/trial-balance");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("accounts");
    expect(Array.isArray(data.accounts)).toBe(true);
    expect(data).toHaveProperty("totals");
    expect(data.totals).toHaveProperty("totalDebits");
    expect(data.totals).toHaveProperty("totalCredits");
    expect(data.totals).toHaveProperty("balanced");
  });
});

describe("Employee API", () => {
  let employeeId: string;

  it("POST /api/employees should create an employee", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/employees", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Juan",
        lastName: "Pérez",
        docType: "CC",
        docNumber: "1234567890-test",
        startDate: "2026-01-15",
        position: "Cajero",
        baseSalary: 1300000,
        salaryType: "ORDINARY",
        contractType: "INDEFINITE",
        email: "juan.perez@test.com",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.firstName).toBe("Juan");
    expect(data.lastName).toBe("Pérez");
    expect(data.docNumber).toBe("1234567890-test");
    employeeId = data.id;
  });

  it("GET /api/employees should list employees", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/employees");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/employees/:id should get an employee", async (ctx) => {
    requireServer(ctx);
    if (!employeeId) ctx.skip();
    const res = await apiRequest(`/api/employees/${employeeId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(employeeId);
    expect(data.firstName).toBe("Juan");
  });

  it("PUT /api/employees/:id should update an employee", async (ctx) => {
    requireServer(ctx);
    if (!employeeId) ctx.skip();
    const res = await apiRequest(`/api/employees/${employeeId}`, {
      method: "PUT",
      body: JSON.stringify({ position: "Administrador" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.position).toBe("Administrador");
  });

  it("DELETE /api/employees/:id should deactivate an employee", async (ctx) => {
    requireServer(ctx);
    if (!employeeId) ctx.skip();
    const res = await apiRequest(`/api/employees/${employeeId}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

describe("Payroll Config API", () => {
  it("GET /api/payroll/config should return or create config", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/payroll/config");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("minimumWage");
    expect(data).toHaveProperty("transportSubsidy");
    expect(data).toHaveProperty("uvtValue");
    expect(data).toHaveProperty("payrollFrequency");
  });

  it("PUT /api/payroll/config should update config", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/payroll/config", {
      method: "PUT",
      body: JSON.stringify({ minimumWage: 1300000, transportSubsidy: 162000 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Number(data.minimumWage)).toBe(1300000);
  });
});

describe("Payroll Run API", () => {
  let runId: string;

  it("POST /api/payroll should create a payroll run", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/payroll", {
      method: "POST",
      body: JSON.stringify({
        period: "2026-03-01",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
        frequency: "MONTHLY",
        notes: "Test run",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("DRAFT");
    runId = data.id;
  });

  it("GET /api/payroll should list payroll runs", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/payroll");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/payroll/:id should get run details", async (ctx) => {
    requireServer(ctx);
    if (!runId) ctx.skip();
    const res = await apiRequest(`/api/payroll/${runId}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(runId);
    expect(data.status).toBe("DRAFT");
  });

  it("POST /api/payroll/:id with action cancel should cancel run", async (ctx) => {
    requireServer(ctx);
    if (!runId) ctx.skip();
    const res = await apiRequest(`/api/payroll/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "cancel" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("CANCELLED");
  });
});

describe("Payroll Concepts API", () => {
  it("POST /api/payroll/concepts should create a concept", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/payroll/concepts", {
      method: "POST",
      body: JSON.stringify({
        code: "TEST_BONUS",
        name: "Bonificación Test",
        type: "EARNING",
        subtype: "BONUS",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.code).toBe("TEST_BONUS");
    expect(data.type).toBe("EARNING");
  });

  it("GET /api/payroll/concepts should list concepts", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/payroll/concepts");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Payroll Provisions API", () => {
  it("GET /api/payroll/provisions should return provisions", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/payroll/provisions");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/payroll/provisions with year filter should work", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/payroll/provisions?year=2026");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe("Company Config - Electronic Payroll", () => {
  it("GET /api/company/config should include electronic payroll fields", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/company/config");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("electronicPayrollEnabled");
    expect(data).toHaveProperty("payrollProvider");
  });

  it("PUT /api/company/config should update electronic payroll config", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/company/config", {
      method: "PUT",
      body: JSON.stringify({
        electronicPayrollEnabled: true,
        payrollProvider: "factus",
        payrollProviderApiUrl: "https://payroll.example.com",
      }),
    });
    expect(res.status).toBe(200);

    const getRes = await apiRequest("/api/company/config");
    const config = await getRes.json();
    expect(config.electronicPayrollEnabled).toBe(true);
    expect(config.payrollProvider).toBe("factus");
  });
});
