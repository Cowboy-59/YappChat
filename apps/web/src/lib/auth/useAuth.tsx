"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { OrgSummary, SessionUser } from "./shared";

/**
 * Spec 011 T008 (minimal slice) — useAuth / AuthContext.
 * A lightweight reactive auth context: fetches /api/auth/me, exposes role
 * helpers and signOut. The fuller AuthGate + provider/account UIs land with the
 * app shell (spec 008) / later 011 passes.
 */
type AuthState = {
  user: SessionUser | null;
  org: OrgSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  hasSystemFlag: (flag: "issystemadmin" | "isbillingadmin" | "issupport") => boolean;
  hasRole: (role: "owner" | "admin" | "member") => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { user: SessionUser; org: OrgSummary | null };
        setUser(data.user);
        setOrg(data.org);
      } else {
        setUser(null);
        setOrg(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    // Spec 008 seam: SecureKeyStore.clearUser(user.id) runs here once available.
    setUser(null);
    setOrg(null);
    window.location.assign("/");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rank = { member: 0, admin: 1, owner: 2 } as const;
  const value: AuthState = {
    user,
    org,
    loading,
    refresh,
    signOut,
    hasSystemFlag: (flag) => Boolean(user?.[flag]),
    hasRole: (role) => Boolean(org && rank[org.role] >= rank[role]),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
