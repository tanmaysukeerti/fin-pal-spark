/** Tiny in-memory sliding-window rate limiter (per server process).
 *  Good enough for a single-instance dev/demo deployment; swap for Redis/Upstash
 *  in a horizontally-scaled production. */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    const retryAfterMs = windowMs - (now - arr[0]);
    hits.set(key, arr);
    return { allowed: false, retryAfterMs };
  }
  arr.push(now);
  hits.set(key, arr);
  return { allowed: true, retryAfterMs: 0 };
}

/** Clear a key after a successful action (so a good login resets the counter). */
export function rateLimitReset(key: string): void {
  hits.delete(key);
}
