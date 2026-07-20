import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfilePanel } from "@/components/dashboard/ProfilePanel";
import { DiscoverWidget } from "@/components/dashboard/DiscoverWidget";
import { AvailabilityControl } from "@/components/dashboard/AvailabilityControl";
import { DeviceSessionsList } from "@/components/auth/DeviceSessionsList";
import { LinkedIdentitiesPanel } from "@/components/auth/LinkedIdentitiesPanel";
import { SystemRoleManager } from "@/components/auth/SystemRoleManager";
import { DashboardSpaceInvite } from "@/components/dashboard/DashboardSpaceInvite";
import { AppDownloadCards } from "@/components/dashboard/AppDownloadCards";
import { getActiveOrg, getSessionUser } from "@/lib/auth/session";
import { isSystemStaff } from "@/lib/auth/shared";
import { listMyCommunities, listMyInviteTargets } from "@/lib/communities/service";
import { resolveAvatarUrl } from "@/lib/account/avatar-resolve";

export const dynamic = "force-dynamic";

const roleBadge: Record<string, string> = {
  owner: "bg-primary/15 text-primary",
  moderator: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  member: "bg-muted text-muted-foreground",
};

// Communities + Messaging intentionally omitted — they're in the sidebar tree.
const QUICK_LINKS = [
  { href: "/assistant", label: "Assistant", desc: "Your AI assistant" },
  { href: "/studio", label: "Studio", desc: "Agents & skills" },
];

/** Spec 068 — dashboard home: my communities, discover, quick links, profile. */
export default async function DashboardHome() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/app");
  const [org, myCommunities, inviteTargets, avatarSrc] = await Promise.all([
    getActiveOrg(user.id),
    listMyCommunities(user.id),
    listMyInviteTargets(user.id),
    resolveAvatarUrl(user.avatarurl),
  ]);
  const staff = isSystemStaff(user);
  // Spec 068 delta — surface the existing spec 011 company invite on the dashboard
  // for corporate owner/admins (routes to /members, the canonical invite surface).
  const canInviteColleagues = org?.plantype === "corporate" && (org.role === "owner" || org.role === "admin");

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <h1 className="text-2xl font-bold">Welcome, {user.displayname} 👋</h1>
          <p className="text-sm text-muted-foreground">
            {user.email}
            {org ? ` · ${org.name} (${org.role})` : ""}
          </p>
        </header>

        {/* Module quick links */}
        <section>
          <h2 className="mb-2 text-sm font-bold">Jump in</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-xl border border-border bg-card p-4 hover:bg-muted">
                <div className="text-sm font-semibold">{l.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{l.desc}</div>
              </Link>
            ))}
            {/* Native app install — Android QR (download) + iOS coming soon, right of Studio */}
            <AppDownloadCards />
            {canInviteColleagues && (
              <Link href="/members" className="rounded-xl border border-border bg-card p-4 hover:bg-muted">
                <div className="text-sm font-semibold">Invite a colleague</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Add someone to {org?.name}</div>
              </Link>
            )}
            {staff && (
              <Link href="/admin" className="rounded-xl border border-border bg-card p-4 hover:bg-muted">
                <div className="text-sm font-semibold">Admin</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Console</div>
              </Link>
            )}
          </div>
        </section>

        {/* Spec 068 delta / 017 FR-021 — invite users into a community space (Public/
            Support), shown when the user owns/moderates a community. */}
        {inviteTargets.length > 0 && <DashboardSpaceInvite targets={inviteTargets} />}

        {/* Profile (aligned to the end of Studio: first 2 of 4 cols) + Discover (right) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <ProfilePanel user={user} avatarSrc={avatarSrc} />
          </div>
          {/* Right column: Discover, with Your communities stacked beneath it */}
          <div className="space-y-6 sm:col-span-2">
            <DiscoverWidget />
            <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Your communities</h2>
            <Link href="/communities" className="text-xs font-semibold text-primary hover:underline">
              Open →
            </Link>
          </div>
          <div className="space-y-2">
            {myCommunities.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href="/communities" className="truncate text-sm font-medium hover:underline">
                    {c.name}
                  </Link>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${roleBadge[c.role] ?? roleBadge.member}`}
                  >
                    {c.role}
                  </span>
                </div>
                <div className="mt-2">
                  <AvailabilityControl
                    communityid={c.id}
                    initialStatus={c.availabilitystatus}
                    initialNote={c.availabilitynote}
                  />
                </div>
              </div>
            ))}
            {myCommunities.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                You haven&apos;t joined any communities yet — find one in Discover.
              </p>
            )}
          </div>
            </section>
          </div>
        </div>

        {/* Security & sessions (spec 011 T008) */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold">Security &amp; sessions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <DeviceSessionsList />
            <LinkedIdentitiesPanel />
          </div>
          {staff && <SystemRoleManager canEdit={user.issystemadmin} />}
        </section>
      </div>
    </main>
  );
}
