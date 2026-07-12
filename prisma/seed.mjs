import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const exercises = [
  { name: "Back Squat", muscleGroups: ["quads", "glutes", "lower back"], movementPattern: "squat" },
  { name: "Front Squat", muscleGroups: ["quads", "glutes", "upper back"], movementPattern: "squat" },
  { name: "Bulgarian Split Squat", muscleGroups: ["quads", "glutes"], movementPattern: "squat" },
  { name: "Romanian Deadlift", muscleGroups: ["hamstrings", "glutes", "lower back"], movementPattern: "hinge" },
  { name: "Conventional Deadlift", muscleGroups: ["hamstrings", "glutes", "back"], movementPattern: "hinge" },
  { name: "Hip Thrust", muscleGroups: ["glutes", "hamstrings"], movementPattern: "hinge" },
  { name: "Bench Press", muscleGroups: ["chest", "triceps", "front delts"], movementPattern: "push" },
  { name: "Overhead Press", muscleGroups: ["shoulders", "triceps", "upper chest"], movementPattern: "push" },
  { name: "Dips", muscleGroups: ["chest", "triceps", "front delts"], movementPattern: "push" },
  { name: "Pull-Up", muscleGroups: ["lats", "biceps", "rear delts"], movementPattern: "pull" },
  { name: "Barbell Row", muscleGroups: ["lats", "rhomboids", "biceps"], movementPattern: "pull" },
  { name: "Face Pull", muscleGroups: ["rear delts", "rotator cuff"], movementPattern: "pull" },
  { name: "Farmer Carry", muscleGroups: ["forearms", "traps", "core"], movementPattern: "carry" },
  { name: "Suitcase Carry", muscleGroups: ["obliques", "forearms", "traps"], movementPattern: "carry" },
  { name: "Plank", muscleGroups: ["core"], movementPattern: "core" },
  { name: "Dead Bug", muscleGroups: ["core", "hip flexors"], movementPattern: "core" },
];

async function main() {
  const existingExercises = await prisma.exercise.count();
  if (existingExercises === 0) {
    for (const exercise of exercises) {
      await prisma.exercise.create({ data: { ...exercise, isSystem: true } });
    }
    console.log("Seeded exercises.");
  } else {
    console.log("Exercises already present; skipping exercise seed.");
  }

  const existingConfig = await prisma.config.findUnique({ where: { id: "default" } });
  if (!existingConfig) {
    await prisma.config.create({
      data: {
        id: "default",
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
    console.log("Seeded config.");
  } else {
    console.log("Config already present; skipping config seed.");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
