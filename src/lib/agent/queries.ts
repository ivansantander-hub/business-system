import { prisma } from "@/lib/prisma";

type D = number;

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "object" && val !== null && "toNumber" in val && typeof (val as { toNumber: () => number }).toNumber === "function") {
    return (val as { toNumber: () => number }).toNumber();
  }
  return Number(val) || 0;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function parsePeriodDates(period: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  const now = new Date();
  if (startDate && endDate) return { start: new Date(startDate), end: new Date(endDate) };
  if (startDate) return { start: new Date(startDate), end: now };
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "week": {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      return { start: startOfDay(w), end: endOfDay(now) };
    }
    case "month": {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: m, end: endOfDay(now) };
    }
    case "year": {
      const yr = new Date(now.getFullYear(), 0, 1);
      return { start: yr, end: endOfDay(now) };
    }
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

// ──── Business Overview ────

export async function getBusinessOverview(companyId: string) {
  const [products, customers, suppliers, employees, invoicesToday] = await Promise.all([
    prisma.product.count({ where: { companyId, isActive: true } }),
    prisma.customer.count({ where: { companyId } }),
    prisma.supplier.count({ where: { companyId } }),
    prisma.employee.count({ where: { companyId, isActive: true } }),
    prisma.invoice.count({ where: { companyId, date: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) }, status: { not: "CANCELLED" } } }),
  ]);
  return { activeProducts: products, totalCustomers: customers, totalSuppliers: suppliers, activeEmployees: employees, invoicesToday };
}

// ──── Sales ────

export async function getSalesSummary(companyId: string, args: { period: string; startDate?: string; endDate?: string }) {
  const { start, end } = parsePeriodDates(args.period, args.startDate, args.endDate);
  const invoices = await prisma.invoice.findMany({
    where: { companyId, date: { gte: start, lte: end }, status: { not: "CANCELLED" } },
    select: { total: true, tax: true, discount: true, paymentMethod: true },
  });
  const total = invoices.reduce((s, i) => s + toNum(i.total), 0);
  const tax = invoices.reduce((s, i) => s + toNum(i.tax), 0);
  const discount = invoices.reduce((s, i) => s + toNum(i.discount), 0);
  return { count: invoices.length, total, tax, discount, period: args.period, startDate: start.toISOString(), endDate: end.toISOString() };
}

export async function getSalesByPaymentMethod(companyId: string, args: { period: string; startDate?: string; endDate?: string }) {
  const { start, end } = parsePeriodDates(args.period, args.startDate, args.endDate);
  const invoices = await prisma.invoice.findMany({
    where: { companyId, date: { gte: start, lte: end }, status: { not: "CANCELLED" } },
    select: { total: true, paymentMethod: true },
  });
  const byMethod: Record<string, { count: number; total: D }> = {};
  for (const inv of invoices) {
    const m = inv.paymentMethod;
    if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
    byMethod[m].count++;
    byMethod[m].total += toNum(inv.total);
  }
  return { breakdown: byMethod, period: args.period };
}

export async function getTopSellingProducts(companyId: string, args: { period: string; limit?: number; startDate?: string; endDate?: string }) {
  const { start, end } = parsePeriodDates(args.period, args.startDate, args.endDate);
  const items = await prisma.invoiceItem.findMany({
    where: { invoice: { companyId, date: { gte: start, lte: end }, status: { not: "CANCELLED" } } },
    select: { productId: true, productName: true, quantity: true, total: true },
  });
  const grouped: Record<string, { name: string; quantity: D; revenue: D }> = {};
  for (const item of items) {
    const pid = item.productId;
    if (!pid) continue;
    if (!grouped[pid]) grouped[pid] = { name: item.productName, quantity: 0, revenue: 0 };
    grouped[pid].quantity += toNum(item.quantity);
    grouped[pid].revenue += toNum(item.total);
  }
  const sorted = Object.values(grouped).sort((a, b) => b.revenue - a.revenue);
  return { products: sorted.slice(0, args.limit || 10), period: args.period };
}

