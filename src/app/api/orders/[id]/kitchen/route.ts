import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditApiRequest } from "@/lib/api-audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { companyId } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });

  const body = await request.json();
  const { orderStatus, itemId, itemStatus } = body;

  const order = await prisma.order.findFirst({ where: { id, companyId } });
  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  if (orderStatus) {
    const validTransitions: Record<string, string[]> = {
      OPEN: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["READY", "CANCELLED"],
      READY: ["PAID", "CANCELLED"],
    };
    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(orderStatus)) {
      return NextResponse.json({ error: `Transición no válida de ${order.status} a ${orderStatus}` }, { status: 400 });
    }

    await prisma.order.update({
      where: { id },
      data: { status: orderStatus },
    });

    if (orderStatus === "IN_PROGRESS") {
      await prisma.orderItem.updateMany({
        where: { orderId: id, status: "PENDING" },
        data: { status: "PREPARING" },
      });
    }
    if (orderStatus === "READY") {
      await prisma.orderItem.updateMany({
        where: { orderId: id, status: { in: ["PENDING", "PREPARING"] } },
        data: { status: "READY" },
      });
    }
    if (orderStatus === "CANCELLED") {
      await prisma.orderItem.updateMany({
        where: { orderId: id, status: { not: "CANCELLED" } },
        data: { status: "CANCELLED" },
      });
    }
  }

  if (itemId && itemStatus) {
    const validItemTransitions: Record<string, string[]> = {
      PENDING: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY", "CANCELLED"],
      READY: ["DELIVERED", "CANCELLED"],
    };
    const item = await prisma.orderItem.findFirst({ where: { id: itemId, orderId: id } });
    if (!item) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    const allowed = validItemTransitions[item.status] || [];
    if (!allowed.includes(itemStatus)) {
      return NextResponse.json({ error: `Transición de item no válida de ${item.status} a ${itemStatus}` }, { status: 400 });
    }
    await prisma.orderItem.update({ where: { id: itemId }, data: { status: itemStatus } });
  }

  const updated = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { name: true } } } },
      table: { select: { number: true } },
      user: { select: { name: true } },
    },
  });

  const action = orderStatus ? `order.kitchen_${orderStatus.toLowerCase()}` : `order.kitchen_item_${itemStatus?.toLowerCase() || "update"}`;
  auditApiRequest(request, action, {
    entity: "Order",
    entityId: id,
    details: { previousStatus: order.status, orderStatus, itemId, itemStatus },
  });

  return NextResponse.json(updated);
}
