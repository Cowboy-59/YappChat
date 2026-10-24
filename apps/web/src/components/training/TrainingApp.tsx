"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Hash } from "lucide-react";
import { TrainingLibrary } from "./TrainingLibrary";
import { CourseView } from "./CourseView";

type SpaceNode = { id: string; name: string };
type CommunityNode = { id: string; name: string; spaces: SpaceNode[] };

/**
 * Spec 092 — Training orchestrator. Chooses the view from the URL-derived props:
 * course → CourseView; space → TrainingLibrary; neither → a space picker.
 */
export function TrainingApp({
  initialSpaceId,
  initialCourseId,
}: {
  initialSpaceId: string | null;
  initialCourseId: string | null;
}) {
  if (initialCourseId) {
    return <CourseView courseId={initialCourseId} spaceId={initialSpaceId} />;
  }
  if (initialSpaceId) {
    return <TrainingLibrary spaceId={initialSpaceId} />;
  }
  return <SpacePicker />;
}

/** No space chosen yet — list the caller's spaces to enter their Training library. */
function SpacePicker() {
  const [communities, setCommunities] = useState<CommunityNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const r = await fetch("/api/nav", { credentials: "include" });
      if (!active) return;
      if (r.ok) {
        const d = (await r.json()) as { communities: CommunityNode[] };
        setCommunities(d.communities ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const spaces = communities.flatMap((c) => c.spaces.map((s) => ({ ...s, community: c.name })));

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Training</h1>
            <p className="text-sm text-muted-foreground">Pick a space to open its course library.</p>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your spaces…</p>
        ) : spaces.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            You&apos;re not in any spaces yet. Join a community space to see its training.
          </p>
        ) : (
          <ul className="space-y-2">
            {spaces.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/training?space=${s.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted"
                >
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.community}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
