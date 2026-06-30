import { redirect } from "next/navigation";
import { SkillStudio } from "@/components/studio/SkillStudio";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Spec 004 — Skill Studio (authenticated, org-scoped). */
export default async function StudioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/studio");
  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold">Agent &amp; Skill Studio</h1>
        <SkillStudio />
      </div>
    </main>
  );
}
