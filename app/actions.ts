"use server";

import { createSession, destroySession, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCoachNote as coachNote } from "@/lib/coach";
import { explainSignal as explainSignalWithGemini } from "@/lib/coach/explain";
import { analyze, type CoachConfig, type Signal } from "@/lib/coach/rules";
import { buildSystemPrompt, getConfig, readPhilosophy, callGemini } from "@/lib/coach";
import { judgeProgress, type JudgeEntry, type ProgressVerdict } from "@/lib/judge";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function login(_prevState: { error: string }, formData: FormData) {
  const passphrase = formData.get("passphrase");
  if (typeof passphrase !== "string" || passphrase !== process.env.APP_PASSPHRASE) {
    return { error: "Invalid passphrase" };
  }

  await createSession();
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function checkSession() {
  return verifySession();
}

export async function getCoachNote() {
  const config = await prisma.config.findUnique({ where: { id: "default" } });
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
  }));

  return coachNote({
    entries,
    config: config ?? {
      splitType: "full body",
      frequencyMin: 2,
      frequencyMax: 3,
      primaryGoal: "hypertrophy + functional fitness",
      targetSetsPerExercise: 2,
      stagnationWindowWeeks: 4,
      volumeBaselineWeeks: 4,
      volumeDropThreshold: 2,
      consistencyWindowWeeks: 2,
    },
  });
}

