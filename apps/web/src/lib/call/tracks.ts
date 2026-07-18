/**
 * Spec 089 — pure classification for call tracks so DmCall can route the shared
 * screen to the main frame and the camera to the PiP. `source`/`kind` are the
 * string values of livekit-client `Track.Source` / `Track.Kind`.
 */
export type CallTrackKind = "screen" | "camera" | "audio" | "other";

export function classifyCallTrack(source: string, kind: string): CallTrackKind {
  if (kind === "audio") return "audio";
  if (source === "screen_share") return "screen";
  if (source === "camera") return "camera";
  return "other";
}

/** Screen share (when present) owns the main frame; camera is the fallback. */
export function pickMainKind(hasScreen: boolean): "screen" | "camera" {
  return hasScreen ? "screen" : "camera";
}
