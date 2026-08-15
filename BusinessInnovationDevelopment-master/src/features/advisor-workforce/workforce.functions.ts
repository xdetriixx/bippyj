import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateAdvisorContent, parseAdvisorJson } from "@/lib/advisor-ai.server";
import { statusFromScore, type WorkforceScanResult, type WorkforceStatus } from "./types";

/**
 * workforce.functions.ts
 * ------------------------------------------------------------------
 * AI Workforce Transition Tracker scan. Deliberately mirrors the
 * structure of advisor.functions.ts so both features read the same
 * way: same Groq helper, same zod validators, same compression pass,
 * same { status, result } return shape.
 *
 * Ported from backend/ai_scanner.py in the standalone Flask build.
 * There is no OpenAI call and no separate API key. The report text
 * arrives already extracted client side by utils/pdf.ts, so there is
 * no upload route either.
 * ------------------------------------------------------------------
 */

const MAX_REPORT_CHARS_FOR_AI = 14_000;

/**
 * Workforce equivalent of BMC_KEYWORDS in advisor.functions.ts. These
 * pull the reskilling, headcount, and automation sentences out of a
 * long annual report, which is exactly where the three pillars live.
 */
const WORKFORCE_KEYWORDS = [
  "reskill",
  "upskill",
  "retrain",
  "training",
  "learning",
  "development",
  "apprentice",
  "redeploy",
  "mobility",
  "headcount",
  "workforce",
  "employee",
  "staff",
  "talent",
  "hiring",
  "recruit",
  "attrition",
  "turnover",
  "redundanc",
  "retrench",
  "layoff",
  "severance",
  "restructur",
  "automation",
  "automate",
  "artificial intelligence",
  "machine learning",
  "digital transformation",
  "productivity",
  "efficiency",
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
    if (WORKFORCE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      keywordLines.push(line);
    }
    if (keywordLines.join("\n").length > 8_000) break;
  }

  return [
    "[REPORT OPENING EXCERPT]",
    head,
    "[WORKFORCE-RELEVANT EXTRACTED LINES]",
    keywordLines.join("\n"),
    "[REPORT CLOSING EXCERPT]",
    tail,
  ]
    .join("\n\n")
    .slice(0, MAX_REPORT_CHARS_FOR_AI);
}

/**
 * Port of parse_score() from ai_scanner.py, with one deliberate
 * change: the Python version returned 0 for an unparseable value,
 * then needed a second check to tell "genuinely scored 0" apart from
 * "could not parse". Returning null removes that ambiguity, so the
 * overall fallback below is unconditional.
 *
 * Still handles floats where an integer was requested (models do not
 * reliably follow that instruction), numeric strings, negatives, and
 * out of range values.
 */
function parseScore(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parsePillar(raw: unknown) {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    score: parseScore(p.score) ?? 0,
    label: typeof p.label === "string" && p.label.trim() ? p.label : "Unknown",
    findings:
      typeof p.findings === "string" && p.findings.trim()
        ? p.findings
        : "No findings returned by the model.",
  };
}

/**
 * Port of _validate_and_normalise(). Fills safe defaults rather than
 * throwing, so a slightly malformed model response still renders.
 */
function validateAndNormalise(
  companyName: string,
  data: Record<string, unknown>,
): WorkforceScanResult {
  const reskilling = parsePillar(data.reskillingInvestment);
  const displacement = parsePillar(data.displacementRisk);
  const newRoles = parsePillar(data.newRoleCreation);

  // If the model gave no usable overall score, derive one from the
  // pillars instead of reporting a 0 that is not real.
  const overall =
    parseScore(data.overallScore) ??
    Math.round((reskilling.score + displacement.score + newRoles.score) / 3);

  const allowed: WorkforceStatus[] = ["Responsible", "Watch", "Caution", "Silent displacement"];
  const rawStatus = data.status as WorkforceStatus;
  const status = allowed.includes(rawStatus) ? rawStatus : statusFromScore(overall);

  return {
    company: companyName,
    reskillingInvestment: reskilling,
    displacementRisk: displacement,
    newRoleCreation: newRoles,
    overallScore: overall,
    status,
    recommendation:
      typeof data.recommendation === "string" && data.recommendation.trim()
        ? data.recommendation
        : "No recommendation returned by the model.",
  };
}

export const scanWorkforce = createServerFn({ method: "POST" })
  .validator(
    z.object({
      customText: z.string().min(200).max(5_000_000),
      companyName: z.string().min(1).max(160),
      // Optional band overrides from the Rules tab. Mirrors how
      // parseBmc accepts riskInstructionBar from the same screen.
      thresholdInstruction: z.string().max(2_000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const compressedReport = compressReportForAi(data.customText);

    const prompt = `You are an ESG research analyst inside CGS International's AI Workforce Transition Tracker. Assess how responsibly this company is managing AI-driven workforce change, across three pillars.

1. Reskilling Investment: does the company disclose budget, enrolment numbers, or training hours dedicated to helping employees transition as AI is adopted?
2. Displacement Risk: is the company reducing headcount in routine roles while increasing AI and automation hiring, with limited workforce support disclosed? A LOW score here means HIGH risk.
3. New Role Creation: is the company creating AI-complementary roles or internal mobility pathways for employees whose roles are affected by automation?

Return valid JSON only:
{"reskillingInvestment":{"score":0,"label":"short label","findings":"1-3 sentences citing specifics from the report"},"displacementRisk":{"score":0,"label":"short label","findings":"1-3 sentences citing specifics from the report"},"newRoleCreation":{"score":0,"label":"short label","findings":"1-3 sentences citing specifics from the report"},"overallScore":0,"status":"Responsible | Watch | Caution | Silent displacement","recommendation":"1-3 sentence recommendation for a CGSI research advisor"}

All scores are integers from 0 to 100. Status bands: Responsible is 70 and above, Watch is 50 to 69, Caution is 30 to 49, Silent displacement is below 30.

Base the assessment only on what is stated or reasonably implied by the supplied report. Never invent figures or quotations. If the report says nothing about a pillar, score it low and say so explicitly in findings rather than inventing detail. A company that discloses heavy automation with no reskilling disclosure is the "silent displacement" case this tool exists to surface.
${data.thresholdInstruction ?? ""}
Company: ${data.companyName}

REPORT:
${compressedReport}`;

    const parsed = parseAdvisorJson<Record<string, unknown>>(
      await generateAdvisorContent(prompt, true),
    );

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Groq returned no workforce scan data. Please try again with a clearer PDF.");
    }

    return {
      status: "success" as const,
      result: {
        ...validateAndNormalise(data.companyName, parsed),
        scannedAt: new Date().toISOString(),
      },
    };
  });
