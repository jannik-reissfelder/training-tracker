import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function WorkoutsPage() {
  const workouts = await prisma.workout.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: { select: { SetEntries: true } },
    },
  });

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Workouts</h1>
        <Link href="/workouts/new" className="btn primary">Log workout</Link>
      </div>

      {workouts.length === 0 ? (
        <p className="muted">No workouts logged yet.</p>
      ) : (
        <div className="stack">
          {workouts.map((w) => (
            <div key={w.id} className="card row" style={{ justifyContent: "space-between" }}>
              <div>
                <Link href={`/workouts/${w.id}`}>
                  <strong>{new Date(w.date).toLocaleDateString()}</strong>
                </Link>
                <p className="muted">{w._count.SetEntries} sets {w.notes ? `· ${w.notes}` : ""}</p>
              </div>
              <Link href={`/workouts/${w.id}`} className="btn">Edit</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