export async function getInvoiceDetails(companyId: string, args: { invoiceNumber: string }) {
  const invoice = await prisma.invoice.findFirst({
    where: { companyId, number: args.invoiceNumber },
    include: { items: true, customer: { select: { name: true, nit: true } }, user: { select: { name: true } } },
  });
  if (!invoice) return { error: "Factura no encontrada" };
  return {
    number: invoice.number, date: invoice.date, status: invoice.status, paymentMethod: invoice.paymentMethod,
    subtotal: toNum(invoice.subtotal), tax: toNum(invoice.tax), discount: toNum(invoice.discount), total: toNum(invoice.total),
    customer: invoice.customer?.name || "Consumidor final", customerNit: invoice.customer?.nit,
    cashier: invoice.user.name,
    items: invoice.items.map((i) => ({ product: i.productName, quantity: toNum(i.quantity), unitPrice: toNum(i.unitPrice), total: toNum(i.total) })),
  };
}

// ──── Products ────

export async function getProductStats(companyId: string) {
  const [total, active, categories] = await Promise.all([
    prisma.product.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId, isActive: true } }),
    prisma.category.count({ where: { companyId } }),
  ]);
  return { totalProducts: total, activeProducts: active, inactive: total - active, totalCategories: categories };
}

export async function searchProducts(companyId: string, args: { query?: string; categoryId?: string; lowStockOnly?: boolean }) {
  const products = await prisma.product.findMany({
    where: {
      companyId,
      isActive: true,
      ...(args.query ? { name: { contains: args.query, mode: "insensitive" as const } } : {}),
      ...(args.categoryId ? { categoryId: args.categoryId } : {}),
    },
    select: { id: true, name: true, salePrice: true, costPrice: true, stock: true, minStock: true, unit: true, category: { select: { name: true } } },
    take: 20,
    orderBy: { name: "asc" },
  });

  const result = products
    .filter((p) => !args.lowStockOnly || toNum(p.stock) <= toNum(p.minStock))
    .map((p) => ({
      id: p.id, name: p.name, salePrice: toNum(p.salePrice), costPrice: toNum(p.costPrice),
      stock: toNum(p.stock), minStock: toNum(p.minStock), unit: p.unit, category: p.category?.name || "Sin categoría",
    }));
  return { products: result, count: result.length };
}

export async function getProductDetails(companyId: string, args: { productId: string }) {
  const p = await prisma.product.findFirst({
    where: { id: args.productId, companyId },
    include: { category: { select: { name: true } } },
  });
  if (!p) return { error: "Producto no encontrado" };
  return {
    id: p.id, name: p.name, description: p.description, barcode: p.barcode, unit: p.unit,
    costPrice: toNum(p.costPrice), salePrice: toNum(p.salePrice), taxRate: toNum(p.taxRate),
    stock: toNum(p.stock), minStock: toNum(p.minStock), category: p.category?.name, isActive: p.isActive,
  };
}

export async function getLowStockProducts(companyId: string) {
  const products = await prisma.product.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true, stock: true, minStock: true, unit: true },
    orderBy: { name: "asc" },
  });
  const lowStock = products.filter((p) => toNum(p.stock) <= toNum(p.minStock));
  return { products: lowStock.map((p) => ({ id: p.id, name: p.name, stock: toNum(p.stock), minStock: toNum(p.minStock), unit: p.unit })), count: lowStock.length };
}

// ──── Inventory ────

export async function getInventoryStatus(companyId: string, args: { productId?: string; lowStockOnly?: boolean }) {
  const products = await prisma.product.findMany({
    where: {
      companyId,
      isActive: true,
      ...(args.productId ? { id: args.productId } : {}),
    },
    select: { id: true, name: true, stock: true, minStock: true, costPrice: true, unit: true },
    take: 50,
    orderBy: { name: "asc" },
  });

  const result = products
    .filter((p) => !args.lowStockOnly || toNum(p.stock) <= toNum(p.minStock))
    .map((p) => ({
      id: p.id, name: p.name, stock: toNum(p.stock), minStock: toNum(p.minStock),
      value: toNum(p.stock) * toNum(p.costPrice), unit: p.unit,
    }));
  return { items: result, totalValue: result.reduce((s, i) => s + i.value, 0) };
}

