import { redirect } from "next/navigation";
import { AssistantApp } from "@/components/pa/AssistantApp";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Spec 002 (core) — Personal Assistant: provider registry + streaming chat. */
export default async function AssistantPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/assistant");
  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold">Personal Assistant</h1>
        <AssistantApp />
      </div>
    </main>
  );
}
