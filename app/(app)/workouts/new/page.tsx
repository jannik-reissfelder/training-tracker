import { createWorkout, createWorkoutFromTemplate } from "@/app/actions";
import { prisma } from "@/lib/db";

export default async function NewWorkoutPage() {
  const today = new Date().toISOString().split("T")[0];
  const recentWorkouts = await prisma.workout.findMany({
    orderBy: { date: "desc" },
    take: 5,
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

      {recentWorkouts.length > 0 && (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>Copy an earlier workout</h2>
          <p className="muted">Pick the session whose structure you want to repeat.</p>
          <ul className="stack" style={{ gap: "0.5rem", listStyle: "none", padding: 0, margin: 0 }}>
            {recentWorkouts.map((workout) => (
              <li key={workout.id}>
                <form action={createWorkoutFromTemplate} className="row" style={{ gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <input type="hidden" name="templateId" value={workout.id} />
                  <span style={{ flex: 1 }}>
                    <strong>{workout.date.toLocaleDateString()}</strong>
                    {" — "}
                    {workout._count.SetEntries} sets
                  </span>
                  <button type="submit" className="btn">Use as template</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
