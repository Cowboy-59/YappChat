import { redirect } from "next/navigation";
import { CommunitiesApp } from "@/components/communities/CommunitiesApp";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Spec 017 (Communities) — first UI over the T001/T002 backend: browse the
 * communities you belong to, open their spaces, and chat live in a space over
 * the membership-gated `conversation:{id}` WS scope (spec 001 T009 core).
 */
export default async function CommunitiesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/communities");
  return (
    <main className="flex flex-1 flex-col px-4 py-4">
      <CommunitiesApp currentUserId={user.id} />
    </main>
  );
}
