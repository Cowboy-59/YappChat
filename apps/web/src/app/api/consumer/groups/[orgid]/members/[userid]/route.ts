import { consumerCall, readJsonObject } from "../../../../../../../lib/consumer/guard";
import { deleteGroupMember, putGroupMember } from "../../../../../../../lib/consumer/groups";
import { ConsumerError } from "../../../../../../../lib/consumer/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orgid: string; userid: string }> };

// [SCOPE 093 / T004] BEGIN — PUT /api/consumer/groups/:orgid/members/:userid
/**
 * PUT … { role: "admin" | "member" } → { orgid, userid, role, added }
 * wxKanban SPEC-144 C1.4. Adds directly (no invitation) or re-roles. 409
 * seat_limit_reached { missing }; 409 owner_protected for the owner.
 */
export async function PUT(req: Request, { params }: Params) {
  const { orgid, userid } = await params;
  return consumerCall(req, "PUT /api/consumer/groups/:orgid/members/:userid", { orgid, userid }, async (deps) => {
    const body = await readJsonObject(req);
    if (!body) throw new ConsumerError("invalid_request", 400);
    const result = await putGroupMember(deps, orgid, userid, body);
    return { body: result, targets: { role: result.role, added: String(result.added) }, auditUserid: result.userid };
  });
}
// [SCOPE 093 / T004] END

// [SCOPE 093 / T004] BEGIN — DELETE /api/consumer/groups/:orgid/members/:userid
/** DELETE … → { removed }. wxKanban SPEC-144 C1.5. 409 owner_protected for the owner. */
export async function DELETE(req: Request, { params }: Params) {
  const { orgid, userid } = await params;
  return consumerCall(req, "DELETE /api/consumer/groups/:orgid/members/:userid", { orgid, userid }, async (deps) => {
    const result = await deleteGroupMember(deps, orgid, userid);
    return { body: result, targets: { removed: String(result.removed) } };
  });
}
// [SCOPE 093 / T004] END
