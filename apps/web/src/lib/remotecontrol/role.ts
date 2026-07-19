/** Spec 088/089 — which side of a control session `currentUserId` is on. */
export function roleOf(
  session: { controlleruserid: string; hostuserid: string } | null,
  currentUserId: string,
): "controller" | "host" | null {
  if (!session) return null;
  return session.controlleruserid === currentUserId ? "controller" : "host";
}
