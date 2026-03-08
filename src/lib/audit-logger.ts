import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface AuditLogEntry {
  companyId?: string | null;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  changeReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  source?: "backend" | "frontend";
  level?: "info" | "warn" | "error" | "debug";
  duration?: number | null;
  statusCode?: number | null;
  path?: string | null;
  method?: string | null;
}

function computeChecksum(entry: AuditLogEntry): string {
  const payload = JSON.stringify({
    a: entry.action,
    e: entry.entity,
    eid: entry.entityId,
    u: entry.userId,
    b: entry.beforeState,
    af: entry.afterState,
    d: entry.details,
    t: Date.now(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

class AuditLogger {
  private static instance: AuditLogger;
  private queue: (AuditLogEntry & { checksum: string })[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 2000;

  private constructor() {}

  static getInstance(): AuditLogger {
    AuditLogger.instance ??= new AuditLogger();
    return AuditLogger.instance;
  }

  log(entry: AuditLogEntry): void {
    const checksum = computeChecksum(entry);
    this.queue.push({ ...entry, checksum });

    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }

  info(action: string, ctx: Partial<AuditLogEntry> = {}): void {
    this.log({ action, level: "info", source: "backend", ...ctx });
  }

  warn(action: string, ctx: Partial<AuditLogEntry> = {}): void {
    this.log({ action, level: "warn", source: "backend", ...ctx });
  }

  error(action: string, ctx: Partial<AuditLogEntry> = {}): void {
    this.log({ action, level: "error", source: "backend", ...ctx });
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.BATCH_SIZE);

    try {
      await prisma.auditLog.createMany({
        data: batch.map((e) => ({
          companyId: e.companyId ?? null,
          userId: e.userId ?? null,
          userName: e.userName ?? null,
          action: e.action,
          entity: e.entity ?? null,
          entityId: e.entityId ?? null,
          details: (e.details ?? undefined) as Prisma.InputJsonValue | undefined,
          beforeState: (e.beforeState ?? undefined) as Prisma.InputJsonValue | undefined,
          afterState: (e.afterState ?? undefined) as Prisma.InputJsonValue | undefined,
          changeReason: e.changeReason ?? null,
          checksum: e.checksum,
          ipAddress: e.ipAddress ?? null,
          userAgent: e.userAgent ?? null,
          source: e.source ?? "backend",
          level: e.level ?? "info",
          duration: e.duration ?? null,
          statusCode: e.statusCode ?? null,
          path: e.path ?? null,
          method: e.method ?? null,
        })),
      });
    } catch (err) {
      console.error("AuditLogger flush failed:", err);
      if (this.queue.length < 500) {
        this.queue.unshift(...batch);
      }
    }

    if (this.queue.length > 0 && !this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }
}

export const auditLogger = AuditLogger.getInstance();

export function extractRequestMeta(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
  const userAgent = request.headers.get("user-agent") ?? null;
  return { ipAddress, userAgent };
}

export function logApiCall(
  request: Request,
  user: { userId?: string; name?: string; companyId?: string | null },
  action: string,
  extra: Partial<AuditLogEntry> = {}
): void {
  const { ipAddress, userAgent } = extractRequestMeta(request);
  const url = new URL(request.url);

  auditLogger.info(action, {
    userId: user.userId,
    userName: user.name,
    companyId: user.companyId,
    ipAddress,
    userAgent,
    path: url.pathname,
    method: request.method,
    ...extra,
  });
}
