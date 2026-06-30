import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { communitymembers, type CommunityRole, type Discoverability, type JoinPolicy } from "../db/communities-schema";
import { requireAuth } from "../auth/session";
import type { SessionUser } from "../auth/shared";

/**
 * Spec 017 T001 — the single capability map + membership guard for communities.
 * Both the UI and the API read CAPABILITIES so a disabled control always matches
 * a rejecting endpoint. Bespoke per-route role checks are a violation.
 */

export const ROLE_RANK: Record<CommunityRole, number> = { member: 0, moderator: 1, owner: 2 };

/** Strictness order — higher = stricter. Used to resolve community⊕space policy. */
const JOIN_RANK: Record<JoinPolicy, number> = { open: 0, approval: 1, invite: 2 };
const DISCOVER_RANK: Record<Discoverability, number> = { public: 0, unlisted: 1 };

/** action → minimum community role required. */
export const CAPABILITIES = {
  "community:update": "moderator",
  "community:delete": "owner",
  "space:create": "moderator",
  "space:update": "moderator",
  "space:delete": "moderator",
  "member:role:set": "owner",
  "member:remove": "moderator",
  "request:decide": "moderator",
  "invite:create": "moderator",
  "audit:view": "moderator",
} as const satisfies Record<string, CommunityRole>;

export type Capability = keyof typeof CAPABILITIES;

/** Whether a role satisfies a capability's minimum. */
export function can(role: CommunityRole, capability: Capability): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[CAPABILITIES[capability]];
}

/** Effective join policy = the stricter of the community and the (optional) space. */
export function effectiveJoinPolicy(community: JoinPolicy, space: JoinPolicy | null): JoinPolicy {
  if (!space) return community;
  return JOIN_RANK[space] >= JOIN_RANK[community] ? space : community;
}

/** Effective discoverability = the stricter of the community and the (optional) space. */
export function effectiveDiscoverability(
  community: Discoverability,
  space: Discoverability | null,
): Discoverability {
  if (!space) return community;
  return DISCOVER_RANK[space] >= DISCOVER_RANK[community] ? space : community;
}

/** A space override is legal only if it is at least as strict as the community. */
export function isStricterOrEqualJoin(community: JoinPolicy, space: JoinPolicy): boolean {
  return JOIN_RANK[space] >= JOIN_RANK[community];
}
/** True when the space is STRICTLY stricter than the community (→ gated: members
 *  who join the community are NOT auto-added; entry must be requested/granted). */
export function isStrictlyStricterJoin(community: JoinPolicy, space: JoinPolicy): boolean {
  return JOIN_RANK[space] > JOIN_RANK[community];
}
export function isStricterOrEqualDiscover(community: Discoverability, space: Discoverability): boolean {
  return DISCOVER_RANK[space] >= DISCOVER_RANK[community];
}

export type MembershipCtx =
  | { ok: true; user: SessionUser; role: CommunityRole }
  | { ok: false; response: NextResponse };

/**
 * The single membership gate for `/api/communities/*` routes (analogue of spec
 * 013's requireAdmin / spec 011's requireAuth). Resolves the session user, then
 * the caller's role in `communityid`; rejects non-members (404 — don't leak
 * existence) and roles below `minRole` (403). Pass `capability` to gate by the
 * capability map instead of a raw role.
 */
export async function requireMembership(
  communityid: string,
  opts?: { minRole?: CommunityRole; capability?: Capability },
): Promise<MembershipCtx> {
  const auth = await requireAuth();
  if (!auth.ok) return { ok: false, response: NextResponse.json({ error: auth.error }, { status: auth.status }) };

  const db = getDb();
  if (!db) return { ok: false, response: NextResponse.json({ error: "db_unavailable" }, { status: 503 }) };

  const [m] = await db
    .select({ role: communitymembers.role })
    .from(communitymembers)
    .where(and(eq(communitymembers.communityid, communityid), eq(communitymembers.userid, auth.user.id)))
    .limit(1);

  // Not a member → 404 (do not reveal the community exists to outsiders).
  if (!m) return { ok: false, response: NextResponse.json({ error: "not_found" }, { status: 404 }) };

  const required = opts?.capability ? CAPABILITIES[opts.capability] : opts?.minRole;
  if (required && ROLE_RANK[m.role] < ROLE_RANK[required]) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { ok: true, user: auth.user, role: m.role };
}
