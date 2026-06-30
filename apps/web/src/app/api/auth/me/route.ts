import { NextResponse } from "next/server";
import { getActiveOrg, getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — current session user + active org, or 401.
 * Consumed by spec 012's SystemPathRedirector and the frontend useAuth hook.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const org = await getActiveOrg(user.id);
  return NextResponse.json({ user, org });
}
