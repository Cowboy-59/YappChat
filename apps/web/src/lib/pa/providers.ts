import { and, desc, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { getDb } from "../db/client";
import { aiproviders, paconfigs } from "../db/pa-schema";
import type { AiProviderRow } from "../db/pa-schema";
import { PaError } from "./errors";
import { getAdapter } from "./adapters";

/**
 * Spec 002 T002 — AI provider registry. Providers are per-user; the single
 * system-default (userid null, isdefault true) is managed only via the
 * admin-gated setSystemDefault. The API key is never returned.
 */

export const providerCreateSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["openai-compatible", "anthropic", "ollama", "custom"]),
  baseurl: z.string().default(""),
  model: z.string().min(1).max(120),
  apikey: z.string().default(""),
  supportstooluse: z.boolean().default(false),
  supportsstreaming: z.boolean().default(true),
});

export const providerUpdateSchema = providerCreateSchema.partial();

export type ProviderResponse = Omit<AiProviderRow, "apikey">;

function toResponse(row: AiProviderRow): ProviderResponse {
  const { apikey: _omit, ...rest } = row;
  void _omit;
  return rest;
}

export async function listProviders(userid: string): Promise<ProviderResponse[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(aiproviders)
    .where(eq(aiproviders.userid, userid))
    .orderBy(desc(aiproviders.createdat));
  return rows.map(toResponse);
}

async function loadOwned(userid: string, id: string): Promise<AiProviderRow> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  const [row] = await db
    .select()
    .from(aiproviders)
    .where(and(eq(aiproviders.id, id), eq(aiproviders.userid, userid)))
    .limit(1);
  if (!row) throw new PaError("provider_not_found", 404);
  return row;
}

export async function createProvider(
  userid: string,
  raw: unknown,
): Promise<{ provider: ProviderResponse; connected: boolean; latencyms?: number; error?: string }> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);

  const parsed = providerCreateSchema.safeParse(raw);
  if (!parsed.success) throw new PaError("invalid_provider", 422, parsed.error.flatten());
  // Per-user route must never set isdefault — only setSystemDefault can.
  if (raw && typeof raw === "object" && "isdefault" in raw) {
    throw new PaError("isdefault_not_allowed", 400);
  }

  const id = uuidv7();
  const row: AiProviderRow = {
    id,
    userid,
    name: parsed.data.name,
    type: parsed.data.type,
    baseurl: parsed.data.baseurl,
    model: parsed.data.model,
    apikey: parsed.data.apikey,
    supportstooluse: parsed.data.supportstooluse,
    supportsstreaming: parsed.data.supportsstreaming,
    isdefault: false,
    lastpingedat: null,
    lastpinglatencyms: null,
    createdat: new Date(),
  };
  await db.insert(aiproviders).values(row);

  const ping = await pingRow(row);
  return { provider: toResponse(row), ...ping };
}

export async function updateProvider(
  userid: string,
  id: string,
  raw: unknown,
): Promise<ProviderResponse> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  const parsed = providerUpdateSchema.safeParse(raw);
  if (!parsed.success) throw new PaError("invalid_provider", 422, parsed.error.flatten());
  if (raw && typeof raw === "object" && "isdefault" in raw) {
    throw new PaError("isdefault_not_allowed", 400);
  }
  const current = await loadOwned(userid, id);
  await db
    .update(aiproviders)
    .set({
      name: parsed.data.name ?? current.name,
      type: parsed.data.type ?? current.type,
      baseurl: parsed.data.baseurl ?? current.baseurl,
      model: parsed.data.model ?? current.model,
      apikey: parsed.data.apikey ?? current.apikey,
      supportstooluse: parsed.data.supportstooluse ?? current.supportstooluse,
      supportsstreaming: parsed.data.supportsstreaming ?? current.supportsstreaming,
    })
    .where(eq(aiproviders.id, id));
  return toResponse(await loadOwned(userid, id));
}

