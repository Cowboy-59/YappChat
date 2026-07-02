import { createHash, createHmac } from "node:crypto";
import { EngineError } from "../engine/errors";

/**
 * Spec 071 (Presentation) T005 — LiveKit access-token minting.
 *
 * The one-to-many broadcast runs over LiveKit (the chosen SFU). A LiveKit access
 * token is just an HS256 JWT signed with the API secret carrying a video grant,
 * so we mint it directly with node:crypto — no SDK dependency. Config comes from
 * env (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET); when unset the room
 * simply has no live media (the rest of the presentation still works).
 */
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY ?? "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET ?? "";

export function livekitConfigured(): boolean {
  return Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

export function livekitUrl(): string {
  return LIVEKIT_URL;
}

/** Stable LiveKit room name for a presentation. */
export function roomName(presentationid: string): string {
  return `presentation-${presentationid}`;
}

export interface LivekitGrant {
  identity: string; // unique participant id (userid, or guest-<attendeeid>)
  name: string; // display name
  room: string;
  canPublish: boolean; // host broadcasts screen+audio; attendees watch-only
  canSubscribe: boolean;
  canPublishData: boolean; // data channel for guest chat / hand-raise
  ttlSeconds?: number;
}

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/** Mint a LiveKit JWT for a participant. Throws if LiveKit is not configured. */
export function mintAccessToken(g: LivekitGrant): string {
  if (!livekitConfigured()) throw new EngineError("livekit_unconfigured", 503);
  const now = Math.floor(Date.now() / 1000);
  const ttl = g.ttlSeconds ?? 6 * 60 * 60; // 6h — long enough for a session
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: LIVEKIT_API_KEY,
      sub: g.identity,
      name: g.name,
      nbf: now,
      exp: now + ttl,
      video: {
        room: g.room,
        roomJoin: true,
        canPublish: g.canPublish,
        canPublishData: g.canPublishData,
        canSubscribe: g.canSubscribe,
      },
    }),
  );
  const sig = createHmac("sha256", LIVEKIT_API_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

/** Convenience: the {url, token} a joined participant hands to the LiveKit client. */
export function connectionFor(
  presentationid: string,
  participant: { identity: string; name: string; isHost: boolean },
): { url: string; token: string } | null {
  if (!livekitConfigured()) return null;
  return {
    url: livekitUrl(),
    token: mintAccessToken({
      identity: participant.identity,
      name: participant.name,
      room: roomName(presentationid),
      canPublish: participant.isHost, // only the host broadcasts media (v1 broadcast-only)
      canSubscribe: true,
      canPublishData: true,
    }),
  };
}

// ── Egress / room service (T008 recording seam) ─────────────────────────────────
//
// Recording uses LiveKit room-composite egress to S3. These call the LiveKit
// server's HTTP (twirp) API with a room-admin token. All are best-effort and
// env-gated: a missing config or a failed call never breaks the session — the
// egress_ended webhook (or a manual register) still records the result.

const S3_BUCKET = process.env.S3_BUCKET ?? "";
const S3_REGION = process.env.AWS_REGION ?? "";
const LIVEKIT_S3_ACCESS_KEY = process.env.LIVEKIT_S3_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID ?? "";
const LIVEKIT_S3_SECRET = process.env.LIVEKIT_S3_SECRET ?? process.env.AWS_SECRET_ACCESS_KEY ?? "";

export function egressConfigured(): boolean {
  return Boolean(livekitConfigured() && S3_BUCKET && LIVEKIT_S3_ACCESS_KEY && LIVEKIT_S3_SECRET);
}

/** LiveKit server HTTP base (twirp). Derives http(s) from the ws(s) client URL. */
function httpBase(): string {
  return (process.env.LIVEKIT_HTTP_URL ?? LIVEKIT_URL).replace(/^ws/, "http").replace(/\/+$/, "");
}

/** Parse a presentation id back out of a `presentation-<id>` room name. */
export function roomNameToPresentationId(room: string): string | null {
  return room.startsWith("presentation-") ? room.slice("presentation-".length) : null;
}

function mintAdminToken(room: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: LIVEKIT_API_KEY,
      sub: "presentation-server",
      nbf: now,
      exp: now + 600,
      video: { room, roomAdmin: true, roomRecord: true, roomList: true },
    }),
  );
  const sig = createHmac("sha256", LIVEKIT_API_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function twirp(service: string, method: string, room: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${httpBase()}/twirp/livekit.${service}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${mintAdminToken(room)}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error(`[livekit] ${service}.${method} failed:`, (err as Error).message);
    return null;
  }
}

/**
 * Start room-composite egress → S3 MP4 (screen + audio + burned captions).
 * Returns the LiveKit egress id (so we can pull the result on End) or an error
 * string. Never throws — a null id with an error lets the caller record + surface
 * the failure instead of showing a "Recording" badge that lies.
 */
