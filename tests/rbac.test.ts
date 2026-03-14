import { describe, it, expect, beforeAll } from "vitest";
import { signToken } from "@/lib/auth";
import {
  getOrCreateTestCompany,
  getOrCreateTestBranch,
  createTestUserWithRole,
} from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
let serverAvailable = true;

let companyId: string;
let adminToken: string;
let cashierToken: string;

function requireServer(ctx: { skip: () => void }) {
  if (!serverAvailable) ctx.skip();
}

async function apiRequest(path: string, token: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: `token=${token}`,
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

beforeAll(async () => {
  const company = await getOrCreateTestCompany();
  companyId = company.id;
  const branch = await getOrCreateTestBranch(companyId);

  // Create ADMIN token (direct sign — ADMIN role has products + inventory)
  const adminUser = await import("@/lib/prisma").then(({ prisma }) =>
    prisma.user.findFirst({ where: { email: "test-concurrency@test.com" } })
  );
  if (adminUser) {
    adminToken = await signToken({
      userId: adminUser.id,
      role: "ADMIN",
      name: adminUser.name,
      companyId,
      branchId: branch.id,
    });
  } else {
    adminToken = await createTestUserWithRole(companyId, "ADMIN");
  }

  // Create CASHIER token (CASHIER has no products or inventory)
  cashierToken = await createTestUserWithRole(companyId, "CASHIER");

  try {
    await fetch(`${BASE_URL}/api/auth/me`, { signal: AbortSignal.timeout(3000) });
    serverAvailable = true;
  } catch {
    serverAvailable = false;
    console.warn(`Server not available at ${BASE_URL} - RBAC tests will be skipped`);
  }
});

describe("RBAC — Productos", () => {
  it("CASHIER: GET /api/products → 403", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/products", cashierToken);
    expect(res.status).toBe(403);
  });

  it("CASHIER: POST /api/products → 403", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/products", cashierToken, {
      method: "POST",
      body: JSON.stringify({ name: "Test", salePrice: 1000, costPrice: 500, stock: 10, minStock: 1 }),
    });
    expect(res.status).toBe(403);
  });

  it("ADMIN: GET /api/products → 200", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/products", adminToken);
    expect(res.status).toBe(200);
  });

  it("ADMIN: POST /api/products → 201 o 400", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/products", adminToken, {
      method: "POST",
      body: JSON.stringify({ name: `RBAC Test Product ${Date.now()}`, salePrice: 5000, costPrice: 2000, stock: 10, minStock: 1 }),
    });
    // 201 if valid body, 400 if validation fails — but NOT 403
    expect(res.status).not.toBe(403);
    expect([201, 400]).toContain(res.status);
  });
});

describe("RBAC — Agent Config", () => {
  it("CASHIER: GET /api/agent/config → 403", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/agent/config", cashierToken);
    expect(res.status).toBe(403);
  });

  it("ADMIN: GET /api/agent/config → 200", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/agent/config", adminToken);
    expect(res.status).toBe(200);
  });
});

describe("RBAC — Mensajería", () => {
  it("CASHIER: GET /api/conversations → 403", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/conversations", cashierToken);
    expect(res.status).toBe(403);
  });

  it("ADMIN: GET /api/conversations → 200", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/conversations", adminToken);
    expect(res.status).toBe(200);
  });
});
