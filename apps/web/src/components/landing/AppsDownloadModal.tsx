"use client";

import { useRef } from "react";
import { Apple, Monitor, Smartphone, X } from "lucide-react";
import type { Downloads } from "@/lib/landing/config-schema";

/**
 * Spec 012 T006 — "Get the apps" trigger + modal (FR-017).
 * Lists iOS / Android / Desktop from config. A platform with available:false
 * shows its comingsoonnote instead of a (broken) link. Uses native <dialog>.
 */
const PLATFORMS = [
  { key: "ios", label: "iOS", Icon: Apple },
  { key: "android", label: "Android", Icon: Smartphone },
  { key: "desktop", label: "Desktop", Icon: Monitor },
] as const;

export function AppsDownloadModal({ downloads }: { downloads: Downloads }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Get the apps
      </button>

      <dialog
        ref={ref}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-card-foreground backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Get the apps</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => ref.current?.close()}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <ul className="divide-y divide-border">
          {PLATFORMS.map(({ key, label, Icon }) => {
            const platform = downloads[key];
            return (
              <li key={key} className="flex items-center gap-4 px-6 py-4">
                <Icon aria-hidden className="h-6 w-6 shrink-0 text-muted-foreground" />
                <span className="flex-1 font-medium text-foreground">{label}</span>
                {platform.available && platform.url ? (
                  <a
                    href={platform.url}
                    className="inline-flex min-h-[40px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Download
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {platform.comingsoonnote || "Coming soon"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </dialog>
    </>
  );
}
