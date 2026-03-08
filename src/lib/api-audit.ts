import { getUserFromHeaders } from "@/lib/auth";
import { auditLogger, extractRequestMeta } from "@/lib/audit-logger";

/**
 * Audit middleware wrapper for API handlers.
 * Supports before/after state capture for full traceability.
 */
export function auditApiRequest(
  request: Request,
  action: string,
  opts: {
    entity?: string;
    entityId?: string;
    statusCode?: number;
    details?: Record<string, unknown>;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    changeReason?: string;
    startTime?: number;
  } = {}
): void {
  const { userId, name, companyId } = getUserFromHeaders(request);
  const { ipAddress, userAgent } = extractRequestMeta(request);
  const url = new URL(request.url);

  auditLogger.log({
    companyId,
    userId: userId || null,
    userName: name || null,
    action,
    entity: opts.entity ?? null,
    entityId: opts.entityId ?? null,
    details: opts.details ?? null,
    beforeState: opts.beforeState ?? null,
    afterState: opts.afterState ?? null,
    changeReason: opts.changeReason ?? null,
    ipAddress,
    userAgent,
    source: "backend",
    level: (opts.statusCode ?? 200) >= 400 ? "warn" : "info",
    duration: opts.startTime ? Date.now() - opts.startTime : null,
    statusCode: opts.statusCode ?? null,
    path: url.pathname,
    method: request.method,
  });
}

/**
 * Serialize an entity to a plain object suitable for before/after storage.
 * Strips Prisma Decimal objects and nested relations for clean JSON.
 */
export function serializeEntity(entity: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!entity) return null;
  return JSON.parse(JSON.stringify(entity, (_key, value) => {
    if (value !== null && typeof value === "object" && typeof value.toNumber === "function") {
      return Number(value);
    }
    return value;
  }));
}