export async function getInventoryMovements(companyId: string, args: { productId?: string; limit?: number }) {
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      companyId,
      ...(args.productId ? { productId: args.productId } : {}),
    },
    include: { product: { select: { name: true } }, user: { select: { name: true } } },
    take: args.limit || 20,
    orderBy: { createdAt: "desc" },
  });

  return {
    movements: movements.map((m) => ({
      date: m.createdAt, type: m.type, product: m.product.name, quantity: toNum(m.quantity),
      previousStock: toNum(m.previousStock), newStock: toNum(m.newStock),
      reason: m.reason, user: m.user?.name,
    })),
  };
}

// ──── Customers ────

export async function listCustomers(companyId: string, args: { limit?: number; offset?: number }) {
  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      select: { id: true, name: true, nit: true, phone: true, email: true, balance: true },
      take: args.limit || 20,
      skip: args.offset || 0,
      orderBy: { name: "asc" },
    }),
    prisma.customer.count({ where: { companyId } }),
  ]);
  return { total, showing: customers.length, customers: customers.map((c) => ({ ...c, balance: toNum(c.balance) })) };
}

export async function searchCustomers(companyId: string, args: { query?: string }) {
  const customers = await prisma.customer.findMany({
    where: {
      companyId,
      ...(args.query ? { OR: [{ name: { contains: args.query, mode: "insensitive" as const } }, { nit: { contains: args.query } }] } : {}),
    },
    select: { id: true, name: true, nit: true, phone: true, email: true, balance: true },
    take: 20,
    orderBy: { name: "asc" },
  });
  return { customers: customers.map((c) => ({ ...c, balance: toNum(c.balance) })) };
}

export async function getCustomerDetails(companyId: string, args: { customerId: string }) {
  const c = await prisma.customer.findFirst({
    where: { id: args.customerId, companyId },
    include: { _count: { select: { invoices: true, orders: true } } },
  });
  if (!c) return { error: "Cliente no encontrado" };
  return {
    id: c.id, name: c.name, nit: c.nit, phone: c.phone, email: c.email, address: c.address,
    creditLimit: toNum(c.creditLimit), balance: toNum(c.balance), totalInvoices: c._count.invoices, totalOrders: c._count.orders,
  };
}

export async function getCustomerPurchaseHistory(companyId: string, args: { customerId: string; limit?: number }) {
  const invoices = await prisma.invoice.findMany({
    where: { companyId, customerId: args.customerId },
    select: { number: true, date: true, total: true, paymentMethod: true, status: true },
    take: args.limit || 10,
    orderBy: { date: "desc" },
  });
  return { invoices: invoices.map((i) => ({ ...i, total: toNum(i.total) })) };
}

// ──── Suppliers ────

export async function listSuppliers(companyId: string, args: { limit?: number }) {
  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where: { companyId },
      select: { id: true, name: true, nit: true, contactName: true, phone: true, email: true },
      take: args.limit || 20,
      orderBy: { name: "asc" },
    }),
    prisma.supplier.count({ where: { companyId } }),
  ]);
  return { total, suppliers };
}

export async function searchSuppliers(companyId: string, args: { query?: string }) {
  const suppliers = await prisma.supplier.findMany({
    where: {
      companyId,
      ...(args.query ? { OR: [{ name: { contains: args.query, mode: "insensitive" as const } }, { nit: { contains: args.query } }] } : {}),
    },
    select: { id: true, name: true, nit: true, contactName: true, phone: true },
    take: 20,
    orderBy: { name: "asc" },
  });
  return { suppliers };
}

export async function getPurchaseOrders(companyId: string, args: { status?: string; limit?: number }) {
  const purchases = await prisma.purchase.findMany({
    where: {
      companyId,
      ...(args.status ? { status: args.status as "PENDING" | "RECEIVED" | "CANCELLED" } : {}),
    },
    include: { supplier: { select: { name: true } } },
    take: args.limit || 10,
    orderBy: { createdAt: "desc" },
  });
  return {
    purchases: purchases.map((p) => ({
      number: p.number, date: p.date, supplier: p.supplier.name, total: toNum(p.total), status: p.status,
    })),
  };
}

