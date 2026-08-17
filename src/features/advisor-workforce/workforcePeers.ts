import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PILLAR_KEYS } from "./types";
import type { StoredWorkforceScan } from "./workforcePersistence";

/**
 * workforcePeers.ts
 * ------------------------------------------------------------------
 * Reads every saved workforce scan so one company can be placed
 * against its peers.
 *
 * This is the "Peer Benchmark Table" from the validation report,
 * derived from E4 (Deloitte 2024: 81% of leaders lack reliable,
 * comparable metrics). Comparability was the point of that evidence,
 * and a single company's score in isolation does not deliver it.
 *
 * SCOPE: reads across EVERY advisor's reports, not just the signed-in
 * user's. firestore.rules allows this: the reports read rule is
 * `allow read: if signedIn()` with no owner check, unlike the create
 * and update rules which do check ownerId. To narrow this back to one
 * advisor, add a where("ownerId", "==", uid) clause.
 *
 * Firestore cannot query for "documents that have a workforceScan
 * field" without a composite index, so filtering happens client side.
 * Fine at this scale, and the alternative is asking the whole team to
 * deploy an index.
 * ------------------------------------------------------------------
 */

export interface PeerScan {
  reportId: string;
  companyName: string;
  scan: StoredWorkforceScan;
}

/**
 * Rejects structurally broken scans so a failed run from any advisor
 * cannot skew the distribution. This checks SHAPE, not score: a
 * genuine 0 (a report that discloses nothing) is real data and must
 * survive, while a scan missing its pillar objects is not.
 */
function isUsableScan(
  scan: StoredWorkforceScan | undefined,
): scan is StoredWorkforceScan {
  if (!scan) return false;
  if (typeof scan.overallScore !== "number") return false;
  if (!scan.status) return false;
  return PILLAR_KEYS.every((key) => scan[key] && typeof scan[key].score === "number");
}

export async function fetchPeerScans(): Promise<PeerScan[]> {
  if (!db) return [];

  const snapshot = await getDocs(collection(db, "reports"));

  return snapshot.docs
    .map((reportDoc) => {
      const data = reportDoc.data();
      const scan = data.workforceScan as StoredWorkforceScan | undefined;
      if (!isUsableScan(scan)) return null;

      return {
        reportId: reportDoc.id,
        // Prefer the report's own company name, since renaming a report
        // updates that field but not the name stored inside the scan.
        companyName: data.company?.name ?? scan.company ?? "Untitled report",
        scan,
      } satisfies PeerScan;
    })
    .filter((entry): entry is PeerScan => entry !== null)
    .sort((left, right) => right.scan.overallScore - left.scan.overallScore);
}
