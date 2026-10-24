import { consumerCall, readJsonObject } from "../../../../lib/consumer/guard";
import { createProjectRoom } from "../../../../lib/consumer/rooms";
import { ConsumerError } from "../../../../lib/consumer/errors";

export const dynamic = "force-dynamic";

// [SCOPE 093 / T005] BEGIN — POST /api/consumer/rooms
/**
 * POST /api/consumer/rooms { ownerUserid, title, memberIds } → { conversationid }
 * wxKanban SPEC-144 C1.6. The room is owned by the company account, filed in its
 * Projects grouping, with every listed member in it.
 */
export async function POST(req: Request) {
  return consumerCall(req, "POST /api/consumer/rooms", {}, async (deps) => {
    const body = await readJsonObject(req);
    if (!body) throw new ConsumerError("invalid_request", 400);
    const { conversationid } = await createProjectRoom(deps, body);
    const owner = typeof body.ownerUserid === "string" ? body.ownerUserid : null;
    const members = Array.isArray(body.memberIds) ? String(body.memberIds.length) : "0";
    return {
      body: { conversationid },
      targets: { conversationid, ownerUserid: owner, members },
      auditUserid: owner,
    };
  });
}
// [SCOPE 093 / T005] END
