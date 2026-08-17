import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateAdvisorContent, generateGroqContent, parseAdvisorJson } from "@/lib/advisor-ai.server";
import type { AdvisorMetrics, BMCBlock, CompetitorOverviewResult, PastYearCompareResult } from "./types";

const MAX_REPORT_CHARS_FOR_AI = 14_000;
const BMC_KEYWORDS = [
  "customer",
  "client",
  "segment",
  "product",
  "service",
  "value",
  "revenue",
  "income",
  "fee",
  "commission",
  "cost",
  "expense",
  "staff",
  "employee",
  "partner",
  "supplier",
  "channel",
  "digital",
  "mobile",
  "online",
  "platform",
  "risk",
  "regulatory",
  "capital",
  "asset",
  "technology",
  "operation",
  "strategy",
  "market",
];

const GOVERNANCE_KEYWORDS = [
  "artificial intelligence",
  "responsible ai",
  "ai governance",
  "ai policy",
  "machine learning",
  "algorithm",
  "model risk",
  "data ethics",
  "data governance",
  "privacy",
  "bias",
  "fairness",
  "transparency",
  "accountability",
  "board oversight",
  "risk committee",
  "regulatory",
  "compliance",
  "cybersecurity",
];

const AI_GOVERNANCE_PATTERNS = [
  /\bartificial intelligence\b/gi,
  /\bgenerative ai\b/gi,
  /\bresponsible ai\b/gi,
  /\bai governance\b/gi,
  /\bai policy\b/gi,
  /\bmachine learning\b/gi,
  /\balgorithm(?:ic|s)?\b/gi,
  /\bmodel risk\b/gi,
  /\bai\b/gi,
];

function compressReportForAi(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_REPORT_CHARS_FOR_AI) return normalized;

  const head = normalized.slice(0, 3_500);
  const tail = normalized.slice(-2_500);
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 80);

  const keywordLines: string[] = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (BMC_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      keywordLines.push(line);
    }
    if (keywordLines.join("\n").length > 8_000) break;
  }

  return [
    "[REPORT OPENING EXCERPT]",
    head,
    "[BMC-RELEVANT EXTRACTED LINES]",
    keywordLines.join("\n"),
    "[REPORT CLOSING EXCERPT]",
    tail,
  ].join("\n\n").slice(0, MAX_REPORT_CHARS_FOR_AI);
}