// ──── Orders ────

export async function getActiveOrders(companyId: string) {
  const orders = await prisma.order.findMany({
    where: { companyId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    include: {
      table: { select: { number: true } },
      customer: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    orders: orders.map((o) => ({
      id: o.id, type: o.type, status: o.status, table: o.table?.number, customer: o.customer?.name,
      total: toNum(o.total), itemCount: o.items.length, createdAt: o.createdAt,
      items: o.items.map((i) => ({ product: i.product?.name ?? i.productId, quantity: toNum(i.quantity), status: i.status })),
    })),
  };
}

export async function getOrderDetails(companyId: string, args: { orderId: string }) {
  const o = await prisma.order.findFirst({
    where: { id: args.orderId, companyId },
    include: {
      table: { select: { number: true } }, customer: { select: { name: true } }, user: { select: { name: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });
  if (!o) return { error: "Orden no encontrada" };
  return {
    id: o.id, type: o.type, status: o.status, table: o.table?.number, customer: o.customer?.name, user: o.user.name,
    subtotal: toNum(o.subtotal), tax: toNum(o.tax), discount: toNum(o.discount), total: toNum(o.total),
    items: o.items.map((i) => ({ product: i.product?.name ?? i.productId, quantity: toNum(i.quantity), unitPrice: toNum(i.unitPrice), total: toNum(i.total), status: i.status })),
  };
}

export async function getTableStatus(companyId: string) {
  const tables = await prisma.restaurantTable.findMany({
    where: { companyId },
    select: { id: true, number: true, capacity: true, section: true, status: true },
    orderBy: { number: "asc" },
  });
  return {
    tables: tables.map((t) => ({ number: t.number, capacity: t.capacity, section: t.section, status: t.status })),
    summary: {
      total: tables.length,
      available: tables.filter((t) => t.status === "AVAILABLE").length,
      occupied: tables.filter((t) => t.status === "OCCUPIED").length,
    },
  };
}

// ──── Employees ────

export async function listEmployees(companyId: string, args: { activeOnly?: boolean; limit?: number }) {
  const whereFilter = { companyId, ...(args.activeOnly !== false ? { isActive: true } : {}) };
  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where: whereFilter,
      select: { id: true, firstName: true, lastName: true, docNumber: true, position: true, contractType: true, baseSalary: true, isActive: true },
      take: args.limit || 30,
      orderBy: { firstName: "asc" },
    }),
    prisma.employee.count({ where: whereFilter }),
  ]);
  return { total, employees: employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, document: e.docNumber, position: e.position, contractType: e.contractType, baseSalary: toNum(e.baseSalary), isActive: e.isActive })) };
}

export async function searchEmployees(companyId: string, args: { query?: string }) {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      isActive: true,
      ...(args.query ? { OR: [
        { firstName: { contains: args.query, mode: "insensitive" as const } },
        { lastName: { contains: args.query, mode: "insensitive" as const } },
        { docNumber: { contains: args.query } },
      ] } : {}),
    },
    select: { id: true, firstName: true, lastName: true, docNumber: true, position: true, contractType: true },
    take: 20,
  });
  return { employees: employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, document: e.docNumber, position: e.position, contractType: e.contractType })) };
}

export async function getEmployeeDetails(companyId: string, args: { employeeId: string }) {
  const e = await prisma.employee.findFirst({
    where: { id: args.employeeId, companyId },
  });
  if (!e) return { error: "Empleado no encontrado" };
  return {
    id: e.id, name: `${e.firstName} ${e.lastName}`, docType: e.docType, docNumber: e.docNumber,
    position: e.position, contractType: e.contractType, startDate: e.startDate,
    baseSalary: toNum(e.baseSalary), salaryType: e.salaryType, isActive: e.isActive,
  };
}

// ──── Payroll ────