export async function startRoomEgress(presentationid: string): Promise<{ egressId: string | null; error: string | null }> {
  if (!egressConfigured()) return { egressId: null, error: "egress_unconfigured" };
  const room = roomName(presentationid);
  const res = await twirp("Egress", "StartRoomCompositeEgress", room, {
    room_name: room,
    layout: "speaker",
    file_outputs: [
      {
        file_type: "MP4",
        filepath: `recordings/${presentationid}/{time}.mp4`,
        s3: { access_key: LIVEKIT_S3_ACCESS_KEY, secret: LIVEKIT_S3_SECRET, bucket: S3_BUCKET, region: S3_REGION },
      },
    ],
  });
  if (!res) return { egressId: null, error: "livekit_unreachable" };
  const text = await res.text().catch(() => "");
  if (!res.ok) return { egressId: null, error: `egress_start_${res.status}: ${text.slice(0, 300)}` };
  try {
    const info = JSON.parse(text) as { egress_id?: string; egressId?: string };
    return { egressId: info.egress_id ?? info.egressId ?? null, error: null };
  } catch {
    return { egressId: null, error: "egress_start_unparseable" };
  }
}

type EgressFile = { filename?: string; location?: string; duration?: string | number };
type EgressItem = {
  egress_id?: string;
  egressId?: string;
  status?: string; // EGRESS_STARTING | EGRESS_ACTIVE | EGRESS_ENDING | EGRESS_COMPLETE | EGRESS_FAILED | EGRESS_ABORTED
  error?: string;
  file_results?: EgressFile[];
  fileResults?: EgressFile[];
  file?: EgressFile;
};

/** Reduce any S3 location/URL LiveKit reports to a bare key relative to our bucket. */
export function normalizeS3Key(location: string): string {
  let k = location.trim();
  k = k.replace(/^s3:\/\/[^/]+\//i, ""); // s3://bucket/key
  k = k.replace(/^https?:\/\/[^/]+\//i, ""); // https://bucket.s3.region.amazonaws.com/key
  k = k.replace(/^\/+/, ""); // leading slashes
  try {
    k = decodeURIComponent(k);
  } catch {
    /* leave as-is */
  }
  return k;
}

/**
 * Pull the latest egress for a presentation's room via ListEgress — the primary
 * way we retrieve a finished recording (we do NOT depend on the webhook). Returns
 * the normalized S3 key, duration, LiveKit status, and any error. Best-effort.
 */
export async function getEgressInfo(
  presentationid: string,
  egressId?: string | null,
): Promise<{ status: string | null; fileKey: string | null; durationms: number | null; error: string | null } | null> {
  if (!livekitConfigured()) return null;
  const room = roomName(presentationid);
  const res = await twirp("Egress", "ListEgress", room, egressId ? { egress_id: egressId } : { room_name: room });
  if (!res || !res.ok) return null;
  const text = await res.text().catch(() => "");
  let items: EgressItem[] = [];
  try {
    const parsed = JSON.parse(text) as { items?: EgressItem[] };
    items = parsed.items ?? [];
  } catch {
    return null;
  }
  if (items.length === 0) return { status: null, fileKey: null, durationms: null, error: null };
  // Prefer the requested egress, else the most recent item.
  const item = (egressId && items.find((i) => (i.egress_id ?? i.egressId) === egressId)) || items[items.length - 1];
  const file = item.file_results?.[0] ?? item.fileResults?.[0] ?? item.file;
  const loc = file?.filename ?? file?.location ?? null;
  return {
    status: item.status ?? null,
    fileKey: loc ? normalizeS3Key(loc) : null,
    durationms: file?.duration ? Math.round(Number(file.duration) / 1e6) : null,
    error: item.error || null,
  };
}

/** Close the LiveKit room (disconnects everyone, finalizes egress). Best-effort. */
export async function closeRoom(presentationid: string): Promise<void> {
  if (!livekitConfigured()) return;
  const room = roomName(presentationid);
  await twirp("RoomService", "DeleteRoom", room, { room });
}

/**
 * Verify a LiveKit webhook: the Authorization header is a JWT signed with the API
 * secret whose `sha256` claim equals the body hash. When LiveKit is unconfigured
 * (local dev) we accept, since no real webhooks are in play.
 */
export function verifyWebhook(authToken: string | null, bodyText: string): boolean {
  if (!livekitConfigured()) return true;
  if (!authToken) return false;
  const parts = authToken.split(".");
  if (parts.length !== 3) return false;
  const [h, p, s] = parts;
  const expectSig = createHmac("sha256", LIVEKIT_API_SECRET).update(`${h}.${p}`).digest("base64url");
  if (s !== expectSig) return false;
  try {
    const claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as { sha256?: string };
    return claims.sha256 === createHash("sha256").update(bodyText).digest("base64");
  } catch {
    return false;
  }
}
