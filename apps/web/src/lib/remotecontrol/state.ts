import type { RemoteControlStatus, RemoteControlAuditRow } from "../db/remotecontrol-schema";

/**
 * Spec 088 — the pure control-session state machine. This is the single source
 * of truth for which transitions are legal; `service.ts` mirrors these rules in
 * atomic DB guards. Kept pure (no DB) so the security-critical transition table
 * is unit-testable in isolation.
 */

export type RemoteControlAction = "allow" | "decline" | "register" | "pause" | "resume" | "end";
export type EndReason = "stopped" | "panic" | "declined" | "disconnected";

/** Statuses that are not yet terminal (an active session). */
export const ACTIVE_STATUSES: RemoteControlStatus[] = ["requested", "agent_pending", "granted", "paused"];

export function isActive(status: RemoteControlStatus): boolean {
  return status !== "ended";
}

/** Terminal reason → the audit event to write. */
export const END_EVENT: Record<EndReason, RemoteControlAuditRow["event"]> = {
  stopped: "stopped",
  panic: "panic",
  declined: "declined",
  disconnected: "disconnected",
};

/**
 * The resulting status for `action` applied from `from`, or `null` if the
 * transition is illegal. `end` is always legal from any active status and a
 * no-op (null) once ended — the only action valid from multiple states.
 */
export function nextStatus(from: RemoteControlStatus, action: RemoteControlAction): RemoteControlStatus | null {
  if (action === "end") return from === "ended" ? null : "ended";
  switch (action) {
    case "allow":
      return from === "requested" ? "agent_pending" : null;
    case "decline":
      return from === "requested" ? "ended" : null;
    case "register":
      return from === "agent_pending" ? "granted" : null;
    case "pause":
      return from === "granted" ? "paused" : null;
    case "resume":
      return from === "paused" ? "granted" : null;
    default:
      return null;
  }
}

export function canTransition(from: RemoteControlStatus, action: RemoteControlAction): boolean {
  return nextStatus(from, action) !== null;
}
