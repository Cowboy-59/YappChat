import Constants from "expo-constants";

/**
 * API base URL for the YappChat backend (the deployed Next.js app). Configured in
 * app.json → expo.extra.apiBaseUrl; override per-build via EAS env if needed.
 */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? "https://www.yappchatt.com";

/**
 * Session model (v1): the backend uses an HttpOnly session cookie set by
 * POST /api/auth/login. React Native's networking layer persists cookies per-host,
 * so subsequent requests to the same origin carry the session automatically — no
 * token plumbing in JS. (If we later add a mobile bearer-token endpoint, this is
 * the one place that changes: attach an Authorization header here.)
 *
 * NOTE (open question for the team): confirm cookie persistence is reliable on both
 * iOS and Android in production, or switch to a token endpoint. See README.
 */

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
    // `credentials: include` → send/store the session cookie on native.
    credentials: "include",
    headers: {
      Accept: "application/json",
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
  content: string | null;
  direction: string;
  createdat?: string;
  deletedat?: string | null;
};

export const auth = {
  login: (email: string, password: string) =>
    api.post<{ user: SessionUser; org: unknown }>("/api/auth/login", { email, password }),
  me: () => api.get<{ user: SessionUser | null }>("/api/auth/me"),
  logout: () => api.post<{ ok: boolean }>("/api/auth/logout", {}),
};

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
};
