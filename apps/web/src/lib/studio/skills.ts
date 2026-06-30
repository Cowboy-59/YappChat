import { and, desc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { skills, skilltestlogs, skillversions } from "../db/studio-schema";
import { generateToken } from "../auth/crypto";
import { StudioError } from "./errors";
import {
  bumpVersion,
  skillCreateSchema,
  skillUpdateSchema,
  validateJsonSchema,
  type VersionBump,
} from "./skill-schema";

/**
 * Spec 004 T001 — skill CRUD + auto-versioning + rollback.
 * All operations are org-scoped; the caller passes the active orgid/userid from
 * requireAuth. `skilltoken` is never returned except once at creation.
 */

export type SkillResponse = Omit<typeof skills.$inferSelect, "skilltoken">;

function toResponse(row: typeof skills.$inferSelect): SkillResponse {
  // Strip the server-only token from every read projection.
  const { skilltoken: _omit, ...rest } = row;
  void _omit;
  return rest;
}

function assertHandlerUrl(url: string) {
  if (!url) return; // blank allowed until deployed
  const allowHttp = process.env.ALLOW_HTTP_SKILL_HANDLERS === "true";
  if (url.startsWith("https://")) return;
  if (url.startsWith("http://") && allowHttp) return;
  throw new StudioError("handler_url_must_be_https", 422);
}

export async function createSkill(
  orgid: string,
  userid: string,
  raw: unknown,
): Promise<{ skill: SkillResponse; skilltoken: string }> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);

  const parsed = skillCreateSchema.safeParse(raw);
  if (!parsed.success) throw new StudioError("invalid_skill", 422, parsed.error.flatten());
  const input = parsed.data;

  const schemaCheck = validateJsonSchema(input.inputschema);
  if (!schemaCheck.valid) throw new StudioError("invalid_input_schema", 422, schemaCheck.error);
  assertHandlerUrl(input.handlerurl);

  // Name uniqueness enforced at the API layer for a clean message.
  const [existing] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.orgid, orgid), eq(skills.name, input.name)))
    .limit(1);
  if (existing) throw new StudioError("name_taken", 409);

  const id = uuidv7();
  const skilltoken = `skl_${generateToken(24)}`;
  const version = "1.0.0";

  await db.transaction(async (tx) => {
    await tx.insert(skills).values({
      id,
      orgid,
      name: input.name,
      label: input.label,
      description: input.description,
      category: input.category,
      inputschema: input.inputschema,
      handlerurl: input.handlerurl,
      skilltoken,
      async: input.async,
      enabled: false, // always starts disabled regardless of creation method
      version,
      createdby: "studio",
      createdbyuserid: userid,
    });
    await tx.insert(skillversions).values({
      id: uuidv7(),
      skillid: id,
      version,
      previousversion: null,
      changedfields: ["created"],
      schemadiff: { before: null, after: input.inputschema },
      updatedby: userid,
    });
  });

  const [row] = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
  return { skill: toResponse(row), skilltoken };
}

export type SkillFilters = {
  category?: string;
  enabled?: boolean;
  async?: boolean;
  createdby?: string;
  search?: string;
};

export async function listSkills(orgid: string, filters: SkillFilters): Promise<SkillResponse[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(skills)
    .where(eq(skills.orgid, orgid))
    .orderBy(desc(skills.updatedat));

  let result = rows;
  if (filters.category) result = result.filter((r) => r.category === filters.category);
  if (typeof filters.enabled === "boolean") result = result.filter((r) => r.enabled === filters.enabled);
  if (typeof filters.async === "boolean") result = result.filter((r) => r.async === filters.async);
  if (filters.createdby) result = result.filter((r) => r.createdby === filters.createdby);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }
  return result.map(toResponse);
}

async function loadSkill(orgid: string, id: string): Promise<typeof skills.$inferSelect> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);
  const [row] = await db
    .select()
    .from(skills)
    .where(and(eq(skills.id, id), eq(skills.orgid, orgid)))
    .limit(1);
  if (!row) throw new StudioError("skill_not_found", 404);
  return row;
}

export async function getSkill(orgid: string, id: string): Promise<SkillResponse> {
  return toResponse(await loadSkill(orgid, id));
}

/** Internal: full row incl. token, for the test console. */
export async function getSkillWithToken(orgid: string, id: string) {
  return loadSkill(orgid, id);
}

