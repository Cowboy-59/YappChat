import { redirect } from "next/navigation";
import { AgentStudio } from "@/components/studio/AgentStudio";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Spec 004 — Agent template studio (authenticated, org-scoped). */
export default async function AgentStudioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/studio/agents");
  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold">Agent &amp; Skill Studio</h1>
        <AgentStudio />
      </div>
    </main>
  );
}
