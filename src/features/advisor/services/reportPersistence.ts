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
import type { BMCResult, CompetitorOverviewResult, RiskSettings } from "../types";

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
  extractedText: string;
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
  const extractionPath = `${basePath}/extracted-text.json`;

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
    extraction: {
      storagePath: extractionPath,
      // Keeps Canvas reopening independent from Storage downloads. The PDF and
      // full extraction are still retained in Storage as the source archive.
      inlineText: input.extractedText,
      characterCount: input.extractedText.length,
      extractedAt: serverTimestamp(),
    },
    processing: { status: "uploading", progress: 25 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const extraction = new Blob([JSON.stringify({ text: input.extractedText }, null, 2)], {
    type: "application/json",
  });

  try {
    await Promise.all([
      uploadBytes(ref(storage, pdfPath), input.file, {
        contentType: input.file.type || "application/pdf",
        customMetadata: { reportId: reportRef.id, ownerId },
      }),
      uploadBytes(ref(storage, extractionPath), extraction, {
        contentType: "application/json",
        customMetadata: { reportId: reportRef.id, ownerId },
      }),
    ]);
  } catch (error) {
    const message = storageUploadErrorMessage(error);
    await updateDoc(reportRef, {
      processing: { status: "failed", progress: 100, error: message, failedAt: serverTimestamp() },
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
    throw new Error(message);
  }

  await updateDoc(reportRef, {
    processing: { status: "uploaded", progress: 45 },
    updatedAt: serverTimestamp(),
  });
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
  settings: RiskSettings;
}) {
  if (!db || !input.reportId) return null;
  const evaluationRef = doc(collection(db, "reports", input.reportId, "evaluations"));

  await setDoc(evaluationRef, {
    reportId: input.reportId,
    model: { provider: "groq", modelName: "groq-chat-completions", promptVersion: "bmc-v1" },
    result: input.result,
    settings: input.settings,
    isSimulated: input.result.isSimulated,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "reports", input.reportId), {
    latestEvaluationId: evaluationRef.id,
    isSimulated: input.result.isSimulated,
    processing: { status: "completed", progress: 100, completedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
  return evaluationRef.id;
}

export async function markReportFailed(reportId: string | null, message: string) {
  if (!db || !reportId) return;
  await updateDoc(doc(db, "reports", reportId), {
    processing: { status: "failed", progress: 100, error: message, completedAt: serverTimestamp() },
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

  // Group-project mode: show reports already saved by teammates too.
  // If deployed Firebase rules still restrict reads to ownerId, fall back to
  // the current browser user so the page does not break.
  let snapshot;
  try {
    snapshot = await getDocs(collection(db, "reports"));
  } catch {
    snapshot = await getDocs(query(collection(db, "reports"), where("ownerId", "==", ownerId)));
  }

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
        status: data.processing?.status ?? "uploaded",
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

  let result: BMCResult | null = null;
  if (data.latestEvaluationId) {
    const evaluation = await getDoc(
      doc(db, "reports", reportId, "evaluations", data.latestEvaluationId),
    );
    if (evaluation.exists()) result = (evaluation.data().result as BMCResult | undefined) ?? null;
  }

  let comparisonResult: BMCResult | null = null;
  let competitorOverview: CompetitorOverviewResult | null = null;
  let comparisonOriginalName: string | undefined;
  const comparison = await getDoc(doc(db, "reports", reportId, "comparisons", "current"));
  if (comparison.exists()) {
    const comparisonData = comparison.data();
    comparisonResult = (comparisonData.result as BMCResult | undefined) ?? null;
    competitorOverview =
      (comparisonData.competitorOverview as CompetitorOverviewResult | undefined) ?? null;
    comparisonOriginalName = comparisonData.originalName;
  }

  // A completed Canvas already contains everything needed to reopen it, so do
  // not let an unrelated Storage timeout block the user.
  let extractedText = data.extraction?.inlineText ?? "";
  if (!result && !extractedText && data.extraction?.storagePath) {
    try {
      const bytes = await getBytes(ref(storage, data.extraction.storagePath), 25 * 1024 * 1024);
      const decoded = JSON.parse(new TextDecoder().decode(bytes)) as { text?: string };
      extractedText = decoded.text ?? "";
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
    status: data.processing?.status ?? "uploaded",
    isSimulated: result?.isSimulated,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    extractedText,
    result,
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
  await setDoc(
    doc(db, "reports", input.reportId, "comparisons", "current"),
    {
      result: input.result,
      companyName: input.result.companyName,
      originalName: input.originalName ?? "comparison.pdf",
      competitorOverview: input.competitorOverview ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await updateDoc(doc(db, "reports", input.reportId), {
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
  await updateDoc(reportRef, {
    "company.name": companyName.trim(),
    updatedAt: serverTimestamp(),
  });
  if (data.latestEvaluationId) {
    await updateDoc(doc(db, "reports", reportId, "evaluations", data.latestEvaluationId), {
      "result.companyName": companyName.trim(),
    });
  }
}

export async function deleteStoredReport(reportId: string) {
  if (!db || !storage) throw new Error("Firebase is not configured.");
  const currentStorage = storage;
  const reportRef = doc(db, "reports", reportId);
  const snapshot = await getDoc(reportRef);
  if (!snapshot.exists()) return;
  const data = snapshot.data();

  const evaluations = await getDocs(collection(db, "reports", reportId, "evaluations"));
  await Promise.all(evaluations.docs.map((evaluation) => deleteDoc(evaluation.ref)));
  await deleteDoc(doc(db, "reports", reportId, "comparisons", "current")).catch(() => undefined);

  const storagePaths = [data.file?.storagePath, data.extraction?.storagePath].filter(
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
