"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Intro splash: plays /brand/splash.mp4 once, then fades to reveal the landing
 * page underneath (which is already in the DOM / SSR HTML, so SEO + first paint
 * are unaffected). The GIF is the poster so there's no black frame before play.
 *
 * Dismisses on: video end, a max-duration fallback, a click/Escape (skip), or
 * immediately when the user prefers reduced motion or has already seen it this
 * session.
 */
// The clip is ~6s; 0.6x stretches it to ~10s so the intro plays slowly, not in a
// flash. (rate = clip seconds / desired seconds = 6 / 10.)
const PLAYBACK_RATE = 0.6;
const HOLD_MS = 1000; // freeze on the final "YappChatt" frame before leaving
const FADE_OUT_MS = 1300; // crossfade out to the landing page
// Safety net if `ended` never fires (e.g. autoplay blocked): generous enough to
// clear the slowed playback (~10s) + hold, so it only trips on a real failure.
const MAX_MS = 15000;

export function Splash() {
  const [phase, setPhase] = useState<"playing" | "leaving" | "gone">("playing");
  // Video eases in over the (always-opaque) background so it never "pops"; the
  // bg stays solid the whole time so the landing page never peeks through.
  const [videoIn, setVideoIn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem("splashSeen") === "1";
      sessionStorage.setItem("splashSeen", "1");
    } catch {
      /* storage unavailable */
    }
    if (reduce || seen) {
      // Defer so we don't setState synchronously inside the effect body.
      const t = window.setTimeout(() => setPhase("gone"), 0);
      return () => clearTimeout(t);
    }
    document.body.style.overflow = "hidden"; // no scroll behind the splash
    const fallback = window.setTimeout(() => dismiss(), MAX_MS);
    timers.current.push(fallback);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    // Fade the video in on the next frame (lets the opacity transition run).
    const raf = requestAnimationFrame(() => setVideoIn(true));
    const v = videoRef.current;
    if (v) {
      v.playbackRate = PLAYBACK_RATE;
      // Best-effort autoplay (muted autoplay is allowed; ignore rejection).
      v.play?.().catch(() => {});
    }
    return () => {
      cancelAnimationFrame(raf);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);

  function dismiss() {
    setPhase((p) => (p === "playing" ? "leaving" : p));
    // Unmount after the (slow) fade so it leaves the DOM cleanly.
    timers.current.push(window.setTimeout(() => setPhase("gone"), FADE_OUT_MS + 100));
    document.body.style.overflow = "";
  }

  // Hold the final frame for a beat, then crossfade out.
  function handleEnded() {
    timers.current.push(window.setTimeout(dismiss, HOLD_MS));
  }

  if (phase === "gone") return null;

  return (
    <div
      role="presentation"
      onClick={dismiss}
      className={
        "fixed inset-0 z-[100] flex items-center justify-center bg-background " +
        "transition-opacity duration-[1300ms] ease-in-out " +
        (phase === "leaving" ? "pointer-events-none opacity-0" : "opacity-100")
      }
    >
      <video
        ref={videoRef}
        className={
          "max-h-[80vh] max-w-[90vw] object-contain " +
          "transition-opacity duration-300 ease-out " +
          (videoIn ? "opacity-100" : "opacity-0")
        }
        src="/brand/splash.mp4"
        // Static first frame, NOT the animated splash.gif: an animated GIF poster
        // plays the whole intro before the <video> autoplays it again, producing a
        // duplicate "flash" of the brand. The still poster avoids a black frame
        // without that double-play.
        poster="/brand/splash-poster.gif"
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedData={() => {
          // Some browsers reset playbackRate on load; re-assert it.
          if (videoRef.current) videoRef.current.playbackRate = PLAYBACK_RATE;
        }}
        onEnded={handleEnded}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="absolute bottom-8 right-8 rounded-full border border-border bg-card/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted"
      >
        Skip ›
      </button>
    </div>
  );
}
