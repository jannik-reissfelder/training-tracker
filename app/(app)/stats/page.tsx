import { prisma } from "@/lib/db";
import StatsCharts, { type StatsWorkout } from "@/components/stats-charts";

export default async function StatsPage() {
  const since = new Date();
  since.setDate(since.getDate() - 12 * 7);

  const workouts = await prisma.workout.findMany({
    where: { date: { gte: since } },
    include: {
      SetEntries: {
        include: { Exercise: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

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

  const exercises = await prisma.exercise.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="stack">
      <h1>Statistics</h1>
      <StatsCharts workouts={mapped} exercises={exercises} />
    </div>
  );
}
