import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { useBehavior } from "@/lib/behavior-store";
import { EsgBadge, MatchBadge, RiskBadge } from "./badges";
import { useEffect, useState } from "react";
import { getAIRecommendationCopy } from "@/lib/cgsi-ai.functions";

export function RecommendationPopup() {
  const { recommendation, dismissRecommendation, setPref, bias } = useBehavior();
  const [aiReason, setAiReason] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setAiReason(null);
    if (!recommendation)
      return () => {
        active = false;
      };

    const { stock, matchScore, basis } = recommendation;
    void getAIRecommendationCopy({
      data: {
        stock: {
          ticker: stock.ticker,
          name: stock.name,
          sector: stock.sector,
          risk: stock.risk,
          esgStrength: stock.esgStrength,
          esgScore: stock.esgScore,
          analystNote: stock.analystNote,
        },
        matchScore,
        basis,
        bias,
      },
    })
      .then((result) => {
        if (active) {
          setAiReason(result.reason);
        }
      })
      .catch(() => {
        /* Keep the deterministic recommendation as a resilient fallback. */
      });

    return () => {
      active = false;
    };
  }, [recommendation, bias]);

  if (!recommendation) return null;
  const { stock, reason, matchScore, basis } = recommendation;

  return (
    <div className="fixed bottom-3 right-3 z-50 w-[260px] max-w-[calc(100vw-1.5rem)] animate-in slide-in-from-bottom-4 fade-in sm:w-[320px]">
      <Card className="overflow-hidden border-indigo-200 p-0 text-xs shadow-xl">
        <div className="flex items-center justify-between bg-cgsi-navy px-3 py-2 text-white">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            AI Recommendation
          </div>
          <button onClick={dismissRecommendation} aria-label="Dismiss">
            <X className="h-3.5 w-3.5 opacity-80 hover:opacity-100" />
          </button>
        </div>
        <div className="space-y-2 p-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Recommended for you
            </div>
            <div className="text-sm font-semibold leading-tight text-cgsi-navy">
              {stock.name}{" "}
              <span className="font-mono text-[11px] text-muted-foreground">({stock.ticker})</span>
            </div>
          </div>
          <p className="line-clamp-3 text-[11px] leading-snug text-slate-700">
            {aiReason ?? reason}
          </p>
          {basis.length > 0 && (
            <div className="rounded-md border bg-slate-50 p-2">
              <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Why this was suggested
              </div>
              <ul className="mt-0.5 space-y-0 text-[10px] text-slate-700">
                {basis.slice(0, 3).map((b) => (
                  <li key={b} className="flex gap-1">
                    <span className="text-cgsi-green">•</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            <MatchBadge score={matchScore} />
            <EsgBadge strength={stock.esgStrength} score={stock.esgScore} />
            <RiskBadge level={stock.risk} />
          </div>
          <div className="flex gap-1.5 pt-0.5">
            <Button
              asChild
              size="sm"
              className="h-7 flex-1 bg-cgsi-navy px-2 text-[11px] text-white hover:opacity-90"
            >
              <Link
                to="/stock/$ticker"
                params={{ ticker: stock.ticker }}
                onClick={dismissRecommendation}
              >
                View
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={dismissRecommendation}
            >
              Dismiss
            </Button>
          </div>
          <button
            onClick={() => {
              setPref("disableRecommendation", true);
              dismissRecommendation();
            }}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:text-cgsi-navy hover:underline"
          >
            Do not show again
          </button>
        </div>
      </Card>
    </div>
  );
}
