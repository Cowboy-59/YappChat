import { consumerCall } from "../../../../../../lib/consumer/guard";
import { retireRoom } from "../../../../../../lib/consumer/rooms";

export const dynamic = "force-dynamic";

// [SCOPE 093 / T006] BEGIN — POST /api/consumer/rooms/:conversationid/retire
/**
 * POST /api/consumer/rooms/:conversationid/retire → { retired: true, retiredat }
 * wxKanban SPEC-144 C1.9. Hidden from members, history kept for the owner, posting
 * refused. Retiring a retired room returns its existing retiredat.
 */
export async function POST(req: Request, { params }: { params: Promise<{ conversationid: string }> }) {
  const { conversationid } = await params;
  return consumerCall(req, "POST /api/consumer/rooms/:conversationid/retire", { conversationid }, async (deps) => {
    const result = await retireRoom(deps, conversationid);
    return { body: result, targets: { retiredat: result.retiredat } };
  });
}
// [SCOPE 093 / T006] END
