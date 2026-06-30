import { redirect } from "next/navigation";
import { AgentSupport } from "@/components/support/SupportApp";
import { getActiveOrg, getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** App Support Chatroom — agent console (org support agents only). */
export default async function SupportAgentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/support/agent");
  if (!user.issupport) redirect("/support");
  const org = await getActiveOrg(user.id);
  if (!org) return <main className="px-4 py-4 text-sm text-muted-foreground">No active organization.</main>;
  return (
    <main className="flex flex-1 flex-col px-4 py-4">
      <AgentSupport orgid={org.id} />
    </main>
  );
}
