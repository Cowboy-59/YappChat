import { redirect } from "next/navigation";
import { getActiveOrg, getSessionUser } from "@/lib/auth/session";
import { MembersManager } from "@/components/orgs/MembersManager";

export const dynamic = "force-dynamic";

/** Company members management — corporate orgs only, owner/admin only. */
export default async function MembersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/members");
  const org = await getActiveOrg(user.id);
  if (!org || org.plantype !== "corporate") redirect("/app");
  const canManage = org.role === "owner" || org.role === "admin";
  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-sm text-muted-foreground">
            {org.name} · {canManage ? "invite and manage your team" : "your team directory"}
          </p>
        </header>
        <MembersManager />
      </div>
    </main>
  );
}
