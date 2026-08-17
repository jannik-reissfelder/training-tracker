import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { analyze, type CoachConfig, type SetEntry, type Signal } from "@/lib/coach/rules";
import { generateGemini } from "@/lib/coach/llm";

export type { Signal } from "@/lib/coach/rules";

const PLACEHOLDER = `This is a placeholder for the training-philosophy grounding document.

Add the real report here when ready. Until then, the coach will fall back to the config values for phrasing.`;

export interface LLMInput {
  systemPrompt: string;
  userPrompt: string;
}

export type LLM = (input: LLMInput) => Promise<string>;

interface GetCoachNoteInput {
  entries: SetEntry[];
  config: CoachConfig;
  llm?: LLM;
}

export async function readPhilosophy(): Promise<string | null> {
  try {
    const path = join(process.cwd(), "docs", "training-philosophy.md");
    const content = await readFile(path, "utf-8");
    const trimmed = content.trim();
    if (trimmed === PLACEHOLDER.trim() || trimmed.length === 0) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

export function getConfig(config: CoachConfig): string {
  return `Split: ${config.splitType}. Frequency target: ${config.frequencyMin}-${config.frequencyMax}x/week. Primary goal: ${config.primaryGoal}. Target sets per exercise: ${config.targetSetsPerExercise}.`;
}

export function buildSystemPrompt(config: CoachConfig, philosophy: string | null): string {
  const base = [
    "You are a direct, no-bullshit training coach for a single user.",
    "Keep the note short (2-4 sentences) and grounded only in the data provided.",
    "Encourage when earned, call out stagnation or missed consistency plainly, and suggest one concrete tweak when the data supports it.",
    "The user trains with 2 hard sets per exercise by intention (minimum-effective-volume), not as a deficiency. Do not suggest adding more sets unless a clear signal supports it.",
    "Do not invent trends, exercises, or numbers. Use only the signals and numbers in the prompt.",
    "Tone: direct, encouraging where earned, honest and unfluffy where warranted.",
  ].join(" ");

  const grounding = philosophy
    ? `Grounding document:\n${philosophy}`
    : `Training philosophy (fallback from config): ${getConfig(config)}`;

  return `${base}\n\n${grounding}`;
}

function buildUserPrompt(config: CoachConfig, signals: Signal[]): string {
  return [
    `Current config: ${getConfig(config)}`,
    `Signals (${signals.length}):`,
    JSON.stringify(signals, null, 2),
    "",
    "Write a short Coach's Note based on these signals. Reference specific numbers and/or exercise names when relevant. If no signals are present, say something brief and neutral.",
  ].join("\n");
}

export async function getCoachNote({
  entries,
  config,
  llm = callGemini,
}: GetCoachNoteInput): Promise<string> {
  const today = new Date();
  const signals = analyze(entries, config, today);
  const philosophy = await readPhilosophy();
  const systemPrompt = buildSystemPrompt(config, philosophy);
  const userPrompt = buildUserPrompt(config, signals);

  try {
    return await llm({ systemPrompt, userPrompt });
  } catch (error) {
    console.error("Coach LLM failed, falling back to deterministic note:", error);
    return fallbackNote(signals);
  }
}

function fallbackNote(signals: Signal[]): string {
  if (signals.length === 0) {
    return "No clear signals right now — keep training consistently and check back after your next session.";
  }
  return signals.map((s) => s.message).join(" ");
}

const PRIMARY_MODEL = "gemini-3.5-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

export async function callGemini(input: LLMInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "mock") {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  try {
    return await generateGemini({ ...input, apiKey, model: PRIMARY_MODEL, timeoutMs: 15000 });
  } catch (primaryError) {
    console.error(`Coach primary model ${PRIMARY_MODEL} failed, trying fallback ${FALLBACK_MODEL}:`, primaryError);
    return generateGemini({ ...input, apiKey, model: FALLBACK_MODEL, timeoutMs: 15000 });
  }
}
