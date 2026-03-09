import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { userId, companyId: headerCompanyId } = getUserFromHeaders(request);
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "20", 10)));
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const typeFilter = searchParams.get("type"); // "email" | "system" | undefined
  const companyId = headerCompanyId || searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  }

  const notificationWhere: { companyId: string; type?: string } = { companyId };
  if (typeFilter === "email" || typeFilter === "system") {
    notificationWhere.type = typeFilter;
  }

  const where = {
    userId,
    notification: notificationWhere,
    ...(unreadOnly && { readAt: null }),
  };

  const [userNotifications, total, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({
      where,
      include: {
        notification: {
          select: { id: true, type: true, subject: true, bodyHtml: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.userNotification.count({ where }),
    prisma.userNotification.count({
      where: { userId, readAt: null, notification: { companyId } },
    }),
  ]);

  const notifications = userNotifications.map((un) => ({
    id: un.notification.id,
    userNotificationId: un.id,
    type: un.notification.type,
    subject: un.notification.subject,
    bodyHtml: un.notification.bodyHtml,
    createdAt: un.notification.createdAt,
    readAt: un.readAt,
  }));

  return NextResponse.json({
    notifications,
    total,
    unreadCount,
  });
}
