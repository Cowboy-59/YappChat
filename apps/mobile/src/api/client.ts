import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

/**
 * API base URL for the YappChat backend (the deployed Next.js app). Configured in
 * app.json → expo.extra.apiBaseUrl; override per-build via EAS env if needed.
 */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "https://www.yappchatt.com";

/**
 * Session model: a **bearer token**. `POST /api/auth/mobile/login` (and the mobile
 * SSO deep-link) return the opaque session token; we persist it in the OS secure
 * store (Keychain / Keystore) and send it as `Authorization: Bearer <token>` on
 * every request. The backend accepts that header on all authenticated routes
 * (see readSessionToken in the web app). No reliance on cookie persistence.
 */
const TOKEN_KEY = "yc.session.token";
let sessionToken: string | null = null;

/** Load the persisted token into memory (call once on app start). */
export async function loadToken(): Promise<string | null> {
  sessionToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return sessionToken;
}

/** Persist (or clear) the session token. */
export async function setToken(token: string | null): Promise<void> {
  sessionToken = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function getToken(): string | null {
  return sessionToken;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

type Json = Record<string, unknown>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as Json) : ({} as Json);

  if (!res.ok) {
    const code = (data.error as string | undefined) ?? `http_${res.status}`;
    throw new ApiError(res.status, code, (data.detail as string | undefined) ?? code);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Typed endpoint helpers (mirror the web API shapes) ───────────────────────

export type SessionUser = { id: string; email: string; displayname: string };
export type Chat = { conversationid: string; kind: string; name: string; solo?: boolean };
export type Contact = { id: string; displayname: string; email: string; conversationid: string | null };
export type Message = {
  id: string;
  authorid: string;
  authorname?: string | null;
  isagent?: boolean;
  content: string | null;
  direction: string;
  createdat?: string;
  deletedat?: string | null;
};

export type SsoProvider = "google" | "microsoft";

export const auth = {
  /** Email + password → stores the returned bearer token. */
  login: async (email: string, password: string) => {
    const r = await api.post<{ user: SessionUser; org: unknown; token: string }>("/api/auth/mobile/login", {
      email,
      password,
    });
    await setToken(r.token);
    return r;
  },
  me: () => api.get<{ user: SessionUser }>("/api/auth/me"),
  logout: async () => {
    try {
      await api.post<{ ok: boolean }>("/api/auth/logout", {});
    } finally {
      await setToken(null);
    }
  },
  /** URL that opens the provider SSO flow for the native app (mode=mobile). */
  ssoStartUrl: (provider: SsoProvider) => `${API_BASE_URL}/api/auth/sso/${provider}?mode=mobile`,
};

/**
 * Run the SSO round-trip in an in-app browser. The backend redirects back to
 * `yappchat://auth?token=…` (or `?error=…`); we capture that, store the token, and
 * return. Uses expo-web-browser's auth session so provider cookies stay isolated.
 */
export async function signInWithSso(provider: SsoProvider): Promise<{ ok: true } | { ok: false; error: string }> {
  const redirectUrl = Linking.createURL("auth"); // yappchat://auth (matches the backend deep link)
  const result = await WebBrowser.openAuthSessionAsync(auth.ssoStartUrl(provider), redirectUrl);
  if (result.type !== "success" || !result.url) {
    return { ok: false, error: result.type === "cancel" ? "cancelled" : "dismissed" };
  }
  const { queryParams } = Linking.parse(result.url);
  const token = typeof queryParams?.token === "string" ? queryParams.token : null;
  const error = typeof queryParams?.error === "string" ? queryParams.error : null;
  if (error || !token) return { ok: false, error: error ?? "sso_failed" };
  await setToken(token);
  return { ok: true };
}

export const chats = {
  list: () => api.get<{ chats: Chat[]; unread?: Record<string, number> }>("/api/chats"),
};

export const contacts = {
  list: () => api.get<{ contacts: Contact[] }>("/api/contacts"),
  /**
   * Open (or create) the 1:1 conversation with an existing contact and return its
   * id. `requestContact` is idempotent on an already-accepted pair — it returns the
   * existing conversation — so tapping a contact reliably yields their DM.
   */
  request: (addresseeid: string) =>
    api.post<{ ok: boolean; mode?: string; contactid: string; conversationid: string }>(
      "/api/contacts/request",
      { addresseeid },
    ),
};

export const conversations = {
  messages: (conversationid: string) =>
    api.get<{ messages: Message[]; myrole?: string | null }>(
      `/api/engine/conversations/${conversationid}/messages`,
    ),
  send: (conversationid: string, content: string) =>
    api.post<{ message: Message }>(`/api/engine/conversations/${conversationid}/messages`, { content }),
  /** Clear all messages, optionally keeping one (e.g. the last incoming message). */
  clear: (conversationid: string, exceptMessageId?: string) =>
    api.del<{ ok: boolean }>(
      `/api/engine/conversations/${conversationid}/messages${exceptMessageId ? `?except=${encodeURIComponent(exceptMessageId)}` : ""}`,
    ),
  /** Advance the caller's read marker (clears the unread count for this room). */
  markRead: (conversationid: string) =>
    api.post<{ ok: boolean }>(`/api/engine/conversations/${conversationid}/read`, {}),
};
