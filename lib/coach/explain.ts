import { callGemini, readPhilosophy, buildSystemPrompt, getConfig } from "@/lib/coach/index";
import type { CoachConfig, Signal } from "@/lib/coach/rules";

function buildSignalPrompt(config: CoachConfig, signal: Signal): string {
  return [
    `Current config: ${getConfig(config)}`,
    "Signal detected:",
    JSON.stringify(signal, null, 2),
    "",
    "Explain this signal to the user in 2-4 sentences. Include the exact numbers, why it matters, and one concrete, actionable tweak. Do not invent data or trends. Do not suggest adding more sets unless the data clearly supports it. Keep the tone direct and honest.",
  ].join("\n");
}

export async function explainSignal(signal: Signal, config: CoachConfig): Promise<string> {
  const philosophy = await readPhilosophy();
  const systemPrompt = buildSystemPrompt(config, philosophy);
  const userPrompt = buildSignalPrompt(config, signal);

  return callGemini({ systemPrompt, userPrompt });
}
