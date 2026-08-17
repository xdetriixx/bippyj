import { getServerConfig } from "./config.server";

type AiPayload = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  };
};

const OPENAI_JSON_COMPLETION_TOKENS = 7_000;
const OPENAI_TEXT_COMPLETION_TOKENS = 1_600;
const GROQ_JSON_COMPLETION_TOKENS = 2_500;
const GROQ_TEXT_COMPLETION_TOKENS = 800;

/**
 * Primary advisor AI provider.
 * Used by BMC parsing, past-year comparison, company comparison,
 * advisor follow-ups, and the AI Workforce scan.
 */
export async function generateAdvisorContent(prompt: string, jsonMode = false) {
  const config = getServerConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is missing from .env.local. Add the key and restart the app.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openAiModel,
      messages: [{ role: "user", content: prompt }],
      reasoning_effort: "low",
      max_completion_tokens: jsonMode
        ? OPENAI_JSON_COMPLETION_TOKENS
        : OPENAI_TEXT_COMPLETION_TOKENS,
      n: 1,
      store: false,
      prompt_cache_key: jsonMode ? "advisor-structured-audit-v1" : "advisor-followup-v1",
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const payload = (await response.json()) as AiPayload;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI request failed (${response.status}).`);
  }

  const text = payload.choices?.[0]?.message?.content;
  if (!text) {
    const choice = payload.choices?.[0];
    const reasoningTokens = payload.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    throw new Error(
      `OpenAI returned an empty response${choice?.finish_reason ? ` (finish reason: ${choice.finish_reason}` : ""}${reasoningTokens ? `; reasoning tokens: ${reasoningTokens}` : ""}${choice?.finish_reason ? ")." : "."}`,
    );
  }

  const inputTokens = payload.usage?.prompt_tokens ?? 0;
  const cachedTokens = Math.min(
    inputTokens,
    payload.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  );
  const outputTokens = payload.usage?.completion_tokens ?? 0;
  const estimatedUsd =
    ((inputTokens - cachedTokens) * 0.25 + cachedTokens * 0.025 + outputTokens * 2) /
    1_000_000;
  console.info(
    `[advisor-ai] ${config.openAiModel}: ${inputTokens} input (${cachedTokens} cached), ${outputTokens} output, estimated $${estimatedUsd.toFixed(5)}`,
  );

  return text;
}

/** Governance-only AI provider. */
export async function generateGroqContent(prompt: string, jsonMode = false) {
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
      max_tokens: jsonMode ? GROQ_JSON_COMPLETION_TOKENS : GROQ_TEXT_COMPLETION_TOKENS,
      n: 1,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const payload = (await response.json()) as AiPayload;
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