function compressGovernanceReportForAi(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_REPORT_CHARS_FOR_AI) return text.trim();

  // Rank every page before truncating. Annual reports mention broad terms such as
  // "compliance" early and often; taking the first matches can accidentally omit
  // later pages containing the actual AI, algorithm or model-governance evidence.
  const pages = text.split(/(?=\[PAGE \d+\])/i).filter((page) => page.trim());
  const rankedPages = pages
    .map((page, index) => {
      const lower = page.toLowerCase();
      const explicitAiMatches = AI_GOVERNANCE_PATTERNS.reduce((total, pattern) => {
        pattern.lastIndex = 0;
        return total + (page.match(pattern)?.length ?? 0);
      }, 0);
      const supportingMatches = GOVERNANCE_KEYWORDS.reduce(
        (total, keyword) => total + (lower.includes(keyword) ? 1 : 0),
        0,
      );
      return { page: page.trim(), index, score: explicitAiMatches * 10 + supportingMatches };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const relevantPages: string[] = [];
  let selectedLength = 0;
  for (const { page } of rankedPages) {
    if (selectedLength > 0 && selectedLength + page.length > 11_000) continue;
    relevantPages.push(page);
    selectedLength += page.length;
    if (selectedLength >= 11_000) break;
  }

  const evidence = relevantPages.length > 0
    ? relevantPages.join("\n\n")
    : normalized.slice(0, 11_000);
  return [
    "[REPORT OPENING EXCERPT]",
    text.slice(0, 2_000),
    "[AI GOVERNANCE-RELEVANT PAGES]",
    evidence,
    "[REPORT CLOSING EXCERPT]",
    text.slice(-1_000),
  ].join("\n\n").slice(0, MAX_REPORT_CHARS_FOR_AI);
}

function governanceFoundationScores(report: string) {
  const lower = report.toLowerCase();
  const explicitAiCount = AI_GOVERNANCE_PATTERNS.reduce((total, pattern) => {
    pattern.lastIndex = 0;
    return total + (report.match(pattern)?.length ?? 0);
  }, 0);
  const coverageScore = (terms: string[]) => {
    const matches = terms.filter((term) => lower.includes(term)).length;
    return matches === 0 ? 0 : Math.min(55, 15 + matches * 8);
  };

  return [
    { name: "AI Policy", score: explicitAiCount === 0 ? 0 : Math.min(45, 10 + explicitAiCount * 5) },
    { name: "Accountability", score: coverageScore(["board", "oversight", "risk committee", "accountability", "governance framework"]) },
    { name: "Transparency", score: coverageScore(["data governance", "privacy", "transparency", "fairness", "bias", "explainability"]) },
    { name: "Compliance", score: coverageScore(["compliance", "regulatory", "cybersecurity", "model risk", "internal control"]) },
  ];
}

export const parseBmc = createServerFn({ method: "POST" })
  .validator(
    z.object({
      customText: z.string().min(50).max(5_000_000),
      companyName: z.string().min(1).max(160),
      reportType: z.string().min(1).max(160),
      riskInstructionBar: z.string().max(6_000),
    }),
  )
  .handler(async ({ data }) => {
    const compressedReport = compressReportForAi(data.customText);
    const prompt = `You are a senior corporate strategy advisor. Analyse only explicit evidence in the supplied report and return a complete Osterwalder Business Model Canvas.

Return valid JSON only:
{"advisorMetrics":{"opportunityScore":0,"riskScore":0,"riskTier":"Low Risk | Medium Risk | High Risk","scalabilityRating":"short label","opportunityDriver":"short reason","keyThreat":"short threat","insight":"advisor insight","highPoints":0,"mediumPoints":0,"lowPoints":0,"operatingLeverage":{"revPerEmp":0,"staffCostPerEmp":0},"techLeveragePercent":0,"nicheRevenueGrowth":0,"totalRevenueGrowth":0,"infraOverheadPercent":0,"revenuePerEmployee":0,"fixedCostIntensity":0,"feeIncomePercent":0,"crossBorderRevenueGrowth":0,"staffCostsPercentOfRevenue":0,"staffCostsGrowthRate":0,"revenueGrowthRate":0,"scalabilityRiskAlert":"short alert","scalabilityRiskRating":"LOW | MEDIUM | HIGH","transparencySentimentScore":0,"transparencySentimentLabel":"short label","transparencySentimentInsight":"short insight"},"blocks":[{"id":"CS | VP | CH | CR | RS | KR | KA | KP | CS_COST","name":"block name","keyPoints":[{"point":"concise finding","description":"business explanation","evidenceQuote":"short exact quote","pageNumber":"page number or Unknown","riskRating":"Low | Medium | High","riskDescription":"rating reason"}]}]}

Return all nine blocks in this order: Customer Segments, Value Propositions, Channels, Customer Relationships, Revenue Streams, Key Resources, Key Activities, Key Partners, Cost Structure. Use exactly 1 concise keyPoint per block. Never invent quotations or figures. For advisorMetrics, estimate numeric values only from the supplied report evidence; if exact values are unavailable, provide a clearly reasoned estimate from the extracted evidence. Do not return 0 for revenuePerEmployee, staff costs, growth rates, sentiment scores, or percentage metrics unless the report explicitly proves the value is zero.

${data.riskInstructionBar}
Company: ${data.companyName}
Report type: ${data.reportType}

REPORT:
${compressedReport}`;

    const parsed = parseAdvisorJson<{ advisorMetrics: AdvisorMetrics; blocks: BMCBlock[] }>(
      await generateAdvisorContent(prompt, true),
    );
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      throw new Error("OpenAI returned no BMC blocks. Please try again with a clearer PDF.");
    }
    if (!parsed.advisorMetrics) {
      throw new Error("OpenAI returned BMC blocks but no advisor metrics. Please try again.");
    }
    const pointCount = parsed.blocks.reduce((sum, block) => sum + block.keyPoints.length, 0);
    const hours = Math.round((2.5 + Math.min(8, data.customText.length / 8_000)) * 10) / 10;
    return {
      status: "success" as const,
      result: {
        ...parsed,
        efficiencyMetrics: {
          estimatedHumanHoursSaved: hours,
          confidenceScore: Math.min(0.98, Math.round((0.82 + pointCount * 0.008) * 100) / 100),
          manpowerCostSavedUSD: Math.round(hours * 65),
        },
        companyName: data.companyName,
        reportType: data.reportType,
        parsedAt: new Date().toISOString(),
        isSimulated: false,
      },
    };
  });

