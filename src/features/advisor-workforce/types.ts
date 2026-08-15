/**
 * types.ts
 * ------------------------------------------------------------------
 * Shared shape of an AI Workforce Transition scan result. Sits
 * alongside workforce.functions.ts, mirroring how advisor-original
 * keeps its types.ts next to advisor.functions.ts.
 *
 * Imported by BOTH the client (to render the result) and the server
 * (to build and validate it), so it holds types and pure helpers
 * only. No secrets, no Node APIs, no Firebase imports.
 *
 * Ported from src/app/services/aiScanner.ts in the standalone build.
 * ------------------------------------------------------------------
 */

export interface PillarResult {
  /** 0 to 100. For displacementRisk, a LOW score means HIGH risk. */
  score: number;
  /** Short label, e.g. "Low signal", "High risk". */
  label: string;
  /** One to three sentences citing specifics from the source text. */
  findings: string;
}

export type WorkforceStatus = "Responsible" | "Watch" | "Caution" | "Silent displacement";

export interface WorkforceScanResult {
  company: string;
  reskillingInvestment: PillarResult;
  displacementRisk: PillarResult;
  newRoleCreation: PillarResult;
  overallScore: number;
  status: WorkforceStatus;
  recommendation: string;
}

/** The three pillar keys, in the order they are displayed. */
export const PILLAR_KEYS = ["reskillingInvestment", "displacementRisk", "newRoleCreation"] as const;

export type PillarKey = (typeof PILLAR_KEYS)[number];

export const PILLAR_LABELS: Record<PillarKey, string> = {
  reskillingInvestment: "Reskilling Investment",
  displacementRisk: "Displacement Risk",
  newRoleCreation: "New Role Creation",
};

/**
 * Maps a 0 to 100 score to a status band.
 *
 * Bands: Responsible 70+, Watch 50 to 69, Caution 30 to 49,
 * Silent displacement below 30.
 *
 * Exported so the UI can band a score without a round trip, and so the
 * server can fall back to it when the model returns a status string
 * that is not one of the four allowed values.
 */
export function statusFromScore(score: number): WorkforceStatus {
  if (score >= 70) return "Responsible";
  if (score >= 50) return "Watch";
  if (score >= 30) return "Caution";
  return "Silent displacement";
}

/**
 * Maps a workforce status onto the High / Medium / Low vocabulary the
 * rest of the advisor app already uses (see riskBadgeCSS and the
 * Rules tab). Use this anywhere a workforce result sits next to a BMC
 * risk rating, so the app speaks one language. The four bands stay as
 * the detailed view underneath.
 *
 * Carried over from statusToRisk() in firestoreCompanies.ts.
 */
export function statusToRiskRating(status: WorkforceStatus): "High" | "Medium" | "Low" {
  if (status === "Responsible") return "Low";
  if (status === "Silent displacement") return "High";
  return "Medium";
}

/**
 * Picks the lowest scoring pillar. That is the most alert worthy
 * finding, so it is what the silent displacement callout leads with.
 *
 * Replaces getWeakestPillarFinding() from firestoreAlerts.ts. In the
 * standalone build that value was written into its own liveAlerts
 * document. Here it is derived at render time instead, so nothing is
 * duplicated in Firestore.
 */
export function weakestPillar(result: WorkforceScanResult): {
  key: PillarKey;
  label: string;
  pillar: PillarResult;
} {
  let weakestKey: PillarKey = "reskillingInvestment";

  for (const key of PILLAR_KEYS) {
    if (result[key].score < result[weakestKey].score) {
      weakestKey = key;
    }
  }

  return {
    key: weakestKey,
    label: PILLAR_LABELS[weakestKey],
    pillar: result[weakestKey],
  };
}
