import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { acceptContactInvite } from "@/lib/contacts/service";

export const dynamic = "force-dynamic";

/** Email contact-invite landing — connect the signed-in user to the inviter. */
export default async function ContactInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/signup?return=${encodeURIComponent(`/invite/contact/${token}`)}`);
  const r = await acceptContactInvite(token, { id: user.id, email: user.email, emailverified: user.emailverified });
  redirect(r.ok ? "/chats" : `/chats?invite=${r.reason ?? "expired"}`);
}
