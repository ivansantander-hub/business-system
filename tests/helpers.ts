import { prisma } from "@/lib/prisma";
import { AccountType } from "@prisma/client";
import { hash } from "bcryptjs";

export async function getOrCreateTestCompany() {
  let company = await prisma.company.findFirst({
    where: { name: "Test Company Concurrency" },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "Test Company Concurrency",
        nit: "999999999-0",
        type: "RESTAURANT",
      },
    });
  }

  const requiredAccounts: { code: string; name: string; type: AccountType }[] = [
    { code: "110505", name: "Caja General", type: AccountType.ASSET },
    { code: "130505", name: "Clientes", type: AccountType.ASSET },
    { code: "1435", name: "Mercancías", type: AccountType.ASSET },
    { code: "2205", name: "Proveedores Nacionales", type: AccountType.LIABILITY },
    { code: "240801", name: "IVA Generado 19%", type: AccountType.LIABILITY },
    { code: "4135", name: "Comercio al por Mayor y Menor", type: AccountType.INCOME },
    { code: "5195", name: "Diversos", type: AccountType.EXPENSE },
    { code: "4250", name: "Ingresos Diversos", type: AccountType.INCOME },
  ];

  for (const acc of requiredAccounts) {
    const existing = await prisma.account.findFirst({
      where: { companyId: company.id, code: acc.code },
    });
    if (!existing) {
      await prisma.account.create({
        data: { companyId: company.id, ...acc, balance: 0 },
      });
    }
  }

  return company;
}

export async function getOrCreateTestBranch(companyId: string) {
  let branch = await prisma.branch.findFirst({
    where: { companyId, name: "Test Branch" },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { companyId, name: "Test Branch", address: "Test Address" },
    });
  }
  return branch;
}

export async function getOrCreateTestUser(companyId: string) {
  let user = await prisma.user.findFirst({
    where: { email: "test-concurrency@test.com" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Test Concurrency User",
        email: "test-concurrency@test.com",
        password: await hash("test123", 10),
      },
    });
  }

  const uc = await prisma.userCompany.findFirst({
    where: { userId: user.id, companyId },
  });
  if (!uc) {
    await prisma.userCompany.create({
      data: { userId: user.id, companyId, role: "ADMIN" },
    });
  }

  return user;
}

export async function getOrCreateSecondTestUser(companyId: string) {
  let user = await prisma.user.findFirst({
    where: { email: "test-messaging@test.com" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Test Messaging User",
        email: "test-messaging@test.com",
        password: await hash("test123", 10),
      },
    });
  }

  const uc = await prisma.userCompany.findFirst({
    where: { userId: user.id, companyId },
  });
  if (!uc) {
    await prisma.userCompany.create({
      data: { userId: user.id, companyId, role: "CASHIER" },
    });
  }

  return user;
}

export async function createTestProduct(companyId: string, stock = 100, branchId?: string) {
  return prisma.product.create({
    data: {
      companyId,
      branchId: branchId || null,
      name: `Test Product ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      salePrice: 10000,
      costPrice: 5000,
      stock,
      minStock: 5,
    },
  });
}

export async function openCashSession(userId: string, companyId: string, branchId?: string) {
  const existing = await prisma.cashSession.findFirst({
    where: { userId, companyId, status: "OPEN", ...(branchId ? { branchId } : {}) },
  });
  if (existing) return existing;

  return prisma.cashSession.create({
    data: {
      companyId,
      userId,
      branchId: branchId || null,
      openingAmount: 100000,
    },
  });
}

export async function cleanupTestData(companyId: string) {
  await prisma.journalLine.deleteMany({
    where: { entry: { companyId } },
  });
  await prisma.journalEntry.deleteMany({ where: { companyId } });
  await prisma.invoiceItem.deleteMany({
    where: { invoice: { companyId } },
  });
  await prisma.invoice.deleteMany({ where: { companyId } });
  await prisma.inventoryMovement.deleteMany({ where: { companyId } });
  await prisma.cashSession.deleteMany({ where: { companyId } });
  await prisma.purchaseItem.deleteMany({
    where: { purchase: { companyId } },
  });
  await prisma.purchase.deleteMany({ where: { companyId } });
  await prisma.product.deleteMany({ where: { companyId } });
  await prisma.setting.deleteMany({ where: { companyId } });
  await prisma.userBranch.deleteMany({ where: { branch: { companyId } } });
  await prisma.branch.deleteMany({ where: { companyId } });
}
