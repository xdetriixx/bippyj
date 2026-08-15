import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { WorkforceScanResult } from "./types";

/**
 * workforcePersistence.ts
 * ------------------------------------------------------------------
 * Saves and loads the AI Workforce Transition scan.
 *
 * Deliberately mirrors storeEvaluation() / storeReportComparison() in
 * advisor-parser/reportPersistence.ts: the scan is a FIELD on the
 * existing reports/{reportId} document, not a subcollection.
 *
 * Consequences of matching that pattern, all of them good:
 *   - No new Firestore rules block is needed. The existing rule on
 *     reports/{reportId} already covers this field.
 *   - deleteStoredReport() removes the scan along with the report.
 *   - renameStoredReport() and the History list need no changes.
 *
 * Replaces firestoreCompanies.ts and firestoreAlerts.ts from the
 * standalone build, which used two top-level collections. Those
 * collections are what triggered the permission-denied error in the
 * standalone version, because no rule matched their paths.
 *
 * There is also no separate alerts record. A silent displacement
 * alert is fully derivable from a scan (status plus weakest pillar),
 * so it is computed at render time via weakestPillar() in types.ts.
 * ------------------------------------------------------------------
 */

export interface StoredWorkforceScan extends WorkforceScanResult {
  scannedAt: string;
}

/**
 * Writes the completed scan onto the report document. Call this right
 * after scanWorkforce() resolves, the same way storeEvaluation() is
 * called after parseBmc().
 *
 * Returns null when Firebase is unconfigured or no report has been
 * saved yet, matching the null-return convention used throughout
 * reportPersistence.ts rather than throwing.
 */
export async function storeWorkforceScan(input: {
  reportId: string | null;
  result: StoredWorkforceScan;
}) {
  if (!db || !input.reportId) return null;

  await updateDoc(doc(db, "reports", input.reportId), {
    workforceScan: input.result,
    updatedAt: serverTimestamp(),
  });

  return input.reportId;
}

/**
 * Reads a saved scan back for a single report.
 *
 * Note: loadStoredReport() in reportPersistence.ts does not currently
 * return this field. See the note in the integration guide about
 * adding `workforceScan` to StoredReportDetail so reopening a report
 * from History restores the scan alongside the canvas.
 */
export async function loadWorkforceScan(reportId: string): Promise<StoredWorkforceScan | null> {
  if (!db) return null;

  const snapshot = await getDoc(doc(db, "reports", reportId));
  if (!snapshot.exists()) return null;

  return (snapshot.data().workforceScan as StoredWorkforceScan | undefined) ?? null;
}
