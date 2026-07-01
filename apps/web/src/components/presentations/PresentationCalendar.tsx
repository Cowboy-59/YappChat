"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Spec 071 / shell — month-grid calendar of all presentations the viewer can
 * see, each placed on its scheduled start date. Replaces the old card list.
 * Pure client-side month navigation; events deep-link to the presentation room.
 */

export type CalendarItem = {
  id: string;
  title: string;
  status: string; // scheduled | live | ended
  visibility: string;
  scheduledstart: string; // ISO
  mine?: boolean; // viewer is the host → can delete it
};

const statusDot: Record<string, string> = {
  live: "bg-red-500",
  scheduled: "bg-primary",
  ended: "bg-muted-foreground/50",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PresentationCalendar({ items }: { items: CalendarItem[] }) {
  const router = useRouter();
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [busyId, setBusyId] = useState<string | null>(null);

  async function deleteItem(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cancels the presentation and removes it from the calendar.`)) return;
    setBusyId(id);
    const r = await fetch(`/api/presentations/${id}`, { method: "DELETE", credentials: "include" });
    setBusyId(null);
    if (r.ok) router.refresh();
    else window.alert("Could not delete — only the host can remove a presentation.");
  }

  // Bucket events by local calendar day.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const key = ymd(new Date(it.scheduledstart));
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => +new Date(a.scheduledstart) - +new Date(b.scheduledstart));
    return map;
  }, [items]);

  // 6 weeks of days starting from the Sunday on/before the 1st.
  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const todayKey = ymd(today);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
          >
            Today
          </button>
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            aria-label="Previous month"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            aria-label="Next month"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-semibold uppercase text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const key = ymd(d);
          const events = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div
              key={i}
              className={`min-h-[92px] border-b border-r border-border p-1.5 ${i % 7 === 0 ? "border-l" : ""} ${
                inMonth ? "" : "bg-muted/30"
              }`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${
                    isToday ? "bg-primary font-bold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {events.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className="group flex items-center rounded bg-muted text-[11px] hover:bg-muted/70"
                  >
                    <Link
                      href={`/presentations/${ev.id}`}
                      title={`${ev.title} · ${new Date(ev.scheduledstart).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
                      className="flex min-w-0 flex-1 items-center gap-1 px-1.5 py-0.5"
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[ev.status] ?? "bg-primary"}`} />
                      <span className="truncate">{ev.title}</span>
                    </Link>
                    {ev.mine && (
                      <button
                        type="button"
                        onClick={() => void deleteItem(ev.id, ev.title)}
                        disabled={busyId === ev.id}
                        aria-label={`Delete ${ev.title}`}
                        title="Delete presentation"
                        className="mr-0.5 hidden shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:block disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {events.length > 3 && (
                  <div className="px-1 text-[10px] text-muted-foreground">+{events.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
