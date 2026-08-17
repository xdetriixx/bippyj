import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

type InvestorAnalysisFeature =
  | "simplified_esg_summary"
  | "impact_bridge"
  | "decision_brief"
  | "scenario_explorer"
  | "peer_comparison"
  | "recommendation"
  | "behavioural_nudge";

export function AIFeedback(_props: {
  feature: InvestorAnalysisFeature;
  tickers: string[];
  context?: string;
}) {
  const [selection, setSelection] = useState<boolean | null>(null);

  const submit = (helpful: boolean) => setSelection(helpful);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white px-3 py-2">
      <span className="mr-auto text-[11px] text-slate-600">
        {selection === null ? "Did this help your research?" : "Thanks for your feedback."}
      </span>
      <button
        type="button"
        aria-label="Mark this analysis as helpful"
        className={`rounded-md border p-1.5 ${selection === true ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "text-slate-500"}`}
        onClick={() => submit(true)}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Mark this analysis as not helpful"
        className={`rounded-md border p-1.5 ${selection === false ? "border-amber-300 bg-amber-50 text-amber-700" : "text-slate-500"}`}
        onClick={() => submit(false)}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
