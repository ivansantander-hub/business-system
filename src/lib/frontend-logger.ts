"use client";

interface FrontendLogEntry {
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  level?: "info" | "warn" | "error" | "debug";
  path?: string;
}

class FrontendLogger {
  private static instance: FrontendLogger;
  private queue: FrontendLogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_SIZE = 20;
  private readonly FLUSH_INTERVAL_MS = 5000;

  private constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flush());
      window.addEventListener("error", (event) => {
        this.error("client.unhandled_error", {
          details: { message: event.message, filename: event.filename, lineno: event.lineno },
        });
      });
      window.addEventListener("unhandledrejection", (event) => {
        this.error("client.unhandled_rejection", {
          details: { reason: String(event.reason) },
        });
      });
    }
  }

  static getInstance(): FrontendLogger {
    FrontendLogger.instance ??= new FrontendLogger();
    return FrontendLogger.instance;
  }

  private log(entry: FrontendLogEntry): void {
    entry.path ??= typeof window !== "undefined" ? window.location.pathname : undefined;
    this.queue.push(entry);

    if (this.queue.length >= this.BATCH_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }

  info(action: string, opts: Partial<FrontendLogEntry> = {}): void {
    this.log({ action, level: "info", ...opts });
  }

  warn(action: string, opts: Partial<FrontendLogEntry> = {}): void {
    this.log({ action, level: "warn", ...opts });
  }

  error(action: string, opts: Partial<FrontendLogEntry> = {}): void {
    this.log({ action, level: "error", ...opts });
  }

  pageView(path: string): void {
    this.log({ action: "page.view", level: "info", path });
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.BATCH_SIZE);

    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        keepalive: true,
      });
      if (!res.ok && this.queue.length < 200) {
        this.queue.unshift(...batch);
      }
    } catch {
      if (this.queue.length < 200) {
        this.queue.unshift(...batch);
      }
    }

    if (this.queue.length > 0 && !this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL_MS);
    }
  }
}

export const frontendLogger = typeof window !== "undefined"
  ? FrontendLogger.getInstance()
  : ({
      info: () => {},
      warn: () => {},
      error: () => {},
      pageView: () => {},
      flush: async () => {},
    } as FrontendLogger);
