import { LoginForm } from "@/components/auth/LoginForm";
import { MagicLinkForm } from "@/components/auth/MagicLinkForm";
import { configuredProviders } from "@/lib/auth/sso";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string; method?: string; email?: string; sso_error?: string }>;
}) {
  const sp = await searchParams;
  if (sp.method === "magic") return <MagicLinkForm />;
  return (
    <LoginForm
      returnTo={sp.return}
      prefillEmail={sp.email}
      ssoProviders={configuredProviders()}
      ssoError={sp.sso_error}
    />
  );
}
