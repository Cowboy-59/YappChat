/**
 * Spec 011 — minimal in-memory rate limiter (T002).
 *
 * Per-instance only: a sliding fixed-window counter held in a Map. This covers
 * the spec's soft limits (signup/login/reset) for a single-node deployment; a
 * multi-node deployment should swap this for a shared store (Redis). Documented
 * limitation, not a silent cap.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateResult = { allowed: boolean; retryAfterSec: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** Test/maintenance helper. */
export function resetRateLimits(): void {
  buckets.clear();
}
