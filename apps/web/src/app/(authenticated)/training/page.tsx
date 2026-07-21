import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { TrainingApp } from "@/components/training/TrainingApp";

export const dynamic = "force-dynamic";

/**
 * Spec 092 (Training) T007 — the Training area. URL-driven, mirroring the shell's
 * `?space=` convention: no space → space picker; `?space=` → the space's library;
 * `?course=` → the course. Params are passed to the client app as props so a
 * navigation re-renders this server component with fresh values.
 */
export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; course?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/signin?return=/training");
  const { space, course } = await searchParams;
  return <TrainingApp initialSpaceId={space ?? null} initialCourseId={course ?? null} />;
}
