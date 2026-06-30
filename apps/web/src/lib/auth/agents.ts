import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { agentapitokens, orgmemberships, users } from "../db/auth-schema";
import { writeAudit } from "./audit";
import { generateToken, hashToken } from "./crypto";
import { AuthError } from "./service";

/**
 * Spec 011 T006 / FR-015 — AI agent API tokens (per spec 001 FR-010). The agent
 * principal is a `users` row with kind='agent'; tokens authenticate that agent's
 * callbacks via Bearer. Only the SHA-256 hash is stored; the plaintext is shown
 * exactly once at issuance. `last6` is the only fragment ever shown afterward.
 */

export type AgentTokenView = {
  id: string;
  label: string | null;
  last6: string;
  createdat: string;
  revokedat: string | null;
};

type Caller = { id: string; issystemadmin: boolean };

/** A caller may manage an agent's tokens if they are a system admin OR an
 *  owner/admin of an org the agent (a kind='agent' user) belongs to. */
async function assertCanManageAgent(caller: Caller, agentid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);
  const [agent] = await db
    .select({ id: users.id, kind: users.kind })
    .from(users)
    .where(eq(users.id, agentid))
    .limit(1);
  if (!agent || agent.kind !== "agent") throw new AuthError("agent_not_found", 404);
  if (caller.issystemadmin) return;

  const adminOrgs = await db
    .select({ orgid: orgmemberships.orgid })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.userid, caller.id), inArray(orgmemberships.role, ["owner", "admin"])));
  if (adminOrgs.length === 0) throw new AuthError("forbidden", 403);
  const orgIds = adminOrgs.map((o) => o.orgid);
  const [shared] = await db
    .select({ orgid: orgmemberships.orgid })
    .from(orgmemberships)
    .where(and(eq(orgmemberships.userid, agentid), inArray(orgmemberships.orgid, orgIds)))
    .limit(1);
  if (!shared) throw new AuthError("forbidden", 403);
}

/** Issue a new API token for an agent. Plaintext returned ONCE. */
export async function issueAgentToken(
  caller: Caller,
  agentid: string,
  label: string | null,
): Promise<{ token: string; last6: string; id: string }> {
  await assertCanManageAgent(caller, agentid);
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);
  const token = `yca_${generateToken(24)}`;
  const id = uuidv7();
  const last6 = token.slice(-6);
  await db.insert(agentapitokens).values({
    id,
    userid: agentid,
    label: label?.trim() || null,
    tokenhash: hashToken(token),
    last6,
    createdby: caller.id,
  });
  await writeAudit({ eventtype: "agent_token_issue", userid: agentid, payload: { by: caller.id, tokenid: id } });
  return { token, last6, id };
}

export async function listAgentTokens(caller: Caller, agentid: string): Promise<AgentTokenView[]> {
  await assertCanManageAgent(caller, agentid);
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: agentapitokens.id,
      label: agentapitokens.label,
      last6: agentapitokens.last6,
      createdat: agentapitokens.createdat,
      revokedat: agentapitokens.revokedat,
    })
    .from(agentapitokens)
    .where(eq(agentapitokens.userid, agentid))
    .orderBy(desc(agentapitokens.createdat));
  return rows.map((r) => ({
    ...r,
    createdat: r.createdat.toISOString(),
    revokedat: r.revokedat ? r.revokedat.toISOString() : null,
  }));
}

export async function revokeAgentToken(caller: Caller, agentid: string, tokenid: string): Promise<void> {
  await assertCanManageAgent(caller, agentid);
  const db = getDb();
  if (!db) throw new AuthError("db_unavailable", 503);
  await db
    .update(agentapitokens)
    .set({ revokedat: new Date() })
    .where(and(eq(agentapitokens.id, tokenid), eq(agentapitokens.userid, agentid)));
  await writeAudit({ eventtype: "agent_token_revoke", userid: agentid, payload: { by: caller.id, tokenid } });
}

export type AgentPrincipal = { agentid: string; tokenid: string };

/**
 * Bearer-auth resolver for agent callbacks (spec 001 FR-010). Resolves
 * `Authorization: Bearer <token>` to the agent (kind='agent') user, or null.
 * A revoked token resolves to null on the NEXT request — no caching delay.
 */
export async function resolveAgentFromBearer(req: Request): Promise<AgentPrincipal | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ id: agentapitokens.id, userid: agentapitokens.userid })
    .from(agentapitokens)
    .innerJoin(users, eq(agentapitokens.userid, users.id))
    .where(
      and(
        eq(agentapitokens.tokenhash, hashToken(token)),
        isNull(agentapitokens.revokedat),
        eq(users.kind, "agent"),
      ),
    )
    .limit(1);
  return row ? { agentid: row.userid, tokenid: row.id } : null;
}