export const compareCompetitorsOverview = createServerFn({ method: "POST" })
  .validator(z.object({ primaryResult: z.any(), comparisonResult: z.any() }))
  .handler(async ({ data }) => {
    const prompt = `Compare these Business Model Canvas evaluations as a chief strategy officer.
Return JSON only: {"overviewMarkdown":"two concise paragraphs with **bold highlights** and [1]/[2] citations","bulletDifferences":[{"title":"difference title","summary":"specific comparison","citationIndex":1}],"sources":[{"title":"source title","uri":"https://example.com","domain":"example.com"}]}
Use citationIndex 1 for the primary report, 2 for the comparison report, and 3 for shared analysis.
PRIMARY: ${JSON.stringify(data.primaryResult)}
COMPARISON: ${JSON.stringify(data.comparisonResult)}`;
    return {
      status: "success" as const,
      result: parseAdvisorJson<CompetitorOverviewResult>(
        await generateAdvisorContent(prompt, true),
      ),
    };
  });

export const comparePastYear = createServerFn({ method: "POST" })
  .validator(
    z.object({
      companyName: z.string(),
      currentYear: z.string(),
      targetYear: z.string(),
      currentBmcText: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Analyse how ${data.companyName}'s business model changed from ${data.targetYear} to ${data.currentYear}. Base the answer on the supplied current canvas and clearly label uncertainty.
Return JSON only: {"companyName":"name","currentYear":"year","targetYear":"year","comparisonNarrative":"summary","aiMetrics":{"itSpendGrowth":0,"rentCostGrowth":0,"infraDeltaStatus":"OPPORTUNITY | RISK | STABLE","infrastructureDeltaVerdict":"short verdict","lastYearPromise":"previous roadmap promise inferred from evidence","thisYearResult":"current execution result inferred from evidence","sayDoConsistencyScore":0,"managementCredibilityRisk":"LOW | MEDIUM | HIGH","sayDoVerdict":"short verdict"},"blocks":[{"id":"CS","name":"Customer Segments","varianceRating":"Low | Medium | High","changeNotes":"change explanation","pastYearKeyPoints":[{"point":"past finding","description":"detail","evidenceQuote":"quote if known","sourceUrl":"source if known"}]}],"sources":[{"title":"source","uri":"https://example.com","snippet":"description"}]}
CURRENT CANVAS: ${data.currentBmcText}`;
    const result = parseAdvisorJson<PastYearCompareResult>(await generateAdvisorContent(prompt, true));
    if (!Array.isArray(result.blocks) || result.blocks.length === 0) {
      throw new Error("OpenAI returned no past-year variance blocks. Please try again.");
    }
    if (!result.aiMetrics) {
      throw new Error("OpenAI returned past-year blocks but no AI metrics. Please try again.");
    }
    return {
      status: "success" as const,
      result,
    };
  });

export const askAdvisorFollowup = createServerFn({ method: "POST" })
  .validator(
    z.object({
      question: z.string().min(1),
      primaryName: z.string(),
      comparisonName: z.string(),
      primaryBmcText: z.string(),
      comparisonBmcText: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `You are a corporate strategy advisor. Answer the question directly using the supplied canvases. Distinguish evidence from inference.
Primary (${data.primaryName}): ${data.primaryBmcText}
Comparison (${data.comparisonName}): ${data.comparisonBmcText}
Question: ${data.question}`;
    return { status: "success" as const, answer: await generateAdvisorContent(prompt) };
  });

export const scanGovernanceReport = createServerFn({ method: "POST" })
  .validator(
    z.object({
      companyName: z.string().min(1).max(160),
      reportType: z.string().min(1).max(160),
      sourceText: z.string().min(50).max(5_000_000),
      pageCount: z.number().int().min(0).max(10_000),
    }),
  )
  .handler(async ({ data }) => {
    const report = compressGovernanceReportForAi(data.sourceText);
    const prompt = `You are an AI governance auditor. Assess ONLY the supplied annual report evidence. Do not use general knowledge about the company and do not invent policies, quotations, page numbers, or scores.

Return valid JSON only with exactly this structure:
{
  "score": 0,
  "policy": "Verified | Partial | None",
  "riskLabel": "Low Risk | Moderate Risk | High Risk | Critical Risk",
  "pillars": [
    {"name":"AI Policy","score":0},
    {"name":"Accountability","score":0},
    {"name":"Transparency","score":0},
    {"name":"Compliance","score":0}
  ],
  "flags": [
    {"severity":"critical | moderate","title":"short evidence-based concern","description":"plain-English explanation","source":"Page X — short exact quotation, or Page unknown — quotation"}
  ],
  "summary":"2-3 sentence investor explanation grounded in the report",
  "checks":[
    {"found":true,"text":"Dedicated AI policy or responsible-AI framework"},
    {"found":true,"text":"Board or senior-management AI oversight"},
    {"found":true,"text":"AI transparency, fairness, bias or explainability controls"},
    {"found":true,"text":"AI regulatory compliance and model-risk controls"}
  ],
  "improvements":["specific evidence-led recommendation"]
}

Scoring rules:
- 80-100: explicit policy, accountable owners, measurable controls and oversight.
- 60-79: credible framework with some missing evidence or metrics.
- 40-59: partial disclosure with material governance gaps.
- 20-39: limited AI governance disclosure and high uncertainty.
- 0-19: no relevant evidence found in the supplied report.
- Return exactly four pillars in the stated order, with scores from 0 to 100.
- Return up to five flags. Every flag must cite a supplied page marker and short quotation where available.
- Absence of evidence is not evidence of misconduct; describe it as a disclosure gap.
- Give proportionate credit for disclosed data governance, privacy, cybersecurity, model-risk, board oversight and compliance controls when the evidence clearly applies to AI, algorithms, models or automated decisions, even if the report does not call them a standalone "AI policy".
- Use policy "Partial" when relevant controls are disclosed but a complete dedicated AI policy is not evidenced.
- A score of 0 is valid only when the supplied pages contain no relevant governance control evidence at all.
- Do not label missing disclosure alone as "Critical Risk". Reserve Critical Risk for explicit evidence of severe unmanaged risk; otherwise use High Risk for major disclosure gaps.

Company: ${data.companyName}
Report type: ${data.reportType}
Extracted PDF pages: ${data.pageCount || "unknown"}

REPORT TEXT:
${report}`;

    const result = parseAdvisorJson<{
      score: number;
      policy: "Verified" | "Partial" | "None";
      riskLabel: "Low Risk" | "Moderate Risk" | "High Risk" | "Critical Risk";
      pillars: Array<{ name: string; score: number }>;
      flags: Array<{
        severity: "critical" | "moderate";
        title: string;
        description: string;
        source: string;
      }>;
      summary: string;
      checks: Array<{ found: boolean; text: string }>;
      improvements: string[];
    }>(await generateGroqContent(prompt, true));

    if (!Array.isArray(result.pillars) || result.pillars.length !== 4) {
      throw new Error("Groq returned an incomplete governance pillar assessment.");
    }

    const normalizedPillars = result.pillars.map((pillar) => ({
      ...pillar,
      score: Math.max(0, Math.min(100, Math.round(pillar.score))),
    }));
    const allPillarsAreZero = normalizedPillars.every((pillar) => pillar.score === 0);
    const foundationPillars = governanceFoundationScores(report);
    const hasFoundationEvidence = foundationPillars.some((pillar) => pillar.score > 0);
    const finalPillars = allPillarsAreZero && hasFoundationEvidence
      ? foundationPillars
      : normalizedPillars;
    const finalScore = allPillarsAreZero && hasFoundationEvidence
      ? Math.round(finalPillars.reduce((total, pillar) => total + pillar.score, 0) / finalPillars.length)
      : Math.max(0, Math.min(100, Math.round(result.score)));
    const finalRiskLabel = allPillarsAreZero && hasFoundationEvidence
      ? finalScore >= 80
        ? "Low Risk"
        : finalScore >= 60
          ? "Moderate Risk"
          : "High Risk"
      : result.riskLabel;

    return {
      status: "success" as const,
      result: {
        ...result,
        score: finalScore,
        riskLabel: finalRiskLabel,
        pillars: finalPillars,
        flags: Array.isArray(result.flags) ? result.flags.slice(0, 5) : [],
      },
    };
  });

export const governanceReasoning = createServerFn({ method: "POST" })
  .validator(
    z.object({
      companyName: z.string().min(1),
      score: z.number(),
      policy: z.string(),
      pages: z.number(),
      pillars: z.array(z.object({ name: z.string(), score: z.number() })),
      flags: z.array(
        z.object({
          severity: z.enum(["critical", "moderate"]),
          title: z.string(),
          description: z.string(),
          source: z.string(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const { companyName, score, policy, pages, pillars, flags } = data;

    const pillarsText = pillars.map((p) => `- ${p.name}: ${p.score}/100`).join("\n");
    const flagsText = flags
      .map((f) => `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description} (${f.source})`)
      .join("\n");

    const prompt = `You are an AI ESG analyst specialising in AI governance assessment for ASEAN financial institutions.

Analyse the following company AI governance data and explain the score clearly for investors.

Company: ${companyName}
Overall AI Governance Score: ${score}/100
AI Policy Status: ${policy}
Pages of disclosures scanned: ${pages}

Pillar scores:
${pillarsText}

Risk flags detected:
${flagsText}

Return a JSON object with EXACTLY this structure (no extra fields):
{
  "summary": "2-3 sentence plain English explanation of why this company received this score and what it means for investors",
  "checks": [
    { "found": boolean, "text": "Dedicated standalone AI policy document" },
    { "found": boolean, "text": "Board-level approval of AI governance framework" },
    { "found": boolean, "text": "Transparent AI decision-making disclosures" },
    { "found": boolean, "text": "Compliance with emerging AI regulations (EU AI Act, MAS guidelines)" }
  ],
  "improvements": [
    "Specific actionable improvement 1 for this company",
    "Specific actionable improvement 2 for this company",
    "Specific actionable improvement 3 for this company"
  ]
}`;

    try {
      const parsed = parseAdvisorJson<{
        summary: string;
        checks: { found: boolean; text: string }[];
        improvements: string[];
      }>(await generateGroqContent(prompt, true));

      return { status: "success" as const, result: parsed };
    } catch (err: any) {
      console.warn("Governance reasoning error, using fallback:", err.message);

      const isLow = score < 40;
      const isMid = score >= 40 && score < 60;

      const fallbackResult = {
        summary: isLow
          ? `${companyName} received a critically low AI governance score of ${score}/100. Our scan of ${pages} pages of public disclosures found no standalone AI governance policy and no board-level oversight of AI systems. This represents a significant blind spot for ESG investors who rely on standard governance scores, which do not currently flag this gap.`
          : isMid
            ? `${companyName} scored ${score}/100 on AI governance, indicating partial but incomplete coverage. While some operational-level AI policies exist, key gaps remain around board-level approval and algorithmic transparency disclosures.`
            : `${companyName} scored ${score}/100 on AI governance, placing it among stronger performers in our ASEAN financial services scan. A dedicated AI policy and clearer board-level oversight were identified across the ${pages} pages of disclosures reviewed, though some transparency and compliance gaps remain.`,
        checks: [
          { found: policy === "Verified", text: "Dedicated standalone AI policy document" },
          { found: policy === "Verified" || policy === "Partial", text: "Board-level approval of AI governance framework" },
          { found: !isLow, text: "Transparent AI decision-making disclosures" },
          { found: score >= 60, text: "Compliance with emerging AI regulations (EU AI Act, MAS guidelines)" },
        ],
        improvements: isLow
          ? [
            "Publish a standalone, board-approved AI governance policy.",
            "Establish a named board-level function responsible for AI risk oversight.",
            "Begin disclosing algorithmic bias testing results for key AI-driven products.",
          ]
          : isMid
            ? [
              "Elevate existing AI policies to receive formal board-level approval.",
              "Expand transparency disclosures around how AI-driven decisions are made.",
              "Publish a clear roadmap for EU AI Act / MAS AI governance compliance.",
            ]
            : [
              "Continue expanding transparency disclosures across all AI-driven products.",
              "Formalise an AI incident reporting and escalation process if not already in place.",
              "Publish year-on-year AI governance score trends to demonstrate continued improvement.",
            ],
      };

      return { status: "success" as const, isSimulated: true, result: fallbackResult };
    }
  });
