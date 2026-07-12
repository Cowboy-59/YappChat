import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ContactFreezesPanel } from "@/components/admin/ContactFreezesPanel";
import { InviteConsole } from "@/components/admin/InviteConsole";
import { getSessionUser, isSystemStaff } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Placeholder system-staff console. The full Admin Console is spec 013; this is
 * the role-gated landing target for system staff after sign-in.
 */
export default async function AdminHome() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/admin");
  if (!isSystemStaff(user)) redirect("/app");

  const flags = [
    user.issystemadmin && "System admin",
    user.isbillingadmin && "Billing admin",
    user.issupport && "Support",
  ].filter(Boolean) as string[];

  return (
    <main className="flex-1 px-6 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm">
          <h1 className="text-2xl font-bold text-foreground">Admin console</h1>
          <p className="mt-2 text-sm text-muted-foreground">Signed in as {user.email}.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {flags.map((f) => (
              <span key={f} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                {f}
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Placeholder for the Admin Console (spec 013) — landing-page branding, system roles, and more land here.
          </p>
          <div className="mt-8 flex gap-3">
            <a
              href="/app"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Go to app
            </a>
            <SignOutButton />
          </div>
        </div>

        {/* Spec 013 FR-019 — global invite console (system admin only). */}
        {user.issystemadmin && <InviteConsole />}
        {user.issystemadmin && <ContactFreezesPanel />}
      </div>
    </main>
  );
}
