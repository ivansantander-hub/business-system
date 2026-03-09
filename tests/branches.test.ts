import { describe, it, expect, beforeAll } from "vitest";
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
    branchId: null,
  });

  try {
    await fetch(`${BASE_URL}/api/auth/me`, { signal: AbortSignal.timeout(3000) });
    serverAvailable = true;
  } catch {
    serverAvailable = false;
    console.warn(`Server not available at ${BASE_URL} - branch tests will be skipped`);
  }
});

describe("Branches API", () => {
  let branchId: string;

  it("GET /api/branches should list branches", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/branches");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/branches should create a branch", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/branches", {
      method: "POST",
      body: JSON.stringify({
        name: `Test Branch ${Date.now()}`,
        address: "Calle 123",
        city: "Bogotá",
        phone: "3001234567",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toContain("Test Branch");
    expect(data.address).toBe("Calle 123");
    expect(data.city).toBe("Bogotá");
    branchId = data.id;
  });

  it("GET /api/branches/[id]/users should return users assigned to branch", async (ctx) => {
    requireServer(ctx);
    if (!branchId) return;
    const res = await apiRequest(`/api/branches/${branchId}/users`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("POST /api/branches/[id]/users should assign users to branch", async (ctx) => {
    requireServer(ctx);
    if (!branchId) return;
    const res = await apiRequest(`/api/branches/${branchId}/users`, {
      method: "POST",
      body: JSON.stringify({ userIds: [userId] }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    const getRes = await apiRequest(`/api/branches/${branchId}/users`);
    const users = await getRes.json();
    expect(users.some((u: { id: string }) => u.id === userId)).toBe(true);
  });

  it("DELETE /api/branches/[id]/users should remove user from branch", async (ctx) => {
    requireServer(ctx);
    if (!branchId) return;
    const res = await apiRequest(`/api/branches/${branchId}/users`, {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    });
    expect(res.status).toBe(200);

    const getRes = await apiRequest(`/api/branches/${branchId}/users`);
    const users = await getRes.json();
    expect(users.some((u: { id: string }) => u.id === userId)).toBe(false);
  });

  it("GET /api/branches should include userCount", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/branches");
    expect(res.status).toBe(200);
    const data = await res.json();
    const branch = data.find((b: { id: string }) => b.id === branchId);
    if (branch) {
      expect(branch).toHaveProperty("userCount");
      expect(typeof branch.userCount).toBe("number");
    }
  });

  it("GET /api/branches/[id]/users for non-existent branch should return 404", async (ctx) => {
    requireServer(ctx);
    const res = await apiRequest("/api/branches/00000000-0000-0000-0000-000000000000/users");
    expect(res.status).toBe(404);
  });
});
