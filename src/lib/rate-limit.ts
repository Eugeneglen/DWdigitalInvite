/**
 * Simple in-memory rate limiter for serverless environments.
 * Uses a Map with automatic cleanup of expired entries.
 * Not distributed-safe (single instance), but sufficient for Railway single-container deploys.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (entry.resetAt <= now) store.delete(key);
      }
    }, 60_000);
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
   resetAt: number;
}

/**
 * Check rate limit for a given identifier.
 * @param key - Unique identifier (e.g., IP address, or IP + endpoint)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000
): RateLimitResult {
  ensureCleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // New window
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/** Extract client IP from request headers (works behind Railway proxy) */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
