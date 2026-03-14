interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blockedUntil?: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpieza periódica para prevenir memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.firstRequest > 60 * 60 * 1000) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (entry?.blockedUntil && now < entry.blockedUntil) {
    return { allowed: false, retryAfterMs: entry.blockedUntil - now };
  }

  if (!entry || now - entry.firstRequest > config.windowMs) {
    store.set(key, { count: 1, firstRequest: now });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > config.maxRequests) {
    entry.blockedUntil = now + config.blockDurationMs;
    return { allowed: false, retryAfterMs: config.blockDurationMs };
  }

  return { allowed: true };
}
