import { redirect } from "next/navigation";
import { MessagingApp } from "@/components/engine/MessagingApp";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Spec 001 (core) — Common Chat Engine: channels, conversations, live messaging. */
export default async function MessagingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/messaging");
  return (
    <main className="flex flex-1 flex-col px-4 py-4">
      <MessagingApp />
    </main>
  );
}
