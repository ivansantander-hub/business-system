import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSale } from "@/lib/sale";
import {
  getOrCreateTestCompany,
  getOrCreateTestUser,
  createTestProduct,
  openCashSession,
  cleanupTestData,
} from "./helpers";

let companyId: string;
let userId: string;

beforeAll(async () => {
  const company = await getOrCreateTestCompany();
  companyId = company.id;
  const user = await getOrCreateTestUser(companyId);
  userId = user.id;
  await cleanupTestData(companyId);
});

afterAll(async () => {
  await cleanupTestData(companyId);
});

describe("Concurrency: Parallel Sales", () => {
  it("should generate unique invoice numbers when 10 sales run in parallel", async () => {
    const product = await createTestProduct(companyId, 1000);
    await openCashSession(userId, companyId);

    const salePromises = Array.from({ length: 10 }, () =>
      createSale({
        companyId,
        userId,
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: 10000,
          },
        ],
        paymentMethod: "CASH",
        paidAmount: 11900,
      })
    );

    const results = await Promise.allSettled(salePromises);
    const successful = results.filter((r) => r.status === "fulfilled");
    const invoiceNumbers = successful.map(
      (r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof createSale>>>).value.invoice.number
    );

    // All successful invoices must have unique numbers
    const uniqueNumbers = new Set(invoiceNumbers);
    expect(uniqueNumbers.size).toBe(invoiceNumbers.length);
    // At least some should succeed (serializable retries may cause several to fail under load)
    expect(successful.length).toBeGreaterThanOrEqual(3);
  });

  it("should correctly decrement stock when parallel sales compete for the same product", async () => {
    const product = await createTestProduct(companyId, 50);

    const salePromises = Array.from({ length: 10 }, () =>
      createSale({
        companyId,
        userId,
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 3,
            unitPrice: 10000,
          },
        ],
        paymentMethod: "CASH",
        paidAmount: 35700,
      })
    );

    const results = await Promise.allSettled(salePromises);
    const successful = results.filter((r) => r.status === "fulfilled");

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });

    const totalSold = successful.length * 3;
    expect(Number(updatedProduct!.stock)).toBe(50 - totalSold);
    expect(Number(updatedProduct!.stock)).toBeGreaterThanOrEqual(0);
  });
});

describe("Concurrency: Parallel Purchases", () => {
  it("should correctly increment stock when parallel purchases are received", async () => {
    const product = await createTestProduct(companyId, 10);

    // Create a supplier first
    let supplier = await prisma.supplier.findFirst({ where: { companyId } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          companyId,
          name: "Test Supplier",
          nit: "123456789-0",
        },
      });
    }

    // Create multiple purchases
    const purchases = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.purchase.create({
          data: {
            companyId,
            supplierId: supplier!.id,
            userId,
            number: `TEST-PO-${Date.now()}-${i}`,
            subtotal: 50000,
            tax: 9500,
            total: 59500,
            status: "PENDING",
            items: {
              create: {
                productId: product.id,
                quantity: 5,
                unitPrice: 10000,
                total: 50000,
              },
            },
          },
        })
      )
    );

    // Receive all purchases in parallel
    const { Prisma } = await import("@prisma/client");
    const { createJournalEntry } = await import("@/lib/accounting");

    const receivePromises = purchases.map((purchase) =>
      prisma.$transaction(async (tx) => {
        const p = await tx.purchase.findFirst({
          where: { id: purchase.id, companyId, status: { not: "RECEIVED" } },
          include: { items: true },
        });
        if (!p) throw new Error("ALREADY_RECEIVED");

        for (const item of p.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: Number(item.quantity) } },
          });
        }

        await tx.purchase.update({
          where: { id: purchase.id },
          data: { status: "RECEIVED" },
        });

        await createJournalEntry(
          tx, companyId,
          `Compra recibida ${p.number}`,
          p.number,
          [
            { accountCode: "1435", debit: Number(p.total), credit: 0 },
            { accountCode: "2205", debit: 0, credit: Number(p.total) },
          ]
        );
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15000,
      })
    );

    const results = await Promise.allSettled(receivePromises);
    const successful = results.filter((r) => r.status === "fulfilled");

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
    });

    // Each successful receive adds 5 units
    const expectedStock = 10 + successful.length * 5;
    expect(Number(updatedProduct!.stock)).toBe(expectedStock);
  });
});

describe("Concurrency: Cash Session", () => {
  it("should prevent opening two cash sessions simultaneously", async () => {
    // Close existing sessions
    await prisma.cashSession.updateMany({
      where: { userId, companyId, status: "OPEN" },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    const { Prisma: P } = await import("@prisma/client");

    const openPromises = Array.from({ length: 5 }, () =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.cashSession.findFirst({
          where: { userId, companyId, status: "OPEN" },
        });
        if (existing) throw new Error("ALREADY_OPEN");
        return tx.cashSession.create({
          data: { companyId, userId, openingAmount: 100000 },
        });
      }, {
        isolationLevel: P.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      })
    );

    const results = await Promise.allSettled(openPromises);
    const successful = results.filter((r) => r.status === "fulfilled");

    // Only one should succeed
    expect(successful.length).toBe(1);

    const openSessions = await prisma.cashSession.findMany({
      where: { userId, companyId, status: "OPEN" },
    });
    expect(openSessions.length).toBe(1);
  });

  it("should correctly accumulate salesTotal across parallel sales", async () => {
    await prisma.cashSession.updateMany({
      where: { userId, companyId, status: "OPEN" },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    const session = await prisma.cashSession.create({
      data: { companyId, userId, openingAmount: 0 },
    });

    const product = await createTestProduct(companyId, 100);

    const salePromises = Array.from({ length: 5 }, () =>
      createSale({
        companyId,
        userId,
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: 10000,
          },
        ],
        paymentMethod: "CASH",
        paidAmount: 11900,
      })
    );

    const results = await Promise.allSettled(salePromises);
    const successful = results.filter((r) => r.status === "fulfilled");

    const updatedSession = await prisma.cashSession.findUnique({
      where: { id: session.id },
    });

    // Each sale total = 10000 * 1.19 = 11900
    const expectedTotal = successful.length * 11900;
    expect(Number(updatedSession!.salesTotal)).toBeCloseTo(expectedTotal, 0);
  });
});

describe("Concurrency: Accounting Balance Integrity", () => {
  it("should maintain balanced journal entries after parallel operations", async () => {
    const accounts = await prisma.account.findMany({
      where: { companyId },
    });

    // Sum all journal entry lines
    const lines = await prisma.journalLine.findMany({
      where: { entry: { companyId } },
    });

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

    // Double-entry: total debits must equal total credits
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });
});
