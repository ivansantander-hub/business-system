import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import {
  getOrCreateTestCompany,
  getOrCreateTestUser,
} from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
let serverAvailable = false;

let token: string;
let companyId: string;
let userId: string;

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

  token = await signToken({
    userId: user.id,
    role: "ADMIN",
    name: user.name,
    companyId: company.id,
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
    expect(data.name).toBe("Test Concurrency User");
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
