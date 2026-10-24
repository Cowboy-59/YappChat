import { consumerCall } from "../../../../../../../lib/consumer/guard";
import { deleteRoomMember, putRoomMember } from "../../../../../../../lib/consumer/rooms";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ conversationid: string; userid: string }> };

// [SCOPE 093 / T005] BEGIN — PUT /api/consumer/rooms/:conversationid/members/:userid
/** PUT … → { added }. wxKanban SPEC-144 C1.7. 404 room_not_found; 409 room_retired. */
export async function PUT(req: Request, { params }: Params) {
  const { conversationid, userid } = await params;
  return consumerCall(
    req,
    "PUT /api/consumer/rooms/:conversationid/members/:userid",
    { conversationid, userid },
    async (deps) => {
      const result = await putRoomMember(deps, conversationid, userid);
      return { body: result, targets: { added: String(result.added) }, auditUserid: null };
    },
  );
}
// [SCOPE 093 / T005] END

// [SCOPE 093 / T005] BEGIN — DELETE /api/consumer/rooms/:conversationid/members/:userid
/** DELETE … → { removed }. wxKanban SPEC-144 C1.8. 404 room_not_found. */
export async function DELETE(req: Request, { params }: Params) {
  const { conversationid, userid } = await params;
  return consumerCall(
    req,
    "DELETE /api/consumer/rooms/:conversationid/members/:userid",
    { conversationid, userid },
    async (deps) => {
      const result = await deleteRoomMember(deps, conversationid, userid);
      return { body: result, targets: { removed: String(result.removed) } };
    },
  );
}
// [SCOPE 093 / T005] END
