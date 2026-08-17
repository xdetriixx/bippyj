import { getServerConfig } from "@/lib/config.server";

type ChatCompletionPayload = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message?: string; code?: string; type?: string };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  };
};

type ResponsesPayload = {
  error?: { message?: string; code?: string; type?: string };
  output?: Array<{
    type?: string;
    action?: {
      sources?: Array<{ type?: string; url?: string; title?: string }>;
    };
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{
        type?: string;
        url?: string;
        title?: string;
      }>;
    }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export interface AdvisorWebSource {
  title: string;
  url: string;
}

type ProviderName = "OpenAI" | "Groq";

class ProviderHttpError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly status: number,
    message: string,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
  }
}

// GPT-5 reasoning tokens count against max_completion_tokens. A 2,400-token
// ceiling could be consumed by reasoning before the nine-block JSON was emitted,
// producing a successful response with empty message content. This is a ceiling,
// not a prepaid amount: OpenAI bills only tokens actually generated.
const OPENAI_JSON_COMPLETION_TOKENS = 7_000;
const OPENAI_TEXT_COMPLETION_TOKENS = 1_600;
const GROQ_JSON_COMPLETION_TOKENS = 2_400;
const GROQ_TEXT_COMPLETION_TOKENS = 700;

function formatRetryDelay(retryAfter: string | null) {
  if (!retryAfter) return "";
  const seconds = Number(retryAfter);
  if (!Number.isFinite(seconds) || seconds <= 0) return ` Retry after ${retryAfter}.`;
  if (seconds < 60) return ` Try again in about ${Math.ceil(seconds)} seconds.`;
  return ` Try again in about ${Math.ceil(seconds / 60)} minutes.`;
}

async function readPayload(response: Response, provider: ProviderName) {
  const body = await response.text();
  try {
    return JSON.parse(body) as ChatCompletionPayload;
  } catch {
    throw new ProviderHttpError(
      provider,
      response.ok ? 502 : response.status,
      `${provider} returned an unreadable response (${response.status}).`,
      response.headers.get("retry-after"),
    );
  }
}

function extractText(payload: ChatCompletionPayload, provider: ProviderName, response: Response) {
  if (!response.ok) {
    throw new ProviderHttpError(
      provider,
      response.status,
      payload.error?.message ?? `${provider} request failed (${response.status}).`,
      response.headers.get("retry-after"),
    );
  }

  const choice = payload.choices?.[0];
  const text = choice?.message?.content;
  if (!text) {
    const reasoningTokens = payload.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    throw new ProviderHttpError(
      provider,
      502,
      `${provider} returned an empty response${choice?.finish_reason ? ` (finish reason: ${choice.finish_reason}` : ""}${reasoningTokens ? `; reasoning tokens: ${reasoningTokens}` : ""}${choice?.finish_reason ? ")." : "."}`,
    );
  }
  return text;
}

function logOpenAiCost(payload: ChatCompletionPayload, model: string) {
  const inputTokens = payload.usage?.prompt_tokens ?? 0;
  const cachedTokens = Math.min(
    inputTokens,
    payload.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  );
  const outputTokens = payload.usage?.completion_tokens ?? 0;
  const uncachedTokens = Math.max(0, inputTokens - cachedTokens);
  // GPT-5 mini prices as of July 2026: $0.25/M input, $0.025/M cached input,
  // and $2/M output. This log is an estimate for local cost monitoring only.
  const estimatedUsd =
    (uncachedTokens * 0.25 + cachedTokens * 0.025 + outputTokens * 2) / 1_000_000;
  console.info(
    `[advisor-ai] ${model}: ${inputTokens} input (${cachedTokens} cached), ${outputTokens} output, estimated $${estimatedUsd.toFixed(5)}`,
  );
}

async function requestOpenAi(prompt: string, jsonMode: boolean, model?: string) {
  const config = getServerConfig();
  if (!config.openAiApiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing from .env.local. Add your sk- key and restart the development server.",
    );
  }

  const requestedModel = model ?? config.openAiModel;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: requestedModel,
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

  const payload = await readPayload(response, "OpenAI");
  logOpenAiCost(payload, requestedModel);
  const text = extractText(payload, "OpenAI", response);
  return text;
}

async function requestGroq(prompt: string, jsonMode: boolean) {
  const config = getServerConfig();
  if (!config.groqApiKey) {
    throw new Error("GROQ_API_KEY is missing, so the fallback provider is unavailable.");
  }

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

  const payload = await readPayload(response, "Groq");
  return extractText(payload, "Groq", response);
}

