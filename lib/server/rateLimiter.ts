/**
 * In-memory sliding window rate limiter.
 *
 * Suitable for single-instance deployment (e.g. Docker, PM2).
 * For multi-instance deployments (Vercel Serverless / Edge), replace
 * `store` with an Upstash Redis client.
 *
 * Usage:
 *   const result = rateLimit(clientIp, { limit: 10, windowMs: 60_000 });
 *   if (!result.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

/** Clean up stale entries every 5 minutes to prevent memory leaks. */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    // Remove entries with no recent timestamps
    if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < now - 300_000) {
      store.delete(key);
    }
  }
}, 300_000);

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. */
  limit: number;
  /** Time window in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Unix timestamp (ms) when the window resets. */
  resetAt: number;
}

/**
 * Check and record a rate limit hit for the given `key`.
 * `key` is typically the client IP or a combination of IP + route.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const { limit, windowMs } = options;
  const windowStart = now - windowMs;

  const entry = store.get(key) ?? { timestamps: [] };

  // Purge timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  const remaining = Math.max(0, limit - entry.timestamps.length - 1);
  const resetAt = entry.timestamps[0] ? entry.timestamps[0] + windowMs : now + windowMs;

  if (entry.timestamps.length >= limit) {
    store.set(key, entry);
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return { allowed: true, remaining, resetAt };
}

/**
 * Extract the real client IP from a Next.js request.
 * Respects common proxy headers (X-Forwarded-For, CF-Connecting-IP).
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  // Cloudflare
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf;
  // Standard proxy
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  // Fallback (development)
  return "127.0.0.1";
}
