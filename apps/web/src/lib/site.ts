/**
 * Deployment-level constants for SEO/absolute URLs (T005).
 *
 * These helpers are used only in server contexts (metadata, JSON-LD, sitemap,
 * robots, footer). They prefer a RUNTIME env var (`SITE_URL` / `APP_VERSION`)
 * so a self-hosted deployment can change them without rebuilding, falling back
 * to the build-time `NEXT_PUBLIC_*` value and finally a local default.
 */

/** Public base URL, e.g. https://yappchat.app. No trailing slash. */
export function getSiteUrl(): string {
  const raw =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:5175";
  return raw.replace(/\/+$/, "");
}

/** Build/version string surfaced in the footer (FR-017). */
export function getAppVersion(): string {
  return (
    process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"
  );
}

/** Resolve a possibly-relative config URL to an absolute URL for OG/JSON-LD. */
export function toAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return getSiteUrl();
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${getSiteUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}
