import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, ApiError, loadToken, signInWithSso, type SessionUser, type SsoProvider } from "@/api/client";

type AuthState = {
  user: SessionUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithProvider: (provider: SsoProvider) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * App-wide auth state. Bootstraps by calling GET /api/auth/me (the session cookie
 * is sent automatically on native); the login/logout endpoints set/clear it.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadToken(); // hydrate the persisted bearer token before hitting /me
        const { user } = await auth.me();
        if (!cancelled) setUser(user);
      } catch (err) {
        // 401 → not signed in; anything else → treat as signed out for v1.
        if (!cancelled && !(err instanceof ApiError && err.status === 401)) {
          // eslint-disable-next-line no-console
          console.warn("auth bootstrap failed:", err);
        }
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await auth.login(email, password);
    setUser(user);
  }, []);

  const signInWithProvider = useCallback(async (provider: SsoProvider) => {
    const r = await signInWithSso(provider);
    if (!r.ok) throw new ApiError(401, r.error);
    const { user } = await auth.me();
    setUser(user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signInWithProvider, signOut }),
    [user, loading, signIn, signInWithProvider, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