export async function getPayrollRuns(companyId: string, args: { limit?: number }) {
  const runs = await prisma.payrollRun.findMany({
    where: { companyId },
    select: {
      id: true, period: true, periodStart: true, periodEnd: true, frequency: true, status: true,
      totalEarnings: true, totalDeductions: true, netPay: true, _count: { select: { items: true } },
    },
    take: args.limit || 5,
    orderBy: { period: "desc" },
  });
  return {
    runs: runs.map((r) => ({
      id: r.id, period: r.period, periodStart: r.periodStart, periodEnd: r.periodEnd,
      frequency: r.frequency, status: r.status, employeeCount: r._count.items,
      totalEarnings: toNum(r.totalEarnings), totalDeductions: toNum(r.totalDeductions), netPay: toNum(r.netPay),
    })),
  };
}

export async function getPayrollSummary(companyId: string, args: { payrollRunId: string }) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: args.payrollRunId, companyId },
    include: { items: { include: { employee: { select: { firstName: true, lastName: true } } } } },
  });
  if (!run) return { error: "Corrida de nómina no encontrada" };
  return {
    period: run.period, status: run.status,
    totalEarnings: toNum(run.totalEarnings), totalDeductions: toNum(run.totalDeductions), netPay: toNum(run.netPay),
    employees: run.items.map((i) => ({
      name: `${i.employee.firstName} ${i.employee.lastName}`,
      baseSalary: toNum(i.baseSalary), earnings: toNum(i.totalEarnings),
      deductions: toNum(i.totalDeductions), netPay: toNum(i.netPay), daysWorked: i.daysWorked,
    })),
  };
}

// ──── Accounting ────

export async function getAccountBalances(companyId: string, args: { type?: string }) {
  const accounts = await prisma.account.findMany({
    where: {
      companyId,
      isActive: true,
      ...(args.type ? { type: args.type as "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | "COST" } : {}),
    },
    select: { code: true, name: true, type: true, balance: true },
    orderBy: { code: "asc" },
  });
  return { accounts: accounts.map((a) => ({ code: a.code, name: a.name, type: a.type, balance: toNum(a.balance) })) };
}

export async function getJournalEntries(companyId: string, args: { limit?: number; startDate?: string; endDate?: string }) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      companyId,
      ...(args.startDate || args.endDate ? {
        date: {
          ...(args.startDate ? { gte: new Date(args.startDate) } : {}),
          ...(args.endDate ? { lte: new Date(args.endDate) } : {}),
        },
      } : {}),
    },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    take: args.limit || 10,
    orderBy: { date: "desc" },
  });
  return {
    entries: entries.map((e) => ({
      date: e.date, description: e.description, reference: e.reference,
      lines: e.lines.map((l) => ({ account: `${l.account.code} - ${l.account.name}`, debit: toNum(l.debit), credit: toNum(l.credit) })),
    })),
  };
}

// ──── Memberships ────

export async function getActiveMemberships(companyId: string, args: { expiringInDays?: number }) {
  const deadline = args.expiringInDays
    ? (() => { const d = new Date(); d.setDate(d.getDate() + args.expiringInDays!); return d; })()
    : undefined;

  const memberships = await prisma.membership.findMany({
    where: {
      status: "ACTIVE",
      member: { companyId },
      ...(deadline ? { endDate: { lte: deadline } } : {}),
    },
    include: { member: { include: { customer: { select: { name: true } } } }, plan: { select: { name: true } } },
    take: 20,
    orderBy: { endDate: "asc" },
  });

  return {
    memberships: memberships.map((m) => ({
      member: m.member.customer.name, plan: m.plan.name,
      startDate: m.startDate, endDate: m.endDate, status: m.status, paymentStatus: m.paymentStatus,
    })),
    count: memberships.length,
  };
}

export async function getMembershipStats(companyId: string) {
  const members = await prisma.gymMember.findMany({ where: { companyId }, select: { status: true } });
  const active = members.filter((m) => m.status === "ACTIVE").length;
  const inactive = members.filter((m) => m.status === "INACTIVE").length;

  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);

  const expiringSoon = await prisma.membership.count({
    where: { member: { companyId }, status: "ACTIVE", endDate: { gte: today, lte: nextMonth } },
  });

  return { totalMembers: members.length, active, inactive, expiringSoon };
}

