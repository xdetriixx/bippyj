import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatCompletion } from "./ai-gateway";

const Input = z.object({
  texts: z.array(z.string()).min(1).max(200),
});

export type AiScore = {
  esg: "environmental" | "social" | "governance" | null;
};


// Lightweight ESG classifier via Lovable AI Gateway. Sentiment is handled
// separately by VADER on the client; this call only assigns E/S/G/null.
export const scoreTextsWithAI = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<AiScore[]> => {
    const numbered = data.texts
      .map((t, i) => `${i}. ${t.replace(/\s+/g, " ").slice(0, 400)}`)
      .join("\n");

    const content = await chatCompletion(
      "flash-lite",
      [
        {
          role: "system",
          content:
            "You are an ESG topic classifier. For each numbered text, assign an ESG category: environmental, social, governance, or null if not ESG-related. Respond ONLY with JSON matching the schema.",
        },
        { role: "user", content: numbered },
      ],
      {
        type: "json_schema",
        json_schema: {
          name: "scores",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["results"],
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["i", "esg"],
                  properties: {
                    i: { type: "integer" },
                    esg: {
                      type: ["string", "null"],
                      enum: ["environmental", "social", "governance", null],
                    },
                  },
                },
              },
            },
          },
        },
      },
    );
    let parsed: { results?: Array<{ i: number; esg: AiScore["esg"] }> };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI response was not valid JSON");
    }

    const out: AiScore[] = data.texts.map(() => ({ esg: null }));
    for (const r of parsed.results ?? []) {
      if (r.i >= 0 && r.i < out.length) out[r.i] = { esg: r.esg ?? null };
    }
    return out;
  });


// ---------------------------------------------------------------------------
// Batch translation to English (auto-detect source). Returns the original
// text unchanged when it is already English so callers can use one code path.
// ---------------------------------------------------------------------------

const TranslateInput = z.object({
  texts: z.array(z.string()).min(1).max(200),
});

export type TranslationResult = {
  translated: string;
  language: string; // ISO-639-1; "en" means no translation needed
};

export const translateTexts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TranslateInput.parse(d))
  .handler(async ({ data }): Promise<TranslationResult[]> => {
    const numbered = data.texts
      .map((t, i) => `${i}. ${t.replace(/\s+/g, " ").slice(0, 600)}`)
      .join("\n");

    const content = await chatCompletion(
      "flash-lite",
      [
        {
          role: "system",
          content:
            'You are a translator. For each numbered text, detect the language and translate to natural English. If the text is already English, set language to "en" and return the original text verbatim as translated. Use ISO-639-1 codes (e.g. "id", "ms", "vi", "th", "tl", "zh"). Preserve meaning; add no commentary. Respond ONLY with JSON matching the schema.',
        },
        { role: "user", content: numbered },
      ],
      {
        type: "json_schema",
        json_schema: {
          name: "translations",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["results"],
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["i", "language", "translated"],
                  properties: {
                    i: { type: "integer" },
                    language: { type: "string" },
                    translated: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    );
    let parsed: {
      results?: Array<{ i: number; language: string; translated: string }>;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI translate response was not valid JSON");
    }

    const out: TranslationResult[] = data.texts.map((t) => ({
      translated: t,
      language: "en",
    }));
    for (const r of parsed.results ?? []) {
      if (r.i >= 0 && r.i < out.length) {
        out[r.i] = {
          translated: r.translated || data.texts[r.i],
          language: (r.language || "en").toLowerCase(),
        };
      }
    }
    return out;
  });
