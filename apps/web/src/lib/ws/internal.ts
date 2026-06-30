/**
 * Spec 003 — server-only seam to the standalone WS engine's internal HTTP API.
 * Mirrors broker.ts: same WS_INTERNAL_URL + WS_INTERNAL_SECRET. Never import from
 * the browser.
 */
const WS_INTERNAL_URL =
  process.env.WS_INTERNAL_URL ?? `http://localhost:${process.env.WS_PORT ?? 3001}`;
const INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET ?? "dev-internal-secret";

export async function engineFetch(
  path: string,
  init?: { method?: string },
): Promise<Response> {
  return fetch(`${WS_INTERNAL_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: { "x-internal-secret": INTERNAL_SECRET },
    signal: AbortSignal.timeout(2000),
  });
}
