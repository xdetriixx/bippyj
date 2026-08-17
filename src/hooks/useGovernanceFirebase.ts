/**
 * useGovernanceFirebase.ts
 * Recovered from chat history — Firestore persistence helpers for the
 * AI Governance Checker feature.
 *
 * UPDATED to match the team's actual src/firebase.ts (confirmed Aug 16):
 *  - `db` is typed `Firestore | null` — it's only non-null when all
 *    VITE_FIREBASE_* env vars are present. Every function below now
 *    guards against `db` being null so a missing/misconfigured .env
 *    fails gracefully instead of throwing.
 *  - Import path: firebase.ts lives at src/lib/api/firebase.ts, and this
 *    hook lives at src/hooks/useGovernanceFirebase.ts, so the relative
 *    path below is '../lib/api/firebase'.
 */
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// ── Types ────────────────────────────────────────────────────────────────

interface GovPillar { name: string; score: number; }
interface GovFlag { severity: 'critical' | 'moderate'; title: string; description: string; source: string; }

interface StoredGovernanceData {
  id: string;
  name: string;
  ticker: string;
  initials: string;
  score: number;
  policy: string;
  pages: number;
  lastScanned: string;
  trendDelta: number;
  riskLabel: string;
  pillars: GovPillar[];
  flags: GovFlag[];
  savedAt: string;
}

interface StoredReasoning {
  summary: string;
  checks: { found: boolean; text: string }[];
  improvements: string[];
  savedAt: string;
}

// ── Save company governance score ──────────────────────────────────────────

export async function saveGovernanceScore(company: StoredGovernanceData): Promise<void> {
  if (!db) {
    console.warn('Firebase not configured — skipping saveGovernanceScore');
    return;
  }
  try {
    await setDoc(doc(db, 'governance_scores', company.id), {
      ...company,
      savedAt: new Date().toISOString(),
    });
    console.log(`Saved governance score for ${company.name}`);
  } catch (err) {
    console.error('Error saving governance score:', err);
  }
}

// ── Load all saved governance scores ───────────────────────────────────────

export async function loadAllGovernanceScores(): Promise<StoredGovernanceData[]> {
  if (!db) {
    console.warn('Firebase not configured — skipping loadAllGovernanceScores');
    return [];
  }
  try {
    const snapshot = await getDocs(collection(db, 'governance_scores'));
    return snapshot.docs.map(d => d.data() as StoredGovernanceData);
  } catch (err) {
    console.error('Error loading governance scores:', err);
    return [];
  }
}

// ── Save AI reasoning result ───────────────────────────────────────────────

export async function saveGovernanceReasoning(
  companyId: string,
  reasoning: { summary: string; checks: { found: boolean; text: string }[]; improvements: string[] }
): Promise<void> {
  if (!db) {
    console.warn('Firebase not configured — skipping saveGovernanceReasoning');
    return;
  }
  try {
    await setDoc(doc(db, 'governance_reasoning', companyId), {
      ...reasoning,
      savedAt: new Date().toISOString(),
    });
    console.log(`Saved reasoning for company ${companyId}`);
  } catch (err) {
    console.error('Error saving reasoning:', err);
  }
}

// ── Load saved AI reasoning result ────────────────────────────────────────

export async function loadGovernanceReasoning(companyId: string): Promise<StoredReasoning | null> {
  if (!db) {
    console.warn('Firebase not configured — skipping loadGovernanceReasoning');
    return null;
  }
  try {
    const snap = await getDoc(doc(db, 'governance_reasoning', companyId));
    if (snap.exists()) {
      return snap.data() as StoredReasoning;
    }
    return null;
  } catch (err) {
    console.error('Error loading reasoning:', err);
    return null;
  }
}

// ── Save PDF company result ────────────────────────────────────────────────

export async function savePdfCompany(company: StoredGovernanceData): Promise<void> {
  if (!db) {
    console.warn('Firebase not configured — skipping savePdfCompany');
    return;
  }
  try {
    await setDoc(doc(db, 'governance_pdf_companies', company.name.replace(/\s+/g, '_')), {
      ...company,
      savedAt: new Date().toISOString(),
    });
    console.log(`Saved PDF company ${company.name}`);
  } catch (err) {
    console.error('Error saving PDF company:', err);
  }
}

// ── Load all saved PDF companies ───────────────────────────────────────────

export async function loadAllPdfCompanies(): Promise<StoredGovernanceData[]> {
  if (!db) {
    console.warn('Firebase not configured — skipping loadAllPdfCompanies');
    return [];
  }
  try {
    const snapshot = await getDocs(collection(db, 'governance_pdf_companies'));
    return snapshot.docs.map(d => d.data() as StoredGovernanceData);
  } catch (err) {
    console.error('Error loading PDF companies:', err);
    return [];
  }
}