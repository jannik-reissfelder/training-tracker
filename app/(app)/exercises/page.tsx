import { prisma } from "@/lib/db";
import ExerciseForm from "@/components/exercise-form";
import DeleteExerciseButton from "@/components/delete-exercise";

export default async function ExercisesPage() {
  const exercises = await prisma.exercise.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="stack">
      <h1>Exercise library</h1>

      <ExerciseForm />

      <div className="stack">
        {exercises.map((ex) => (
          <div key={ex.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{ex.name}</strong>
              <p className="muted">
                {ex.movementPattern ? `${ex.movementPattern} · ` : ""}
                {ex.muscleGroups.join(", ")}
              </p>
            </div>
            {!ex.isSystem && <DeleteExerciseButton id={ex.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
