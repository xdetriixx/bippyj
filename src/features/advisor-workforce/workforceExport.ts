import {
  PILLAR_KEYS,
  PILLAR_LABELS,
  statusToRiskRating,
  weakestPillar,
  type WorkforceScanResult,
} from "./types";

/**
 * workforceExport.ts
 * ------------------------------------------------------------------
 * Builds a client-facing summary of an AI Workforce scan and triggers
 * a download.
 *
 * This is the "Export to Client Report" feature from the validation
 * report, derived from E4 (Deloitte 2024: only 19% of leaders have
 * reliable Social metrics). CGSI advisors are already being asked
 * about AI workforce risk by institutional clients; this is the
 * artefact they send back.
 *
 * Follows the same Blob and anchor pattern as downloadJson() in
 * advisor-original/App.tsx rather than introducing a second approach.
 * Markdown rather than JSON, because the audience is a client and not
 * a developer.
 * ------------------------------------------------------------------
 */

function scoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return `${"#".repeat(filled)}${".".repeat(10 - filled)}`;
}

/**
 * Renders the scan as a markdown briefing note. Kept as a pure
 * function so it can be unit tested or reused for an in-app preview
 * without touching the download path.
 */
export function buildWorkforceReport(
  scan: WorkforceScanResult,
  reportType = "Annual Report",
): string {
  const generated = new Date().toISOString().slice(0, 10);
  const weakest = weakestPillar(scan);
  const riskRating = statusToRiskRating(scan.status);

  const pillarSections = PILLAR_KEYS.map((key, index) => {
    const pillar = scan[key];
    const note =
      key === "displacementRisk"
        ? "\n_Note: a lower score on this pillar indicates higher risk._"
        : "";

    return `### ${index + 1}. ${PILLAR_LABELS[key]}

**Score:** ${pillar.score} / 100  \`${scoreBar(pillar.score)}\`
**Assessment:** ${pillar.label}

${pillar.findings}${note}`;
  }).join("\n\n");

  return `# AI Workforce Transition Assessment

**Company:** ${scan.company}
**Source:** ${reportType}
**Prepared:** ${generated}
**Prepared by:** CGS International, ESG Research

---

## Headline

**AI Workforce Score: ${scan.overallScore} / 100** \`${scoreBar(scan.overallScore)}\`

**Status: ${scan.status}**  (maps to ${riskRating} risk on the CGSI scale)

${scan.recommendation}

---

## Why this sits outside a standard ESG Social score

Conventional ESG Social metrics measure headcount, turnover, and diversity.
They were designed before AI-driven automation and record whether a company
*has* workers, not whether those workers are being supported through
automation of their roles. A company can automate a function entirely,
disclose no reskilling investment, and still carry a clean Social score.

This assessment reads the company's own disclosure for three signals that
those metrics do not capture.

---

## Pillar breakdown

${pillarSections}

---

## Lowest scoring signal

**${weakest.label}** at ${weakest.pillar.score} / 100.

${weakest.pillar.findings}

${
  scan.status === "Silent displacement"
    ? "This company meets the silent displacement threshold: evidence of AI adoption without corresponding disclosure of workforce transition support."
    : ""
}

---

## Method and limitations

Scores are produced by language analysis of the company's own published
disclosure. They measure **what the company discloses**, not what it does.
A low score indicates that transition planning is not evidenced in the
document reviewed, which may reflect either an absence of planning or an
absence of reporting on it.

Scores are not comparable across sectors without adjustment, and are
intended to prompt advisor enquiry rather than to replace it.

Bands: Responsible 70 and above, Watch 50 to 69, Caution 30 to 49,
Silent displacement below 30.
`;
}

/**
 * Builds the report and downloads it. Mirrors downloadJson() in
 * App.tsx, including the object URL cleanup the original omits.
 */
export function downloadWorkforceReport(
  scan: WorkforceScanResult,
  reportType?: string,
): void {
  const markdown = buildWorkforceReport(scan, reportType);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute(
    "download",
    `${scan.company.replace(/\s+/g, "_")}_AI_Workforce_Assessment.md`,
  );
  anchor.click();
  anchor.remove();
  // downloadJson() leaks its object URL. Revoking here keeps the blob
  // from being held in memory for the life of the page.
  URL.revokeObjectURL(url);
}
