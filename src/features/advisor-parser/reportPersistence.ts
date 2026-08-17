import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { db, ensureAnonymousUser, isFirebaseConfigured, storage } from "@/lib/firebase";
import type { BMCResult } from "./types";
import type { CompetitorOverviewResult } from "../advisor-original/types";
import type { StoredWorkforceScan } from "../advisor-workforce/workforcePersistence";
import { extractTextFromPdf } from "../advisor-original/utils/pdf";


export { isFirebaseConfigured };

export interface StoredReportSummary {
  id: string;
  companyName: string;
  reportType: string;
  originalName: string;
  sizeBytes: number;
  pageCount: number;
  status: string;
  isSimulated?: boolean;
  comparisonCompanyName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StoredReportDetail extends StoredReportSummary {
  extractedText: string;
  result: BMCResult | null;
  workforceScan: StoredWorkforceScan | null;
  comparisonResult: BMCResult | null;
  competitorOverview: CompetitorOverviewResult | null;
  comparisonOriginalName?: string;
}

const MAX_REPORT_BYTES = 100 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function storageUploadErrorMessage(error: unknown) {
  const code = (error as { code?: string }).code;
  if (code === "storage/unauthorized") {
    return "Firebase Storage blocked the PDF upload. Deploy the latest storage.rules, then upload again.";
  }
  if (code === "storage/quota-exceeded") {
    return "Firebase Storage quota was exceeded. Ask the Firebase project owner to check Storage usage.";
  }
  if (code === "storage/retry-limit-exceeded") {
    return "Firebase Storage timed out while uploading. Check your connection and try again.";
  }
  return error instanceof Error
    ? error.message
    : "The PDF could not be uploaded to Firebase Storage.";
}

export async function storeUploadedReport(input: {
  file: File;
  companyName: string;
  reportType: string;
  extractedText?: string;
  pageCount: number;
}): Promise<string | null> {
  if (!db || !storage) return null;
  if (input.file.size > MAX_REPORT_BYTES) {
    throw new Error(
      "This PDF is too large for Firebase Storage. Please upload a file under 100 MB.",
    );
  }

  const ownerId = await ensureAnonymousUser();
  if (!ownerId) return null;

  const reportRef = doc(collection(db, "reports"));
  const basePath = `reports/${ownerId}/${reportRef.id}`;
  const pdfPath = `${basePath}/${safeFileName(input.file.name)}`;

  let pdfUploaded = false;
  try {
    await uploadBytes(ref(storage, pdfPath), input.file, {
      contentType: input.file.type || "application/pdf",
      customMetadata: { reportId: reportRef.id, ownerId },
    });
    pdfUploaded = true;
    await setDoc(reportRef, {
      ownerId,
      company: { name: input.companyName, reportType: input.reportType },
      file: {
        originalName: input.file.name,
        storagePath: pdfPath,
        mimeType: input.file.type || "application/pdf",
        sizeBytes: input.file.size,
        pageCount: input.pageCount,
      },
      processing: { status: "uploaded", progress: 45 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (pdfUploaded) await deleteObject(ref(storage, pdfPath)).catch(() => undefined);
    throw new Error(storageUploadErrorMessage(error));
  }
  return reportRef.id;
}

export async function markReportEvaluating(reportId: string | null) {
  if (!db || !reportId) return;
  await updateDoc(doc(db, "reports", reportId), {
    processing: { status: "evaluating", progress: 65, startedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
}

export async function storeEvaluation(input: {
  reportId: string | null;
  result: BMCResult;
  settings?: unknown;
}) {
  if (!db || !input.reportId) return null;
  await updateDoc(doc(db, "reports", input.reportId), {
    result: input.result,
    isSimulated: input.result.isSimulated,
    processing: { status: "completed", progress: 100, completedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
  return input.reportId;
}

export async function markReportFailed(reportId: string | null, message: string) {
  if (!db || !reportId) return;
  await updateDoc(doc(db, "reports", reportId), {
    processing: { status: "failed", progress: 100, error: message },
    updatedAt: serverTimestamp(),
  });
}

function asDate(value: unknown): Date | undefined {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return undefined;
}

export async function listStoredReports(): Promise<StoredReportSummary[]> {
  if (!db) return [];
  const ownerId = await ensureAnonymousUser();
  if (!ownerId) return [];

  const snapshot = await getDocs(query(collection(db, "reports"), where("ownerId", "==", ownerId)));

  return snapshot.docs
    .map((reportDoc) => {
      const data = reportDoc.data();
      return {
        id: reportDoc.id,
        companyName: data.company?.name ?? "Untitled report",
        reportType: data.company?.reportType ?? "Annual Report",
        originalName: data.file?.originalName ?? "report.pdf",
        sizeBytes: data.file?.sizeBytes ?? 0,
        pageCount: data.file?.pageCount ?? 0,
        status: data.result ? "completed" : (data.processing?.status ?? "uploaded"),
        isSimulated: data.isSimulated,
        comparisonCompanyName: data.comparisonCompanyName,
        createdAt: asDate(data.createdAt),
        updatedAt: asDate(data.updatedAt),
      } satisfies StoredReportSummary;
    })
    .sort((left, right) => (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0));
}

export async function loadStoredReport(reportId: string): Promise<StoredReportDetail> {
  if (!db || !storage) throw new Error("Firebase is not configured.");
  const ownerId = await ensureAnonymousUser();
  if (!ownerId) throw new Error("Cloud session is unavailable.");

  const reportRef = doc(db, "reports", reportId);
  const snapshot = await getDoc(reportRef);
  if (!snapshot.exists()) throw new Error("The report no longer exists.");
  const data = snapshot.data();
  const canManage = data.ownerId === ownerId;

  const result = (data.result as BMCResult | undefined) ?? null;
  const workforceScan = (data.workforceScan as StoredWorkforceScan | undefined) ?? null;

  let comparisonResult: BMCResult | null = null;
  let competitorOverview: CompetitorOverviewResult | null = null;
  let comparisonOriginalName: string | undefined;
  if (data.comparison) {
    comparisonResult = (data.comparison.result as BMCResult | undefined) ?? null;
    competitorOverview =
      (data.comparison.competitorOverview as CompetitorOverviewResult | undefined) ?? null;
    comparisonOriginalName = data.comparison.originalName;
  }

  // Re-extract the PDF text when EITHER analysis is missing. A completed Canvas
  // contains everything needed to redraw itself, but the AI Workforce lens scans
  // the source text directly, so a report with a canvas and no workforce scan
  // still needs its text back. An unrelated Storage timeout should not block the
  // user either way.
  let extractedText = "";
  if ((!result || !workforceScan) && data.file?.storagePath) {
    try {
      const bytes = await getBytes(ref(storage, data.file.storagePath), MAX_REPORT_BYTES);
      const file = new File([bytes], data.file.originalName ?? "report.pdf", {
        type: data.file.mimeType ?? "application/pdf",
      });
      extractedText = await extractTextFromPdf(file);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "storage/retry-limit-exceeded") throw error;
    }
  }

  return {
    id: reportId,
    companyName: data.company?.name ?? result?.companyName ?? "Untitled report",
    reportType: data.company?.reportType ?? result?.reportType ?? "Annual Report",
    originalName: data.file?.originalName ?? "report.pdf",
    sizeBytes: data.file?.sizeBytes ?? 0,
    pageCount: data.file?.pageCount ?? 0,
    status: result ? "completed" : "uploaded",
    isSimulated: result?.isSimulated,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    extractedText,
    result,
    workforceScan,
    comparisonResult,
    competitorOverview,
    comparisonOriginalName,
    canManage,
  } as StoredReportDetail & { canManage: boolean };
}

export async function storeReportComparison(input: {
  reportId: string | null;
  result: BMCResult;
  originalName?: string;
  competitorOverview?: CompetitorOverviewResult | null;
}) {
  if (!db || !input.reportId) return;
  await updateDoc(doc(db, "reports", input.reportId), {
    comparison: {
      result: input.result,
      originalName: input.originalName ?? "comparison.pdf",
      competitorOverview: input.competitorOverview ?? null,
    },
    comparisonCompanyName: input.result.companyName,
    updatedAt: serverTimestamp(),
  });
}

export async function renameStoredReport(reportId: string, companyName: string) {
  if (!db) throw new Error("Firebase is not configured.");
  const reportRef = doc(db, "reports", reportId);
  const snapshot = await getDoc(reportRef);
  if (!snapshot.exists()) throw new Error("The report no longer exists.");
  const data = snapshot.data();
  const changes: Record<string, unknown> = {
    "company.name": companyName.trim(),
    updatedAt: serverTimestamp(),
  };
  if (data.result) changes["result.companyName"] = companyName.trim();
  await updateDoc(reportRef, changes);
}

export async function deleteStoredReport(reportId: string) {
  if (!db || !storage) throw new Error("Firebase is not configured.");
  const currentStorage = storage;
  const reportRef = doc(db, "reports", reportId);
  const snapshot = await getDoc(reportRef);
  if (!snapshot.exists()) return;
  const data = snapshot.data();

  const storagePaths = [data.file?.storagePath].filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
  await Promise.all(
    storagePaths.map(async (path) => {
      try {
        await deleteObject(ref(currentStorage, path));
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "storage/object-not-found") throw error;
      }
    }),
  );
  await deleteDoc(reportRef);
}