import { prisma } from "@/lib/db";
import StatsCharts, { type StatsWorkout } from "@/components/stats-charts";
import StatsAnalysis from "@/components/stats-analysis";
import { judgeProgress } from "@/lib/judge";
import type { CoachConfig } from "@/lib/coach/rules";
import type { JudgeEntry } from "@/lib/judge";

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

export default async function StatsPage() {
  const since = new Date();
  since.setDate(since.getDate() - 12 * 7);

  const [workouts, exercises, config] = await Promise.all([
    prisma.workout.findMany({
      where: { date: { gte: since } },
      include: {
        SetEntries: {
          include: { Exercise: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { date: "asc" },
    }),
    prisma.exercise.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.config.findUnique({ where: { id: "default" } }),
  ]);

  const configValues = config ?? DEFAULT_CONFIG;

  const mapped: StatsWorkout[] = workouts.map((w) => ({
    id: w.id,
    date: w.date.toISOString(),
    setEntries: w.SetEntries.map((s) => ({
      id: s.id,
      exerciseId: s.exerciseId,
      exerciseName: s.Exercise.name,
      muscleGroups: s.Exercise.muscleGroups,
      reps: s.reps,
      weight: s.weight,
      unit: s.unit,
    })),
  }));

  const judgeEntries: JudgeEntry[] = [];
  for (const w of workouts) {
    for (const s of w.SetEntries) {
      judgeEntries.push({
        date: w.date,
        workoutId: w.id,
        exerciseId: s.exerciseId,
        exerciseName: s.Exercise.name,
        muscleGroups: s.Exercise.muscleGroups,
        reps: s.reps,
        weight: s.weight,
        unit: s.unit,
        rir: s.rir ?? undefined,
        rpe: s.rpe ?? undefined,
        createdAt: s.createdAt,
      });
    }
  }

  const verdict = judgeProgress(judgeEntries, configValues, new Date());

  return (
    <div className="stack">
      <h1>Statistics</h1>
      <StatsAnalysis verdict={verdict} />
      <StatsCharts workouts={mapped} exercises={exercises} />
    </div>
  );
}
