"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LANGUAGES } from "@/lib/account/languages";

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-semibold text-muted-foreground";

/** Spec 071 T009 — schedule a presentation (FR-001). Cover upload reuses /api/upload (spec 068 S3 pattern). */
export function SchedulePresentationForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledstart, setStart] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [spokenlanguage, setLang] = useState("en");
  const [coverimageurl, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function uploadCover(file: File) {
    setBusy(true);
    setNote(null);
    const body = new FormData();
    body.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", credentials: "include", body });
    setBusy(false);
    if (r.ok) {
      const data = (await r.json()) as { key: string };
      setCover(data.key);
      setNote("Cover uploaded.");
    } else {
      setNote("Cover upload failed.");
    }
  }

  async function submit() {
    setBusy(true);
    setNote(null);
    const r = await fetch("/api/presentations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        spokenlanguage,
        coverimageurl,
        scheduledstart: new Date(scheduledstart).toISOString(),
      }),
    });
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      setTitle("");
      setDescription("");
      setStart("");
      setCover(null);
      router.refresh();
    } else {
      setNote("Could not schedule — check the title and start time.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-[36px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        + Schedule a presentation
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Schedule a presentation</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
      <label className={label}>
        Title
        <input className={`${field} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className={label}>
        Description
        <textarea className={`${field} mt-1`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Start
          <input
            type="datetime-local"
            className={`${field} mt-1`}
            value={scheduledstart}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className={label}>
          Spoken language
          <select className={`${field} mt-1`} value={spokenlanguage} onChange={(e) => setLang(e.target.value)}>
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Visibility
          <select
            className={`${field} mt-1`}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "public" | "private")}
          >
            <option value="private">Private (invite only)</option>
            <option value="public">Public (guests allowed)</option>
          </select>
        </label>
        <div>
          <span className={label}>Cover image</span>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="mt-1 inline-flex min-h-[38px] w-full items-center justify-center rounded-lg border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            {coverimageurl ? "Cover ✓ — replace" : busy ? "Working…" : "Upload cover"}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadCover(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !title.trim() || !scheduledstart}
          className="inline-flex min-h-[36px] items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Schedule"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="inline-flex min-h-[36px] items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