// ──── Cash ────

export async function getCashSessions(companyId: string, args: { status?: string }) {
  const sessions = await prisma.cashSession.findMany({
    where: {
      companyId,
      ...(args.status ? { status: args.status as "OPEN" | "CLOSED" } : {}),
    },
    include: { user: { select: { name: true } }, branch: { select: { name: true } } },
    take: 10,
    orderBy: { openedAt: "desc" },
  });
  return {
    sessions: sessions.map((s) => ({
      id: s.id, user: s.user.name, branch: s.branch?.name, status: s.status,
      openingAmount: toNum(s.openingAmount), salesTotal: toNum(s.salesTotal),
      closingAmount: s.closingAmount ? toNum(s.closingAmount) : null,
      openedAt: s.openedAt, closedAt: s.closedAt,
    })),
  };
}

export async function getDailyCashSummary(companyId: string, args: { date?: string }) {
  const targetDate = args.date ? new Date(args.date) : new Date();
  const start = startOfDay(targetDate);
  const end = endOfDay(targetDate);

  const invoices = await prisma.invoice.findMany({
    where: { companyId, date: { gte: start, lte: end }, status: { not: "CANCELLED" } },
    select: { total: true, paymentMethod: true },
  });
  const expenses = await prisma.expense.findMany({
    where: { companyId, date: { gte: start, lte: end } },
    select: { amount: true, category: true },
  });

  const totalSales = invoices.reduce((s, i) => s + toNum(i.total), 0);
  const totalExpenses = expenses.reduce((s, e) => s + toNum(e.amount), 0);

  return { date: targetDate.toISOString().split("T")[0], totalSales, invoiceCount: invoices.length, totalExpenses, expenseCount: expenses.length, net: totalSales - totalExpenses };
}

// ──── Audit ────

export async function getRecentAudit(companyId: string, args: { entity?: string; action?: string; limit?: number }) {
  const logs = await prisma.auditLog.findMany({
    where: {
      companyId,
      ...(args.entity ? { entity: args.entity } : {}),
      ...(args.action ? { action: { contains: args.action } } : {}),
    },
    select: { action: true, entity: true, entityId: true, userName: true, details: true, createdAt: true },
    take: args.limit || 20,
    orderBy: { createdAt: "desc" },
  });
  return { logs };
}

export async function getEntityAuditHistory(companyId: string, args: { entity: string; entityId: string }) {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, entity: args.entity, entityId: args.entityId },
    select: { action: true, userName: true, details: true, beforeState: true, afterState: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return { entity: args.entity, entityId: args.entityId, history: logs };
}

// ──── Flexible SQL Query ────

const DANGEROUS_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXEC|EXECUTE|MERGE|CALL|SET|COMMIT|ROLLBACK|SAVEPOINT|EXPLAIN|PRAGMA|ATTACH|DETACH|VACUUM|ANALYZE|DBCC|CHECKPOINT|LOAD|COPY|IMPORT)\b/i;
const ALLOWED_TENANT_TABLES = new Set([
  "categories", "products", "customers", "suppliers", "invoices", "invoice_items",
  "purchases", "purchase_items", "orders", "order_items", "restaurant_tables",
  "employees", "payroll_runs", "payroll_items", "inventory_movements",
  "cash_sessions", "expenses", "accounts", "journal_entries", "journal_lines",
  "gym_members", "memberships", "membership_plans", "check_ins",
  "branches",
]);
const ALLOWED_PUBLIC_TABLES = new Set(["audit_logs"]);

