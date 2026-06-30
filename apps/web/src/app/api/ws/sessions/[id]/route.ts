import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { engineFetch } from "@/lib/ws/internal";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/ws/sessions/:id — force-close a live WS session (spec 003 T001),
 * e.g. when an account is deactivated. System admins only. Proxies the engine,
 * which terminates the socket and drops the `wssessions` row.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth({ systemFlag: "issystemadmin" });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  try {
    const res = await engineFetch(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.status === 404) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!res.ok) return NextResponse.json({ error: "engine unavailable" }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "engine unavailable" }, { status: 502 });
  }
}