export async function deleteProvider(userid: string, id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  await loadOwned(userid, id);
  // Can't delete the active provider without switching first.
  const [cfg] = await db.select().from(paconfigs).where(eq(paconfigs.userid, userid)).limit(1);
  if (cfg?.activeproviderid === id) throw new PaError("provider_is_active", 409);
  await db.delete(aiproviders).where(eq(aiproviders.id, id));
}

/** Ping a provider by id (owned by the caller). */
export async function pingProvider(
  userid: string,
  id: string,
): Promise<{ connected: boolean; latencyms?: number; error?: string }> {
  const row = await loadOwned(userid, id);
  return pingRow(row);
}

async function pingRow(
  row: AiProviderRow,
): Promise<{ connected: boolean; latencyms?: number; error?: string }> {
  const db = getDb();
  const started = Date.now();
  try {
    const adapter = getAdapter(row);
    // Consume the first delta then stop — confirms connectivity + auth.
    const it = adapter.streamChat({
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 8,
    });
    await it.next();
    await it.return?.(undefined);
    const latencyms = Date.now() - started;
    if (db) {
      await db
        .update(aiproviders)
        .set({ lastpingedat: new Date(), lastpinglatencyms: latencyms })
        .where(eq(aiproviders.id, row.id));
    }
    return { connected: true, latencyms };
  } catch (err) {
    return { connected: false, error: (err as Error).message };
  }
}

/** Admin-gated: set (or clear) the single system-default provider. */
export async function setSystemDefault(providerid: string | null): Promise<void> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  await db.transaction(async (tx) => {
    // Clear any existing default first so the partial unique index never sees two.
    await tx.update(aiproviders).set({ isdefault: false }).where(eq(aiproviders.isdefault, true));
    if (providerid) {
      await tx.update(aiproviders).set({ isdefault: true }).where(eq(aiproviders.id, providerid));
    }
  });
}

export async function listSystemRoleProviders(): Promise<ProviderResponse[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.select().from(aiproviders).where(isNull(aiproviders.userid));
  return rows.map(toResponse);
}

/** Resolve the provider a chat should use: explicit -> active -> system default. */
export async function resolveProviderRow(
  userid: string,
  explicitId?: string | null,
): Promise<AiProviderRow | null> {
  const db = getDb();
  if (!db) return null;

  if (explicitId) {
    const [row] = await db.select().from(aiproviders).where(eq(aiproviders.id, explicitId)).limit(1);
    if (row && (row.userid === userid || row.isdefault)) return row;
  }
  const [cfg] = await db.select().from(paconfigs).where(eq(paconfigs.userid, userid)).limit(1);
  if (cfg?.activeproviderid) {
    const [row] = await db
      .select()
      .from(aiproviders)
      .where(eq(aiproviders.id, cfg.activeproviderid))
      .limit(1);
    if (row) return row;
  }
  const [own] = await db
    .select()
    .from(aiproviders)
    .where(eq(aiproviders.userid, userid))
    .orderBy(desc(aiproviders.createdat))
    .limit(1);
  if (own) return own;

  const [def] = await db.select().from(aiproviders).where(eq(aiproviders.isdefault, true)).limit(1);
  return def ?? null;
}

/** Get/ensure the caller's paconfig and set the active provider. */
export async function setActiveProvider(userid: string, providerid: string): Promise<void> {
  const db = getDb();
  if (!db) throw new PaError("db_unavailable", 503);
  await loadOwned(userid, providerid);
  const [existing] = await db.select().from(paconfigs).where(eq(paconfigs.userid, userid)).limit(1);
  if (existing) {
    await db
      .update(paconfigs)
      .set({ activeproviderid: providerid, updatedat: new Date() })
      .where(eq(paconfigs.userid, userid));
  } else {
    await db.insert(paconfigs).values({ id: uuidv7(), userid, activeproviderid: providerid });
  }
}

export async function getActiveProviderId(userid: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [cfg] = await db.select().from(paconfigs).where(eq(paconfigs.userid, userid)).limit(1);
  return cfg?.activeproviderid ?? null;
}
