"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Spec 068 — client-side avatar crop/reposition. The picked image is shown in a
 * circular viewport the user can PAN (drag up/down + sideways) and ZOOM; on
 * confirm we render the framed square to a canvas and hand back a JPEG blob, so
 * the stored avatar is already correctly composed (no server-side cropping, no
 * schema change). Fixes the "head lopped off" default-center-crop.
 */
const VIEW = 240; // preview viewport (px, square) — masked to a circle
const OUT = 512; // exported avatar edge (px)

export function AvatarCropper({
  file,
  onCancel,
  onCropped,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1); // >= 1
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image top-left within the viewport
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Load the picked file into an image to read its natural size.
  useEffect(() => {
    const u = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL from prop, revoked on cleanup
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const baseScale = nat ? VIEW / Math.min(nat.w, nat.h) : 1; // "cover" the square
  const scale = baseScale * zoom;
  const dispW = nat ? nat.w * scale : VIEW;
  const dispH = nat ? nat.h * scale : VIEW;

  // Keep the viewport fully covered: top-left stays in [VIEW - size, 0].
  const clamp = useCallback(
    (p: { x: number; y: number }) => ({
      x: Math.min(0, Math.max(VIEW - dispW, p.x)),
      y: Math.min(0, Math.max(VIEW - dispH, p.y)),
    }),
    [dispW, dispH],
  );

  // Center on first load / whenever the scale changes.
  useEffect(() => {
    if (!nat) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recenter within new bounds
    setPos((p) => clamp({ x: (VIEW - dispW) / 2 || p.x, y: (VIEW - dispH) / 2 || p.y }));
  }, [nat, dispW, dispH, clamp]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    setPos(clamp({ x: drag.current.ox + dx, y: drag.current.oy + dy }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function confirm() {
    const img = imgRef.current;
    if (!img || !nat) return;
    // Viewport pixel (cx,cy) maps to source ((cx - pos.x)/scale, (cy - pos.y)/scale).
    const sx = -pos.x / scale;
    const sy = -pos.y / scale;
    const sSize = VIEW / scale;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
    canvas.toBlob((blob) => blob && onCropped(blob), "image/jpeg", 0.9);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-xs rounded-2xl border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-bold text-foreground">Position your photo</h2>
        <p className="mb-3 text-xs text-muted-foreground">Drag to move, slide to zoom.</p>

        <div
          className="relative mx-auto touch-none overflow-hidden rounded-full border border-border bg-muted"
          style={{ width: VIEW, height: VIEW, cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL for cropping
            <img
              ref={imgRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: dispW,
                height: dispH,
                maxWidth: "none",
                userSelect: "none",
              }}
            />
          )}
          {/* subtle ring to signal the crop circle */}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/40" />
        </div>

        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-[34px] items-center rounded-lg border border-border px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!nat}
            className="inline-flex min-h-[34px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}
