import { useEffect, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { fetchPeerScans, type PeerScan } from "./workforcePeers";
import { PILLAR_KEYS, PILLAR_LABELS, type WorkforceStatus } from "./types";

/**
 * PeerBenchmark.tsx
 * ------------------------------------------------------------------
 * Places the current report against every other scanned company.
 *
 * Deliberately leads with the band distribution rather than a bare
 * ranking. In testing across four companies the scores clustered hard
 * at the bottom (0, 20, 20) with one outlier at 70, so a sorted table
 * of near-identical bars would have buried the actual finding: most
 * disclosures say nothing about workforce transition at all.
 *
 * The pillar strip on each row matters more than the composite. Two
 * companies both scoring 20 can fail for different reasons, and that
 * is the difference an advisor acts on.
 * ------------------------------------------------------------------
 */

const STATUS_ORDER: WorkforceStatus[] = [
  "Responsible",
  "Watch",
  "Caution",
  "Silent displacement",
];

const STATUS_STYLES: Record<WorkforceStatus, string> = {
  Responsible: "bg-emerald-50 text-emerald-700 border border-emerald-150",
  Watch: "bg-indigo-50 text-indigo-700 border border-indigo-150",
  Caution: "bg-amber-50 text-amber-700 border border-amber-150",
  "Silent displacement": "bg-rose-50 text-rose-700 border border-rose-150",
};

const STATUS_DOTS: Record<WorkforceStatus, string> = {
  Responsible: "bg-emerald-500",
  Watch: "bg-indigo-500",
  Caution: "bg-amber-500",
  "Silent displacement": "bg-rose-500",
};

function barColor(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 50) return "bg-indigo-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

interface PeerBenchmarkProps {
  /** Report id of the company currently open, so its row can be marked. */
  currentReportId: string | null;
}

export default function PeerBenchmark({ currentReportId }: PeerBenchmarkProps) {
  const [peers, setPeers] = useState<PeerScan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPeerScans()
      .then((results) => {
        if (!cancelled) setPeers(results);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Could not load peer scans.",
          );
        }
      });

    // Guards against setting state after the panel unmounts, which
    // happens when the advisor switches Canvas views mid-fetch.
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-[10px] leading-relaxed">
        {error}
      </div>
    );
  }

  if (!peers) {
    return (
      <div className="bg-white border p-5 text-center rounded-xl space-y-2">
        <RefreshCw className="w-5 h-5 text-[#F27D26] mx-auto animate-spin" />
        <p className="text-[9.5px] text-slate-400 font-sans">Loading peer scans...</p>
      </div>
    );
  }

  if (peers.length < 2) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-6 px-4 text-center space-y-1.5">
        <BarChart3 className="w-6 h-6 text-slate-300 mx-auto" />
        <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
          Scan at least two companies to compare them. Peer context is what turns a
          single score into a judgement.
        </p>
      </div>
    );
  }

  const belowThreshold = peers.filter(
    (p) => p.scan.status === "Silent displacement",
  ).length;

  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: peers.filter((p) => p.scan.status === status).length,
  })).filter((entry) => entry.count > 0);

  return (
    <div className="space-y-3 text-left">
      <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block">
        Peer Benchmark:
      </span>

      {/* Headline finding, not a ranking */}
      <div className="bg-white border border-slate-150 rounded-xl p-3.5 shadow-3xs space-y-3 border-l-4 border-l-[#F27D26]">
        <div className="flex items-center gap-1.5 border-b pb-2">
          <BarChart3 className="w-4 h-4 text-[#F27D26] shrink-0" />
          <span className="text-[10.5px] font-sans font-black text-slate-900 uppercase tracking-wider leading-none">
            Coverage Distribution
          </span>
        </div>

        <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
          <strong className="text-[#F27D26] font-mono text-sm">
            {belowThreshold} of {peers.length}
          </strong>{" "}
          companies scanned fall below the silent displacement threshold.
        </p>

        <div className="space-y-1.5">
          {counts.map(({ status, count }) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOTS[status]}`} />
              <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider w-[110px] shrink-0">
                {status}
              </span>
              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${STATUS_DOTS[status]}`}
                  style={{ width: `${(count / peers.length) * 100}%` }}
                />
              </div>
              <span className="text-[9px] font-mono font-bold text-slate-700 w-4 text-right shrink-0">
                {count}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[9px] text-slate-400 leading-relaxed font-sans">
          Scores measure what a company discloses, not what it does. Two companies in
          the same sector can differ sharply here on reporting practice alone.
        </p>
      </div>

      {/* Ranked rows with pillar detail */}
      <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block">
        Ranked by AI Workforce Score:
      </span>

      <div className="space-y-2">
        {peers.map((peer, index) => {
          const isCurrent = peer.reportId === currentReportId;
          return (
            <div
              key={peer.reportId}
              className={`border rounded-lg p-3 space-y-2.5 text-left ${
                isCurrent
                  ? "bg-orange-50/40 border-orange-150"
                  : "bg-slate-50 border-slate-150"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[8.5px] font-mono font-bold text-slate-400 shrink-0">
                    {index + 1}.
                  </span>
                  <span className="text-[10px] font-extrabold text-slate-900 truncate">
                    {peer.companyName}
                  </span>
                  {isCurrent && (
                    <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-[#F27D26] text-white shrink-0">
                      Open
                    </span>
                  )}
                </div>
                <span
                  className={`text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none shrink-0 ${STATUS_STYLES[peer.scan.status]}`}
                >
                  {peer.scan.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-lg font-black font-mono text-slate-900 leading-none w-8 shrink-0">
                  {peer.scan.overallScore}
                </span>
                <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor(peer.scan.overallScore)}`}
                    style={{ width: `${peer.scan.overallScore}%` }}
                  />
                </div>
              </div>

              {/* Pillar strip. Two companies on the same composite can fail
                  for different reasons, and that is the actionable part. */}
              <div className="grid grid-cols-3 gap-1.5">
                {PILLAR_KEYS.map((key) => (
                  <div
                    key={key}
                    className="bg-white border border-slate-200/80 rounded px-1.5 py-1 text-center"
                  >
                    <span className="block text-[6.5px] font-mono text-slate-400 uppercase leading-tight truncate">
                      {PILLAR_LABELS[key].split(" ")[0]}
                    </span>
                    <span className="block text-[10px] font-black font-mono text-slate-800 leading-none mt-0.5">
                      {peer.scan[key].score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
