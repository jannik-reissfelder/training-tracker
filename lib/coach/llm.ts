export interface GeminiPrompt {
  systemPrompt: string;
  userPrompt: string;
  apiKey: string;
  model?: string;
}

export async function generateGemini({
  systemPrompt,
  userPrompt,
  apiKey,
  model = "gemini-3.5-flash",
}: GeminiPrompt): Promise<string> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as unknown;
  const candidate = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | undefined)
    ?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (typeof text !== "string") {
    throw new Error("Unexpected Gemini response shape");
  }

  return text.trim();
}
