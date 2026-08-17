import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateAdvisorContent, parseAdvisorJson } from "@/lib/advisor-ai.server";
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
      throw new Error("Groq returned no BMC blocks. Please try again with a clearer PDF.");
    }
    if (!parsed.advisorMetrics) {
      throw new Error("Groq returned BMC blocks but no advisor metrics. Please try again.");
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
      throw new Error("Groq returned no past-year variance blocks. Please try again.");
    }
    if (!result.aiMetrics) {
      throw new Error("Groq returned past-year blocks but no AI metrics. Please try again.");
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
