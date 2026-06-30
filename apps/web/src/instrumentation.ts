/**
 * Next.js instrumentation — runs once when the server process starts.
 * Spec 011 T005: idempotent first-system-admin bootstrap from BOOTSTRAP_ADMIN_EMAIL.
 */
export async function register() {
  // Only on the Node.js server runtime (not edge/browser).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { bootstrapAdmin } = await import("@/lib/auth/roles");
    await bootstrapAdmin();
  } catch (err) {
    console.error("[instrumentation] bootstrap failed:", err);
  }
}
