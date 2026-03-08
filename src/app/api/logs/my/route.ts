import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromHeaders } from "@/lib/auth";
import { auditLogger } from "@/lib/audit-logger";

/** GET — current user's own activity logs */
export async function GET(request: Request) {
  const { userId, companyId } = getUserFromHeaders(request);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  await auditLogger.flush();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));

  const where: Record<string, unknown> = { userId };
  if (companyId) where.companyId = companyId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        level: true,
        source: true,
        path: true,
        method: true,
        createdAt: true,
      },
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
