import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  generateAdvisorContent,
  parseAdvisorJson,
  searchAdvisorWeb,
  type AdvisorWebSource,
} from "./ai.server";
import type {
  AdvisorMetrics,
  BMCBlock,
  BMCPoint,
  BMCResult,
  CapitalAllocationAnalysis,
  CompetitorOverviewResult,
  GroundingSource,
  MetricWebSource,
  PastYearCompareResult,
} from "../types";

// Keep requests compact to reduce API cost. Annual-report tables often consume
// more tokens per character than normal prose, so keep this deliberately modest.
const MAX_REPORT_CHARS_FOR_AI = 12_000;
const MAX_TARGETED_REPORT_CHARS_FOR_AI = 12_000;
const MAX_RULE_INSTRUCTION_CHARS = 1_200;
const MAX_CANVAS_CONTEXT_CHARS = 5_000;
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
  "debt",
  "equity",
  "shareholder",
  "earnings per share",
  "basic earnings per share",
  "diluted earnings per share",
  "share price",
  "closing price",
  "market price",
  "asset",
  "technology",
  "operation",
  "strategy",
  "market",
];

const BMC_DEFINITIONS = [
  { id: "CS", name: "Customer Segments", aliases: ["customer segment", "customers"] },
  { id: "VP", name: "Value Propositions", aliases: ["value proposition", "value"] },
  { id: "CH", name: "Channels", aliases: ["channel", "distribution channels"] },
  {
    id: "CR",
    name: "Customer Relationships",
    aliases: ["customer relationship", "client relationships"],
  },
  { id: "RS", name: "Revenue Streams", aliases: ["revenue stream", "revenues"] },
  { id: "KR", name: "Key Resources", aliases: ["key resource", "resources"] },
  { id: "KA", name: "Key Activities", aliases: ["key activity", "activities"] },
  { id: "KP", name: "Key Partners", aliases: ["key partner", "partnerships", "partners"] },
  { id: "CS_COST", name: "Cost Structure", aliases: ["cost structure", "costs"] },
] as const;

function normalizeBmcKey(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeBmcBlocks(blocks: BMCBlock[]) {
  const sourceBlocks = Array.isArray(blocks) ? blocks : [];
  const used = new Set<number>();

  return BMC_DEFINITIONS.map((definition, definitionIndex): BMCBlock => {
    const acceptedKeys = new Set(
      [definition.id, definition.name, ...definition.aliases].map(normalizeBmcKey),
    );
    let sourceIndex = sourceBlocks.findIndex(
      (block, index) =>
        !used.has(index) &&
        (acceptedKeys.has(normalizeBmcKey(block?.id)) ||
          acceptedKeys.has(normalizeBmcKey(block?.name))),
    );
    // The prompt requires this exact order, so use position as a safe legacy fallback.
    if (sourceIndex < 0 && sourceBlocks.length >= BMC_DEFINITIONS.length) {
      sourceIndex = definitionIndex;
    }
    if (sourceIndex >= 0) used.add(sourceIndex);
    const source = sourceIndex >= 0 ? sourceBlocks[sourceIndex] : null;
    return {
      id: definition.id,
      name: definition.name,
      keyPoints: Array.isArray(source?.keyPoints) ? source.keyPoints.filter(Boolean) : [],
    };
  });
}

function compressReportForAi(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (text.trim().length <= MAX_REPORT_CHARS_FOR_AI) return text.trim();

  const head = normalized.slice(0, 1_000);
  const tail = normalized.slice(-600);
  const financialTerms = [
    "total revenue",
    "revenue",
    "total debt",
    "borrowings",
    "shareholders' equity",
    "shareholders’ equity",
    "total equity",
    "net profit",
    "profit attributable",
    "profit for the year",
    "cash from operations",
    "capital expenditure",
    "dividends",
    "share buyback",
    "acquisition",
  ];
  const pageSections = getPdfPageSections(text);
  const financialWindows = new Set<string>();
  const bmcWindows = new Set<string>();

  if (pageSections.length > 0) {
    for (const page of pageSections) {
      const lowerPage = page.text.toLowerCase();
      for (const term of financialTerms) {
        const matchIndex = lowerPage.indexOf(term);
        if (matchIndex >= 0) {
          financialWindows.add(
            `[PDF PAGE ${page.pageNumber}]\n${page.text.slice(
              Math.max(0, matchIndex - 350),
              Math.min(page.text.length, matchIndex + 650),
            )}`,
          );
        }
      }

      const keywordMatches = BMC_KEYWORDS.map((keyword) => lowerPage.indexOf(keyword))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)
        .slice(0, 2);
      for (const matchIndex of keywordMatches) {
        bmcWindows.add(
          `[PDF PAGE ${page.pageNumber}]\n${page.text.slice(
            Math.max(0, matchIndex - 250),
            Math.min(page.text.length, matchIndex + 550),
          )}`,
        );
      }
    }
  } else {
    for (const term of financialTerms) {
      const matchIndex = normalized.toLowerCase().indexOf(term);
      if (matchIndex >= 0) {
        financialWindows.add(
          normalized.slice(
            Math.max(0, matchIndex - 350),
            Math.min(normalized.length, matchIndex + 650),
          ),
        );
      }
    }
    const lines = text
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 20);
    for (const line of lines) {
      if (BMC_KEYWORDS.some((keyword) => line.toLowerCase().includes(keyword))) {
        bmcWindows.add(line);
      }
    }
  }

  return [
    "[REPORT OPENING EXCERPT]",
    head,
    "[FINANCIAL EVIDENCE WINDOWS]",
    Array.from(financialWindows).join("\n\n").slice(0, 4_000),
    "[PAGE-LINKED BMC EVIDENCE WINDOWS]",
    Array.from(bmcWindows).join("\n\n").slice(0, 6_200),
    "[REPORT CLOSING EXCERPT]",
    tail,
  ]
    .join("\n\n")
    .slice(0, MAX_REPORT_CHARS_FOR_AI);
}

