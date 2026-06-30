"use client";

/** "Continue with …" SSO buttons — one per configured provider (spec 011 T007).
 *  Plain links: the start route redirects to the IdP. `returnTo` is threaded so an
 *  invited user lands back on /invite/[token] after auth. */
export function SsoButtons({
  providers,
  returnTo,
}: {
  providers: { key: string; label: string }[];
  returnTo?: string;
}) {
  if (!providers.length) return null;
  const q = returnTo ? `?return=${encodeURIComponent(returnTo)}` : "";
  return (
    <div className="space-y-2">
      <div className="relative py-1 text-center">
        <span className="bg-card px-2 text-xs text-muted-foreground">or continue with</span>
      </div>
      {providers.map((p) => (
        <a
          key={p.key}
          href={`/api/auth/sso/${p.key}${q}`}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          Continue with {p.label}
        </a>
      ))}
    </div>
  );
}
