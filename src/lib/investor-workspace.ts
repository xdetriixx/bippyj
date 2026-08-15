import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { Stock } from "@/lib/cgsi-data";
import { db } from "@/lib/firebase";

export type InvestmentDecision = "Undecided" | "Buy" | "Watch" | "Avoid";
export type InvestmentHorizon = "Short term" | "Medium term" | "Long term";

export type DecisionChecklist = {
  financialsReviewed: boolean;
  materialEsgReviewed: boolean;
  risksReviewed: boolean;
  peerCompared: boolean;
};

export type ReviewSnapshot = {
  price: number;
  esgScore: number;
  environmental: number;
  social: number;
  governance: number;
  revenue: number;
  netIncome: number;
  carbonTotal: number;
  renewableEnergy: number;
  asOf: string;
};

export type InvestorWorkspace = {
  decision: InvestmentDecision;
  thesis: string;
  timeHorizon: InvestmentHorizon;
  maxRisk: Stock["risk"];
  checklist: DecisionChecklist;
  snapshot: ReviewSnapshot | null;
};

export const EMPTY_WORKSPACE: InvestorWorkspace = {
  decision: "Undecided",
  thesis: "",
  timeHorizon: "Long term",
  maxRisk: "Medium",
  checklist: {
    financialsReviewed: false,
    materialEsgReviewed: false,
    risksReviewed: false,
    peerCompared: false,
  },
  snapshot: null,
};

const DECISIONS: InvestmentDecision[] = ["Undecided", "Buy", "Watch", "Avoid"];
const HORIZONS: InvestmentHorizon[] = ["Short term", "Medium term", "Long term"];
const RISKS: Stock["risk"][] = ["Low", "Medium", "High"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseWorkspace(value: unknown): InvestorWorkspace {
  if (!isRecord(value)) return EMPTY_WORKSPACE;
  const checklist = isRecord(value.checklist) ? value.checklist : {};
  const snapshot = isRecord(value.snapshot) ? value.snapshot : null;
  const numberFromSnapshot = (key: keyof ReviewSnapshot) => {
    const candidate = snapshot?.[key];
    return typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
  };
  const parsedSnapshot = snapshot
    ? {
        price: numberFromSnapshot("price"),
        esgScore: numberFromSnapshot("esgScore"),
        environmental: numberFromSnapshot("environmental"),
        social: numberFromSnapshot("social"),
        governance: numberFromSnapshot("governance"),
        revenue: numberFromSnapshot("revenue"),
        netIncome: numberFromSnapshot("netIncome"),
        carbonTotal: numberFromSnapshot("carbonTotal"),
        renewableEnergy: numberFromSnapshot("renewableEnergy"),
        asOf: typeof snapshot.asOf === "string" ? snapshot.asOf : null,
      }
    : null;
  const validSnapshot =
    parsedSnapshot && Object.values(parsedSnapshot).every((entry) => entry !== null)
      ? (parsedSnapshot as ReviewSnapshot)
      : null;

  return {
    decision: DECISIONS.includes(value.decision as InvestmentDecision)
      ? (value.decision as InvestmentDecision)
      : EMPTY_WORKSPACE.decision,
    thesis: typeof value.thesis === "string" ? value.thesis.slice(0, 1200) : "",
    timeHorizon: HORIZONS.includes(value.timeHorizon as InvestmentHorizon)
      ? (value.timeHorizon as InvestmentHorizon)
      : EMPTY_WORKSPACE.timeHorizon,
    maxRisk: RISKS.includes(value.maxRisk as Stock["risk"])
      ? (value.maxRisk as Stock["risk"])
      : EMPTY_WORKSPACE.maxRisk,
    checklist: {
      financialsReviewed: checklist.financialsReviewed === true,
      materialEsgReviewed: checklist.materialEsgReviewed === true,
      risksReviewed: checklist.risksReviewed === true,
      peerCompared: checklist.peerCompared === true,
    },
    snapshot: validSnapshot,
  };
}

function workspaceRef(uid: string, ticker: string) {
  if (!db) throw new Error("Firebase is not configured for this app.");
  return doc(db, "users", uid, "investmentWorkspaces", ticker.toUpperCase());
}

export async function loadInvestorWorkspace(uid: string, ticker: string) {
  const snapshot = await getDoc(workspaceRef(uid, ticker));
  return snapshot.exists() ? parseWorkspace(snapshot.data()) : EMPTY_WORKSPACE;
}

export async function saveInvestorWorkspace(
  uid: string,
  ticker: string,
  workspace: Omit<InvestorWorkspace, "snapshot">,
) {
  await setDoc(
    workspaceRef(uid, ticker),
    {
      ticker: ticker.toUpperCase(),
      decision: workspace.decision,
      thesis: workspace.thesis.trim(),
      timeHorizon: workspace.timeHorizon,
      maxRisk: workspace.maxRisk,
      checklist: workspace.checklist,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveReviewSnapshot(uid: string, ticker: string, snapshot: ReviewSnapshot) {
  await setDoc(
    workspaceRef(uid, ticker),
    {
      ticker: ticker.toUpperCase(),
      snapshot,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function createReviewSnapshot(stock: Stock, price: number): ReviewSnapshot {
  const latestFinancial = stock.financial.at(-1);
  const latestCarbon = stock.carbon.at(-1);
  const latestEnergy = stock.energy.at(-1);
  return {
    price,
    esgScore: stock.esgScore,
    environmental: stock.environmental,
    social: stock.social,
    governance: stock.governance,
    revenue: latestFinancial?.revenue ?? 0,
    netIncome: latestFinancial?.netIncome ?? 0,
    carbonTotal: latestCarbon?.total ?? 0,
    renewableEnergy: latestEnergy?.renewable ?? 0,
    asOf: new Date().toISOString(),
  };
}