export async function updateSkill(
  orgid: string,
  userid: string,
  id: string,
  raw: unknown,
): Promise<SkillResponse> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);

  const parsed = skillUpdateSchema.safeParse(raw);
  if (!parsed.success) throw new StudioError("invalid_skill", 422, parsed.error.flatten());
  const patch = parsed.data;
  const current = await loadSkill(orgid, id);

  if (patch.inputschema !== undefined) {
    const check = validateJsonSchema(patch.inputschema);
    if (!check.valid) throw new StudioError("invalid_input_schema", 422, check.error);
  }
  if (patch.handlerurl !== undefined) assertHandlerUrl(patch.handlerurl);

  // A change to inputschema or handlerurl auto-versions.
  const schemaChanged =
    patch.inputschema !== undefined &&
    JSON.stringify(patch.inputschema) !== JSON.stringify(current.inputschema);
  const handlerChanged =
    patch.handlerurl !== undefined && patch.handlerurl !== current.handlerurl;
  const versioned = schemaChanged || handlerChanged;

  const nextVersion = versioned
    ? bumpVersion(current.version, (patch.versionbump as VersionBump) ?? "patch")
    : current.version;

  await db.transaction(async (tx) => {
    await tx
      .update(skills)
      .set({
        label: patch.label ?? current.label,
        description: patch.description ?? current.description,
        category: patch.category ?? current.category,
        inputschema: patch.inputschema ?? current.inputschema,
        handlerurl: patch.handlerurl ?? current.handlerurl,
        async: patch.async ?? current.async,
        version: nextVersion,
        updatedat: new Date(),
      })
      .where(eq(skills.id, id));

    if (versioned) {
      const changedfields: string[] = [];
      if (schemaChanged) changedfields.push("inputschema");
      if (handlerChanged) changedfields.push("handlerurl");
      await tx.insert(skillversions).values({
        id: uuidv7(),
        skillid: id,
        version: nextVersion,
        previousversion: current.version,
        changedfields,
        schemadiff: { before: current.inputschema, after: patch.inputschema ?? current.inputschema },
        updatedby: userid,
      });
    }
  });

  return getSkill(orgid, id);
}

export async function setSkillEnabled(
  orgid: string,
  id: string,
  enabled: boolean,
): Promise<SkillResponse> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);
  await loadSkill(orgid, id); // ensure exists + org scope
  await db.update(skills).set({ enabled, updatedat: new Date() }).where(eq(skills.id, id));
  return getSkill(orgid, id);
}

export async function deleteSkill(orgid: string, id: string, override: boolean): Promise<void> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);
  await loadSkill(orgid, id);
  // Spec: block if invoked in the last 24h (skillinvocations — spec 002, not yet
  // built). Until then we require an explicit override to delete.
  if (!override) throw new StudioError("delete_requires_override", 409);
  await db.delete(skills).where(eq(skills.id, id));
}

export async function getSkillVersions(orgid: string, id: string) {
  const db = getDb();
  if (!db) return [];
  await loadSkill(orgid, id);
  return db
    .select()
    .from(skillversions)
    .where(eq(skillversions.skillid, id))
    .orderBy(desc(skillversions.updatedat));
}

export async function rollbackSkill(
  orgid: string,
  userid: string,
  id: string,
  version: string,
): Promise<SkillResponse> {
  const db = getDb();
  if (!db) throw new StudioError("db_unavailable", 503);
  const current = await loadSkill(orgid, id);

  const [target] = await db
    .select()
    .from(skillversions)
    .where(and(eq(skillversions.skillid, id), eq(skillversions.version, version)))
    .limit(1);
  if (!target) throw new StudioError("version_not_found", 404);

  // Restore from the version's recorded schema as a NEW version (history kept).
  const restoredSchema = (target.schemadiff as { after?: unknown } | null)?.after ?? current.inputschema;
  const nextVersion = bumpVersion(current.version, "patch");

  await db.transaction(async (tx) => {
    await tx
      .update(skills)
      .set({ inputschema: restoredSchema, version: nextVersion, updatedat: new Date() })
      .where(eq(skills.id, id));
    await tx.insert(skillversions).values({
      id: uuidv7(),
      skillid: id,
      version: nextVersion,
      previousversion: current.version,
      changedfields: [`rollback_to_${version}`],
      schemadiff: { before: current.inputschema, after: restoredSchema },
      updatedby: userid,
    });
  });

  return getSkill(orgid, id);
}

export async function getSkillTestLogs(orgid: string, id: string) {
  const db = getDb();
  if (!db) return [];
  await loadSkill(orgid, id);
  return db
    .select()
    .from(skilltestlogs)
    .where(eq(skilltestlogs.skillid, id))
    .orderBy(desc(skilltestlogs.testedat))
    .limit(50);
}

/** Count enabled skills referenced by id set — used by the agent-template guard. */
export async function findDisabledSkillIds(orgid: string, skillIds: string[]): Promise<string[]> {
  const db = getDb();
  if (!db || skillIds.length === 0) return [];
  const rows = await db
    .select({ id: skills.id, enabled: skills.enabled })
    .from(skills)
    .where(eq(skills.orgid, orgid));
  const byId = new Map(rows.map((r) => [r.id, r.enabled]));
  return skillIds.filter((sid) => byId.get(sid) !== true);
}
