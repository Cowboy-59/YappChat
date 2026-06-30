import { NextResponse } from "next/server";
import { getSessionUser, isSystemStaff } from "@/lib/auth/session";
import {
  ConfigValidationError,
  DatabaseUnavailableError,
  getPublicConfig,
  patchConfig,
} from "@/lib/landing/service";

// Config reflects DB state; never statically cached at the route layer.
export const dynamic = "force-dynamic";

/**
 * GET /api/landing/config — public-readable subset.
 * Never returns updatedby / row id or any admin-only field.
 */
export async function GET() {
  const { config, updatedat } = await getPublicConfig();
  return NextResponse.json(
    { config, updatedat },
    {
      headers: {
        // Allow CDNs/browsers to cache briefly; bust is driven by updatedat.
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60",
      },
    },
  );
}

/**
 * PATCH /api/landing/config — admin-only write (requires system staff).
 * Validates jsonb against Zod (422 on failure), bumps updatedat/updatedby.
 */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSystemStaff(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await patchConfig(body, user.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      return NextResponse.json(
        { error: "Invalid config", issues: err.issues },
        { status: 422 },
      );
    }
    if (err instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 503 },
      );
    }
    console.error("[landing] PATCH config failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
