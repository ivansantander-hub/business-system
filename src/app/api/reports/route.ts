import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId, branchId, role } = getUserFromHeaders(request);
  if (!companyId) {
    return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "dashboard";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const qsBranch = searchParams.get("branchId");

  const effectiveBranch = (role === "ADMIN" || role === "SUPER_ADMIN")
    ? (qsBranch || null)
    : branchId;

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to + "T23:59:59");

  try {
    if (type === "dashboard") {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { type: true },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const invoiceWhere = { companyId, ...(effectiveBranch ? { branchId: effectiveBranch } : {}) };
      const [todaySales, todayInvoices, recentInvoices] = await Promise.all([
        prisma.invoice.aggregate({
          where: { ...invoiceWhere, date: { gte: today, lt: tomorrow }, status: "PAID" },
          _sum: { total: true },
          _count: true,
        }),
        prisma.invoice.count({
          where: { ...invoiceWhere, date: { gte: today, lt: tomorrow }, status: "PAID" },
        }),
        prisma.invoice.findMany({
          where: { ...invoiceWhere, status: "PAID" },
          include: { customer: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

      const lowStockProducts = await prisma.product.findMany({
        where: {
          companyId,
          ...(effectiveBranch ? { branchId: effectiveBranch } : {}),
          isActive: true,
          stock: { lte: prisma.product.fields?.minStock as unknown as number ?? 0 },
        },
        select: { id: true, name: true, stock: true, minStock: true },
        orderBy: { stock: "asc" },
        take: 10,
      }).catch(() => []);

      const filteredLowStock = lowStockProducts.filter(
        (p) => Number(p.stock) <= Number(p.minStock)
      );

      const salesByDay = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);

        const dayTotal = await prisma.invoice.aggregate({
          where: { ...invoiceWhere, date: { gte: d, lt: next }, status: "PAID" },
          _sum: { total: true },
        });

        salesByDay.push({
          date: d.toISOString().split("T")[0],
          total: Number(dayTotal._sum.total) || 0,
        });
      }

      const baseData = {
        companyType: company?.type || "RESTAURANT",
        todaySales: Number(todaySales._sum.total) || 0,
        todayTransactions: todayInvoices,
        salesByDay,
        recentInvoices,
        lowStockCount: filteredLowStock.length,
        lowStockProducts: filteredLowStock.map((p) => ({
          id: p.id,
          name: p.name,
          stock: String(p.stock),
          min_stock: String(p.minStock),
        })),
      };

      if (company?.type === "GYM") {
        const now = new Date();
        const [
          totalMembers,
          activeMembers,
          todayCheckIns,
          activeMemberships,
          expiringMemberships,
          activeDayPasses,
        ] = await Promise.all([
          prisma.gymMember.count({ where: { companyId } }),
          prisma.gymMember.count({ where: { companyId, status: "ACTIVE" } }),
          prisma.checkIn.count({ where: { companyId, timestamp: { gte: today, lt: tomorrow } } }),
          prisma.membership.count({ where: { companyId, status: "ACTIVE", endDate: { gte: now } } }),
          prisma.membership.findMany({
            where: {
              companyId,
              status: "ACTIVE",
              endDate: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
            },
            include: { member: { include: { customer: { select: { name: true } } } }, plan: { select: { name: true } } },
            orderBy: { endDate: "asc" },
            take: 10,
          }),
          prisma.dayPass.count({ where: { companyId, status: "ACTIVE" } }),
        ]);

        const checkInsByDay = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          d.setHours(0, 0, 0, 0);
          const next = new Date(d);
          next.setDate(next.getDate() + 1);
          const count = await prisma.checkIn.count({
            where: { companyId, timestamp: { gte: d, lt: next }, type: "ENTRY" },
          });
          checkInsByDay.push({ date: d.toISOString().split("T")[0], entries: count });
        }

        return NextResponse.json({
          ...baseData,
          gym: {
            totalMembers,
            activeMembers,
            todayCheckIns,
            activeMemberships,
            activeDayPasses,
            expiringMemberships: expiringMemberships.map((m) => ({
              id: m.id,
              memberName: m.member.customer.name,
              planName: m.plan.name,
              endDate: m.endDate,
            })),
            checkInsByDay,
          },
        });
      }

      const openOrders = await prisma.order.count({ where: { companyId, status: "OPEN" } });
      return NextResponse.json({ ...baseData, openOrders });
    }

    if (type === "sales") {
      const invoices = await prisma.invoice.findMany({
        where: {
          companyId,
          ...(effectiveBranch ? { branchId: effectiveBranch } : {}),
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
        where: { companyId, ...(effectiveBranch ? { branchId: effectiveBranch } : {}), isActive: true },
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
        companyId,
        status: "PAID" as const,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      };
      const expenseWhere = {
        companyId,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      };

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
        where: {
          invoice: { companyId },
        },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 20,
      });
      return NextResponse.json(topProducts);
    }

    return NextResponse.json({ error: "Tipo de reporte no válido" }, { status: 400 });
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 });
  }
}
