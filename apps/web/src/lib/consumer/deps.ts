import type { ConsumerStore } from "./store";

/**
 * SPEC-093 — the collaborators the consumer services need, gathered in one place
 * so the routes run against the real database, mailer and account provisioning,
 * while unit tests swap in an in-memory store and recorders. The real modules are
 * loaded lazily so importing a route never opens a database connection by itself.
 */

// [SCOPE 093 / T001] BEGIN — Consumer dependencies
export type OutboundEmail = { to: string; subject: string; body: string; actionUrl?: string };

export type ConsumerDeps = {
  store: ConsumerStore;
  /** lib/auth/service.ts provisionOrLookupUserByEmail. */
  provisionUser(input: { email: string; displayName: string | null }): Promise<{ userid: string; created: boolean }>;
  /** lib/auth/mailer.ts sendEmail (never throws). */
  sendEmail(email: OutboundEmail): Promise<void>;
  /** lib/auth/crypto.ts generateToken / hashToken. */
  newToken(): { token: string; tokenhash: string };
  siteUrl(): string;
  now(): Date;
  newId(): string;
};

let override: ConsumerDeps | null = null;
let real: ConsumerDeps | null = null;

async function buildRealDeps(): Promise<ConsumerDeps> {
  const [{ DrizzleConsumerStore }, auth, mailer, crypto, site, ids] = await Promise.all([
    import("./drizzle-store"),
    import("../auth/service"),
    import("../auth/mailer"),
    import("../auth/crypto"),
    import("../site"),
    import("uuidv7"),
  ]);
  return {
    store: new DrizzleConsumerStore(),
    provisionUser: (input) => auth.provisionOrLookupUserByEmail(input),
    sendEmail: (email) => mailer.sendEmail(email),
    newToken: () => {
      const token = crypto.generateToken();
      return { token, tokenhash: crypto.hashToken(token) };
    },
    siteUrl: () => site.getSiteUrl(),
    now: () => new Date(),
    newId: () => ids.uuidv7(),
  };
}

export async function getConsumerDeps(): Promise<ConsumerDeps> {
  if (override) return override;
  real ??= await buildRealDeps();
  return real;
}

/** Test seam: replace the dependencies (pass null to restore the real ones). */
export function setConsumerDepsForTests(deps: ConsumerDeps | null): void {
  override = deps;
}
// [SCOPE 093 / T001] END
