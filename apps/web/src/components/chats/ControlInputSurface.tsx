"use client";

import { useCallback, useRef } from "react";
import { useWSClient } from "@/components/ws/WSProvider";
import type { ControlInput } from "@/lib/ws/events";

/**
 * Spec 088/089 — the controller's pointer/keyboard capture layer. Absolutely
 * fills its positioned parent (the shared-screen video), normalizes coordinates
 * to [0,1] over itself, and relays input over the WS control scope. Reused by
 * RemoteControlStage (separate-room control) and DmCall (in-call control).
 */
const MOVE_THROTTLE_MS = 16; // ~60 fps for pointer moves

function normButton(b: number): "left" | "right" | "middle" {
  return b === 2 ? "right" : b === 1 ? "middle" : "left";
}

export function ControlInputSurface({ sessionId, active }: { sessionId: string; active: boolean }) {
  const ws = useWSClient();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const lastMove = useRef(0);

  const send = useCallback((input: ControlInput) => ws.sendControlInput(sessionId, input), [ws, sessionId]);

  const norm = (clientX: number, clientY: number) => {
    const el = surfaceRef.current;
    if (!el) return { x: 0, y: 0 };
    const b = el.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (clientY - b.top) / b.height)),
    };
  };

  if (!active) return null;

  return (
    <div
      ref={surfaceRef}
      className="absolute inset-0 cursor-crosshair outline-none"
      tabIndex={0}
      onPointerMove={(e) => {
        const now = e.timeStamp;
        if (now - lastMove.current < MOVE_THROTTLE_MS) return;
        lastMove.current = now;
        const p = norm(e.clientX, e.clientY);
        send({ t: "move", x: p.x, y: p.y });
      }}
      onPointerDown={(e) => {
        e.currentTarget.focus();
        const p = norm(e.clientX, e.clientY);
        send({ t: "down", x: p.x, y: p.y, button: normButton(e.button) });
      }}
      onPointerUp={(e) => {
        const p = norm(e.clientX, e.clientY);
        send({ t: "up", x: p.x, y: p.y, button: normButton(e.button) });
      }}
      onWheel={(e) => {
        const p = norm(e.clientX, e.clientY);
        send({ t: "scroll", x: p.x, y: p.y, dx: e.deltaX, dy: e.deltaY });
      }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        e.preventDefault();
        send({ t: "key", key: e.key, down: true });
      }}
      onKeyUp={(e) => {
        e.preventDefault();
        send({ t: "key", key: e.key, down: false });
      }}
    />
  );
}
