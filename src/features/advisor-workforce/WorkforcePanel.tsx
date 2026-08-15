import { useState } from "react";
import { AlertTriangle, Download, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { scanWorkforce } from "./workforce.functions";
import { storeWorkforceScan, type StoredWorkforceScan } from "./workforcePersistence";
import { PILLAR_KEYS, PILLAR_LABELS, weakestPillar, type WorkforceStatus } from "./types";
import { downloadWorkforceReport } from "./workforceExport";
import PeerBenchmark from "./PeerBenchmark";
import WorkforceHowItWorks from "./WorkforceHowItWorks";

/**
 * WorkforcePanel.tsx
 * ------------------------------------------------------------------
 * The AI Workforce Transition Tracker view. Renders as the third
 * option in the Canvas segmented control, alongside the BMC board and
 * the Chronos temporal auditor.
 *
 * Same uploaded document, a different lens. The BMC lens answers what
 * the business model is. This lens answers what the company is doing
 * to its workers, which ESG Social metrics were not designed to see.
 *
 * All styling is lifted from the existing markup in App.tsx so the
 * panel is indistinguishable from the rest of the advisor UI. No new
 * CSS, no new component library.
 * ------------------------------------------------------------------
 */

interface WorkforcePanelProps {
  /** Text extracted client side by utils/pdf.ts. Empty means nothing to scan. */
  sourceText: string;
  companyName: string;
  /** Firestore report id, or null if the report has not been saved. */
  reportId: string | null;
  /** A scan already saved on this report, if one exists. */
  savedScan?: StoredWorkforceScan | null;
  /** Optional band overrides assembled from the Rules tab. */
  thresholdInstruction?: string;
}

const STATUS_STYLES: Record<WorkforceStatus, string> = {
  Responsible: "bg-emerald-50 text-emerald-700 border border-emerald-150",
  Watch: "bg-indigo-50 text-indigo-700 border border-indigo-150",
  Caution: "bg-amber-50 text-amber-700 border border-amber-150",
  "Silent displacement": "bg-rose-50 text-rose-700 border border-rose-150",
};

function barColor(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 50) return "bg-indigo-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

export default function WorkforcePanel({
  sourceText,
  companyName,
  reportId,
  savedScan = null,
  thresholdInstruction,
}: WorkforcePanelProps) {
  const [scan, setScan] = useState<StoredWorkforceScan | null>(savedScan);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScan() {
    setIsScanning(true);
    setError(null);
    try {
      const response = await scanWorkforce({
        data: { customText: sourceText, companyName, thresholdInstruction },
      });
      setScan(response.result);
      // Persistence is best effort. A Firestore failure should not
      // discard a scan the advisor is already looking at.
      await storeWorkforceScan({ reportId, result: response.result }).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The workforce scan failed.");
    } finally {
      setIsScanning(false);
    }
  }

  // Nothing saved and nothing to scan. Matches the empty states on the
  // Canvas and Compare tabs, including their wording and button style.
  if (!scan && (!sourceText || sourceText.trim().length < 200)) {
    return (
      <div className="text-center py-16 space-y-3">
        <Users className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="text-xs font-sans font-bold text-slate-500 uppercase tracking-widest">
          No Workforce Scan Yet
        </h3>
        <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
          Analyse your primary document in the <strong>Reports Portal</strong> tab first.
        </p>
      </div>
    );
  }

  const weakest = scan ? weakestPillar(scan) : null;

  return (
    <div className="space-y-3.5 animate-fade-in text-left">
<div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase tracking-widest">
          AI Workforce Transition Tracker:
        </span>
        <WorkforceHowItWorks />
      </div>
      {/* Dark header card, same treatment as the Reports and History headers */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <Users className="absolute -right-3 -bottom-3 w-24 h-24 opacity-10" />
        <div className="relative space-y-1">
          <div className="bg-slate-800 px-2 py-0.5 text-[8px] tracking-widest font-mono font-bold uppercase rounded-sm inline-block">
            ESG Social Blind Spot
          </div>
          <h2 className="text-base font-bold tracking-tight">AI Workforce Score</h2>
          <p className="text-[10px] text-slate-300 leading-relaxed max-w-xs">
            Scans the same disclosure for reskilling investment, displacement risk, and new role
            creation. Surfaces what a clean ESG Social score cannot.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-[10px] leading-relaxed">
          {error}
        </div>
      )}

      {!scan && !isScanning && (
        <button
          type="button"
          onClick={() => void runScan()}
          className="w-full bg-slate-900 hover:bg-black text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-98"
        >
          Run Workforce Scan <Users className="w-3.5 h-3.5" />
        </button>
      )}

      {isScanning && (
        <div className="bg-white border p-6 text-center rounded-xl space-y-3">
          <RefreshCw className="w-6 h-6 text-[#F27D26] mx-auto animate-spin" />
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-650 animate-pulse">
            Scanning Workforce Signals
          </h4>
          <p className="text-[9.5px] text-slate-400 leading-normal max-w-[220px] mx-auto">
            Extracting reskilling, headcount, and automation disclosures from the report.
          </p>
        </div>
      )}

      {scan && (
        <div className="space-y-3.5 animate-slide-in">
          {/* Composite score */}
          <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-3xs space-y-4 border-l-4 border-l-[#F27D26]">
            <div className="flex items-center justify-between border-b pb-2 leading-none">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#F27D26] shrink-0" />
                <span className="text-[11px] font-sans font-black text-slate-900 uppercase tracking-wider block">
                  Composite Workforce Score
                </span>
              </div>
              <span
                className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${STATUS_STYLES[scan.status]}`}
              >
                {scan.status}
              </span>
            </div>

            <div className="flex items-end justify-between">
              <span className="text-3xl font-black font-mono text-slate-900 leading-none">
                {scan.overallScore}
                <span className="text-xs font-normal font-sans text-slate-400"> / 100</span>
              </span>
              <span className="text-[8.5px] font-mono text-slate-400 uppercase tracking-wider">
                {scan.company}
              </span>
            </div>

            <div className="bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(scan.overallScore)}`}
                style={{ width: `${scan.overallScore}%` }}
              />
            </div>
          </div>

          {/* Three pillars */}
          <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block">
            Pillar Breakdown:
          </span>

          <div className="space-y-2.5">
            {PILLAR_KEYS.map((key, index) => {
              const pillar = scan[key];
              return (
                <div
                  key={key}
                  className="bg-slate-50 border border-slate-150 p-3.5 rounded-lg space-y-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${barColor(pillar.score)}`}
                      />
                      <span className="text-[9.5px] text-slate-455 font-extrabold uppercase tracking-wider leading-none truncate">
                        {index + 1}. {PILLAR_LABELS[key]}
                      </span>
                    </div>
                    <span className="text-[8.5px] font-black font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-wide leading-none bg-white border border-slate-200 text-slate-700 shrink-0">
                      {pillar.label}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-mono text-slate-500">
                      <span className="uppercase tracking-wider">Score</span>
                      <span className="font-extrabold text-slate-900">{pillar.score}</span>
                    </div>
                    <div className="bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${barColor(pillar.score)}`}
                        style={{ width: `${pillar.score}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-650 leading-relaxed font-sans">
                    {pillar.findings}
                  </p>

                  {key === "displacementRisk" && (
                    <p className="text-[8.5px] text-slate-400 font-mono leading-none">
                      A lower score here means higher risk.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Silent displacement callout, derived rather than stored */}
          {scan.status === "Silent displacement" && weakest && (
            <div className="bg-rose-50/60 border border-rose-150 p-3 rounded-xl space-y-1">
              <span className="text-[8.5px] font-sans font-extrabold text-rose-600 uppercase tracking-widest flex items-center gap-1 leading-none">
                <AlertTriangle className="w-3 h-3 text-rose-600" /> Silent Displacement Alert
              </span>
              <p className="text-[10px] text-rose-950 font-sans leading-relaxed">
                <strong>{weakest.label}:</strong> {weakest.pillar.findings}
              </p>
            </div>
          )}

          {/* Advisor recommendation */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1.5">
            <span className="text-[8px] font-sans font-extrabold text-[#F27D26] uppercase tracking-wider block">
              Advisor Recommendation:
            </span>
            <p className="text-[10.5px] text-slate-650 leading-relaxed font-sans">
              {scan.recommendation}
            </p>
          </div>

          {/* Action buttons */}
          <button
            type="button"
            onClick={() => downloadWorkforceReport(scan)}
            className="w-full bg-slate-900 hover:bg-black text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-98"
          >
            <Download className="w-3.5 h-3.5" /> Export Client Report
          </button>

          {sourceText.trim().length >= 200 && (
            <button
              type="button"
              onClick={() => void runScan()}
              className="w-full border border-slate-350 hover:bg-slate-50 text-slate-750 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Rescan Document
            </button>
          )}

          {/* Cross-report comparison. A score in isolation is not a
              judgement, which is the point of E4 in the validation
              report. */}
          <div className="pt-2 border-t border-slate-200">
            <PeerBenchmark currentReportId={reportId} />
          </div>
        </div>
      )}
    </div>
  );
}
