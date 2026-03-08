import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditLogger } from "@/lib/audit-logger";

export async function GET(request: Request) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  if (!["ADMIN", "SUPER_ADMIN"].includes(role || "")) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity");
  const entityId = searchParams.get("entityId");
  if (!entity || !entityId) return NextResponse.json({ error: "entity y entityId requeridos" }, { status: 400 });

  await auditLogger.flush();

  const auditWhere: { entity: string; entityId: string; companyId?: string } = { entity, entityId };
  if (role !== "SUPER_ADMIN") {
    auditWhere.companyId = companyId;
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: auditWhere,
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  let entityData: Record<string, unknown> = {};
  let relatedData: Record<string, unknown> = {};

  if (entity === "Product") {
    const product = await prisma.product.findUnique({
      where: { id: entityId },
      include: { category: { select: { name: true } } },
    });
    entityData = product
      ? JSON.parse(
          JSON.stringify(product, (_, v) =>
            v !== null && typeof v === "object" && typeof (v as { toNumber?: () => number }).toNumber === "function"
              ? Number(v)
              : v
          )
        )
      : {};

    const invoiceItems = await prisma.invoiceItem.findMany({
      where: { productId: entityId },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            date: true,
            total: true,
            status: true,
            companyId: true,
            customer: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { invoice: { date: "desc" } },
      take: 50,
    });

    const purchaseItems = await prisma.purchaseItem.findMany({
      where: { productId: entityId },
      include: {
        purchase: {
          select: {
            id: true,
            number: true,
            date: true,
            total: true,
            status: true,
            companyId: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { purchase: { date: "desc" } },
      take: 50,
    });

    const inventoryMoves = await prisma.inventoryMovement.findMany({
      where: { productId: entityId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const customerSet = new Map<string, { id: string; name: string; totalPurchased: number; count: number }>();
    for (const item of invoiceItems) {
      if (item.invoice.customer) {
        const existing = customerSet.get(item.invoice.customer.id);
        if (existing) {
          existing.totalPurchased += Number(item.total);
          existing.count++;
        } else {
          customerSet.set(item.invoice.customer.id, {
            id: item.invoice.customer.id,
            name: item.invoice.customer.name,
            totalPurchased: Number(item.total),
            count: 1,
          });
        }
      }
    }

    relatedData = {
      sales: invoiceItems
        .filter((i) => i.invoice.companyId === companyId)
        .map((i) => ({
          invoiceId: i.invoice.id,
          invoiceNumber: i.invoice.number,
          date: i.invoice.date,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
          invoiceTotal: Number(i.invoice.total),
          status: i.invoice.status,
          customerName: i.invoice.customer?.name || null,
          customerId: i.invoice.customer?.id || null,
        })),
      purchases: purchaseItems
        .filter((p) => p.purchase.companyId === companyId)
        .map((p) => ({
          purchaseId: p.purchase.id,
          purchaseNumber: p.purchase.number,
          date: p.purchase.date,
          quantity: Number(p.quantity),
          unitPrice: Number(p.unitPrice),
          total: Number(p.total),
          purchaseTotal: Number(p.purchase.total),
          status: p.purchase.status,
          supplierName: p.purchase.supplier?.name || null,
        })),
      inventoryMovements: inventoryMoves.map((m) => ({
        type: m.type,
        quantity: Number(m.quantity),
        reference: m.referenceId || m.reason || null,
        createdAt: m.createdAt,
      })),
      customers: Array.from(customerSet.values()).sort((a, b) => b.totalPurchased - a.totalPurchased),
      totalSold: invoiceItems.reduce((sum, i) => sum + Number(i.quantity), 0),
      totalRevenue: invoiceItems.reduce((sum, i) => sum + Number(i.total), 0),
      totalPurchased: purchaseItems.reduce((sum, p) => sum + Number(p.quantity), 0),
      totalCost: purchaseItems.reduce((sum, p) => sum + Number(p.total), 0),
    };
  }

  if (entity === "Customer") {
    const customer = await prisma.customer.findUnique({
      where: { id: entityId },
      include: { gymMember: { select: { id: true } } },
    });
    entityData = customer
      ? JSON.parse(
          JSON.stringify(customer, (_, v) =>
            v !== null && typeof v === "object" && typeof (v as { toNumber?: () => number }).toNumber === "function"
              ? Number(v)
              : v
          )
        )
      : {};

    const invoices = await prisma.invoice.findMany({
      where: { customerId: entityId },
      include: { items: { select: { productName: true, quantity: true, total: true } } },
      orderBy: { date: "desc" },
      take: 50,
    });

    const membershipsData: { id: string; startDate: Date; endDate: Date; status: string; plan?: { name: string } }[] = [];
    const dayPassesData: { id: string; date: Date; price: unknown; status: string; usedEntries: number; totalEntries: number }[] = [];

    if (customer?.gymMember) {
      const memberships = await prisma.membership.findMany({
        where: { memberId: customer.gymMember.id },
        include: { plan: { select: { name: true, durationDays: true } } },
        orderBy: { startDate: "desc" },
        take: 20,
      });
      const dayPasses = await prisma.dayPass.findMany({
        where: { memberId: customer.gymMember.id },
        orderBy: { date: "desc" },
        take: 20,
      });
      membershipsData.push(
        ...memberships.map((m) => ({
          id: m.id,
          startDate: m.startDate,
          endDate: m.endDate,
          status: m.status,
          plan: m.plan ? { name: m.plan.name } : undefined,
        }))
      );
      dayPassesData.push(
        ...dayPasses.map((d) => ({
          id: d.id,
          date: d.date,
          price: d.price,
          status: d.status,
          usedEntries: d.usedEntries,
          totalEntries: d.totalEntries,
        }))
      );
    }

    relatedData = {
      invoices: invoices.map((i) => ({
        id: i.id,
        number: i.number,
        date: i.date,
        total: Number(i.total),
        status: i.status,
        paymentMethod: i.paymentMethod,
        items: i.items.map((it) => ({
          name: it.productName,
          quantity: Number(it.quantity),
          total: Number(it.total),
        })),
      })),
      memberships: membershipsData.map((m) => ({
        id: m.id,
        planName: m.plan?.name,
        startDate: m.startDate,
        endDate: m.endDate,
        status: m.status,
      })),
      dayPasses: dayPassesData.map((d) => ({
        id: d.id,
        date: d.date,
        price: Number(d.price),
        status: d.status,
        usedEntries: d.usedEntries,
        totalEntries: d.totalEntries,
      })),
      totalSpent: invoices.reduce((sum, i) => sum + Number(i.total), 0),
      invoiceCount: invoices.length,
    };
  }

  if (entity === "Invoice") {
    const invoice = await prisma.invoice.findUnique({
      where: { id: entityId },
      include: {
        customer: { select: { id: true, name: true, nit: true } },
        user: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    entityData = invoice
      ? JSON.parse(
          JSON.stringify(invoice, (_, v) =>
            v !== null && typeof v === "object" && typeof (v as { toNumber?: () => number }).toNumber === "function"
              ? Number(v)
              : v
          )
        )
      : {};
    relatedData = {};
  }

  if (entity === "User") {
    const user = await prisma.user.findUnique({
      where: { id: entityId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    entityData = user || {};

    const recentLogs = await prisma.auditLog.findMany({
      where: { userId: entityId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    relatedData = { recentActions: recentLogs };
  }

  if (entity === "Purchase") {
    const purchase = await prisma.purchase.findUnique({
      where: { id: entityId },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });
    entityData = purchase
      ? JSON.parse(
          JSON.stringify(purchase, (_, v) =>
            v !== null && typeof v === "object" && typeof (v as { toNumber?: () => number }).toNumber === "function"
              ? Number(v)
              : v
          )
        )
      : {};
    relatedData = {};
  }

  return NextResponse.json({ entity, entityId, entityData, relatedData, auditLogs });
}
