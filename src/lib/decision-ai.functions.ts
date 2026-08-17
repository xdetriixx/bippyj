import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateGroqContent, parseGroqJson } from "./groq-ai.server";

const confidenceSchema = z.enum(["Low", "Medium", "High"]);
const peerEvidenceLevelSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium" || normalized === "moderate") return "Medium";
  if (normalized === "low") return "Low";

  // Labels such as "Illustrative" do not describe evidence strength. The
  // prototype has no linked source documents, so treat unknown labels as Low.
  return "Low";
}, confidenceSchema);

const peerValueSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .pipe(z.string().min(1).max(100));
const contextSchema = z.object({
  ticker: z.string().min(1).max(16),
  name: z.string().min(1).max(120),
  sector: z.string().min(1).max(80),
  risk: z.string().min(1).max(20),
  esgStrength: z.string().min(1).max(20),
  esgScore: z.number().min(0).max(100),
  environmental: z.number().min(0).max(100),
  social: z.number().min(0).max(100),
  governance: z.number().min(0).max(100),
  peerEsgScore: z.number().min(0).max(100),
  peerEnvironmental: z.number().min(0).max(100),
  peerSocial: z.number().min(0).max(100),
  peerGovernance: z.number().min(0).max(100),
  boardIndependence: z.number().min(0).max(100),
  employeeIndicator: z.number().min(0).max(5),
  emissionsChangePct: z.number().min(-100).max(100),
  latestEmissions: z.number().nonnegative(),
  renewableEnergyPct: z.number().min(0).max(100),
  latestRevenue: z.number(),
  latestNetIncome: z.number(),
  latestMargin: z.number(),
  priorRevenue: z.number(),
  priorMargin: z.number(),
  financialUnit: z.string().max(40),
  dataMode: z.literal("illustrative prototype"),
  reportingPeriod: z.literal("FY2025 / latest illustrative quarter"),
});

const impactResultSchema = z.object({
  items: z
    .array(
      z.object({
        issue: z.string().min(1).max(100),
        signal: z.string().min(1).max(180),
        financialChannel: z.string().min(1).max(260),
        timeHorizon: z.enum(["Near term", "Medium term", "Long term"]),
        evidence: z.array(z.string().min(1).max(180)).min(1).max(3),
        confidence: confidenceSchema,
        assumptions: z.array(z.string().min(1).max(180)).min(1).max(3),
      }),
    )
    .min(2)
    .max(4),
  limitations: z.array(z.string().min(1).max(180)).min(1).max(3),
});

const briefResultSchema = z.object({
  fitReasons: z.array(z.string().min(1).max(180)).min(1).max(3),
  risks: z.array(z.string().min(1).max(180)).min(1).max(3),
  strongestEsgFactor: z.object({
    factor: z.string().min(1).max(100),
    evidence: z.string().min(1).max(220),
  }),
  importantFinancialFactor: z.object({
    factor: z.string().min(1).max(100),
    evidence: z.string().min(1).max(220),
  }),
  uncertainties: z.array(z.string().min(1).max(180)).min(1).max(3),
  nextAction: z.string().min(1).max(220),
});

const peerResultSchema = z.object({
  directAnswer: z.string().min(1).max(320),
  companyAssessments: z
    .array(
      z.object({
        ticker: z.string().min(1).max(16),
        rank: z.number().int().min(1).max(3).nullable(),
        verdict: z.string().min(1).max(100),
        rationale: z.string().min(1).max(260),
        caveat: z.string().min(1).max(220),
      }),
    )
    .min(2)
    .max(3),
  comparableFacts: z
    .array(
      z.object({
        metric: z.string().min(1).max(100),
        values: z
          .array(z.object({ ticker: z.string().max(16), value: peerValueSchema }))
          .min(2)
          .max(3),
        interpretation: z.string().min(1).max(220),
      }),
    )
    .min(2)
    .max(5),
  importantDifferences: z.array(z.string().min(1).max(200)).min(1).max(4),
  financialRelevance: z
    .array(
      z.object({
        ticker: z.string().min(1).max(16),
        esgSignal: z.string().min(1).max(180),
        possibleFinancialEffect: z.string().min(1).max(260),
      }),
    )
    .min(2)
    .max(3),
  evidenceQuality: z
    .array(
      z.object({
        ticker: z.string().max(16),
        level: peerEvidenceLevelSchema,
        reason: z.string().min(1).max(180),
      }),
    )
    .min(2)
    .max(3),
  missingData: z
    .array(z.string().min(1).max(180))
    .max(4)
    .transform((items) =>
      items.length > 0
        ? items
        : ["Source-document citations and company-reported transition targets were not supplied."],
    ),
  sectorCaveat: z.string().min(1).max(280),
  nextStep: z.string().min(1).max(240),
  conclusion: z.string().min(1).max(350),
});

