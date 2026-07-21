"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, FileText, MonitorPlay, Trash2, Upload, Video } from "lucide-react";

type ItemType = "recording" | "video" | "document";
type CourseItem = { id: string; position: number; type: ItemType; title: string };
type CourseDetail = {
  id: string;
  title: string;
  description: string;
  published: boolean;
  items: CourseItem[];
};
type PastPresentation = { id: string; title: string; recordingid: string | null };

const ICONS: Record<ItemType, typeof Video> = { recording: MonitorPlay, video: Video, document: FileText };

/** Spec 092 — author surface: edit, publish, add/reorder/remove items, delete (FR-002/003/005/006/008). */
export function CourseEditor({
  courseId,
  spaceId,
  onDone,
}: {
  courseId: string;
  spaceId: string;
  onDone: () => void;
}) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [addMode, setAddMode] = useState<ItemType>("recording");

  const load = useCallback(async () => {
    const r = await fetch(`/api/training/courses/${courseId}`, { credentials: "include" });
    if (r.ok) {
      const d = (await r.json()) as CourseDetail;
      setCourse(d);
      setTitle(d.title);
      setDescription(d.description);
    }
  }, [courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load, state set after await
    void load();
  }, [load]);

  async function patchCourse(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/training/courses/${courseId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    setBusy(false);
    await load();
  }

  async function reorder(index: number, dir: -1 | 1) {
    if (!course) return;
    const ids = course.items.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await patchCourse({ itemorder: ids });
  }

  async function removeItem(id: string) {
    setBusy(true);
    await fetch(`/api/training/items/${id}`, { method: "DELETE", credentials: "include" });
    setBusy(false);
    await load();
  }

  async function deleteCourse() {
    if (!confirm("Delete this course and all its items? This can't be undone.")) return;
    await fetch(`/api/training/courses/${courseId}`, { method: "DELETE", credentials: "include" });
    onDone();
  }

  if (!course) {
    return <main className="flex-1 px-6 py-8"><p className="mx-auto max-w-3xl text-sm text-muted-foreground">Loading…</p></main>;
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Edit course</h1>
          <button
            onClick={onDone}
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Check className="h-3.5 w-3.5" /> Done
          </button>
        </div>

        {/* Details */}
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <label className="block text-xs font-semibold text-muted-foreground">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== course.title && void patchCourse({ title })}
            className="min-h-[40px] w-full rounded-lg border border-border bg-background px-3 text-sm"
          />
          <label className="block text-xs font-semibold text-muted-foreground">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== course.description && void patchCourse({ description })}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={course.published}
                onChange={(e) => void patchCourse({ published: e.target.checked })}
                className="h-4 w-4"
              />
              Published (visible to all space members)
            </label>
            <button onClick={() => void deleteCourse()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:opacity-80">
              <Trash2 className="h-3.5 w-3.5" /> Delete course
            </button>
          </div>
        </section>

        {/* Items */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Items</h2>
          {course.items.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No items yet — add one below.</p>
          ) : (
            <ol className="space-y-1.5">
              {course.items.map((item, idx) => {
                const Icon = ICONS[item.type];
                return (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{idx + 1}.</span>
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                    <button aria-label="Move item up" title="Move up" onClick={() => void reorder(idx, -1)} disabled={idx === 0 || busy} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button aria-label="Move item down" title="Move down" onClick={() => void reorder(idx, 1)} disabled={idx === course.items.length - 1 || busy} className="rounded p-1 hover:bg-muted disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button aria-label="Remove item" title="Remove item" onClick={() => void removeItem(item.id)} disabled={busy} className="rounded p-1 text-destructive hover:bg-muted disabled:opacity-30">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Add item */}
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Add an item</h2>
          <div className="flex gap-1.5">
            {(["recording", "video", "document"] as ItemType[]).map((t) => {
              const Icon = ICONS[t];
              return (
                <button
                  key={t}
                  onClick={() => setAddMode(t)}
                  className={`inline-flex min-h-[32px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold capitalize ${
                    addMode === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {t === "recording" ? "Recording" : t}
                </button>
              );
            })}
          </div>

          {addMode === "recording" ? (
            <RecordingPicker courseId={courseId} onAdded={load} />
          ) : (
            <UploadItem courseId={courseId} kind={addMode} onAdded={load} />
          )}
        </section>

        <p className="text-center text-[11px] text-muted-foreground">Space: {spaceId.slice(0, 8)}…</p>
      </div>
    </main>
  );
}

/** Pick a past presentation's recording to add (no re-upload) — FR-005. */
function RecordingPicker({ courseId, onAdded }: { courseId: string; onAdded: () => Promise<void> }) {
  const [options, setOptions] = useState<PastPresentation[]>([]);
  const [recId, setRecId] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/presentations", { credentials: "include" });
      if (r.ok) {
        const d = (await r.json()) as { past: PastPresentation[] };
        setOptions((d.past ?? []).filter((p) => p.recordingid));
      }
    })();
  }, []);

  async function add() {
    if (!recId) return;
    setBusy(true);
    await fetch(`/api/training/courses/${courseId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        type: "recording",
        presentationrecordingid: recId,
        title: title.trim() || options.find((o) => o.recordingid === recId)?.title || "Recording",
      }),
    });
    setBusy(false);
    setRecId("");
    setTitle("");
    await onAdded();
  }

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">No recorded presentations you can access yet.</p>;
  }
  return (
    <div className="space-y-2">
      <select
        aria-label="Choose a recorded presentation"
        value={recId}
        onChange={(e) => {
          setRecId(e.target.value);
          setTitle(options.find((o) => o.recordingid === e.target.value)?.title ?? "");
        }}
        className="min-h-[40px] w-full rounded-lg border border-border bg-background px-3 text-sm"
      >
        <option value="">Choose a recording…</option>
        {options.map((o) => (
          <option key={o.recordingid} value={o.recordingid!}>
            {o.title}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Item title (shown in the course)"
        className="min-h-[40px] w-full rounded-lg border border-border bg-background px-3 text-sm"
      />
      <button
        onClick={() => void add()}
        disabled={!recId || busy}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Add recording
      </button>
    </div>
  );
}

/** Upload a standalone video or document and add it as an item — FR-006/007. */
function UploadItem({ courseId, kind, onAdded }: { courseId: string; kind: "video" | "document"; onAdded: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!file.type) {
      setError("unknown_file_type");
      return;
    }
    setBusy(true);
    setError(null);

    // 1) ask the server for a presigned PUT URL (author-gated).
    const urlRes = await fetch(`/api/training/courses/${courseId}/upload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ kind, filename: file.name, contentType: file.type }),
    });
    if (!urlRes.ok) {
      const d = (await urlRes.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "upload_failed");
      setBusy(false);
      return;
    }
    const { key, url, contentType } = (await urlRes.json()) as { key: string; url: string; contentType: string };

    // 2) PUT the bytes DIRECTLY to S3 — they never transit the app server.
    const put = await fetch(url, { method: "PUT", body: file, headers: { "content-type": contentType } });
    if (!put.ok) {
      setError("s3_upload_failed");
      setBusy(false);
      return;
    }

    // 3) add the item referencing the uploaded key.
    await fetch(`/api/training/courses/${courseId}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        type: kind,
        title: title.trim() || file.name,
        ...(kind === "video" ? { mediakey: key } : { documentkey: key }),
      }),
    });
    setBusy(false);
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
    await onAdded();
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        aria-label={kind === "video" ? "Choose a video file to upload" : "Choose a document to upload"}
        accept={kind === "video" ? "video/*" : ".pdf,.doc,.docx,.ppt,.pptx"}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:font-semibold"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Item title (defaults to the file name)"
        className="min-h-[40px] w-full rounded-lg border border-border bg-background px-3 text-sm"
      />
      {error && <p className="text-xs text-red-500">Upload failed: {error}</p>}
      <button
        onClick={() => void upload()}
        disabled={busy}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        <Upload className="h-4 w-4" /> {busy ? "Uploading…" : `Upload ${kind}`}
      </button>
    </div>
  );
}
