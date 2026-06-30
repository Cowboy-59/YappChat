import { uuidv7 } from "uuidv7";
import type { WSEvent } from "./events";

/**
 * Spec 003 (core slice) — LocalBroker publish bridge.
 *
 * apps/web runs as a separate process from the WS engine, so publishing an event
 * POSTs it to the engine's internal `/publish` endpoint. This is the single seam
 * the rest of the app calls; swapping to a RedisBroker later only changes this
 * file. Best-effort: a publish failure must never break the caller's flow.
 */
const WS_INTERNAL_URL =
  process.env.WS_INTERNAL_URL ?? `http://localhost:${process.env.WS_PORT ?? 3001}`;
const INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET ?? "dev-internal-secret";

export async function publishEvent(input: {
  type: string;
  scope: string;
  payload?: unknown;
}): Promise<void> {
  const event: WSEvent = {
    id: uuidv7(),
    type: input.type,
    scope: input.scope,
    payload: input.payload,
    ts: Date.now(),
  };
  try {
    const res = await fetch(`${WS_INTERNAL_URL}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": INTERNAL_SECRET },
      body: JSON.stringify(event),
      // Don't let a slow/absent engine hang the request.
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      console.error(`[ws] publish rejected: ${res.status} (check WS_INTERNAL_SECRET)`);
    }
  } catch (err) {
    console.error("[ws] publish failed (engine down?):", (err as Error).message);
  }
}
