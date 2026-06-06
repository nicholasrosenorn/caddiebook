import type { Context, MiddlewareHandler } from 'hono';

// A small in-memory fixed-window rate limiter. Sufficient for a single-instance
// deployment (one container) — no Redis. Buckets are keyed per limiter (`name`)
// plus a caller key (IP or user id) and reset when their window elapses.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = 0;

// Drop expired buckets opportunistically (no timers, so tests don't leak handles).
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  lastSweep = now;
}

// Test helper: clear all limiter state between cases.
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}

type RateLimitOptions = {
  /** Namespaces the buckets so multiple limiters don't collide. */
  name: string;
  windowMs: number;
  max: number;
  /** Derives the per-caller key (e.g. IP for /auth, user id for /sync). */
  key: (c: Context) => string;
};

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const now = Date.now();
    sweep(now);

    const id = `${opts.name}:${opts.key(c)}`;
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(id, bucket);
    }
    bucket.count += 1;

    if (bucket.count > opts.max) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return c.json({ error: 'rate limit exceeded' }, 429);
    }
    await next();
  };
}

// Real client IP behind Cloudflare Tunnel / proxies (the socket IP is the proxy).
export function clientIp(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