const BRIEF_MODE_INSTRUCTIONS = {
  "30-second":
    "FAST SCAN: Keep the entire response extremely concise (about 100-120 words). Return exactly 2 short fitReasons, exactly 2 short risks, and exactly 1 uncertainty. Each item must be one direct sentence. State the strongest ESG factor and financial factor in one short evidence sentence each. Do not define common terms.",
  beginner:
    "BEGINNER EXPLANATION: Use plain English (about 200-260 words). Return 2-3 fitReasons, 2-3 risks, and 2 uncertainties. Explain technical ideas such as margin, emissions exposure, or governance when used. Show what each supplied number means without assuming financial knowledge.",
  detailed:
    "DETAILED INVESTOR BRIEF: Provide the most analytical version (about 380-500 words). Return exactly 3 fitReasons, exactly 3 risks, and 2-3 uncertainties. Cite supplied figures, compare ESG pillars with sector benchmarks, describe at least one ESG-to-financial channel, distinguish evidence from assumptions, and explain why revenue or margin direction matters. Do not simplify away material caveats.",
} as const;

const scenarioResultSchema = z.object({
  summary: z.string().min(1).max(350),
  affectedMetrics: z
    .array(
      z.object({
        metric: z.string().min(1).max(100),
        direction: z.enum(["Upward pressure", "Downward pressure", "Mixed"]),
        impactRange: z.enum(["Low", "Low to moderate", "Moderate", "Moderate to high", "High"]),
        rationale: z.string().min(1).max(240),
      }),
    )
    .min(2)
    .max(4),
  assumptions: z.array(z.string().min(1).max(180)).min(1).max(4),
  uncertainties: z.array(z.string().min(1).max(180)).min(1).max(4),
  confidence: confidenceSchema,
});

export const getAIEsgFinancialBridge = createServerFn({ method: "POST" })
  .validator(z.object({ stock: contextSchema }))
  .handler(async ({ data }) => {
    const content = await generateGroqContent(
      [
        {
          role: "system",
          content:
            "Build an ESG-to-financial impact bridge using only the supplied illustrative facts. Explain causal channels, not predictions. Never invent regulations, geography, targets, or external evidence. Confidence must reflect evidence completeness. Return JSON with items[{issue,signal,financialChannel,timeHorizon,evidence[],confidence,assumptions[]}] and limitations[]. Include 2-4 material issues. No buy/sell advice.",
        },
        { role: "user", content: JSON.stringify(data.stock) },
      ],
      { jsonMode: true, temperature: 0.2, maxTokens: 950 },
    );
    return impactResultSchema.parse(parseGroqJson(content));
  });

