import { AppSidebar } from "@/components/shell/AppSidebar";
import { IconRail } from "@/components/shell/IconRail";
import { AppRealtime } from "@/components/ws/AppRealtime";
import { AuthProvider } from "@/components/auth/AuthContext";
import { EmailVerifyNotice } from "@/components/auth/EmailVerifyNotice";
import { getActiveOrg, getCurrentSessionId, getSessionUser, listUserOrgs } from "@/lib/auth/session";
import { resolveAvatarUrl } from "@/lib/account/avatar-resolve";

export const dynamic = "force-dynamic";

/**
 * Spec 068 — authenticated app shell. A Next route group `(authenticated)`:
 * the folder is invisible to the URL, so every wrapped route keeps its path.
 * Renders the persistent sidebar + realtime + email-verify chrome once around
 * the page content when signed in. When there is NO session the layout renders
 * the children bare and lets each page's own guard redirect with its PRECISE
 * `?return=` path (the layout can't see the requested pathname server-side).
 */
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) return <>{children}</>;
  const [avatarSrc, org, orgs, sessionId] = await Promise.all([
    resolveAvatarUrl(user.avatarurl),
    getActiveOrg(user.id),
    listUserOrgs(user.id),
    getCurrentSessionId(),
  ]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <AppRealtime currentSessionId={sessionId} currentUserId={user.id} />
      <IconRail user={user} org={org} orgs={orgs} avatarSrc={avatarSrc} />
      <AppSidebar />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-y-auto">
        {!user.emailverified ? (
          <div className="px-6 pt-4">
            <EmailVerifyNotice />
          </div>
        ) : null}
        <AuthProvider user={user} org={org}>
          {children}
        </AuthProvider>
      </div>
    </div>
  );
}
