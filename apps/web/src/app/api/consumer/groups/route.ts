import { consumerCall, readJsonObject } from "../../../../lib/consumer/guard";
import { createCompanyGroup } from "../../../../lib/consumer/groups";
import { ConsumerError } from "../../../../lib/consumer/errors";

export const dynamic = "force-dynamic";

// [SCOPE 093 / T003] BEGIN — POST /api/consumer/groups
/**
 * POST /api/consumer/groups { ownerUserid, name, seatlimit } → { orgid }
 * wxKanban SPEC-144 C1.2. Creates a corporate org owned by the company account.
 */
export async function POST(req: Request) {
  return consumerCall(req, "POST /api/consumer/groups", {}, async (deps) => {
    const body = await readJsonObject(req);
    if (!body) throw new ConsumerError("invalid_request", 400);
    const { orgid } = await createCompanyGroup(deps, body);
    const owner = typeof body.ownerUserid === "string" ? body.ownerUserid : null;
    return { body: { orgid }, targets: { orgid, ownerUserid: owner }, auditUserid: owner };
  });
}
// [SCOPE 093 / T003] END
