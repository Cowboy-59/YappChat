"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

/**
 * Dark/light switch. The initial theme is resolved before paint by the inline
 * script in layout.tsx (stored choice → OS preference), which sets `data-theme`
 * on <html>. This toggle flips that attribute and persists the choice.
 *
 * The active theme is read as external state via useSyncExternalStore — the
 * source of truth is the `data-theme` attribute, not React state — so the icon
 * stays in sync no matter who changes the theme, with no setState-in-effect.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("themechange", onChange);
  window.addEventListener("storage", onChange); // cross-tab sync
  return () => {
    window.removeEventListener("themechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  return (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // null on the server / during hydration (no DOM) → render no icon until mounted.
  const theme = useSyncExternalStore<Theme | null>(subscribe, getSnapshot, () => null);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage unavailable — in-memory only */
    }
    window.dispatchEvent(new Event("themechange"));
  }

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border " +
        "bg-card text-foreground shadow-sm transition-colors hover:bg-muted " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        className
      }
    >
      {theme === null ? null : isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
