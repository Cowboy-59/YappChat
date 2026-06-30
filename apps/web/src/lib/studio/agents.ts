import { and, desc, eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { getDb } from "../db/client";
import { agenttemplates, agenttemplateskills, skills } from "../db/studio-schema";
import { StudioError } from "./errors";
import { findDisabledSkillIds } from "./skills";

/**
 * Spec 004 T004 — agent-template CRUD + skill assignment + skill-validity guard.
 * `providerid` references spec 002 `aiproviders` (no FK until 002 ships).
 */

export const agentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  avatarurl: z.string().default(""),
  systemprompt: z.string().max(20000).default(""),
  providerid: z.string().uuid().nullable().optional(),
  async: z.boolean().default(false),
  maxruntimeseconds: z.number().int().min(60).max(3600).default(600),
  skillids: z.array(z.string().uuid()).default([]),
});

export const agentUpdateSchema = agentCreateSchema.partial();

export type AgentTemplateResponse = typeof agenttemplates.$inferSelect & {
  skillids: string[];
};

async function resolveSkillIds(agenttemplateid: string): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ skillid: agenttemplateskills.skillid })
    .from(agenttemplateskills)
    .where(eq(agenttemplateskills.agenttemplateid, agenttemplateid));
  return rows.map((r) => r.skillid);
}

export async function createAgentTemplate(
  orgid: string,
  raw: unknown,
): Promise<AgentTemplateResponse> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);

  const parsed = agentCreateSchema.safeParse(raw);
  if (!parsed.success) throw new StudioError("invalid_agent", 422, parsed.error.flatten());
  const input = parsed.data;

  const [existing] = await db
    .select({ id: agenttemplates.id })
    .from(agenttemplates)
    .where(and(eq(agenttemplates.orgid, orgid), eq(agenttemplates.name, input.name)))
    .limit(1);
  if (existing) throw new StudioError("name_taken", 409);

  // Skill-validity guard: a template may include only enabled skills.
  const disabled = await findDisabledSkillIds(orgid, input.skillids);
  if (disabled.length > 0) {
    throw new StudioError("template_contains_disabled_skills", 422, { disabledSkillIds: disabled });
  }

  const id = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(agenttemplates).values({
      id,
      orgid,
      name: input.name,
      description: input.description,
      avatarurl: input.avatarurl,
      systemprompt: input.systemprompt,
      providerid: input.providerid ?? null,
      async: input.async,
      enabled: false,
      maxruntimeseconds: input.maxruntimeseconds,
    });
    if (input.skillids.length > 0) {
      await tx.insert(agenttemplateskills).values(
        input.skillids.map((skillid) => ({ id: uuidv7(), agenttemplateid: id, skillid })),
      );
    }
  });

  return getAgentTemplate(orgid, id);
}

export async function listAgentTemplates(orgid: string) {
  const db = getDb();
  if (!db) return [];
  const templates = await db
    .select()
    .from(agenttemplates)
    .where(eq(agenttemplates.orgid, orgid))
    .orderBy(desc(agenttemplates.updatedat));

  if (templates.length === 0) return [];
  const links = await db
    .select({ agenttemplateid: agenttemplateskills.agenttemplateid })
    .from(agenttemplateskills)
    .where(inArray(agenttemplateskills.agenttemplateid, templates.map((t) => t.id)));
  const counts = new Map<string, number>();
  for (const l of links) counts.set(l.agenttemplateid, (counts.get(l.agenttemplateid) ?? 0) + 1);

  return templates.map((t) => ({ ...t, skillcount: counts.get(t.id) ?? 0 }));
}

async function loadAgent(orgid: string, id: string): Promise<typeof agenttemplates.$inferSelect> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);
  const [row] = await db
    .select()
    .from(agenttemplates)
    .where(and(eq(agenttemplates.id, id), eq(agenttemplates.orgid, orgid)))
    .limit(1);
  if (!row) throw new StudioError("agent_not_found", 404);
  return row;
}

export async function getAgentTemplate(orgid: string, id: string): Promise<AgentTemplateResponse> {
  const row = await loadAgent(orgid, id);
  return { ...row, skillids: await resolveSkillIds(id) };
}

export async function updateAgentTemplate(
  orgid: string,
  id: string,
  raw: unknown,
): Promise<AgentTemplateResponse> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);

  const parsed = agentUpdateSchema.safeParse(raw);
  if (!parsed.success) throw new StudioError("invalid_agent", 422, parsed.error.flatten());
  const patch = parsed.data;
  const current = await loadAgent(orgid, id);

  if (patch.skillids) {
    const disabled = await findDisabledSkillIds(orgid, patch.skillids);
    if (disabled.length > 0) {
      throw new StudioError("template_contains_disabled_skills", 422, { disabledSkillIds: disabled });
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(agenttemplates)
      .set({
        name: patch.name ?? current.name,
        description: patch.description ?? current.description,
        avatarurl: patch.avatarurl ?? current.avatarurl,
        systemprompt: patch.systemprompt ?? current.systemprompt,
        providerid: patch.providerid === undefined ? current.providerid : patch.providerid,
        async: patch.async ?? current.async,
        maxruntimeseconds: patch.maxruntimeseconds ?? current.maxruntimeseconds,
        updatedat: new Date(),
      })
      .where(eq(agenttemplates.id, id));

    if (patch.skillids) {
      await tx.delete(agenttemplateskills).where(eq(agenttemplateskills.agenttemplateid, id));
      if (patch.skillids.length > 0) {
        await tx.insert(agenttemplateskills).values(
          patch.skillids.map((skillid) => ({ id: uuidv7(), agenttemplateid: id, skillid })),
        );
      }
    }
  });

  return getAgentTemplate(orgid, id);
}

export async function setAgentEnabled(
  orgid: string,
  id: string,
  enabled: boolean,
): Promise<AgentTemplateResponse> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);
  await loadAgent(orgid, id);

  if (enabled) {
    // Guard at enable time: every assigned skill must be enabled.
    const skillIds = await resolveSkillIds(id);
    const disabled = await findDisabledSkillIds(orgid, skillIds);
    if (disabled.length > 0) {
      throw new StudioError("template_contains_disabled_skills", 422, { disabledSkillIds: disabled });
    }
  }

  await db.update(agenttemplates).set({ enabled, updatedat: new Date() }).where(eq(agenttemplates.id, id));
  return getAgentTemplate(orgid, id);
}

export async function deleteAgentTemplate(orgid: string, id: string): Promise<void> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);
  await loadAgent(orgid, id);
  // Spec: block if an active subagentexecutions row references this template
  // (spec 002, not yet built) — skipped until 002 exists.
  await db.delete(agenttemplates).where(eq(agenttemplates.id, id));
}

/** Resolve full skill rows for an agent (for the detail view). */
export async function getAgentSkills(orgid: string, id: string) {
  const db = getDb();
  if (!db) return [];
  const ids = await resolveSkillIds(id);
  if (ids.length === 0) return [];
  return db
    .select({ id: skills.id, name: skills.name, label: skills.label, enabled: skills.enabled })
    .from(skills)
    .where(and(eq(skills.orgid, orgid), inArray(skills.id, ids)));
}
