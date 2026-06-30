import { PasswordResetForm } from "@/components/auth/PasswordResetForms";

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  return <PasswordResetForm token={sp.token ?? ""} />;
}
