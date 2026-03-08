import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditLogger, extractRequestMeta } from "@/lib/audit-logger";

/** POST — receive frontend logs (batch) */
export async function POST(request: Request) {
  const { userId, name, companyId } = getUserFromHeaders(request);
  const { ipAddress, userAgent } = extractRequestMeta(request);

  try {
    const body = await request.json();
    const entries: unknown[] = Array.isArray(body) ? body : [body];

    for (const raw of entries) {
      const e = raw as Record<string, unknown>;
      auditLogger.log({
        companyId: companyId ?? (e.companyId as string) ?? null,
        userId: userId || (e.userId as string) || null,
        userName: name || (e.userName as string) || null,
        action: String(e.action || "unknown"),
        entity: (e.entity as string) ?? null,
        entityId: (e.entityId as string) ?? null,
        details: (e.details as Record<string, unknown>) ?? null,
        ipAddress,
        userAgent,
        source: "frontend",
        level: (e.level as "info" | "warn" | "error" | "debug") ?? "info",
        path: (e.path as string) ?? null,
        method: (e.method as string) ?? null,
      });
    }

    return NextResponse.json({ ok: true, count: entries.length });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

/** GET — query logs (admin only) */
export async function GET(request: Request) {
  const { companyId, role } = getUserFromHeaders(request);
  if (!companyId) return NextResponse.json({ error: "Contexto de empresa requerido" }, { status: 403 });
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // Force flush pending logs before querying
  await auditLogger.flush();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");
  const entity = searchParams.get("entity");
  const level = searchParams.get("level");
  const source = searchParams.get("source");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};

  if (role !== "SUPER_ADMIN") {
    where.companyId = companyId;
  }
  const entityId = searchParams.get("entityId");

  if (userId) where.userId = userId;
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;
  if (level) where.level = level;
  if (source) where.source = source;
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entity: { contains: search, mode: "insensitive" } },
      { userName: { contains: search, mode: "insensitive" } },
      { path: { contains: search, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to + "T23:59:59");
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
