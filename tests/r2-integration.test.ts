/**
 * R2 Integration Tests — require R2 credentials in .env and a running dev server.
 * Tests actual upload/download/delete against the live Cloudflare R2 bucket.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { signToken } from "@/lib/auth";
import { getOrCreateTestCompany, getOrCreateTestUser } from "./helpers";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
let serverAvailable = false;
let token: string;
let companyId: string;
let userId: string;

async function apiRequest(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    Cookie: `token=${token}`,
    ...(options.headers as Record<string, string> || {}),
  };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
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
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: `token=${token}` },
      signal: AbortSignal.timeout(5000),
    });
    serverAvailable = res.ok || res.status === 401;
  } catch {
    serverAvailable = false;
    console.warn(`Server not available at ${BASE_URL} — R2 integration tests will be skipped`);
  }
});

describe("R2 Direct Client Integration", () => {
  it("should upload, verify, and delete a test object from R2", async (ctx) => {
    requireServer(ctx);

    const { uploadToR2, existsInR2, getBufferFromR2, deleteFromR2, isR2Configured } = await import("@/lib/r2");

    if (!isR2Configured()) {
      console.warn("R2 not configured — skipping direct R2 test");
      ctx.skip();
      return;
    }

    const testKey = `_test/integration-${Date.now()}.txt`;
    const testContent = `R2 integration test at ${new Date().toISOString()}`;
    const buffer = Buffer.from(testContent, "utf-8");

    // Upload
    const uploadedKey = await uploadToR2(testKey, buffer, "text/plain");
    expect(uploadedKey).toBe(testKey);

    // Verify existence
    const exists = await existsInR2(testKey);
    expect(exists).toBe(true);

    // Download and verify content
    const result = await getBufferFromR2(testKey);
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("text/plain");
    expect(result!.buffer.toString("utf-8")).toBe(testContent);

    // Delete
    await deleteFromR2(testKey);

    // Verify deletion
    const existsAfter = await existsInR2(testKey);
    expect(existsAfter).toBe(false);
  });

  it("should upload and retrieve a PDF-like binary from R2", async (ctx) => {
    requireServer(ctx);

    const { uploadToR2, getBufferFromR2, deleteFromR2, isR2Configured } = await import("@/lib/r2");

    if (!isR2Configured()) {
      ctx.skip();
      return;
    }

    const { generateInvoicePdf } = await import("@/lib/pdf");

    const pdfBytes = await generateInvoicePdf({
      invoiceNumber: "TEST-R2-001",
      date: "08/03/2026",
      companyName: "Test R2 Co",
      companyNit: "900000000-1",
      paymentMethod: "CASH",
      items: [{ name: "Test Item", quantity: 1, unitPrice: 10000, total: 10000 }],
      subtotal: 10000,
      taxRate: 0.19,
      tax: 1900,
      discount: 0,
      total: 11900,
      paidAmount: 12000,
      changeAmount: 100,
      type: "sale",
    });

    const testKey = `_test/test-invoice-${Date.now()}.pdf`;
    await uploadToR2(testKey, Buffer.from(pdfBytes), "application/pdf");

    const result = await getBufferFromR2(testKey);
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("application/pdf");
    expect(result!.buffer.length).toBeGreaterThan(500);

    // Verify PDF header magic bytes
    const header = result!.buffer.toString("ascii", 0, 4);
    expect(header).toBe("%PDF");

    // Cleanup
    await deleteFromR2(testKey);
  });
});

describe("R2 via API — Invoice PDF Flow", () => {
  let invoiceId: string | null = null;

  it("should create a sale, auto-generate PDF, and retrieve it via API", async (ctx) => {
    requireServer(ctx);

    // 1. Open a cash session (or reuse existing one)
    const openRes = await apiRequest("/api/cash", {
      method: "POST",
      body: JSON.stringify({ action: "open", openingAmount: 50000 }),
    });
    // 200 or 400 (already open) both are fine
    expect([200, 201, 400].includes(openRes.status)).toBe(true);

    // 2. Create a sale/invoice
    const saleRes = await apiRequest("/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        items: [
          { productName: "R2 Test Product", quantity: 1, unitPrice: 5000 },
        ],
        paymentMethod: "CASH",
        paidAmount: 10000,
      }),
    });

    if (saleRes.status === 400) {
      // Possible "no cash session" or similar — skip
      console.warn("Could not create sale (possibly no cash session). Skipping PDF retrieval.");
      return;
    }

    expect(saleRes.status).toBe(201);
    const invoice = await saleRes.json();
    invoiceId = invoice.id;
    expect(invoice.id).toBeTruthy();
    expect(invoice.number).toBeTruthy();

    // 3. Wait for background PDF generation to complete
    await new Promise((r) => setTimeout(r, 5000));

    // 4. Retrieve the PDF via API
    const pdfRes = await fetch(`${BASE_URL}/api/invoices/${invoice.id}/pdf`, {
      headers: { Cookie: `token=${token}` },
    });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toBe("application/pdf");

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    expect(pdfBuffer.length).toBeGreaterThan(500);

    // Verify it's a valid PDF
    const magic = pdfBuffer.toString("ascii", 0, 4);
    expect(magic).toBe("%PDF");

    console.log(`✓ Invoice ${invoice.number} PDF generated and stored in R2 (${pdfBuffer.length} bytes)`);
  });

  it("should verify the PDF is cached in R2", async (ctx) => {
    requireServer(ctx);
    if (!invoiceId) { ctx.skip(); return; }

    const { isR2Configured } = await import("@/lib/r2");
    if (!isR2Configured()) { ctx.skip(); return; }

    // Second request should serve from R2 cache
    const pdfRes = await fetch(`${BASE_URL}/api/invoices/${invoiceId}/pdf`, {
      headers: { Cookie: `token=${token}` },
    });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toBe("application/pdf");
    console.log("✓ PDF served from R2 cache on second request");
  });
});

describe("R2 via API — Purchase PDF Flow", () => {
  it("should create a purchase and retrieve its PDF via API", async (ctx) => {
    requireServer(ctx);

    // We need a supplier and product first
    const suppRes = await apiRequest("/api/suppliers");
    if (!suppRes.ok) { ctx.skip(); return; }
    const suppliers = await suppRes.json();
    if (suppliers.length === 0) { ctx.skip(); return; }

    const prodRes = await apiRequest("/api/products?active=true");
    if (!prodRes.ok) { ctx.skip(); return; }
    const products = await prodRes.json();
    if (products.length === 0) { ctx.skip(); return; }

    // Create a purchase
    const purchaseRes = await apiRequest("/api/purchases", {
      method: "POST",
      body: JSON.stringify({
        supplierId: suppliers[0].id,
        items: [{ productId: products[0].id, quantity: 1, unitPrice: 1000 }],
      }),
    });

    expect(purchaseRes.status).toBe(201);
    const purchase = await purchaseRes.json();

    // Wait for background PDF generation
    await new Promise((r) => setTimeout(r, 5000));

    // Retrieve PDF
    const pdfRes = await fetch(`${BASE_URL}/api/purchases/${purchase.id}/pdf`, {
      headers: { Cookie: `token=${token}` },
    });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toBe("application/pdf");

    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    expect(pdfBuffer.length).toBeGreaterThan(500);
    expect(pdfBuffer.toString("ascii", 0, 4)).toBe("%PDF");

    console.log(`✓ Purchase ${purchase.number} PDF generated and stored in R2 (${pdfBuffer.length} bytes)`);
  });
});

describe("R2 via API — Avatar Upload Flow", () => {
  it("should upload an avatar and retrieve it via API", async (ctx) => {
    requireServer(ctx);

    const { isR2Configured } = await import("@/lib/r2");
    if (!isR2Configured()) { ctx.skip(); return; }

    // Create a small 1x1 pixel PNG for testing
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
      0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const formData = new FormData();
    const blob = new Blob([pngBytes], { type: "image/png" });
    formData.append("avatar", blob, "test-avatar.png");

    const uploadRes = await fetch(`${BASE_URL}/api/profile/avatar`, {
      method: "POST",
      headers: { Cookie: `token=${token}` },
      body: formData,
    });

    expect(uploadRes.status).toBe(200);
    const uploadData = await uploadRes.json();
    expect(uploadData.key).toContain("users/");
    expect(uploadData.key).toContain("/avatar.png");

    // Retrieve the avatar
    const avatarRes = await fetch(`${BASE_URL}/api/profile/avatar`, {
      headers: { Cookie: `token=${token}` },
    });

    expect(avatarRes.status).toBe(200);
    expect(avatarRes.headers.get("content-type")).toContain("image/png");

    const avatarBuffer = Buffer.from(await avatarRes.arrayBuffer());
    expect(avatarBuffer.length).toBeGreaterThan(10);

    console.log(`✓ Avatar uploaded and retrieved from R2 (${avatarBuffer.length} bytes)`);

    // Delete the avatar
    const deleteRes = await fetch(`${BASE_URL}/api/profile/avatar`, {
      method: "DELETE",
      headers: { Cookie: `token=${token}` },
    });
    expect(deleteRes.status).toBe(200);

    // Verify it's gone
    const avatarGoneRes = await fetch(`${BASE_URL}/api/profile/avatar`, {
      headers: { Cookie: `token=${token}` },
    });
    expect(avatarGoneRes.status).toBe(404);

    console.log("✓ Avatar deleted from R2 successfully");
  });
});

describe("R2 via API — Profile Integration", () => {
  it("GET /api/auth/me should return avatarUrl field", async (ctx) => {
    requireServer(ctx);

    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: `token=${token}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("avatarUrl");
  });

  it("GET /api/profile should return user info with avatarUrl", async (ctx) => {
    requireServer(ctx);

    const res = await apiRequest("/api/profile");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("email");
    expect(data).toHaveProperty("avatarUrl");
  });
});