interface PdfPageSection {
  pageNumber: string;
  text: string;
}

function getPdfPageSections(reportText: string): PdfPageSection[] {
  const sections: PdfPageSection[] = [];
  const pagePattern = /\[PDF PAGE (\d+)\]\s*([\s\S]*?)(?=\s*\[PDF PAGE \d+\]|$)/g;
  for (const match of reportText.matchAll(pagePattern)) {
    sections.push({ pageNumber: match[1], text: match[2] });
  }
  return sections;
}

function compressPastYearReportForAi(text: string) {
  const pages = getPdfPageSections(text);
  if (pages.length === 0) return compressReportForAi(text);

  const weightedTerms: Array<[string, number]> = [
    ["consolidated cash flow statement", 12],
    ["statement of cash flows", 12],
    ["cash flow statement", 10],
    ["cash flows from operating activities", 8],
    ["net cash generated from operating activities", 8],
    ["net cash from operating activities", 8],
    ["operating activities", 4],
    ["investing activities", 4],
    ["financing activities", 4],
    ["dividends paid", 5],
    ["capital expenditure", 5],
    ["purchase of property", 5],
    ["proceeds from borrowings", 5],
    ["repayment of borrowings", 5],
    ["acquisition of", 3],
    ["share buyback", 5],
    ["repurchase of shares", 5],
    ["net profit", 6],
    ["profit attributable to", 8],
    ["profit for the year", 6],
  ];

  const rankedPages = pages
    .map((page, index) => {
      const lower = page.text.toLowerCase();
      const score = weightedTerms.reduce(
        (total, [term, weight]) => total + (lower.includes(term) ? weight : 0),
        0,
      );
      return { page, index, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (rankedPages.length === 0) return compressReportForAi(text);

  const selectedIndexes: number[] = [];
  const addPageIndex = (index: number) => {
    if (index >= 0 && index < pages.length && !selectedIndexes.includes(index)) {
      selectedIndexes.push(index);
    }
  };
  for (const entry of rankedPages) {
    addPageIndex(entry.index);
    addPageIndex(entry.index - 1);
    addPageIndex(entry.index + 1);
  }

  const targetedPages = selectedIndexes
    .map((index) => `[PDF PAGE ${pages[index].pageNumber}]\n${pages[index].text.slice(0, 4_500)}`)
    .join("\n\n")
    .slice(0, 7_000);
  const strategicContext = compressReportForAi(text).slice(0, 4_300);

  return [
    "[TARGETED PROFIT AND CASH-FLOW PAGES]",
    targetedPages,
    "[ADDITIONAL STRATEGIC CONTEXT]",
    strategicContext,
  ]
    .join("\n\n")
    .slice(0, MAX_TARGETED_REPORT_CHARS_FOR_AI);
}

function compressSingleReportForAi(text: string) {
  const pages = getPdfPageSections(text);
  if (pages.length === 0) return compressReportForAi(text);

  const weightedTerms: Array<[string, number]> = [
    ["consolidated balance sheet", 12],
    ["statement of financial position", 12],
    ["balance sheet", 8],
    ["total debt", 12],
    ["debt issued", 10],
    ["borrowings", 8],
    ["subordinated debt", 10],
    ["subordinated liabilities", 10],
    ["shareholders' equity", 12],
    ["shareholders’ equity", 12],
    ["equity attributable to", 10],
    ["total equity", 10],
    ["total liabilities", 5],
    ["earnings per share", 10],
    ["basic earnings per share", 12],
    ["diluted earnings per share", 12],
    ["share price", 10],
    ["closing price", 10],
    ["market price", 8],
    ["price earnings ratio", 12],
  ];

  const rankedPages = pages
    .map((page, index) => {
      const lower = page.text.toLowerCase();
      const score = weightedTerms.reduce(
        (total, [term, weight]) => total + (lower.includes(term) ? weight : 0),
        0,
      );
      return { index, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (rankedPages.length === 0) return compressReportForAi(text);

  const selectedIndexes: number[] = [];
  const addPageIndex = (index: number) => {
    if (index >= 0 && index < pages.length && !selectedIndexes.includes(index)) {
      selectedIndexes.push(index);
    }
  };
  for (const entry of rankedPages) {
    addPageIndex(entry.index);
    addPageIndex(entry.index - 1);
    addPageIndex(entry.index + 1);
  }

  const balanceSheetPages = selectedIndexes
    .map((index) => `[PDF PAGE ${pages[index].pageNumber}]\n${pages[index].text.slice(0, 4_000)}`)
    .join("\n\n")
    .slice(0, 6_500);
  const bmcContext = compressReportForAi(text).slice(0, 5_000);

  return [
    "[TARGETED BALANCE-SHEET AND DEBT-NOTE PAGES]",
    balanceSheetPages,
    "[BMC STRATEGIC CONTEXT]",
    bmcContext,
  ]
    .join("\n\n")
    .slice(0, MAX_TARGETED_REPORT_CHARS_FOR_AI);
}

function normalizeEvidence(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findEvidencePage(reportText: string, evidenceQuote: string) {
  const pages = getPdfPageSections(reportText);
  const normalizedQuote = normalizeEvidence(evidenceQuote);
  if (pages.length === 0 || normalizedQuote.length < 8) return null;

  const exactMatches = pages.filter((page) =>
    normalizeEvidence(page.text).includes(normalizedQuote),
  );
  if (exactMatches.length === 1) return exactMatches[0].pageNumber;

  const quoteWords = normalizedQuote.split(" ");
  const windowSize = Math.min(10, quoteWords.length);
  if (windowSize < 6) return null;

  const pageScores = pages.map((page) => {
    const normalizedPage = normalizeEvidence(page.text);
    let score = 0;
    for (let index = 0; index <= quoteWords.length - windowSize; index += 1) {
      if (normalizedPage.includes(quoteWords.slice(index, index + windowSize).join(" "))) {
        score += 1;
      }
    }
    return { pageNumber: page.pageNumber, score };
  });
  pageScores.sort((a, b) => b.score - a.score);
  if (pageScores[0]?.score > 0 && pageScores[0].score > (pageScores[1]?.score ?? 0)) {
    return pageScores[0].pageNumber;
  }
  return null;
}

function verifyBmcPointCitations(blocks: BMCBlock[], reportText: string) {
  const reportPages = getPdfPageSections(reportText);
  const validPageNumbers = new Set(reportPages.map((page) => page.pageNumber));

  return blocks.map((block) => ({
    ...block,
    keyPoints: block.keyPoints.map((point) => {
      const verifiedPage = findEvidencePage(reportText, point.evidenceQuote);
      const claimedPage = String(point.pageNumber ?? "").match(/\d+/)?.[0] ?? "";
      const validClaimedPage = validPageNumbers.has(claimedPage) ? claimedPage : "";
      const resolvedPage = verifiedPage ?? validClaimedPage;
      return {
        ...point,
        pageNumber: resolvedPage,
        citationStatus: verifiedPage
          ? ("VERIFIED" as const)
          : validClaimedPage
            ? ("AI_CITED" as const)
            : ("UNRESOLVED" as const),
      };
    }),
  }));
}

function verifyCapitalAllocationCitations(
  allocation: CapitalAllocationAnalysis,
  reportText: string,
): CapitalAllocationAnalysis {
  const candidateCount = allocation.sources.length + allocation.uses.length;
  const verifyItems = (items: CapitalAllocationAnalysis["sources"]) =>
    items.flatMap((item) => {
      if (!item || typeof item.evidenceQuote !== "string") return [];
      const amount =
        typeof item.amount === "number" && Number.isFinite(item.amount)
          ? Math.abs(item.amount)
          : null;
      const pageNumber = findEvidencePage(reportText, item.evidenceQuote);
      if (amount === null || !pageNumber) return [];
      return [{ ...item, amount, pageNumber }];
    });

  const sources = verifyItems(allocation.sources);
  const uses = verifyItems(allocation.uses);
  const verifiedCount = sources.length + uses.length;

  return {
    ...allocation,
    sources,
    uses,
    verificationNote:
      verifiedCount > 0
        ? `${verifiedCount} cash-flow item${verifiedCount === 1 ? "" : "s"} verified against PDF evidence.`
        : candidateCount > 0
          ? `${candidateCount} candidate cash-flow item${candidateCount === 1 ? " was" : "s were"} found, but the amount and quotation could not both be verified on a PDF page.`
          : allocation.verificationNote?.trim() ||
            "No explicit cash-flow line items were returned from the targeted report pages.",
  };
}

function limitContext(value: string, maxChars: number) {
  const normalized = value.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}\n[Additional context omitted to stay within the AI request limit.]`;
}

function compactEvaluationForAi(value: unknown) {
  if (!value || typeof value !== "object") {
    return limitContext(String(value ?? ""), MAX_CANVAS_CONTEXT_CHARS);
  }

  const evaluation = value as Record<string, unknown>;
  const blocks = Array.isArray(evaluation.blocks)
    ? evaluation.blocks.map((block) => {
        const record = block as Record<string, unknown>;
        const keyPoints = Array.isArray(record.keyPoints)
          ? record.keyPoints.slice(0, 1).map((point) => {
              const item = point as Record<string, unknown>;
              return {
                point: item.point,
                description: item.description,
                pageNumber: item.pageNumber,
                riskRating: item.riskRating,
              };
            })
          : [];
        return { id: record.id, name: record.name, keyPoints };
      })
    : [];

  return limitContext(
    JSON.stringify({
      companyName: evaluation.companyName,
      reportType: evaluation.reportType,
      advisorMetrics: evaluation.advisorMetrics,
      blocks,
    }),
    MAX_CANVAS_CONTEXT_CHARS,
  );
}

interface OnlineFinancialLookup {
  businessModelBlocks?: Array<{
    id: string;
    name: string;
    point: string;
    description: string;
    evidence: string;
    riskRating: "Low" | "Medium" | "High";
    riskDescription: string;
    sourceUrl: string;
  }>;
  debtToEquity?: {
    totalDebt: number | null;
    totalShareholdersEquity: number | null;
    currencyUnit: string;
    asOfDate: string;
    evidence: string;
    sourceUrl: string;
  } | null;
  priceToEarnings?: {
    marketPricePerShare: number | null;
    earningsPerShare: number | null;
    priceToEarningsRatio: number | null;
    currencyUnit: string;
    asOfDate: string;
    evidence: string;
    sourceUrl: string;
  } | null;
  profitGrowth?: {
    metricLabel: string;
    currentProfit: number | null;
    previousProfit: number | null;
    currencyUnit: string;
    evidence: string;
    sourceUrl: string;
  } | null;
  capitalAllocation?: {
    periodLabel: string;
    currencyUnit: string;
    sources: Array<{ label: string; amount: number | null; evidence: string }>;
    uses: Array<{ label: string; amount: number | null; evidence: string }>;
    advisorInsight: string;
    sourceUrl: string;
  } | null;
}

function positiveOnlineNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizedWebUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return `${url.origin}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function findConsultedSource(sourceUrl: unknown, sources: AdvisorWebSource[]) {
  if (typeof sourceUrl !== "string") return null;
  const requestedUrl = normalizedWebUrl(sourceUrl);
  if (!requestedUrl) return null;
  const exact = sources.find((source) => normalizedWebUrl(source.url) === requestedUrl);
  if (exact) return exact;
  try {
    const requested = new URL(sourceUrl);
    return (
      sources.find((source) => {
        const consulted = new URL(source.url);
        return (
          consulted.hostname === requested.hostname &&
          (consulted.pathname.startsWith(requested.pathname) ||
            requested.pathname.startsWith(consulted.pathname))
        );
      }) ?? null
    );
  } catch {
    return null;
  }
}

function appendMetricSource(
  sources: MetricWebSource[],
  metric: MetricWebSource["metric"],
  source: AdvisorWebSource,
  asOfDate?: string,
) {
  if (sources.some((item) => item.metric === metric && item.url === source.url)) return;
  sources.push({ metric, title: source.title, url: source.url, asOfDate });
}

async function runMissingFinancialLookup(options: {
  companyName: string;
  reportPeriod: string;
  currentYear?: string;
  targetYear?: string;
  missing: Array<
    | "debtToEquity"
    | "priceToEarnings"
    | "profitGrowth"
    | "capitalAllocation"
    | "businessModelCanvas"
  >;
  missingBmcBlocks?: Array<{ id: string; name: string }>;
}) {
  const prompt = `Search the web only for these missing financial fields for ${options.companyName}: ${options.missing.join(", ")}.
Report period: ${options.reportPeriod}.
${options.currentYear ? `Current year: ${options.currentYear}.` : ""}
${options.targetYear ? `Comparison year: ${options.targetYear}.` : ""}
${options.missingBmcBlocks?.length ? `Missing Business Model Canvas blocks: ${options.missingBmcBlocks.map((block) => `${block.id} (${block.name})`).join(", ")}.` : ""}

Use the minimum searches needed (never more than two) and prioritise the company's official investor-relations pages, official annual reports, stock-exchange filings, and regulator disclosures. Use reputable market data only when an official source does not publish the required dated market price. Do not use search-result snippets without opening a supporting source. Do not substitute current figures for a historical report period. Values compared in one metric must use the same date, scope, currency, and unit. Return null for a financial metric that cannot be verified.

Return compact JSON only:
{"debtToEquity":null,"priceToEarnings":null,"profitGrowth":null,"capitalAllocation":null,"businessModelBlocks":[]}

When found, replace only the requested null objects using these shapes:
debtToEquity: {"totalDebt":0,"totalShareholdersEquity":0,"currencyUnit":"currency and scale","asOfDate":"date","evidence":"brief exact-value explanation","sourceUrl":"one consulted URL"}
priceToEarnings: {"marketPricePerShare":null,"earningsPerShare":null,"priceToEarningsRatio":null,"currencyUnit":"currency per share","asOfDate":"date","evidence":"brief exact-value explanation","sourceUrl":"one consulted URL"}
profitGrowth: {"metricLabel":"same bottom-line profit measure for both years","currentProfit":0,"previousProfit":0,"currencyUnit":"currency and scale","evidence":"brief exact-value explanation","sourceUrl":"one consulted URL"}
capitalAllocation: {"periodLabel":"fiscal year","currencyUnit":"currency and scale","sources":[{"label":"cash source","amount":0,"evidence":"reported cash-flow line"}],"uses":[{"label":"cash use","amount":0,"evidence":"reported cash-flow line"}],"advisorInsight":"short factual assessment","sourceUrl":"one consulted URL"}
businessModelBlocks: [{"id":"exact requested ID","name":"exact requested name","point":"concise finding","description":"specific business explanation","evidence":"short factual online evidence","riskRating":"Low | Medium | High","riskDescription":"rating reason","sourceUrl":"one consulted URL"}]

For businessModelBlocks, return exactly one well-supported finding for every requested missing block. Use a company-controlled page, annual report, stock-exchange filing, or reputable corporate profile. Do not invent a PDF page number.`;

  const webResult = await searchAdvisorWeb(prompt);
  return {
    lookup: parseAdvisorJson<OnlineFinancialLookup>(webResult.text),
    sources: webResult.sources,
  };
}

async function enrichSingleReportFromWeb(
  metrics: AdvisorMetrics,
  companyName: string,
  reportType: string,
  blocks: BMCBlock[],
) {
  const reportedDebt =
    positiveOnlineNumber(metrics.totalDebt) ??
    (Array.isArray(metrics.debtComponents) && metrics.debtComponents.length > 0
      ? metrics.debtComponents.reduce(
          (sum, component) => sum + (positiveOnlineNumber(component.amount) ?? 0),
          0,
        )
      : null);
  const hasDebtToEquity =
    reportedDebt !== null && positiveOnlineNumber(metrics.totalShareholdersEquity) !== null;
  const hasPriceToEarnings =
    positiveOnlineNumber(metrics.priceToEarningsRatio) !== null ||
    (positiveOnlineNumber(metrics.marketPricePerShare) !== null &&
      positiveOnlineNumber(metrics.earningsPerShare) !== null);
  const missingBlocks = blocks.filter((block) => block.keyPoints.length === 0);
  const missing: Array<"debtToEquity" | "priceToEarnings" | "businessModelCanvas"> = [];
  if (!hasDebtToEquity) missing.push("debtToEquity");
  if (!hasPriceToEarnings) missing.push("priceToEarnings");
  if (missingBlocks.length > 0) missing.push("businessModelCanvas");
  if (missing.length === 0) return { metrics, blocks };

  try {
    const web = await runMissingFinancialLookup({
      companyName,
      reportPeriod: reportType,
      missing,
      missingBmcBlocks: missingBlocks.map(({ id, name }) => ({ id, name })),
    });
    const enriched: AdvisorMetrics = { ...metrics };
    const enrichedBlocks = blocks.map((block) => ({ ...block, keyPoints: [...block.keyPoints] }));
    const webSources = [...(metrics.webSources ?? [])];

    const debt = web.lookup.debtToEquity;
    const debtSource = debt ? findConsultedSource(debt.sourceUrl, web.sources) : null;
    const totalDebt = positiveOnlineNumber(debt?.totalDebt);
    const totalEquity = positiveOnlineNumber(debt?.totalShareholdersEquity);
    if (!hasDebtToEquity && debt && debtSource && totalDebt !== null && totalEquity !== null) {
      enriched.totalDebt = totalDebt;
      enriched.totalShareholdersEquity = totalEquity;
      enriched.debtComponents = [];
      enriched.debtCurrencyUnit = debt.currencyUnit?.trim() || "";
      enriched.debtToEquityRatio = null;
      enriched.debtToEquityRating = "UNAVAILABLE";
      enriched.debtToEquityEvidence = `Online fallback: ${debt.evidence}`;
      enriched.debtCalculationBasis = `Online values dated ${debt.asOfDate || reportType}: total debt divided by shareholders' equity.`;
      appendMetricSource(webSources, "debtToEquity", debtSource, debt.asOfDate);
    }

    const pe = web.lookup.priceToEarnings;
    const peSource = pe ? findConsultedSource(pe.sourceUrl, web.sources) : null;
    const marketPrice = positiveOnlineNumber(pe?.marketPricePerShare);
    const earningsPerShare = positiveOnlineNumber(pe?.earningsPerShare);
    const directRatio = positiveOnlineNumber(pe?.priceToEarningsRatio);
    if (
      !hasPriceToEarnings &&
      pe &&
      peSource &&
      ((marketPrice !== null && earningsPerShare !== null) || directRatio !== null)
    ) {
      enriched.marketPricePerShare = marketPrice;
      enriched.earningsPerShare = earningsPerShare;
      enriched.priceToEarningsRatio = directRatio;
      enriched.peCurrencyUnit = pe.currencyUnit?.trim() || "";
      enriched.peAsOfDate = pe.asOfDate?.trim() || reportType;
      enriched.peEvidence = `Online fallback: ${pe.evidence}`;
      enriched.peCalculationBasis =
        marketPrice !== null && earningsPerShare !== null
          ? "Dated online market price per share divided by matching annual EPS."
          : "Dated P/E ratio reported by the cited online source.";
      appendMetricSource(webSources, "priceToEarnings", peSource, pe.asOfDate);
    }

    enriched.webSources = webSources;

    for (const onlineBlock of web.lookup.businessModelBlocks ?? []) {
      const target = enrichedBlocks.find(
        (block) =>
          normalizeBmcKey(block.id) === normalizeBmcKey(onlineBlock.id) ||
          normalizeBmcKey(block.name) === normalizeBmcKey(onlineBlock.name),
      );
      if (!target || target.keyPoints.length > 0) continue;
      const source = findConsultedSource(onlineBlock.sourceUrl, web.sources);
      if (!source || !onlineBlock.point?.trim() || !onlineBlock.description?.trim()) continue;
      const riskRating = ["Low", "Medium", "High"].includes(onlineBlock.riskRating)
        ? onlineBlock.riskRating
        : "Medium";
      const point: BMCPoint = {
        point: onlineBlock.point.trim(),
        description: onlineBlock.description.trim(),
        evidenceQuote: onlineBlock.evidence?.trim() || "Verified online company information",
        pageNumber: "Online",
        citationStatus: "AI_CITED",
        riskRating: riskRating as BMCPoint["riskRating"],
        riskDescription: onlineBlock.riskDescription?.trim() || "Online fallback assessment.",
        sourceTitle: source.title,
        sourceUrl: source.url,
        evidenceType: "ONLINE",
      };
      target.keyPoints.push(point);
      appendMetricSource(webSources, "businessModelCanvas", source, reportType);
    }

    enriched.webSources = webSources;
    return { metrics: enriched, blocks: enrichedBlocks };
  } catch (error) {
    console.warn(
      `[advisor-ai] Missing-value web fallback skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { metrics, blocks };
  }
}

function appendGroundingSource(
  sources: GroundingSource[],
  source: AdvisorWebSource,
  snippet: string,
) {
  if (sources.some((item) => item.uri === source.url)) return;
  sources.push({
    title: source.title,
    uri: source.url,
    domain: new URL(source.url).hostname,
    snippet,
  });
}

async function enrichPastYearFromWeb(
  result: PastYearCompareResult,
  options: { companyName: string; currentYear: string; targetYear: string },
) {
  if (!result.aiMetrics) return result;
  const hasProfitComparison =
    positiveOnlineNumber(result.aiMetrics.currentProfit) !== null &&
    positiveOnlineNumber(result.aiMetrics.previousProfit) !== null;
  const hasCapitalAllocation =
    result.capitalAllocation.sources.length > 0 || result.capitalAllocation.uses.length > 0;
  const missing: Array<"profitGrowth" | "capitalAllocation"> = [];
  if (!hasProfitComparison) missing.push("profitGrowth");
  if (!hasCapitalAllocation) missing.push("capitalAllocation");
  if (missing.length === 0) return result;

  try {
    const web = await runMissingFinancialLookup({
      companyName: options.companyName,
      reportPeriod: `${options.targetYear} to ${options.currentYear}`,
      currentYear: options.currentYear,
      targetYear: options.targetYear,
      missing,
    });
    const sources = Array.isArray(result.sources) ? [...result.sources] : [];
    let aiMetrics = { ...result.aiMetrics };
    let capitalAllocation = result.capitalAllocation;

    const profit = web.lookup.profitGrowth;
    const profitSource = profit ? findConsultedSource(profit.sourceUrl, web.sources) : null;
    const currentProfit = positiveOnlineNumber(profit?.currentProfit);
    const previousProfit = positiveOnlineNumber(profit?.previousProfit);
    if (
      !hasProfitComparison &&
      profit &&
      profitSource &&
      currentProfit !== null &&
      previousProfit !== null
    ) {
      aiMetrics = {
        ...aiMetrics,
        profitMetricLabel: profit.metricLabel?.trim() || aiMetrics.profitMetricLabel,
        currentProfit,
        previousProfit,
        profitCurrencyUnit: profit.currencyUnit?.trim() || "",
        profitGrowthRate: ((currentProfit - previousProfit) / previousProfit) * 100,
        profitGrowthEvidence: `Online fallback: ${profit.evidence}`,
      };
      appendGroundingSource(sources, profitSource, `Online source for profit comparison.`);
    }

    const allocation = web.lookup.capitalAllocation;
    const allocationSource = allocation
      ? findConsultedSource(allocation.sourceUrl, web.sources)
      : null;
    if (!hasCapitalAllocation && allocation && allocationSource) {
      const mapItems = (
        items: Array<{ label: string; amount: number | null; evidence: string }> | undefined,
      ) =>
        (Array.isArray(items) ? items : []).flatMap((item) => {
          const amount = positiveOnlineNumber(item?.amount);
          const label = typeof item?.label === "string" ? item.label.trim() : "";
          if (amount === null || !label) return [];
          return [
            {
              label,
              amount,
              evidenceQuote:
                typeof item.evidence === "string" ? item.evidence.trim() : "Online disclosure",
              pageNumber: "Online",
              sourceTitle: allocationSource.title,
              sourceUrl: allocationSource.url,
            },
          ];
        });
      const onlineSources = mapItems(allocation.sources);
      const onlineUses = mapItems(allocation.uses);
      if (onlineSources.length > 0 || onlineUses.length > 0) {
        capitalAllocation = {
          periodLabel: allocation.periodLabel?.trim() || options.currentYear,
          currencyUnit: allocation.currencyUnit?.trim() || "",
          sources: onlineSources,
          uses: onlineUses,
          advisorInsight: allocation.advisorInsight?.trim() || "Online cash-flow fallback used.",
          verificationNote:
            "Values came from the cited online disclosure after the uploaded PDF did not provide machine-verifiable values.",
        };
        appendGroundingSource(
          sources,
          allocationSource,
          "Online source for the capital-allocation fallback.",
        );
      }
    }

    return { ...result, aiMetrics, capitalAllocation, sources };
  } catch (error) {
    console.warn(
      `[advisor-ai] Past-year web fallback skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }
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
    const compressedReport = compressSingleReportForAi(data.customText);
    const prompt = `You are a senior corporate strategy advisor. Analyse only explicit evidence in the supplied report and return a complete Osterwalder Business Model Canvas.

Return valid JSON only:
{"advisorMetrics":{"opportunityScore":0,"riskScore":0,"riskTier":"Low Risk | Medium Risk | High Risk","scalabilityRating":"short label","opportunityDriver":"short reason","keyThreat":"short threat","insight":"advisor insight","highPoints":0,"mediumPoints":0,"lowPoints":0,"operatingLeverage":{"revPerEmp":0,"staffCostPerEmp":0},"techLeveragePercent":0,"nicheRevenueGrowth":0,"totalRevenueGrowth":0,"infraOverheadPercent":0,"revenuePerEmployee":0,"marketPricePerShare":null,"earningsPerShare":null,"peCurrencyUnit":"SGD","priceToEarningsRatio":null,"peAsOfDate":"fiscal year-end date","peEvidence":"exact share-price and EPS evidence with PDF pages or not found","peCalculationBasis":"dated market price per share divided by annual EPS","fixedCostIntensity":0,"feeIncomePercent":0,"crossBorderRevenueGrowth":0,"staffCostsPercentOfRevenue":0,"staffCostsGrowthRate":0,"revenueGrowthRate":0,"scalabilityRiskAlert":"short alert","scalabilityRiskRating":"LOW | MEDIUM | HIGH","debtComponents":[{"label":"Debt issued","amount":0}],"totalDebt":null,"totalShareholdersEquity":null,"debtCurrencyUnit":"reported currency and unit","debtToEquityRatio":null,"debtToEquityRating":"UNAVAILABLE","debtToEquityInsight":"short insight","debtToEquityEvidence":"short exact evidence with PDF pages or not found","debtCalculationBasis":"Reported total debt or component labels summed","transparencySentimentScore":0,"transparencySentimentLabel":"short label","transparencySentimentInsight":"short insight"},"blocks":[{"id":"CS | VP | CH | CR | RS | KR | KA | KP | CS_COST","name":"block name","keyPoints":[{"point":"concise finding","description":"business explanation","evidenceQuote":"short exact quote copied from one PDF page","pageNumber":"digits only from the nearest [PDF PAGE n] marker","riskRating":"Low | Medium | High","riskDescription":"rating reason"}]}]}

Return all nine blocks in this order: Customer Segments, Value Propositions, Channels, Customer Relationships, Revenue Streams, Key Resources, Key Activities, Key Partners, Cost Structure. Use exactly 1 concise keyPoint per block. Every keyPoint must contain a verbatim evidenceQuote copied from a single PDF page and the digits from that page's [PDF PAGE n] marker. Never return Unknown, N/A, an empty citation, an invented quotation, or a quotation assembled across pages. For advisorMetrics, estimate numeric values only from the supplied report evidence; if exact values are unavailable, provide a clearly reasoned estimate from the extracted evidence. Do not return 0 for revenuePerEmployee, staff costs, growth rates, sentiment scores, or percentage metrics unless the report explicitly proves the value is zero.

For the debt-to-equity metric, extract total shareholders' equity and reported total debt for the same reporting date and currency/unit. If the report does not state one total-debt line, populate debtComponents using explicit, non-overlapping interest-bearing categories such as borrowings, debt issued, and subordinated debt; the application will sum them. Never include customer deposits, trade payables, provisions, derivative liabilities, or total liabilities as debt. Do not double-count a component already included in another subtotal. If neither reported total debt nor valid components are available, return totalDebt null and an empty debtComponents array. Do not estimate. The application calculates the ratio, so leave debtToEquityRatio null and debtToEquityRating UNAVAILABLE. State the exact debt definition, component labels and supporting PDF pages in debtCalculationBasis and debtToEquityEvidence.

For the price-to-earnings metric, extract a clearly dated fiscal-year-end or closing market price per ordinary share and annual basic or diluted earnings per share for the same share class and financial period. Convert EPS stated in cents into the same currency unit as the share price before returning it. Prefer diluted EPS when available and name the selected EPS basis in peCalculationBasis. The application calculates Market Price per Share / Earnings per Share itself. If the report explicitly publishes a dated price-to-earnings ratio, you may return that direct ratio even when its component inputs are not machine-readable, but identify it as a reported P/E in peCalculationBasis and cite its PDF page. Never use an undated price, invent current market data, or mix currencies/share classes. If neither comparable inputs nor a directly reported P/E are available, return all P/E fields as null. Put the exact values, dates, EPS basis and supporting PDF pages in peEvidence.

${limitContext(data.riskInstructionBar, MAX_RULE_INSTRUCTION_CHARS)}
Company: ${data.companyName}
Report type: ${data.reportType}

REPORT:
${compressedReport}`;

    const parsed = parseAdvisorJson<{ advisorMetrics: AdvisorMetrics; blocks: BMCBlock[] }>(
      await generateAdvisorContent(prompt, true),
    );
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      throw new Error("The AI returned no BMC blocks. Please try again with a clearer PDF.");
    }
    if (!parsed.advisorMetrics) {
      throw new Error("The AI returned BMC blocks but no advisor metrics. Please try again.");
    }
    const normalizedBlocks = normalizeBmcBlocks(parsed.blocks);
    const verifiedBlocks = verifyBmcPointCitations(normalizedBlocks, data.customText);
    const enriched = await enrichSingleReportFromWeb(
      parsed.advisorMetrics,
      data.companyName,
      data.reportType,
      verifiedBlocks,
    );
    const pointCount = enriched.blocks.reduce((sum, block) => sum + block.keyPoints.length, 0);
    const hours = Math.round((2.5 + Math.min(8, data.customText.length / 8_000)) * 10) / 10;
    return {
      status: "success" as const,
      result: {
        ...parsed,
        advisorMetrics: enriched.metrics,
        blocks: enriched.blocks,
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

export const enrichMissingAdvisorResult = createServerFn({ method: "POST" })
  .validator(z.object({ result: z.any() }))
  .handler(async ({ data }) => {
    const result = data.result as BMCResult;
    const blocks = normalizeBmcBlocks(result.blocks ?? []);
    if (!result.advisorMetrics) {
      return { status: "success" as const, result: { ...result, blocks } };
    }
    const enriched = await enrichSingleReportFromWeb(
      result.advisorMetrics,
      result.companyName,
      result.reportType,
      blocks,
    );
    return {
      status: "success" as const,
      result: {
        ...result,
        advisorMetrics: enriched.metrics,
        blocks: enriched.blocks,
      },
    };
  });

export const compareCompetitorsOverview = createServerFn({ method: "POST" })
  .validator(z.object({ primaryResult: z.any(), comparisonResult: z.any() }))
  .handler(async ({ data }) => {
    const prompt = `Compare these Business Model Canvas evaluations as a chief strategy officer.
Return JSON only: {"overviewMarkdown":"two concise paragraphs with **bold highlights** and [1]/[2] citations","bulletDifferences":[{"title":"difference title","summary":"specific comparison","citationIndex":1}],"sources":[{"title":"source title","uri":"https://example.com","domain":"example.com"}]}
Use citationIndex 1 for the primary report, 2 for the comparison report, and 3 for shared analysis.
PRIMARY: ${compactEvaluationForAi(data.primaryResult)}
COMPARISON: ${compactEvaluationForAi(data.comparisonResult)}`;
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
      currentReportText: z.string().max(5_000_000),
    }),
  )
  .handler(async ({ data }) => {
    const compressedReport = compressPastYearReportForAi(data.currentReportText);
    const prompt = `Analyse how ${data.companyName}'s performance and capital allocation changed from ${data.targetYear} to ${data.currentYear}. Base the answer on the supplied current canvas and annual-report extract and clearly label uncertainty.
Return JSON only: {"companyName":"name","currentYear":"year","targetYear":"year","comparisonNarrative":"summary","aiMetrics":{"lastYearPromise":"previous roadmap promise inferred from evidence","thisYearResult":"current execution result inferred from evidence","sayDoConsistencyScore":0,"managementCredibilityRisk":"LOW | MEDIUM | HIGH","sayDoVerdict":"short verdict","profitMetricLabel":"Net profit attributable to shareholders","currentProfit":null,"previousProfit":null,"profitCurrencyUnit":"reported currency and unit","profitGrowthRate":null,"profitGrowthEvidence":"supporting line and PDF page or reason unavailable"},"capitalAllocation":{"periodLabel":"fiscal year","currencyUnit":"reported currency and unit","sources":[{"label":"Cash from operations","amount":null,"evidenceQuote":"short exact quote","pageNumber":"digits only"}],"uses":[{"label":"Capital expenditure","amount":null,"evidenceQuote":"short exact quote","pageNumber":"digits only"}],"advisorInsight":"capital discipline assessment","verificationNote":"specific extraction limitation when arrays are empty"},"sources":[{"title":"uploaded annual report","uri":"PDF","snippet":"description"}]}

Profit rule: use net profit attributable to shareholders/owners when it is explicitly reported for both comparison years. If that label is unavailable, use another clearly named bottom-line profit measure only when both years use exactly the same scope. Never mix operating profit, profit before tax, segment profit, or net interest income. Never estimate. If either value is missing, scopes differ, or previous profit is zero/negative, return null for both values and explain why in profitGrowthEvidence. Otherwise calculate profitGrowthRate = ((currentProfit - previousProfit) / previousProfit) * 100. Include the exact metric name in profitMetricLabel and cite the supporting PDF page in profitGrowthEvidence.

Capital allocation rule: build a Sources and Uses of Cash waterfall for the latest reported fiscal year. Sources may include cash from operations, debt/equity issued, and asset sales. Uses may include capex, acquisitions, R&D only when separately disclosed as cash spending, dividends, share buybacks, and debt repayments. Include only explicitly reported cash-flow amounts; use positive magnitudes in the report's same currency/unit and never invent missing categories. Every item must contain a verbatim evidenceQuote and digits from its [PDF PAGE n] marker. Return an empty array when no verified source or use is available.

CURRENT CANVAS:
${limitContext(data.currentBmcText, MAX_CANVAS_CONTEXT_CHARS)}

ANNUAL REPORT EXTRACT:
${compressedReport}`;
    const result = parseAdvisorJson<PastYearCompareResult>(
      await generateAdvisorContent(prompt, true),
    );
    if (!result.aiMetrics) {
      throw new Error("The AI returned past-year blocks but no AI metrics. Please try again.");
    }
    // Capital allocation is useful but optional. Do not reject an otherwise
    // valid past-year comparison when the model finds no verified cash-flow
    // breakdown or omits this section.
    const capitalAllocation: CapitalAllocationAnalysis =
      result.capitalAllocation &&
      Array.isArray(result.capitalAllocation.sources) &&
      Array.isArray(result.capitalAllocation.uses)
        ? {
            periodLabel: result.capitalAllocation.periodLabel || data.currentYear,
            currencyUnit: result.capitalAllocation.currencyUnit || "",
            sources: result.capitalAllocation.sources,
            uses: result.capitalAllocation.uses,
            advisorInsight: result.capitalAllocation.advisorInsight || "",
            verificationNote: result.capitalAllocation.verificationNote || "",
          }
        : {
            periodLabel: data.currentYear,
            currencyUnit: "",
            sources: [],
            uses: [],
            advisorInsight: "",
            verificationNote: "",
          };
    const verifiedCapitalAllocation = verifyCapitalAllocationCitations(
      capitalAllocation,
      data.currentReportText,
    );
    const enrichedResult = await enrichPastYearFromWeb(
      {
        ...result,
        capitalAllocation: verifiedCapitalAllocation,
        sources: Array.isArray(result.sources) ? result.sources : [],
      },
      {
        companyName: data.companyName,
        currentYear: data.currentYear,
        targetYear: data.targetYear,
      },
    );
    return {
      status: "success" as const,
      result: enrichedResult,
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
Primary (${data.primaryName}): ${limitContext(data.primaryBmcText, MAX_CANVAS_CONTEXT_CHARS)}
Comparison (${data.comparisonName}): ${limitContext(data.comparisonBmcText, MAX_CANVAS_CONTEXT_CHARS)}
Question: ${limitContext(data.question, 1_000)}`;
    return { status: "success" as const, answer: await generateAdvisorContent(prompt) };
  });
