/**
 * Spec 011 T008 — lightweight client-side password-strength estimate.
 *
 * A self-contained heuristic (length + character-class diversity) used to render
 * the signup strength meter and soft-gate weak passwords, WITHOUT pulling in the
 * heavyweight zxcvbn dependency. The server remains authoritative (length ≥ 8);
 * full zxcvbn scoring can be swapped in later behind this same interface.
 */

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"] as const;

export function passwordStrength(pw: string): { score: PasswordScore; label: string } {
  if (!pw) return { score: 0, label: LABELS[0] };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  // Penalise trivial patterns even if long.
  if (/^(.)\1+$/.test(pw) || /^(?:0123|1234|abcd|qwerty|password)/i.test(pw)) s = Math.min(s, 1);
  const score = Math.max(0, Math.min(4, s)) as PasswordScore;
  return { score, label: LABELS[score] };
}
