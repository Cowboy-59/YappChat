/**
 * Spec 068 — account avatar helpers shared by the ProfilePanel picker (client),
 * the avatar upload route, and the server-side resolver.
 *
 * `users.avatarurl` holds ONE of two shapes:
 *   - a preset path  — a public asset under /avatars/*.svg  (starts with "/")
 *   - an uploaded key — a private S3 object key             (no scheme, no leading "/")
 * Preset paths render directly; uploaded keys must be presigned on read
 * (see resolveAvatarUrl in ./avatar-resolve). This module stays free of any
 * server-only imports so it is safe to pull into client components.
 */
export const PRESET_AVATARS = [
  { id: "aurora", url: "/avatars/aurora.svg", label: "Aurora" },
  { id: "cobalt", url: "/avatars/cobalt.svg", label: "Cobalt" },
  { id: "coral", url: "/avatars/coral.svg", label: "Coral" },
  { id: "plum", url: "/avatars/plum.svg", label: "Plum" },
  { id: "slate", url: "/avatars/slate.svg", label: "Slate" },
  { id: "amber", url: "/avatars/amber.svg", label: "Amber" },
] as const;

/** The set of allowed preset paths — the only string values PATCH /profile accepts for avatarurl. */
export const PRESET_AVATAR_PATHS: readonly string[] = PRESET_AVATARS.map((a) => a.url);

export function isPresetPath(value: string): boolean {
  return PRESET_AVATAR_PATHS.includes(value);
}

/** A stored value is an S3 key (needs presigning) when it is neither an absolute URL nor a public path. */
export function isStoredKey(value: string): boolean {
  return !/^(https?:\/\/|\/)/.test(value);
}
