"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth/shared";
import { SUPPORTED_LANGUAGES } from "@/lib/account/languages";
import { PRESET_AVATARS } from "@/lib/account/avatars";

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const label = "block text-xs font-semibold text-muted-foreground";

/** Spec 068 — edit the account profile (display name, language, avatar, bio). */
export function ProfilePanel({ user, avatarSrc }: { user: SessionUser; avatarSrc: string | null }) {
  const router = useRouter();
  const [displayname, setDisplayname] = useState(user.displayname);
  const [preferredlanguage, setPreferredlanguage] = useState(user.preferredlanguage ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Avatar is its own self-contained control: every change persists immediately,
  // independent of the "Save profile" button (which handles name/language/bio).
  const [avatar, setAvatar] = useState<string | null>(avatarSrc);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNote, setAvatarNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function save() {
    setSaving(true);
    setNote(null);
    const r = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        displayname: displayname.trim(),
        preferredlanguage: preferredlanguage || null,
        bio: bio.trim() || null,
      }),
    });
    setSaving(false);
    if (r.ok) {
      setNote("Saved.");
      router.refresh();
    } else {
      setNote("Could not save — check the fields.");
    }
  }

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    setAvatarNote(null);
    const body = new FormData();
    body.append("file", file);
    const r = await fetch("/api/account/avatar", { method: "POST", credentials: "include", body });
    setAvatarBusy(false);
    if (r.ok) {
      const data = (await r.json()) as { previewurl: string };
      setAvatar(data.previewurl);
      setAvatarNote("Avatar updated.");
      router.refresh();
    } else if (r.status === 413) {
      setAvatarNote("Image too large (max 5 MB).");
    } else if (r.status === 415) {
      setAvatarNote("Use a PNG, JPG, GIF, or WebP image.");
    } else if (r.status === 503) {
      setAvatarNote("Image storage isn’t configured.");
    } else {
      setAvatarNote("Upload failed.");
    }
  }

  async function setPreset(url: string | null) {
    setAvatarBusy(true);
    setAvatarNote(null);
    const r = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ avatarurl: url }),
    });
    setAvatarBusy(false);
    if (r.ok) {
      setAvatar(url);
      setAvatarNote(url ? "Avatar updated." : "Avatar removed.");
      router.refresh();
    } else {
      setAvatarNote("Could not update avatar.");
    }
  }

  const initial = (displayname.trim()[0] || "?").toUpperCase();

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Profile</h2>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>

      {/* Avatar — upload your own or choose a preset. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={label}>Avatar</span>
          {avatarNote && <span className="text-xs text-muted-foreground">{avatarNote}</span>}
        </div>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned/preset avatar URL
              <img src={avatar} alt="Your avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-muted-foreground">
                {initial}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={avatarBusy}
              className="inline-flex min-h-[34px] items-center rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {avatarBusy ? "Working…" : "Upload image"}
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => setPreset(null)}
                disabled={avatarBusy}
                className="inline-flex min-h-[34px] items-center rounded-lg border border-border px-3 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
                e.target.value = ""; // allow re-selecting the same file
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="sr-only">Or choose a preset avatar</span>
          {PRESET_AVATARS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.url)}
              disabled={avatarBusy}
              title={p.label}
              aria-label={`Use ${p.label} avatar`}
              className="h-9 w-9 overflow-hidden rounded-full border border-border hover:ring-2 hover:ring-primary disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static preset asset */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <label className={label}>
        Display name
        <input className={`${field} mt-1`} value={displayname} onChange={(e) => setDisplayname(e.target.value)} />
      </label>
      <label className={label}>
        Preferred language
        <select
          className={`${field} mt-1`}
          value={preferredlanguage}
          onChange={(e) => setPreferredlanguage(e.target.value)}
        >
          <option value="">Not set</option>
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Bio
        <textarea className={`${field} mt-1`} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      <button
        onClick={save}
        disabled={saving || !displayname.trim()}
        className="inline-flex min-h-[34px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </div>
  );
}
