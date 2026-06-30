import { SignupForm } from "@/components/auth/SignupForm";
import { configuredProviders } from "@/lib/auth/sso";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; return?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const plan = sp.plan === "corporate" ? "corporate" : "individual";
  return <SignupForm plan={plan} returnTo={sp.return} invitedEmail={sp.email} ssoProviders={configuredProviders()} />;
}
