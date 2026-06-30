"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { OrgSummary, SessionUser, SystemFlag } from "@/lib/auth/shared";

/**
 * Spec 011 T008 — client auth context. The web app guards auth server-side (the
 * (authenticated) route-group layout), so this provider is SEEDED from the
 * server-resolved user/org and exposes reactive auth state + helpers to client
 * islands. `signIn` is owned by the dedicated forms (LoginForm/SignupForm/…);
 * this hook covers the consume-side: role checks, signOut, and refresh.
 */

type OrgRole = "owner" | "admin" | "member";
const RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };

type AuthValue = {
  user: SessionUser;
  org: OrgSummary | null;
  hasRole: (role: OrgRole) => boolean;
  hasSystemFlag: (flag: SystemFlag) => boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({
  user: initialUser,
  org: initialOrg,
  children,
}: {
  user: SessionUser;
  org: OrgSummary | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const [org, setOrg] = useState(initialOrg);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      org,
      hasRole: (role) => (org ? RANK[org.role] >= RANK[role] : false),
      hasSystemFlag: (flag) => Boolean(user[flag]),
      signOut: async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
        // Spec 008 seam: SecureKeyStore.clearUser(user.id) runs here on native.
        window.location.assign("/");
      },
      refresh: async () => {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        if (r.ok) {
          const data = (await r.json()) as { user: SessionUser; org: OrgSummary | null };
          setUser(data.user);
          setOrg(data.org);
        }
      },
    }),
    [user, org],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
