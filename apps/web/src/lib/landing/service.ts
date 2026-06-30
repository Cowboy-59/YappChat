import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "../db/client";
import { landingpageconfig } from "../db/schema";
import { DEFAULT_LANDING_CONFIG } from "./defaults";
import {
  landingConfigPatchSchema,
  landingConfigSchema,
  toPublicConfig,
  type LandingConfig,
  type LandingConfigPatch,
  type PublicLandingConfig,
} from "./config-schema";

/** One config row per deployment. Override per self-hosted cluster via env. */
export const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID ?? "default";

export type FullLandingConfig = {
  config: LandingConfig;
  updatedat: string | null;
  updatedby: string | null;
  /** True when served from seed defaults (no DB row / DB unreachable). */
  isDefault: boolean;
};

function parseRow(row: {
  branding: unknown;
  seo: unknown;
  plans: unknown;
  features: unknown;
  security: unknown;
  faq: unknown;
  testimonials: unknown;
  downloads: unknown;
}): LandingConfig {
  // Validate stored jsonb on read so a hand-edited / legacy row can't crash the
  // page; throws if invalid and the caller falls back to defaults.
  return landingConfigSchema.parse({
    branding: row.branding,
    seo: row.seo,
    plans: row.plans,
    features: row.features,
    security: row.security,
    faq: row.faq,
    testimonials: row.testimonials,
    downloads: row.downloads,
  });
}

/** Full config for admin (T004 GET /admin) + render. Falls back to defaults. */
export async function getFullConfig(): Promise<FullLandingConfig> {
  const db = getDb();
  if (!db) {
    return { config: DEFAULT_LANDING_CONFIG, updatedat: null, updatedby: null, isDefault: true };
  }

  try {
    const [row] = await db
      .select()
      .from(landingpageconfig)
      .where(eq(landingpageconfig.deploymentid, DEPLOYMENT_ID))
      .limit(1);

    if (!row) {
      return { config: DEFAULT_LANDING_CONFIG, updatedat: null, updatedby: null, isDefault: true };
    }

    return {
      config: parseRow(row),
      updatedat: row.updatedat ? new Date(row.updatedat).toISOString() : null,
      updatedby: row.updatedby ?? null,
      isDefault: false,
    };
  } catch (err) {
    console.error("[landing] getFullConfig failed, serving defaults:", err);
    return { config: DEFAULT_LANDING_CONFIG, updatedat: null, updatedby: null, isDefault: true };
  }
}

/** Public, unauthenticated projection (T004 GET /config). */
export async function getPublicConfig(): Promise<{
  config: PublicLandingConfig;
  updatedat: string | null;
}> {
  const { config, updatedat } = await getFullConfig();
  return { config: toPublicConfig(config), updatedat };
}

export class ConfigValidationError extends Error {
  constructor(public issues: unknown) {
    super("Invalid landing page config");
    this.name = "ConfigValidationError";
  }
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database not configured");
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * Validate + persist a partial config update (T004 PATCH).
 * Merges the patch over current config, validates the whole, upserts the row,
 * bumps updatedat/updatedby. Returns the new full config.
 */
export async function patchConfig(
  rawPatch: unknown,
  userId: string | null,
): Promise<FullLandingConfig> {
  const parsedPatch = landingConfigPatchSchema.safeParse(rawPatch);
  if (!parsedPatch.success) {
    throw new ConfigValidationError(parsedPatch.error.flatten());
  }

  const db = getDb();
  if (!db) throw new DatabaseUnavailableError();

  const current = await getFullConfig();
  const merged = mergeConfig(current.config, parsedPatch.data);

  // Re-validate the merged whole so cross-section invariants hold.
  const validated = landingConfigSchema.safeParse(merged);
  if (!validated.success) {
    throw new ConfigValidationError(validated.error.flatten());
  }
  const next = validated.data;

  await db
    .insert(landingpageconfig)
    .values({
      id: uuidv7(),
      deploymentid: DEPLOYMENT_ID,
      branding: next.branding,
      seo: next.seo,
      plans: next.plans,
      features: next.features,
      security: next.security,
      faq: next.faq,
      testimonials: next.testimonials,
      downloads: next.downloads,
      updatedat: new Date(),
      updatedby: userId,
    })
    .onConflictDoUpdate({
      target: landingpageconfig.deploymentid,
      set: {
        branding: next.branding,
        seo: next.seo,
        plans: next.plans,
        features: next.features,
        security: next.security,
        faq: next.faq,
        testimonials: next.testimonials,
        downloads: next.downloads,
        updatedat: new Date(),
        updatedby: userId,
      },
    });

  // TODO(spec-011): write authauditlog entry
  //   { eventtype: 'landingpage_config_changed', actorid: userId, diff }
  // once the auth/audit tables exist.

  return getFullConfig();
}

function mergeConfig(base: LandingConfig, patch: LandingConfigPatch): LandingConfig {
  // Section-level merge: a present section replaces the whole section (each
  // section is validated as a unit), absent sections are preserved.
  return {
    branding: patch.branding ?? base.branding,
    seo: patch.seo ?? base.seo,
    plans: patch.plans ?? base.plans,
    features: patch.features ?? base.features,
    security: patch.security ?? base.security,
    faq: patch.faq ?? base.faq,
    testimonials: patch.testimonials ?? base.testimonials,
    downloads: patch.downloads ?? base.downloads,
  };
}
