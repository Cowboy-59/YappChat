"use client";

import { useState } from "react";
import { useWSClient, useWSStatus } from "./WSProvider";

/**
 * Spec 003 (T008) — small connection-status dot for the app header.
 *  green = connected · amber = connecting/reconnecting · red = disconnected.
 * Click toggles a tooltip with the last close code/reason.
 */
const COLORS: Record<string, string> = {
  connected: "#2ecc71",
  connecting: "#f1c40f",
  reconnecting: "#f1c40f",
  disconnected: "#e74c3c",
};

const LABELS: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

export function WSStatusIndicator() {
  const status = useWSStatus();
  const client = useWSClient();
  const [open, setOpen] = useState(false);
  const close = client.lastClose;

  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        aria-label={`WebSocket: ${LABELS[status]}`}
        title={LABELS[status]}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: COLORS[status],
          border: "none",
          padding: 0,
          cursor: "pointer",
          animation: status === "reconnecting" || status === "connecting" ? "pulse 1s infinite" : undefined,
        }}
      />
      {open && (
        <span
          role="status"
          style={{
            position: "absolute",
            top: "140%",
            right: 0,
            whiteSpace: "nowrap",
            background: "#2c3e50",
            color: "#f9f9f9",
            padding: "4px 8px",
            borderRadius: 6,
            fontSize: 12,
            zIndex: 50,
          }}
        >
          {LABELS[status]}
          {close ? ` — last close: ${close.code}${close.reason ? ` (${close.reason})` : ""}` : ""}
        </span>
      )}
    </span>
  );
}
