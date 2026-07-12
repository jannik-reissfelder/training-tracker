import Link from "next/link";
import { prisma } from "@/lib/db";
import CoachNote from "@/components/coach-note";

export default async function DashboardPage() {
  const recentWorkouts = await prisma.workout.findMany({
    orderBy: { date: "desc" },
    take: 5,
    include: {
      _count: { select: { SetEntries: true } },
    },
  });

  const exerciseCount = await prisma.exercise.count();

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
