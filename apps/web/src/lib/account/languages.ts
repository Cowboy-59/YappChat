/**
 * Spec 068 — the languages YappChatt offers for the account preferred-language
 * setting. Stored on `users.preferredlanguage` as the ISO 639-1 code; the label is
 * the language's own native name for the picker. Shared by the ProfilePanel
 * dropdown and the PATCH /api/account/profile zod validation so the UI and the API
 * stay in lock-step (also drives presentation spoken/caption languages, spec 071).
 */
export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
] as const;

/** Tuple of the supported ISO codes — typed for z.enum() and exhaustiveness checks. */
export const LANGUAGE_CODES = ["en", "fr", "es", "de", "it", "pt"] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}
