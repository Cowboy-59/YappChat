/** Spec 011 — shared auth constants (cookie names, TTLs). */

export const SESSION_COOKIE = "yc_session";
export const REFRESH_COOKIE = "yc_refresh";
/** Selected active org (multi-org switcher). Server reads it in getActiveOrg. */
export const ACTIVE_ORG_COOKIE = "yc_active_org";

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // sliding 24h
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const MAGIC_LINK_TTL_MS = 10 * 60 * 1000; // 10 min
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 min
export const REFRESH_GRACE_MS = 5 * 1000; // 5s rotation grace window

export const MIN_PASSWORD_LENGTH = 8;
