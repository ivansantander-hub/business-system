import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";

export async function GET(request: Request) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const companyFilter = role === "SUPER_ADMIN" ? {} : { companyId };

  const [totalLogs, byEntity, byUser, byAction, recentActivity] = await Promise.all([
    prisma.auditLog.count({ where: companyFilter }),
    prisma.auditLog.groupBy({
      by: ["entity"],
      where: { ...companyFilter, entity: { not: null } },
      _count: true,
      orderBy: { _count: { entity: "desc" } },
      take: 20,
    }),
    prisma.auditLog.groupBy({
      by: ["userId", "userName"],
      where: { ...companyFilter, userId: { not: null } },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 20,
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where: companyFilter,
      _count: true,
      orderBy: { _count: { action: "desc" } },
      take: 20,
    }),
    prisma.auditLog.findMany({
      where: companyFilter,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        userName: true,
        createdAt: true,
        level: true,
      },
    }),
  ]);

  return NextResponse.json({
    totalLogs,
    byEntity: byEntity.map((e) => ({ entity: e.entity, count: e._count })),
    byUser: byUser.map((u) => ({ userId: u.userId, userName: u.userName, count: u._count })),
    byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
    recentActivity,
  });
}
