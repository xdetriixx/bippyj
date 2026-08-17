export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type JsonSchemaResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
};

// "flash" / "flash-lite" map to different concrete model ids per provider —
// Lovable's gateway wants pinned versions ("google/gemini-2.5-flash"), while
// calling Gemini directly needs the "-latest" aliases: pinned 2.5 models are
// quota-locked to 0 on newer Google AI Studio accounts.
export type ModelTier = "flash" | "flash-lite";

const LOVABLE_MODEL: Record<ModelTier, string> = {
  flash: "google/gemini-2.5-flash",
  "flash-lite": "google/gemini-2.5-flash-lite",
};

const GEMINI_MODEL: Record<ModelTier, string> = {
  flash: "gemini-flash-latest",
  "flash-lite": "gemini-flash-lite-latest",
};

// Calls whichever AI provider is configured and returns the raw JSON string
// from choices[0].message.content (OpenAI chat-completions shape).
//
// Prefers the Lovable AI Gateway (project-managed key, billed via Lovable
// credits) — that's what's used when this app runs on Lovable's own hosting.
// Falls back to calling Gemini directly through Google AI Studio's
// OpenAI-compatible endpoint when only GEMINI_API_KEY is set, for running
// outside Lovable (local dev) where LOVABLE_API_KEY can't be retrieved from
// the dashboard.
export async function chatCompletion(
  tier: ModelTier,
  messages: ChatMessage[],
  responseFormat?: JsonSchemaResponseFormat,
): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let url: string;
  let headers: Record<string, string>;
  let model: string;

  if (lovableKey) {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    headers = { "Content-Type": "application/json", "Lovable-API-Key": lovableKey };
    model = LOVABLE_MODEL[tier];
  } else if (geminiKey) {
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${geminiKey}` };
    model = GEMINI_MODEL[tier];
  } else {
    throw new Error("No AI provider configured: set LOVABLE_API_KEY or GEMINI_API_KEY");
  }

  const body = { model, messages, response_format: responseFormat };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "{}";
}
