"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = [
  { value: "", label: "Not set" },
  { value: "available", label: "🟢 Available to help" },
  { value: "busy", label: "🔴 Busy" },
  { value: "away", label: "🌙 Away" },
];

/** Spec 068 — set the caller's own availability within one community (dashboard row). */
export function AvailabilityControl({
  communityid,
  initialStatus,
  initialNote,
}: {
  communityid: string;
  initialStatus: string | null;
  initialNote: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus ?? "");
  const [note, setNote] = useState(initialNote ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(next: { availabilitystatus?: string | null; availabilitynote?: string | null }) {
    setSaving(true);
    const r = await fetch(`/api/communities/${communityid}/members/me`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(next),
    });
    setSaving(false);
    if (r.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        disabled={saving}
        onChange={(e) => {
          const v = e.target.value;
          setStatus(v);
          void save({ availabilitystatus: v || null });
        }}
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
        title="Your availability in this community"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {editingNote ? (
        <input
          autoFocus
          value={note}
          disabled={saving}
          placeholder="Office hours / note…"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            setEditingNote(false);
            void save({ availabilitynote: note.trim() || null });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-40 rounded-lg border border-border bg-background px-2 py-1 text-xs"
        />
      ) : (
        <button
          onClick={() => setEditingNote(true)}
          className="truncate text-xs text-muted-foreground hover:underline"
          title="Edit availability note"
        >
          {note ? note : "+ note"}
        </button>
      )}
    </div>
  );
}
