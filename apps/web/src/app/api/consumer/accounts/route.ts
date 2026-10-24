import { consumerCall, readJsonObject } from "../../../../lib/consumer/guard";
import { createOrLinkAccount, lookupAccount } from "../../../../lib/consumer/accounts";

export const dynamic = "force-dynamic";

// [SCOPE 093 / T002] BEGIN — POST /api/consumer/accounts
/**
 * POST /api/consumer/accounts { email, displayName? } → { userid, created }
 * wxKanban SPEC-144 C1.1. Create or link a YappChatt account by email; a new
 * account gets the welcome (set-password) email. Same email → same id.
 */
export async function POST(req: Request) {
  return consumerCall(req, "POST /api/consumer/accounts", {}, async (deps) => {
    const body = (await readJsonObject(req)) ?? {};
    const result = await createOrLinkAccount(deps, { email: body.email, displayName: body.displayName });
    return {
      body: { userid: result.userid, created: result.created },
      targets: { userid: result.userid, created: String(result.created) },
      auditUserid: result.userid,
    };
  });
}
// [SCOPE 093 / T002] END

// [SCOPE 093 / T009] BEGIN — GET /api/consumer/accounts?email=
/**
 * GET /api/consumer/accounts?email=<email> → { exists, userid, displayName }
 * wxKanban SPEC-144 C1.0 (SPEC-093 Amendment A). Read only: nothing is created,
 * no email is sent; the call itself is audited like every consumer call.
 */
export async function GET(req: Request) {
  return consumerCall(req, "GET /api/consumer/accounts", {}, async (deps) => {
    const result = await lookupAccount(deps, new URL(req.url).searchParams.get("email"));
    return {
      body: result,
      targets: { userid: result.userid, exists: String(result.exists) },
      auditUserid: result.userid,
    };
  });
}
// [SCOPE 093 / T009] END