function stripSqlComments(sql: string): string {
  // Elimina comentarios de bloque /* ... */ y de línea -- ...
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validateSqlQuery(sql: string): { valid: boolean; error?: string } {
  // Rechazar cualquier comentario antes de procesarlo (evasión de keywords)
  if (sql.includes("--") || sql.includes("/*") || sql.includes("*/")) {
    return { valid: false, error: "Comentarios SQL no están permitidos" };
  }

  // Rechazar múltiples sentencias (semicolon seguido de contenido)
  if (/;\s*\S/.test(sql)) {
    return { valid: false, error: "Solo se permite una consulta a la vez" };
  }

  const clean = stripSqlComments(sql).replace(/;+$/, "").trim();

  // La query limpia debe empezar estrictamente con SELECT
  if (!/^SELECT\s/i.test(clean)) {
    return { valid: false, error: "Solo se permiten consultas SELECT" };
  }

  // Verificar keywords peligrosos en la query limpia
  if (DANGEROUS_KEYWORDS.test(clean)) {
    return { valid: false, error: "La consulta contiene operaciones no permitidas" };
  }

  return { valid: true };
}

function injectCompanyFilter(sql: string, companyId: string): string {
  let query = sql.trim().replace(/;+$/, "");

  const tablesReferenced: { table: string; alias: string; schema: "tenant" | "public" }[] = [];
  const fromJoinPattern = /(?:FROM|JOIN)\s+(tenant\.|public\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
  let match;
  while ((match = fromJoinPattern.exec(query)) !== null) {
    const schemaPrefix = match[1]?.replace(".", "") as "tenant" | "public" | undefined;
    const tableName = match[2].toLowerCase();
    const alias = match[3] || match[2];

    if (ALLOWED_TENANT_TABLES.has(tableName)) {
      tablesReferenced.push({ table: tableName, alias, schema: schemaPrefix || "tenant" });
    } else if (ALLOWED_PUBLIC_TABLES.has(tableName)) {
      tablesReferenced.push({ table: tableName, alias, schema: schemaPrefix || "public" });
    }
  }

  const mainTable = tablesReferenced[0];
  if (!mainTable) return query;

  const companyCol = "company_id";
  const filterExpr = `${mainTable.alias}.${companyCol} = '${companyId}'`;

  const whereIndex = query.toUpperCase().indexOf("WHERE");
  const groupIndex = query.toUpperCase().indexOf("GROUP BY");
  const orderIndex = query.toUpperCase().indexOf("ORDER BY");
  const limitIndex = query.toUpperCase().indexOf("LIMIT");
  const havingIndex = query.toUpperCase().indexOf("HAVING");

  if (whereIndex !== -1) {
    const insertPos = whereIndex + 6;
    query = query.slice(0, insertPos) + ` ${filterExpr} AND` + query.slice(insertPos);
  } else {
    const insertBefore = [groupIndex, orderIndex, limitIndex, havingIndex]
      .filter((i) => i !== -1)
      .sort((a, b) => a - b)[0];

    if (insertBefore !== undefined) {
      query = query.slice(0, insertBefore) + ` WHERE ${filterExpr} ` + query.slice(insertBefore);
    } else {
      query += ` WHERE ${filterExpr}`;
    }
  }

  if (!/LIMIT\s+\d+/i.test(query)) {
    query += " LIMIT 100";
  }

  return query;
}

export async function executeSqlQuery(companyId: string, args: { sql: string; description?: string }) {
  const validation = validateSqlQuery(args.sql);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const finalSql = injectCompanyFilter(args.sql, companyId);

  try {
    const results = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(finalSql);

    const serialized = results.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(row)) {
        if (val instanceof Date) out[key] = val.toISOString();
        else if (typeof val === "bigint") out[key] = Number(val);
        else if (val !== null && typeof val === "object" && "toNumber" in val) out[key] = (val as { toNumber: () => number }).toNumber();
        else out[key] = val;
      }
      return out;
    });

    return { rows: serialized, rowCount: serialized.length, query: args.description || "Consulta SQL" };
  } catch (err) {
    return { error: `Error en consulta: ${err instanceof Error ? err.message : "desconocido"}` };
  }
}

