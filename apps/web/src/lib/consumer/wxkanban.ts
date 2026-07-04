import { timingSafeEqual } from "node:crypto";
import { issueSessionForUserWithToken, provisionOrLookupUserByEmail } from "../auth/service";
import { ensureCommunityAndSpaceMember } from "../communities/membership";

/**
 * wxKanban Cockpit community-help consumer seam.
 *
 * A single trusted external app (the wxKanban Dev Cockpit) calls
 * `POST /api/consumer/session` to provision-or-login a user by email and drop them
 * into the wxKanban Community's help space. This module is the reusable lib half:
 * secret verification + the provisioning/membership/session orchestration. The
 * route handler stays thin.
 *
 * The community + space are fixed for the wxKanban help space but exposed as env
 * overrides so a different deployment (staging, a renamed space) can retarget
 * without a code change. The defaults are the production wxKanban Community + space.
 */

export const WXKANBAN_COMMUNITY_ID =
  process.env.WXKANBAN_COMMUNITY_ID ?? "019f1f30-9005-7678-847f-6217d13684ef";
export const WXKANBAN_SPACE_ID =
  process.env.WXKANBAN_SPACE_ID ?? "019f1f32-0f0a-7ad6-8810-eaa6af97bec7";

/**
 * Constant-time check of the caller-presented consumer secret against
 * `WXKANBAN_CONSUMER_SECRET`. FAIL CLOSED: if the env secret is unset (or empty),
 * or the presented value is missing, this returns false so the seam cannot be
 * called on a misconfigured deployment.
 */
export function verifyConsumerSecret(presented: string | null | undefined): boolean {
  const expected = process.env.WXKANBAN_CONSUMER_SECRET;
  if (!expected || !presented) return false; // fail closed
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual requires equal-length buffers; a length mismatch is a mismatch.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type ConsumerSessionResult = {
  sessionToken: string;
  userid: string;
  communityId: string;
  spaceId: string;
  conversationId: string;
};

/**
 * Provision-or-lookup the user by email, guarantee their membership of the wxKanban
 * Community + target space, then issue a session and return the RAW session token.
 */
export async function provisionConsumerSession(input: {
  email: string;
  displayName?: string;
}): Promise<ConsumerSessionResult> {
  const { userid } = await provisionOrLookupUserByEmail({
    email: input.email,
    displayName: input.displayName ?? null,
  });
  const { conversationid } = await ensureCommunityAndSpaceMember(
    WXKANBAN_COMMUNITY_ID,
    WXKANBAN_SPACE_ID,
    userid,
  );
  const sessionToken = await issueSessionForUserWithToken(userid);
  return {
    sessionToken,
    userid,
    communityId: WXKANBAN_COMMUNITY_ID,
    spaceId: WXKANBAN_SPACE_ID,
    conversationId: conversationid,
  };
}