function canUseGroqFallback(error: unknown) {
  if (error instanceof ProviderHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  // A failed fetch is normally a TypeError in Node. Configuration and bad-key
  // errors deliberately do not fall back, so they remain visible to the user.
  return error instanceof TypeError;
}

function formatProviderError(error: unknown) {
  if (!(error instanceof ProviderHttpError)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  const normalizedMessage = error.message.toLowerCase();
  if (error.status === 413 || normalizedMessage.includes("request too large")) {
    return new Error(
      `${error.provider} rejected this advisor request because it was too large. Try a shorter PDF.`,
    );
  }
  if (error.status === 429) {
    return new Error(
      `${error.provider} rate or credit limit reached.${formatRetryDelay(error.retryAfter)} ${error.message}`,
    );
  }
  if (error.status === 401) {
    return new Error(
      `${error.provider} rejected the API key. Check .env.local and restart the app.`,
    );
  }
  return error;
}

export async function generateAdvisorContent(prompt: string, jsonMode = false) {
  const config = getServerConfig();
  try {
    return await requestOpenAi(prompt, jsonMode);
  } catch (openAiError) {
    if (!canUseGroqFallback(openAiError)) {
      throw formatProviderError(openAiError);
    }

    let openAiFallbackError: unknown = null;
    if (config.openAiWebModel !== config.openAiModel) {
      console.warn(
        `[advisor-ai] ${config.openAiModel} was temporarily unavailable; trying ${config.openAiWebModel}.`,
      );
      try {
        return await requestOpenAi(prompt, jsonMode, config.openAiWebModel);
      } catch (error) {
        openAiFallbackError = error;
      }
    }

    if (config.groqApiKey) {
      console.warn("[advisor-ai] OpenAI models were unavailable; trying Groq fallback.");
      try {
        return await requestGroq(prompt, jsonMode);
      } catch (groqError) {
        const primaryMessage = formatProviderError(openAiError).message;
        const openAiFallbackMessage = openAiFallbackError
          ? formatProviderError(openAiFallbackError).message
          : "not attempted";
        const groqMessage = formatProviderError(groqError).message;
        throw new Error(
          `Primary OpenAI error: ${primaryMessage} OpenAI nano fallback: ${openAiFallbackMessage} Groq fallback: ${groqMessage}`,
        );
      }
    }

    if (openAiFallbackError) throw formatProviderError(openAiFallbackError);
    throw formatProviderError(openAiError);
  }
}

export async function searchAdvisorWeb(prompt: string) {
  const config = getServerConfig();
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required for the online-data fallback.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openAiWebModel,
      input: prompt,
      reasoning: { effort: "low" },
      tools: [
        {
          type: "web_search",
          search_context_size: "low",
          filters: {
            blocked_domains: ["reddit.com", "quora.com", "wikipedia.org"],
          },
        },
      ],
      tool_choice: "required",
      max_tool_calls: 2,
      max_output_tokens: 2_200,
      include: ["web_search_call.action.sources"],
      text: { verbosity: "low" },
      store: false,
    }),
  });

  const body = await response.text();
  let payload: ResponsesPayload;
  try {
    payload = JSON.parse(body) as ResponsesPayload;
  } catch {
    throw new ProviderHttpError(
      "OpenAI",
      response.ok ? 502 : response.status,
      `OpenAI web search returned an unreadable response (${response.status}).`,
      response.headers.get("retry-after"),
    );
  }
  if (!response.ok) {
    throw formatProviderError(
      new ProviderHttpError(
        "OpenAI",
        response.status,
        payload.error?.message ?? `OpenAI web search failed (${response.status}).`,
        response.headers.get("retry-after"),
      ),
    );
  }

  const messageParts =
    payload.output?.flatMap((item) => (item.type === "message" ? (item.content ?? []) : [])) ?? [];
  const text = messageParts
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("OpenAI web search returned no structured result.");

  const sourceMap = new Map<string, AdvisorWebSource>();
  for (const item of payload.output ?? []) {
    for (const source of item.action?.sources ?? []) {
      if (typeof source.url === "string" && /^https?:\/\//i.test(source.url)) {
        sourceMap.set(source.url, {
          title: source.title?.trim() || new URL(source.url).hostname,
          url: source.url,
        });
      }
    }
    for (const part of item.content ?? []) {
      for (const annotation of part.annotations ?? []) {
        if (
          annotation.type === "url_citation" &&
          typeof annotation.url === "string" &&
          /^https?:\/\//i.test(annotation.url)
        ) {
          sourceMap.set(annotation.url, {
            title: annotation.title?.trim() || new URL(annotation.url).hostname,
            url: annotation.url,
          });
        }
      }
    }
  }

  const inputTokens = payload.usage?.input_tokens ?? 0;
  const outputTokens = payload.usage?.output_tokens ?? 0;
  console.info(
    `[advisor-ai] ${config.openAiWebModel} online fallback: at most two web-search calls, ${inputTokens} input and ${outputTokens} output tokens.`,
  );
  return { text, sources: Array.from(sourceMap.values()) };
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
