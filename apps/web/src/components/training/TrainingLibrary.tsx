"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GraduationCap, Plus } from "lucide-react";

type CourseSummary = {
  id: string;
  title: string;
  description: string;
  published: boolean;
  itemcount: number;
  completedcount: number;
  mine: boolean;
};

/** Spec 092 — a space's course library with per-learner progress + create (FR-001/002). */
export function TrainingLibrary({ spaceId }: { spaceId: string }) {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/training/courses?spaceId=${spaceId}`, { credentials: "include" });
    if (r.ok) {
      const d = (await r.json()) as { courses: CourseSummary[] };
      setCourses(d.courses ?? []);
      setError(null);
    } else if (r.status === 403) {
      setError("You don't have access to this space's training.");
    } else {
      setError("Couldn't load training.");
    }
    setLoading(false);
  }, [spaceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load, state set after await
    void load();
  }, [load]);

  async function createCourse() {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    const r = await fetch("/api/training/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ spaceId, title }),
    });
    setCreating(false);
    if (r.ok) {
      const d = (await r.json()) as { course: { id: string } };
      router.push(`/training?space=${spaceId}&course=${d.course.id}`);
    }
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/training" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> All spaces
          </Link>
        </div>
        <header className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Training</h1>
            <p className="text-sm text-muted-foreground">Courses to work through at your own pace.</p>
          </div>
        </header>

        {/* Create a course (any member who can author). */}
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void createCourse()}
            placeholder="New course title…"
            className="min-h-[40px] flex-1 rounded-lg border border-border bg-background px-3 text-sm"
          />
          <button
            onClick={() => void createCourse()}
            disabled={creating || !newTitle.trim()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Create
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">{error}</p>
        ) : courses.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No courses yet. Create the first one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {courses.map((c) => {
              const pct = c.itemcount ? Math.round((c.completedcount / c.itemcount) * 100) : 0;
              return (
                <li key={c.id}>
                  <Link
                    href={`/training?space=${spaceId}&course=${c.id}`}
                    className="block rounded-xl border border-border bg-card p-4 hover:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold">{c.title}</span>
                          {!c.published && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                              Draft
                            </span>
                          )}
                        </div>
                        {c.description && <p className="mt-0.5 truncate text-sm text-muted-foreground">{c.description}</p>}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {c.completedcount}/{c.itemcount}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
