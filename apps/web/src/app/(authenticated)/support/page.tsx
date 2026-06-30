import { redirect } from "next/navigation";
import { RequesterSupport } from "@/components/support/SupportApp";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** App Support Chatroom — requester surface (logged-in user starts a support chat). */
export default async function SupportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/support");
  return (
    <main className="flex flex-1 flex-col px-4 py-4">
      <RequesterSupport />
    </main>
  );
}
