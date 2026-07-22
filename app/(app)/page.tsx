import Link from "next/link";
import { prisma } from "@/lib/db";
import { analyze } from "@/lib/coach/rules";
import type { CoachConfig } from "@/lib/coach/rules";
import { judgeProgress } from "@/lib/judge";
import CoachNote from "@/components/coach-note";
import SignalAlerts from "@/components/signal-alerts";
import ProgressVerdict from "@/components/progress-verdict";

const DEFAULT_CONFIG: CoachConfig = {
  splitType: "full body",
  frequencyMin: 2,
  frequencyMax: 3,
  primaryGoal: "hypertrophy + functional fitness",
  targetSetsPerExercise: 2,
  stagnationWindowWeeks: 4,
  volumeBaselineWeeks: 4,
  volumeDropThreshold: 2,
  consistencyWindowWeeks: 2,
};

export default async function DashboardPage() {
  const recentWorkouts = await prisma.workout.findMany({
    orderBy: { date: "desc" },
    take: 5,
    include: {
      _count: { select: { SetEntries: true } },
    },
  });

  const exerciseCount = await prisma.exercise.count();

  const config = await prisma.config.findUnique({ where: { id: "default" } });
  const configValues = config ?? DEFAULT_CONFIG;

  const since = new Date();
  since.setDate(since.getDate() - 12 * 7);

  const dbEntries = await prisma.setEntry.findMany({
    where: {
      Workout: { date: { gte: since } },
    },
    include: { Workout: true, Exercise: true },
    orderBy: { Workout: { date: "asc" } },
  });

  const entries = dbEntries.map((e) => ({
    date: e.Workout.date,
    workoutId: e.workoutId,
    exerciseId: e.exerciseId,
    exerciseName: e.Exercise.name,
    muscleGroups: e.Exercise.muscleGroups,
    reps: e.reps,
    weight: e.weight,
    unit: e.unit,
    rir: e.rir ?? undefined,
    rpe: e.rpe ?? undefined,
    createdAt: e.createdAt,
  }));

  const signals = analyze(entries, configValues, new Date());
  const verdict = judgeProgress(entries, configValues, new Date());

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Dashboard</h1>
        <Link href="/workouts/new" className="btn primary">Log workout</Link>
      </div>

      <section className="card">
        <h2>Quick stats</h2>
        <p className="muted">Exercises in library: {exerciseCount}</p>
        <p className="muted">Recent workouts: {recentWorkouts.length}</p>
      </section>

      <ProgressVerdict verdict={verdict} />

      <SignalAlerts signals={signals} />

      <section className="card">
        <h2>Recent workouts</h2>
        {recentWorkouts.length === 0 ? (
          <p className="muted">No workouts yet. Start with the button above.</p>
        ) : (
          <ul className="stack" style={{ gap: "0.5rem" }}>
            {recentWorkouts.map((w) => (
              <li key={w.id} className="row">
                <Link href={`/workouts/${w.id}`}>
                  {new Date(w.date).toLocaleDateString()} — {w._count.SetEntries} sets
                </Link>
                <span className="muted">{w.notes ? w.notes : "No notes"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CoachNote />
    </div>
  );
}
