import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGroqContent, parseGroqJson, type GroqMessage } from "./groq-ai.server";

const biasSchema = z.object({
  risk: z.record(z.string(), z.number()),
  esg: z.record(z.string(), z.number()),
  sector: z.record(z.string(), z.number()),
  exchange: z.record(z.string(), z.number()),
});

const stockSchema = z.object({
  ticker: z.string().min(1).max(12),
  name: z.string().min(1).max(120),
  sector: z.string().min(1).max(80),
  risk: z.string().min(1).max(20),
  esgStrength: z.string().min(1).max(20),
  esgScore: z.number().min(0).max(100),
  environmental: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
  governance: z.number().min(0).max(100),
  analystNote: z.string().max(2_000),
  riskNote: z.string().max(1_000),
  dataMode: z.literal("illustrative prototype"),
  asOf: z.string().max(40),
  peerEsgScore: z.number().min(0).max(100),
  emissionsChangePct: z.number().min(-100).max(100),
  renewableEnergyPct: z.number().min(0).max(100),
  financialUnit: z.string().max(40),
  latestRevenue: z.number(),
  latestNetIncome: z.number(),
});

export const getAIRecommendationCopy = createServerFn({ method: "POST" })
  .validator(
    z.object({
      stock: stockSchema.pick({
        ticker: true,
        name: true,
        sector: true,
        risk: true,
        esgStrength: true,
        esgScore: true,
        analystNote: true,
      }),
      matchScore: z.number().min(0).max(100),
      basis: z.array(z.string().max(160)).max(5),
      bias: biasSchema,
    }),
  )
  .handler(async ({ data }) => {
    const content = await generateGroqContent(
      [
        {
          role: "system",
          content:
            'You write concise, balanced investment-discovery recommendations. Use only supplied facts, explain fit rather than predicting returns, and never tell the user to buy or sell. Return JSON only as {"reason":"..."}.',
        },
        { role: "user", content: JSON.stringify(data) },
      ],
      { jsonMode: true, maxTokens: 180 },
    );
    const parsed = parseGroqJson<{ reason?: string }>(content);
    if (!parsed.reason?.trim()) throw new Error("Groq returned no recommendation reason.");
    return { reason: parsed.reason.trim() };
  });

export const getAIBehavioralNudge = createServerFn({ method: "POST" })
  .validator(
    z.object({
      uniqueStockCount: z.number().int().min(0).max(100),
      highRiskCount: z.number().int().min(0).max(100),
      compareCount: z.number().int().min(0).max(3),
      bias: biasSchema,
    }),
  )
  .handler(async ({ data }) => {
    const content = await generateGroqContent(
      [
        {
          role: "system",
          content:
            'You are a behavioural-finance coach. Create a calm, non-judgmental decision nudge from browsing signals. Do not diagnose, shame, predict returns, or give buy/sell advice. Return JSON only as {"title":"max 8 words","body":"max 45 words"}.',
        },
        { role: "user", content: JSON.stringify(data) },
      ],
      { jsonMode: true, maxTokens: 180 },
    );
    const parsed = parseGroqJson<{ title?: string; body?: string }>(content);
    if (!parsed.title?.trim() || !parsed.body?.trim())
      throw new Error("Groq returned an incomplete nudge.");
    return { title: parsed.title.trim(), body: parsed.body.trim() };
  });

export const getAISimplifiedEsgSummary = createServerFn({ method: "POST" })
  .validator(z.object({ stock: stockSchema }))
  .handler(async ({ data }) => {
    const content = await generateGroqContent(
      [
        {
          role: "system",
          content:
            'Explain the supplied illustrative company profile to a beginner in 85 words or fewer. Mention the strongest pillar, the main concern, the peer comparison, and one relevant climate or financial trend. Clearly call the values illustrative prototype data. Use only supplied facts and no buy/sell instruction. Return JSON only as {"summary":"..."}.',
        },
        { role: "user", content: JSON.stringify(data.stock) },
      ],
      { jsonMode: true, maxTokens: 220 },
    );
    const parsed = parseGroqJson<{ summary?: string }>(content);
    if (!parsed.summary?.trim()) throw new Error("Groq returned no ESG summary.");
    return { summary: parsed.summary.trim() };
  });

export const askCGSIAssistant = createServerFn({ method: "POST" })
  .validator(
    z.object({
      messages: z
        .array(
          z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2_000) }),
        )
        .min(1)
        .max(12),
      context: z.object({
        recentTickers: z.array(z.string().max(12)).max(20),
        compareTickers: z.array(z.string().max(12)).max(3),
        bias: biasSchema,
        stockFacts: z
          .array(
            stockSchema.pick({
              ticker: true,
              name: true,
              sector: true,
              esgScore: true,
              esgStrength: true,
              risk: true,
              environmental: true,
              social: true,
              governance: true,
            }),
          )
          .length(30),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const messages: GroqMessage[] = [
      {
        role: "system",
        content:
          "You are the CGSI AI Assistant. Help users understand ESG scores, risk, comparisons, and this app's investment-discovery data. The supplied stockFacts array contains the complete 30-stock dashboard universe, so use it to answer questions about any listed company. Recent and comparison tickers are personalization signals, not limits on which stocks you may discuss. All supplied company values are illustrative prototype data, not live market data. Be concise and clear. Never claim live market knowledge, invent facts, or provide personalised financial advice. State uncertainty and encourage professional advice for decisions. User browsing context follows: " +
          JSON.stringify(data.context),
      },
      ...data.messages,
    ];
    const answer = await generateGroqContent(messages, { temperature: 0.35, maxTokens: 450 });
    return { answer };
  });