export const getAIDecisionBrief = createServerFn({ method: "POST" })
  .validator(
    z.object({ stock: contextSchema, mode: z.enum(["30-second", "beginner", "detailed"]) }),
  )
  .handler(async ({ data }) => {
    const modeInstruction = BRIEF_MODE_INSTRUCTIONS[data.mode];
    const content = await generateGroqContent(
      [
        {
          role: "system",
          content: `Create a neutral Before You Decide brief from supplied illustrative facts only. Organise evidence; do not recommend buying, selling, or expected returns. ${modeInstruction} Return JSON with fitReasons[], risks[], strongestEsgFactor{factor,evidence}, importantFinancialFactor{factor,evidence}, uncertainties[], nextAction. The next action must be research or peer comparison, not a trade. Do not mention these formatting instructions in the response.`,
        },
        { role: "user", content: JSON.stringify(data) },
      ],
      {
        jsonMode: true,
        temperature: 0.15,
        maxTokens: data.mode === "detailed" ? 1_250 : data.mode === "beginner" ? 800 : 500,
      },
    );
    return briefResultSchema.parse(parseGroqJson(content));
  });

export const getAIEsgPeerComparison = createServerFn({ method: "POST" })
  .validator(
    z.object({
      stocks: z.array(contextSchema).min(2).max(3),
      question: z.enum([
        "Overall ESG differences",
        "Stronger governance",
        "Climate transition credibility",
        "Evidence quality",
        "Largest ESG-related financial exposure",
      ]),
    }),
  )
  .handler(async ({ data }) => {
    const content = await generateGroqContent(
      [
        {
          role: "system",
          content:
            'Act as a neutral ESG comparison analyst. Use only the supplied illustrative facts and answer the selected investor question directly before presenting supporting detail. Rank every supplied company from strongest to weakest for that question only. If the evidence cannot support a defensible ranking, set rank to null for every company and clearly explain why instead of inventing certainty. For climate transition credibility, emissions direction and renewable share are proxy signals only: without targets, implementation evidence, and source documents, set ranks to null and do not claim that any plan is credible. Compare both raw values and sector-relative values because cross-sector raw scores may not be directly comparable. Do not treat a composite ESG score as proof of transition-plan credibility, and never invent policies, targets, geography, disclosures, or external evidence. Explain at least one possible financial channel for each company, but describe possibilities rather than predictions. Return JSON with directAnswer, companyAssessments[{ticker,rank,verdict,rationale,caveat}], comparableFacts[{metric,values[{ticker,value}],interpretation}], importantDifferences[], financialRelevance[{ticker,esgSignal,possibleFinancialEffect}], evidenceQuality[{ticker,level,reason}], missingData[], sectorCaveat, nextStep, conclusion. Select 3-5 metrics that directly answer the chosen question. Every comparableFacts value must be a JSON string. Every evidenceQuality level must be exactly "Low", "Medium", or "High" and reflect source completeness. Missing-data items must identify what is needed to answer the selected question more confidently. The next step must be a specific research action, not a trade. Keep the conclusion neutral and avoid buy/sell advice.',
        },
        { role: "user", content: JSON.stringify(data) },
      ],
      { jsonMode: true, temperature: 0.15, maxTokens: 1_600 },
    );
    return peerResultSchema.parse(parseGroqJson(content));
  });

export const getAIEsgScenario = createServerFn({ method: "POST" })
  .validator(
    z.object({
      stock: contextSchema,
      scenario: z.enum([
        "Higher carbon pricing",
        "Stricter emissions regulation",
        "Increased renewable-energy adoption",
        "Supply-chain disruption",
        "New AI-governance requirements",
      ]),
      intensity: z.enum(["Moderate", "Elevated", "Severe"]),
    }),
  )
  .handler(async ({ data }) => {
    const content = await generateGroqContent(
      [
        {
          role: "system",
          content:
            "Run an educational ESG scenario analysis using only supplied illustrative facts and the selected scenario. This is not a forecast. Use qualitative impact ranges, visible assumptions, causal reasoning, and uncertainty. Never invent geographic exposure, regulation, supply-chain structure, or precise monetary estimates. Return JSON with summary, affectedMetrics[{metric,direction,impactRange,rationale}], assumptions[], uncertainties[], confidence. No buy/sell advice.",
        },
        { role: "user", content: JSON.stringify(data) },
      ],
      { jsonMode: true, temperature: 0.2, maxTokens: 900 },
    );
    return scenarioResultSchema.parse(parseGroqJson(content));
  });
