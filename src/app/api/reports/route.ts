import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "dashboard";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to + "T23:59:59");

  if (type === "dashboard") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todaySales, todayInvoices, openOrders, lowStock, recentInvoices] = await Promise.all([
      prisma.invoice.aggregate({
        where: { date: { gte: today, lt: tomorrow }, status: "PAID" },
        _sum: { total: true },
        _count: true,
      }),
      prisma.invoice.count({
        where: { date: { gte: today, lt: tomorrow }, status: "PAID" },
      }),
      prisma.order.count({ where: { status: "OPEN" } }),
      prisma.product.count({
        where: {
          isActive: true,
          stock: { lte: prisma.product.fields.minStock },
        },
      }).catch(() => 0),
      prisma.invoice.findMany({
        where: { status: "PAID" },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Sales last 7 days
    const salesByDay = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);

      const dayTotal = await prisma.invoice.aggregate({
        where: { date: { gte: d, lt: next }, status: "PAID" },
        _sum: { total: true },
      });

      salesByDay.push({
        date: d.toISOString().split("T")[0],
        total: Number(dayTotal._sum.total) || 0,
      });
    }

    // Low stock products
    const lowStockProducts = await prisma.$queryRaw`
      SELECT id, name, stock, min_stock FROM products
      WHERE is_active = true AND stock <= min_stock
      ORDER BY stock ASC LIMIT 10
    `;

    return NextResponse.json({
      todaySales: Number(todaySales._sum.total) || 0,
      todayTransactions: todayInvoices,
      openOrders,
      lowStockCount: lowStock,
      salesByDay,
      recentInvoices,
      lowStockProducts,
    });
  }

  if (type === "sales") {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      },
      include: {
        customer: { select: { name: true } },
        items: true,
      },
      orderBy: { date: "desc" },
    });

    const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalTax = invoices.reduce((sum, inv) => sum + Number(inv.tax), 0);

    return NextResponse.json({
      invoices,
      summary: { total: totalSales, tax: totalTax, count: invoices.length },
    });
  }

  if (type === "inventory") {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    const totalValue = products.reduce(
      (sum, p) => sum + Number(p.stock) * Number(p.costPrice),
      0
    );
    const totalSaleValue = products.reduce(
      (sum, p) => sum + Number(p.stock) * Number(p.salePrice),
      0
    );

    return NextResponse.json({
      products,
      summary: { totalProducts: products.length, totalValue, totalSaleValue },
    });
  }

  if (type === "income-expense") {
    const incomeWhere = {
      status: "PAID" as const,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    };
    const expenseWhere = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

    const [income, expenses] = await Promise.all([
      prisma.invoice.aggregate({ where: incomeWhere, _sum: { total: true } }),
      prisma.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
    ]);

    const expensesByCategory = await prisma.expense.groupBy({
      by: ["category"],
      where: expenseWhere,
      _sum: { amount: true },
    });

    return NextResponse.json({
      totalIncome: Number(income._sum.total) || 0,
      totalExpenses: Number(expenses._sum.amount) || 0,
      profit: (Number(income._sum.total) || 0) - (Number(expenses._sum.amount) || 0),
      expensesByCategory,
    });
  }

  if (type === "top-products") {
    const topProducts = await prisma.invoiceItem.groupBy({
      by: ["productName"],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 20,
    });
    return NextResponse.json(topProducts);
  }

  return NextResponse.json({ error: "Tipo de reporte no válido" }, { status: 400 });
}
