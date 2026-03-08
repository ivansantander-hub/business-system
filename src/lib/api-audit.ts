import { getUserFromHeaders } from "@/lib/auth";
import { auditLogger, extractRequestMeta } from "@/lib/audit-logger";

/**
 * Audit middleware wrapper — call at end of each API handler to log the action.
 * Designed to be non-blocking (fire-and-forget).
 */
export function auditApiRequest(
  request: Request,
  action: string,
  opts: {
    entity?: string;
    entityId?: string;
    statusCode?: number;
    details?: Record<string, unknown>;
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
