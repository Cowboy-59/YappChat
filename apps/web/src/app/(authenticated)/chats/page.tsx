import { redirect } from "next/navigation";
import { ChatsApp } from "@/components/chats/ChatsApp";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** The "Individuals" context — direct + group chats, backed by the contacts system. */
export default async function ChatsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/chats");
  return (
    <main className="flex flex-1 flex-col px-4 py-4 min-h-0">
      <ChatsApp autoTranslate={user.autotranslate} />
    </main>
  );
}
