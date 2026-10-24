import { consumerCall, readJsonObject } from "../../../../../lib/consumer/guard";
import { updateGroupSeatlimit } from "../../../../../lib/consumer/groups";
import { ConsumerError } from "../../../../../lib/consumer/errors";

export const dynamic = "force-dynamic";

// [SCOPE 093 / T003] BEGIN — PATCH /api/consumer/groups/:orgid
/**
 * PATCH /api/consumer/groups/:orgid { seatlimit } → { orgid, seatlimit }
 * wxKanban SPEC-144 C1.3. 409 below_members { members } when the new limit is
 * below the current non-owner members; nothing changes then.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ orgid: string }> }) {
  const { orgid } = await params;
  return consumerCall(req, "PATCH /api/consumer/groups/:orgid", { orgid }, async (deps) => {
    const body = await readJsonObject(req);
    if (!body) throw new ConsumerError("invalid_request", 400);
    const result = await updateGroupSeatlimit(deps, orgid, body);
    return { body: result, targets: { seatlimit: String(result.seatlimit) } };
  });
}
// [SCOPE 093 / T003] END
