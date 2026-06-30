/** Maps server auth error codes to user-facing copy. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "That email or password is incorrect.",
  registration_failed: "We couldn't create that account. Try signing in instead.",
  plan_required: "Please choose a plan.",
  orgname_required_for_corporate: "An organisation name is required for the Corporate plan.",
  password_too_short: "Password must be at least 8 characters.",
  displayname_required: "Please enter your name.",
  invalid_email: "Please enter a valid email address.",
  invalid_or_expired_token: "That link is invalid or has expired.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  invalid_body: "Please fill in all required fields.",
  db_unavailable: "The service is temporarily unavailable. Please try again shortly.",
  internal_error: "Something went wrong. Please try again.",
};

export function authMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || "Something went wrong. Please try again.";
}

/** Maps `?sso_error=` query codes (SSO redirect failures) to user-facing copy. */
const SSO_MESSAGES: Record<string, string> = {
  account_exists:
    "An account already exists for that email. Sign in with your password (or your original method) first, then link this provider from your account settings.",
  state: "Your sign-in session expired before it completed. Please try again.",
  failed: "We couldn't complete that sign-in. Please try again.",
  start_failed: "We couldn't start that sign-in. Please try again.",
  unknown_provider: "That sign-in provider isn't available.",
};

export function ssoMessage(code: string | undefined): string | null {
  if (!code) return null;
  return SSO_MESSAGES[code] ?? "We couldn't complete that sign-in. Please try again.";
}
