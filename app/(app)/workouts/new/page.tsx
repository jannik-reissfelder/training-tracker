import { createWorkout, createWorkoutFromTemplate } from "@/app/actions";
import { prisma } from "@/lib/db";

export default async function NewWorkoutPage() {
  const today = new Date().toISOString().split("T")[0];
  const lastWorkout = await prisma.workout.findFirst({
    orderBy: { date: "desc" },
    include: { _count: { select: { SetEntries: true } } },
  });

  return (
    <div className="stack" style={{ maxWidth: "32rem" }}>
      <h1>Log workout</h1>

      <form action={createWorkout} className="card stack">
        <label htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={today} required />

        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} placeholder="Optional session notes" />

        <div className="row">
          <button type="submit" className="btn primary">Start workout</button>
        </div>
      </form>

      {lastWorkout && (
        <form action={createWorkoutFromTemplate} className="card stack">
          <p className="muted">
            Last logged: <strong>{lastWorkout.date.toLocaleDateString()}</strong> — {lastWorkout._count.SetEntries} sets
          </p>
          <div className="row">
            <button type="submit" className="btn primary">Copy last workout</button>
          </div>
        </form>
      )}
    </div>
  );
}
