import { createWorkoutFromTemplate } from "@/app/actions";
import { prisma } from "@/lib/db";

type WorkoutTemplateName = "A" | "B";

function getWorkoutTemplateName(notes: string | null): WorkoutTemplateName | null {
  const match = notes?.trim().toUpperCase().match(/^(?:WORKOUT\s+)?([AB])(?:\b|\s|\()/);
  return match?.[1] === "A" || match?.[1] === "B" ? match[1] : null;
}

export default async function NewWorkoutPage() {
  const recentWorkouts = await prisma.workout.findMany({
    orderBy: { date: "desc" },
    take: 50,
    include: { _count: { select: { SetEntries: true } } },
  });

  const latestTemplates = new Map<WorkoutTemplateName, (typeof recentWorkouts)[number]>();
  for (const workout of recentWorkouts) {
    const templateName = getWorkoutTemplateName(workout.notes);
    if (templateName && !latestTemplates.has(templateName)) {
      latestTemplates.set(templateName, workout);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: "32rem" }}>
      <h1>Log workout</h1>
      <p className="muted">Start Workout A or B with the exercises and values from the latest matching session.</p>

      {(["A", "B"] as const).map((templateName) => {
        const template = latestTemplates.get(templateName);
        return (
          <section key={templateName} className="card stack">
            <h2 style={{ margin: 0 }}>Workout {templateName}</h2>
            <p className="muted">
              {template
                ? `Last tracked ${template.date.toLocaleDateString()} · ${template._count.SetEntries} sets`
                : "No previous session yet. Start with an empty workout."}
            </p>
            <form action={createWorkoutFromTemplate}>
              <input type="hidden" name="templateName" value={templateName} />
              {template && <input type="hidden" name="templateId" value={template.id} />}
              <button type="submit" className="btn primary">
                Start Workout {templateName}
              </button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
