import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import WorkoutForm from "@/components/workout-form";

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      SetEntries: {
        include: { Exercise: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!workout) {
    notFound();
  }

  const exercises = await prisma.exercise.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="stack">
      <h1>Edit workout</h1>
      <WorkoutForm
        workout={{
          id: workout.id,
          date: workout.date.toISOString().split("T")[0],
          notes: workout.notes,
          setEntries: workout.SetEntries.map((set) => ({
            id: set.id,
            exerciseId: set.exerciseId,
            exerciseName: set.Exercise.name,
            reps: set.reps,
            weight: set.weight,
            unit: set.unit,
            rir: set.rir,
            rpe: set.rpe,
            notes: set.notes,
          })),
        }}
        exercises={exercises.map((ex) => ({ id: ex.id, name: ex.name }))}
      />
    </div>
  );
}
