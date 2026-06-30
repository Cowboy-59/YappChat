import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { listPresentations } from "@/lib/presentations/service";
import { SchedulePresentationForm } from "@/components/presentations/SchedulePresentationForm";
import { PresentationCalendar, type CalendarItem } from "@/components/presentations/PresentationCalendar";

export const dynamic = "force-dynamic";

export default async function PresentationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/presentations");
  const { upcoming, past } = await listPresentations(user.id);

  // All visible presentations on the calendar, on their scheduled start date.
  const items: CalendarItem[] = [...upcoming, ...past].map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    visibility: p.visibility,
    scheduledstart: new Date(p.scheduledstart).toISOString(),
  }));

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Presentations</h1>
            <p className="text-sm text-muted-foreground">Schedule and host live screen-share sessions.</p>
          </div>
        </header>

        <SchedulePresentationForm />

        <PresentationCalendar items={items} />

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Live
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Ended
          </span>
        </div>
      </div>
    </main>
  );
}