export async function explainSignal(signal: Signal) {
  if (!(await verifySession())) {
    throw new Error("Unauthorized");
  }

  const config = await prisma.config.findUnique({ where: { id: "default" } });
  const configValues: CoachConfig = config ?? {
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

  try {
    return await explainSignalWithGemini(signal, configValues);
  } catch (error) {
    console.error("explainSignal failed:", error);
    return "Could not analyze this signal right now. Please try again.";
  }
}

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

async function loadJudgeEntries(): Promise<JudgeEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - 12 * 7);

  const dbEntries = await prisma.setEntry.findMany({
    where: {
      Workout: { date: { gte: since } },
    },
    include: { Workout: true, Exercise: true },
    orderBy: { createdAt: "asc" },
  });

  return dbEntries.map((e) => ({
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
}

async function loadConfig(): Promise<CoachConfig> {
  const config = await prisma.config.findUnique({ where: { id: "default" } });
  return config ?? DEFAULT_CONFIG;
}

async function computeVerdict(): Promise<{ verdict: ProgressVerdict; config: CoachConfig }> {
  const [entries, config] = await Promise.all([loadJudgeEntries(), loadConfig()]);
  const verdict = judgeProgress(entries, config, new Date());
  return { verdict, config };
}

export async function analyzeStats() {
  if (!(await verifySession())) {
    throw new Error("Unauthorized");
  }

  const { verdict, config } = await computeVerdict();

  const systemPrompt = `You are a ruthless, no-fluff performance analyst. Your only job is to look at the user's training metrics and state the brutal truth about whether they are progressing, stalling, or declining.

Rules:
- Use the exact numbers from the metrics below. Do not invent data.
- Do not mention training philosophy, doctrine, minimum effective dose, or motivational filler.
- If the verdict is "insufficient data", say so plainly and say what data is missing.
- Keep your answer to 2-4 sentences. Be direct.`;

  const userPrompt = `Current config: ${getConfig(config)}\n\nProgress verdict (stats-only):\n${JSON.stringify(verdict, null, 2)}\n\nGive a short, data-only analysis.`;

  try {
    return await callGemini({ systemPrompt, userPrompt });
  } catch (error) {
    console.error("analyzeStats failed:", error);
    return `${verdict.headline} Based on ${verdict.observations.length} tracked metrics, the current assessment is: ${verdict.status}.`;
  }
}

export async function coachStats() {
  if (!(await verifySession())) {
    throw new Error("Unauthorized");
  }

  const { verdict, config } = await computeVerdict();
  const entries = await loadJudgeEntries();
  const signals = analyze(entries, config, new Date());
  const philosophy = await readPhilosophy();

  const systemPrompt = buildSystemPrompt(config, philosophy);

  const userPrompt = `Current config: ${getConfig(config)}\n\nProgress verdict (stats-based):\n${JSON.stringify(
    verdict,
    null,
    2
  )}\n\nStage A signals:\n${JSON.stringify(signals, null, 2)}\n\nWrite a short Coach's Note that interprets these numbers in light of the training philosophy. Be direct and honest. Suggest one concrete tweak only if the data clearly supports it. 2-4 sentences.`;

  try {
    return await callGemini({ systemPrompt, userPrompt });
  } catch (error) {
    console.error("coachStats failed:", error);
    if (signals.length > 0) {
      return signals.map((s) => s.message).join(" ");
    }
    return "Keep training consistently and check back after your next session.";
  }
}

export async function createWorkout(formData: FormData) {
  const date = formData.get("date") as string;
  const notes = formData.get("notes") as string;

  const workout = await prisma.workout.create({
    data: {
      date: new Date(date),
      notes: notes || null,
    },
  });

  redirect(`/workouts/${workout.id}`);
}

export async function updateWorkout(formData: FormData) {
  const id = formData.get("id") as string;
  const date = formData.get("date") as string;
  const notes = formData.get("notes") as string;

  await prisma.workout.update({
    where: { id },
    data: {
      date: new Date(date),
      notes: notes || null,
    },
  });

  redirect(`/workouts/${id}`);
}

export async function deleteWorkout(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.workout.delete({ where: { id } });
  redirect("/workouts");
}

export async function createSet(formData: FormData) {
  const workoutId = formData.get("workoutId") as string;
  const exerciseId = formData.get("exerciseId") as string;
  const reps = Number(formData.get("reps"));
  const weight = Number(formData.get("weight"));
  const unit = formData.get("unit") as string;
  const rir = formData.get("rir") ? Number(formData.get("rir")) : null;
  const rpe = formData.get("rpe") ? Number(formData.get("rpe")) : null;
  const notes = (formData.get("notes") as string) || null;

  await prisma.setEntry.create({
    data: {
      workoutId,
      exerciseId,
      reps,
      weight,
      unit,
      rir,
      rpe,
      notes,
    },
  });

  revalidatePath(`/workouts/${workoutId}`);
}

export async function updateSet(formData: FormData) {
  const id = formData.get("id") as string;
  const workoutId = formData.get("workoutId") as string;
  const reps = Number(formData.get("reps"));
  const weight = Number(formData.get("weight"));
  const unit = formData.get("unit") as string;
  const rir = formData.get("rir") ? Number(formData.get("rir")) : null;
  const rpe = formData.get("rpe") ? Number(formData.get("rpe")) : null;
  const notes = (formData.get("notes") as string) || null;

  await prisma.setEntry.update({
    where: { id },
    data: { reps, weight, unit, rir, rpe, notes },
  });

  revalidatePath(`/workouts/${workoutId}`);
}

export async function deleteSet(formData: FormData) {
  const id = formData.get("id") as string;
  const workoutId = formData.get("workoutId") as string;
  await prisma.setEntry.delete({ where: { id } });
  revalidatePath(`/workouts/${workoutId}`);
}

export async function createExercise(_prevState: { error: string }, formData: FormData) {
  const name = (formData.get("name") as string).trim();
  const muscleGroups = (formData.get("muscleGroups") as string)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const movementPattern = (formData.get("movementPattern") as string) || null;

  const existing = await prisma.exercise.findUnique({ where: { name } });
  if (existing) {
    return { error: "An exercise with that name already exists." };
  }

  await prisma.exercise.create({
    data: { name, muscleGroups, movementPattern, isSystem: false },
  });

  redirect("/exercises");
}

export async function deleteExercise(_prevState: { error: string }, formData: FormData) {
  const id = formData.get("id") as string;
  try {
    await prisma.exercise.delete({ where: { id } });
    redirect("/exercises");
  } catch {
    return { error: "Could not delete exercise. It may be used in existing sets." };
  }
}

export async function updateConfig(formData: FormData) {
  const splitType = formData.get("splitType") as string;
  const frequencyMin = Number(formData.get("frequencyMin"));
  const frequencyMax = Number(formData.get("frequencyMax"));
  const primaryGoal = formData.get("primaryGoal") as string;
  const targetSetsPerExercise = Number(formData.get("targetSetsPerExercise"));
  const stagnationWindowWeeks = Number(formData.get("stagnationWindowWeeks"));
  const volumeBaselineWeeks = Number(formData.get("volumeBaselineWeeks"));
  const volumeDropThreshold = Number(formData.get("volumeDropThreshold"));
  const consistencyWindowWeeks = Number(formData.get("consistencyWindowWeeks"));

  const config: CoachConfig = {
    splitType,
    frequencyMin,
    frequencyMax,
    primaryGoal,
    targetSetsPerExercise,
    stagnationWindowWeeks,
    volumeBaselineWeeks,
    volumeDropThreshold,
    consistencyWindowWeeks,
  };

  await prisma.config.upsert({
    where: { id: "default" },
    update: config,
    create: { id: "default", ...config },
  });

  revalidatePath("/settings");
}
