import { getServerConfig } from "./config.server";

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export async function generateGroqContent(
  messages: GroqMessage[],
  options: { jsonMode?: boolean; temperature?: number; maxTokens?: number } = {},
) {
  const { groqApiKey, groqModel } = getServerConfig();
  if (!groqApiKey) throw new Error("GROQ_API_KEY is missing from the server environment.");
  if (!groqModel) throw new Error("GROQ_MODEL is missing from the server environment.");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${groqApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: groqModel,
      messages,
      temperature: options.temperature ?? 0.25,
      max_completion_tokens: options.maxTokens ?? 500,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const payload = (await response.json()) as GroqPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Groq request failed (${response.status}).`);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq returned an empty response.");
  return content;
}

export function parseGroqJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}
