import "dotenv/config";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getDb } from "./client";
import { landingpageconfig } from "./schema";
import { DEFAULT_LANDING_CONFIG } from "../landing/defaults";
import { DEPLOYMENT_ID } from "../landing/service";

/**
 * Seed first-launch defaults (FR-008). Idempotent: skips if a row already
 * exists for this deployment. Run via `pnpm db:seed`.
 */
async function main() {
  const db = getDb();
  if (!db) {
    console.error("DATABASE_URL not set — nothing to seed.");
    process.exit(1);
  }

  const [existing] = await db
    .select({ id: landingpageconfig.id })
    .from(landingpageconfig)
    .where(eq(landingpageconfig.deploymentid, DEPLOYMENT_ID))
    .limit(1);

  if (existing) {
    console.log(`landingpageconfig already seeded for deployment "${DEPLOYMENT_ID}".`);
    process.exit(0);
  }

  await db.insert(landingpageconfig).values({
    id: uuidv7(),
    deploymentid: DEPLOYMENT_ID,
    ...DEFAULT_LANDING_CONFIG,
    updatedat: new Date(),
    updatedby: null,
  });

  console.log(`Seeded landingpageconfig defaults for deployment "${DEPLOYMENT_ID}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
