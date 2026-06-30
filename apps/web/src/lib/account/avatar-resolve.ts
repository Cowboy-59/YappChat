import { presignGet } from "../storage/s3";
import { isStoredKey } from "./avatars";

/**
 * Spec 068 — turn a stored `users.avatarurl` into a URL the browser can render.
 * Preset/public paths and absolute URLs pass through unchanged; uploaded S3 keys
 * get a short-lived presigned GET URL. Returns null when there is no avatar or the
 * key can no longer be presigned (e.g. storage unconfigured / object gone).
 */
export async function resolveAvatarUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!isStoredKey(value)) return value;
  try {
    return await presignGet(value);
  } catch {
    return null;
  }
}
