type AgentLogMeta = {
  userId?: string;
  companyId?: string;
  toolName?: string;
  queryDescription?: string;
  rowCount?: number;
  durationMs?: number;
};

function sanitizeError(err: unknown): string {
  if (!(err instanceof Error)) return "unknown error";
  return `${err.constructor.name}: ${err.message.slice(0, 200)}`;
}

export const agentLogger = {
  info(event: string, meta: AgentLogMeta = {}) {
    console.log(JSON.stringify({ level: "info", event, ...meta, ts: new Date().toISOString() }));
  },
  warn(event: string, meta: AgentLogMeta = {}) {
    console.warn(JSON.stringify({ level: "warn", event, ...meta, ts: new Date().toISOString() }));
  },
  error(event: string, err: unknown, meta: AgentLogMeta = {}) {
    console.error(JSON.stringify({ level: "error", event, error: sanitizeError(err), ...meta, ts: new Date().toISOString() }));
  },
};
