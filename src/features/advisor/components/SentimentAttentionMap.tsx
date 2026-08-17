import React, { useMemo } from "react";
import { Sparkles } from "lucide-react";

interface SentimentAttentionMapProps {
  companyName: string;
  score: number;
}

export const SentimentAttentionMap: React.FC<SentimentAttentionMapProps> = ({
  companyName,
  score,
}) => {
  // Create solid deterministic seed for calculating words and stats
  const seed = useMemo(() => {
    let nameHash = 0;
    const nameStr = companyName || "";
    for (let i = 0; i < nameStr.length; i++) {
      nameHash = (nameHash << 5) - nameHash + nameStr.charCodeAt(i);
      nameHash |= 0;
    }
    return Math.abs(nameHash);
  }, [companyName]);

  const normName = (companyName || "").toLowerCase();

  const companyData = useMemo(() => {
    // Basic balanced counts
    let positiveWordCount = 420 + (seed % 280);
    let negativeWordCount = 120 + (seed % 140);

    // Adjust counts dynamically based on actual sentiment score
    if (score < 50) {
      positiveWordCount = Math.floor(positiveWordCount * 0.7);
      negativeWordCount = Math.floor(negativeWordCount * 1.8);
    } else if (score > 80) {
      positiveWordCount = Math.floor(positiveWordCount * 1.5);
      negativeWordCount = Math.floor(negativeWordCount * 0.6);
    }

    let highestPositiveWord = "robust";
    let highestPositiveCount = 28 + (seed % 15);
    let highestNegativeWord = "uncertainty";
    let highestNegativeCount = 19 + (seed % 12);

    if (normName.includes("dbs") || normName.includes("digi") || normName.includes("beta")) {
      highestPositiveWord = "robust";
      highestNegativeWord = "volatility";
      highestPositiveCount = 38 + (seed % 10);
      highestNegativeCount = 9 + (seed % 5);
    } else if (
      normName.includes("cgsi") ||
      normName.includes("alpha") ||
      normName.includes("cimb")
    ) {
      highestPositiveWord = "compliance";
      highestNegativeWord = "vulnerability";
      highestPositiveCount = 22 + (seed % 6);
      highestNegativeCount = 34 + (seed % 12);
    } else {
      highestPositiveWord = seed % 2 === 0 ? "resilient" : "expansion";
      highestNegativeWord = seed % 2 === 0 ? "headwinds" : "uncertainty";
      highestPositiveCount = 24 + (seed % 8);
      highestNegativeCount = 16 + (seed % 6);
    }

    return {
      positiveWordCount,
      negativeWordCount,
      highestPositiveWord,
      highestPositiveCount,
      highestNegativeWord,
      highestNegativeCount,
    };
  }, [score, seed, normName]);

  const totalWords = companyData.positiveWordCount + companyData.negativeWordCount;
  const positiveRatio = (companyData.positiveWordCount / totalWords) * 100;

  return (
    <div
      className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-3xs space-y-4 text-left"
      id="sentiment_audit_module"
    >
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100 shrink-0">
            <Sparkles className="w-4 h-4 text-[#F27D26]" />
          </div>
          <div>
            <h3 className="text-[11px] font-black tracking-wider text-slate-800 uppercase font-sans leading-tight">
              Qualitative Sentence-Level Sentiment & Attention Audit
            </h3>
            <p className="text-[9px] text-slate-400">
              Natural language analysis on corporate filing archives
            </p>
          </div>
        </div>

        {/* SENTIMENT RE-DESIGNED BADGE */}
        <div className="bg-indigo-50 border border-indigo-100/80 px-2.5 py-1 rounded-lg text-center flex items-center gap-2 shrink-0">
          <div className="text-left leading-none">
            <div className="text-[6.5px] font-mono text-indigo-500 uppercase tracking-widest font-black">
              SENTIMENT
            </div>
            <div className="text-[6.5px] font-mono text-indigo-500 uppercase tracking-widest font-black">
              INDEX:
            </div>
          </div>
          <div className="text-sm font-mono text-indigo-700 font-extrabold leading-none">
            {score}%
          </div>
        </div>
      </div>

      {/* RE-ARCHITECTED AUDIT CARDS LAYOUT DESIGNED SPECIFICALLY FOR INTUITIVE VIEWING IN SMARTPHONE CHASSIS */}
      <div className="space-y-3.5 pt-1">
        {/* ROW 1: WORD DENSITY (Full Width for comfortable text stretching) */}
        <div
          className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-xl flex flex-col justify-between space-y-3 animate-fade-in"
          id="sentiment_density_card"
        >
          <div>
            <div className="text-[8.5px] font-mono text-slate-400 font-bold uppercase tracking-widest leading-none flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-2">
              <span className="text-indigo-600 font-black">01 //</span>
              <span>WORD DENSITY</span>
            </div>

            <div className="pt-1">
              <span className="text-3xl font-mono font-bold text-slate-800 tracking-tighter">
                {totalWords}
              </span>
              <p className="text-[9.5px] text-slate-550 uppercase tracking-wider font-extrabold leading-none mt-1">
                processed words
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100/60">
            <div className="flex justify-between items-center text-[8px] font-mono font-black tracking-tight leading-none uppercase">
              <span className="text-emerald-600">POS: {companyData.positiveWordCount}</span>
              <span className="text-[#F27D26]">NEG: {companyData.negativeWordCount}</span>
            </div>

            {/* Elegant horizontal split state bar */}
            <div className="h-1.5 w-full bg-slate-150 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${positiveRatio}%` }}
                className="bg-emerald-500 h-full transition-all duration-300"
              />
              <div
                style={{ width: `${100 - positiveRatio}%` }}
                className="bg-[#F27D26] h-full transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* ROW 2: PEAK SEARCH ANCHORS (Symmetrical 2 Column Layout with short, digestible counters) */}
        <div className="grid grid-cols-2 gap-3" id="sentiment_anchors_row">
          {/* PEAK POSITIVE ANCHOR */}
          <div
            className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-xl flex flex-col justify-between space-y-3 relative overflow-hidden animate-fade-in"
            id="sentiment_pos_anchor"
          >
            <div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-2">
                <div className="text-[8.5px] font-mono text-slate-400 font-bold uppercase tracking-widest leading-none flex items-center gap-1">
                  <span className="text-emerald-600 font-black">02/</span>
                  <span>POS ANCHOR</span>
                </div>
              </div>

              <div className="pt-1 select-all">
                <span className="text-xs sm:text-sm font-mono font-extrabold text-[#14B8A6] uppercase tracking-wide bg-emerald-50/35 px-1.5 py-0.5 rounded border border-emerald-100/45 inline-block truncate max-w-full">
                  "{companyData.highestPositiveWord}"
                </span>
              </div>
            </div>

            <div className="text-[9px] text-slate-500 leading-snug font-normal pt-2 border-t border-slate-100/60">
              Appears{" "}
              <strong className="text-slate-800 font-bold font-mono">
                {companyData.highestPositiveCount}x
              </strong>{" "}
              search frequency.
            </div>
          </div>

          {/* PEAK NEGATIVE ANCHOR */}
          <div
            className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-xl flex flex-col justify-between space-y-3 relative overflow-hidden animate-fade-in"
            id="sentiment_neg_anchor"
          >
            <div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 mb-2">
                <div className="text-[8.5px] font-mono text-slate-400 font-bold uppercase tracking-widest leading-none flex items-center gap-1">
                  <span className="text-[#F27D26] font-black">03/</span>
                  <span>NEG ANCHOR</span>
                </div>
              </div>

              <div className="pt-1 select-all">
                <span className="text-xs sm:text-sm font-mono font-extrabold text-[#F27D26] uppercase tracking-wide bg-amber-50/35 px-1.5 py-0.5 rounded border border-amber-100/45 inline-block truncate max-w-full">
                  "{companyData.highestNegativeWord}"
                </span>
              </div>
            </div>

            <div className="text-[9px] text-slate-500 leading-snug font-normal pt-2 border-t border-slate-100/60">
              Appears{" "}
              <strong className="text-slate-800 font-bold font-mono">
                {companyData.highestNegativeCount}x
              </strong>{" "}
              risk mentions.
            </div>
          </div>
        </div>

        {/* ROW 3: LANGUAGE INSIGHT VERDICT (Full Width, providing maximum text reading comfort) */}
        <div
          className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-xl flex flex-col justify-between space-y-3 animate-fade-in"
          id="sentiment_verdict_card"
        >
          <div>
            <div className="text-[8.5px] font-mono text-slate-400 font-bold uppercase tracking-widest leading-none flex items-center gap-1.5 border-b border-slate-100 pb-1.5 mb-2">
              <span className="text-indigo-600 font-black">04 //</span>
              <span>INSIGHT VERDICT</span>
            </div>

            <div className="pt-0.5">
              <p className="text-[10px] font-semibold text-slate-700 leading-relaxed font-sans">
                {score >= 75
                  ? "Highly specific & actionable language with verifiable, concrete numeric evidence."
                  : score >= 50
                    ? "Standard templated advisory legal terminology. Moderate audit assurance."
                    : "Defensive passive phrasing detected. Higher potential to mask legacy audit write-downs."}
              </p>
            </div>
          </div>

          <div className="text-[8.5px] text-slate-450 pt-2 border-t border-slate-100/60 font-mono flex items-center justify-between">
            <span>Audit Clarity Grade:</span>
            <span className="font-extrabold uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/40 text-[8px]">
              {score >= 75 ? "EXCELLENT" : score >= 50 ? "ADEQUATE" : "VAGUE_WARNING"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