export const QUERY_HANDLERS: Record<string, (companyId: string, args: Record<string, unknown>) => Promise<unknown>> = {
  get_business_overview: (cid) => getBusinessOverview(cid),
  get_sales_summary: (cid, args) => getSalesSummary(cid, args as Parameters<typeof getSalesSummary>[1]),
  get_sales_by_payment_method: (cid, args) => getSalesByPaymentMethod(cid, args as Parameters<typeof getSalesByPaymentMethod>[1]),
  get_top_selling_products: (cid, args) => getTopSellingProducts(cid, args as Parameters<typeof getTopSellingProducts>[1]),
  get_invoice_details: (cid, args) => getInvoiceDetails(cid, args as Parameters<typeof getInvoiceDetails>[1]),
  get_product_stats: (cid) => getProductStats(cid),
  search_products: (cid, args) => searchProducts(cid, args as Parameters<typeof searchProducts>[1]),
  get_product_details: (cid, args) => getProductDetails(cid, args as Parameters<typeof getProductDetails>[1]),
  get_low_stock_products: (cid) => getLowStockProducts(cid),
  get_inventory_status: (cid, args) => getInventoryStatus(cid, args as Parameters<typeof getInventoryStatus>[1]),
  get_inventory_movements: (cid, args) => getInventoryMovements(cid, args as Parameters<typeof getInventoryMovements>[1]),
  list_customers: (cid, args) => listCustomers(cid, args as Parameters<typeof listCustomers>[1]),
  search_customers: (cid, args) => searchCustomers(cid, args as Parameters<typeof searchCustomers>[1]),
  get_customer_details: (cid, args) => getCustomerDetails(cid, args as Parameters<typeof getCustomerDetails>[1]),
  get_customer_purchase_history: (cid, args) => getCustomerPurchaseHistory(cid, args as Parameters<typeof getCustomerPurchaseHistory>[1]),
  list_suppliers: (cid, args) => listSuppliers(cid, args as Parameters<typeof listSuppliers>[1]),
  search_suppliers: (cid, args) => searchSuppliers(cid, args as Parameters<typeof searchSuppliers>[1]),
  get_purchase_orders: (cid, args) => getPurchaseOrders(cid, args as Parameters<typeof getPurchaseOrders>[1]),
  get_active_orders: (cid) => getActiveOrders(cid),
  get_order_details: (cid, args) => getOrderDetails(cid, args as Parameters<typeof getOrderDetails>[1]),
  get_table_status: (cid) => getTableStatus(cid),
  list_employees: (cid, args) => listEmployees(cid, args as Parameters<typeof listEmployees>[1]),
  search_employees: (cid, args) => searchEmployees(cid, args as Parameters<typeof searchEmployees>[1]),
  get_employee_details: (cid, args) => getEmployeeDetails(cid, args as Parameters<typeof getEmployeeDetails>[1]),
  get_payroll_runs: (cid, args) => getPayrollRuns(cid, args as Parameters<typeof getPayrollRuns>[1]),
  get_payroll_summary: (cid, args) => getPayrollSummary(cid, args as Parameters<typeof getPayrollSummary>[1]),
  get_account_balances: (cid, args) => getAccountBalances(cid, args as Parameters<typeof getAccountBalances>[1]),
  get_journal_entries: (cid, args) => getJournalEntries(cid, args as Parameters<typeof getJournalEntries>[1]),
  get_active_memberships: (cid, args) => getActiveMemberships(cid, args as Parameters<typeof getActiveMemberships>[1]),
  get_membership_stats: (cid) => getMembershipStats(cid),
  get_cash_sessions: (cid, args) => getCashSessions(cid, args as Parameters<typeof getCashSessions>[1]),
  get_daily_cash_summary: (cid, args) => getDailyCashSummary(cid, args as Parameters<typeof getDailyCashSummary>[1]),
  get_recent_audit: (cid, args) => getRecentAudit(cid, args as Parameters<typeof getRecentAudit>[1]),
  get_entity_audit_history: (cid, args) => getEntityAuditHistory(cid, args as Parameters<typeof getEntityAuditHistory>[1]),
  execute_sql_query: (cid, args) => executeSqlQuery(cid, args as Parameters<typeof executeSqlQuery>[1]),
};
