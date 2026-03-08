import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditLogger } from "@/lib/audit-logger";

export async function GET(request: Request) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  await auditLogger.flush();

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity");
  const entityId = searchParams.get("entityId");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

  if (!entity || !entityId) {
    return NextResponse.json({ error: "entity and entityId are required" }, { status: 400 });
  }

  const where: Record<string, unknown> = { entity, entityId };

  if (role !== "SUPER_ADMIN") {
    where.companyId = companyId;
  }

  const [events, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    entity,
    entityId,
    events,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
