// src/lib/scan-firestore.ts
import { collection, doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

export type PersistableInsight = {
  company: string;
  product: string;
  riskScore: number;
  severity: string;
  esg: string;
  reason: string;
  postCount: number;
  topPostId: string;
  ts: string;
};

// Firestore throws on undefined field values instead of omitting them.
// Their db is already initialized via getFirestore() in firebase.ts, and
// Firestore settings can only be set once per app before first use — so we
// strip undefined manually here instead of using ignoreUndefinedProperties.
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function insightSlug(company: string, product: string): string {
  return `${company}__${product}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 300);
}

export async function saveInsightsToFirestore(insights: PersistableInsight[]): Promise<void> {
  if (!db || insights.length === 0) return;
  const insightsRef = collection(db, "insights");
  const chunks: PersistableInsight[][] = [];
  for (let i = 0; i < insights.length; i += 500) chunks.push(insights.slice(i, i + 500));
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const insight of chunk) {
      batch.set(doc(insightsRef, insightSlug(insight.company, insight.product)), stripUndefined(insight));
    }
    await batch.commit();
  }
}