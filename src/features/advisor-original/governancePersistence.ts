import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface StoredGovernancePillar {
  name: string;
  score: number;
}

export interface StoredGovernanceFlag {
  severity: "critical" | "moderate";
  title: string;
  description: string;
  source: string;
}

export interface StoredGovernanceReasoning {
  summary: string;
  checks: Array<{ found: boolean; text: string }>;
  improvements: string[];
}

export interface StoredGovernanceScan {
  score: number;
  policy: "Verified" | "Partial" | "None";
  riskLabel: "Low Risk" | "Moderate Risk" | "High Risk" | "Critical Risk";
  pages: number;
  pillars: StoredGovernancePillar[];
  flags: StoredGovernanceFlag[];
  reasoning: StoredGovernanceReasoning;
  scannedAt: string;
}

/** Save the Governance lens on the same report document as Canvas and Workforce. */
export async function storeGovernanceScan(input: {
  reportId: string | null;
  result: StoredGovernanceScan;
}) {
  if (!db || !input.reportId) return null;

  await updateDoc(doc(db, "reports", input.reportId), {
    governanceScan: input.result,
    updatedAt: serverTimestamp(),
  });

  return input.reportId;
}
