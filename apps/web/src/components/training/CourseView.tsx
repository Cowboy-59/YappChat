"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, Circle, FileText, MonitorPlay, Pencil, Video } from "lucide-react";
import { ReplayPlayer } from "@/components/presentations/ReplayPlayer";
import { DocumentViewer } from "./DocumentViewer";
import { CourseEditor } from "./CourseEditor";

type ItemType = "recording" | "video" | "document";
type CourseItem = { id: string; position: number; type: ItemType; title: string; hasMedia: boolean; completed: boolean };
type CourseDetail = {
  id: string;
  spaceid: string;
  title: string;
  description: string;
  published: boolean;
  mine: boolean;
  items: CourseItem[];
  completedcount: number;
};

const ICONS: Record<ItemType, typeof Video> = { recording: MonitorPlay, video: Video, document: FileText };

/** Spec 092 — the learner's course view: ordered items, playback/viewing, and mark-complete (FR-004/007/009). */
export function CourseView({ courseId, spaceId }: { courseId: string; spaceId: string | null }) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/training/courses/${courseId}`, { credentials: "include" });
    if (r.ok) {
      const d = (await r.json()) as CourseDetail;
      setCourse(d);
      setSelected((prev) => prev ?? d.items[0]?.id ?? null);
      setError(null);
    } else if (r.status === 403) {
      setError("You don't have access to this course.");
    } else if (r.status === 404) {
      setError("Course not found.");
    } else {
      setError("Couldn't load this course.");
    }
  }, [courseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load, state set after await
    void load();
  }, [load]);

  async function toggleComplete(item: CourseItem) {
    const method = item.completed ? "DELETE" : "POST";
    const r = await fetch(`/api/training/items/${item.id}/complete`, { method, credentials: "include" });
    if (r.ok && course) {
      setCourse({
        ...course,
        items: course.items.map((i) => (i.id === item.id ? { ...i, completed: !i.completed } : i)),
        completedcount: course.completedcount + (item.completed ? -1 : 1),
      });
    }
  }

  const backHref = spaceId ? `/training?space=${spaceId}` : "/training";

  if (error) {
    return (
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }
  if (!course) {
    return <main className="flex-1 px-6 py-8"><p className="mx-auto max-w-3xl text-sm text-muted-foreground">Loading…</p></main>;
  }

  if (editing) {
    return (
      <CourseEditor
        courseId={courseId}
        spaceId={course.spaceid}
        onDone={() => {
          setEditing(false);
          void load();
        }}
      />
    );
  }

  const current = course.items.find((i) => i.id === selected) ?? course.items[0] ?? null;
  const total = course.items.length;

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between">
          <Link href={backHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Library
          </Link>
          {course.mine && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit course
            </button>
          )}
        </div>

        <header>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {!course.published && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Draft</span>
            )}
          </div>
          {course.description && <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {course.completedcount}/{total} complete
          </p>
        </header>

        {total === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            This course has no items yet.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            {/* Ordered item list */}
            <ol className="space-y-1">
              {course.items.map((item, idx) => {
                const Icon = ICONS[item.type];
                const active = current?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setSelected(item.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 opacity-40" />
                      )}
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{idx + 1}.</span>
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Selected item */}
            {current && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="truncate text-lg font-semibold">{current.title}</h2>
                  <button
                    onClick={() => void toggleComplete(current)}
                    className={`inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
                      current.completed
                        ? "border border-border text-muted-foreground hover:bg-muted"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {current.completed ? "Completed" : "Mark complete"}
                  </button>
                </div>

                {!current.hasMedia ? (
                  <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
                    This item&apos;s media is unavailable.
                  </p>
                ) : current.type === "document" ? (
                  <DocumentViewer itemId={current.id} />
                ) : (
                  <ReplayPlayer
                    recordingEndpoint={`/api/training/items/${current.id}/media`}
                    shareEndpoint={`/api/training/items/${current.id}/share`}
                    captionsBase={null}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
