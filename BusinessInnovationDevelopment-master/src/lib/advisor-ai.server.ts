import { getServerConfig } from "./config.server";

type GroqPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function generateAdvisorContent(prompt: string, jsonMode = false) {
  const config = getServerConfig();
  if (!config.groqApiKey) throw new Error("GROQ_API_KEY is missing from .env.local.");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.groqModel,
      messages: [{ role: "user", content: prompt }],
      temperature: jsonMode ? 0.1 : 0.3,
      max_tokens: jsonMode ? 2500 : 800,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const payload = (await response.json()) as GroqPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Groq request failed (${response.status}).`);
  }
  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response.");
  return text;
}

export function parseAdvisorJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

export function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, { status });
}
