import { Link, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, X } from "lucide-react";
import { useBehavior } from "@/lib/behavior-store";
import { useEffect, useState } from "react";
import { getAIBehavioralNudge } from "@/lib/cgsi-ai.functions";

export function NudgePopup() {
  const { fatigueTrigger, recentViews, dismissNudge, bias, compareList, setPref } = useBehavior();
  const navigate = useNavigate();
  const [aiNudge, setAiNudge] = useState<{ title: string; body: string } | null>(null);

  const uniqueCount = new Set(recentViews.map((v) => v.ticker)).size;
  const highRiskHeavy = (bias.risk["High"] ?? 0) >= 4;
  const title = highRiskHeavy
    ? "Slow down and compare carefully"
    : "You may be experiencing decision fatigue";
  const body = highRiskHeavy
    ? "You have switched between several high-risk stocks quickly. Consider comparing your top choices before making a decision."
    : `You have viewed ${uniqueCount} different stocks in the last 10 minutes. Looking at too many options at once may make it harder to make a confident investment decision.`;

  useEffect(() => {
    let active = true;
    setAiNudge(null);
    if (!fatigueTrigger)
      return () => {
        active = false;
      };

    void getAIBehavioralNudge({
      data: {
        uniqueStockCount: uniqueCount,
        highRiskCount: bias.risk["High"] ?? 0,
        compareCount: compareList.length,
        bias,
      },
    })
      .then((result) => {
        if (active) {
          setAiNudge(result);
        }
      })
      .catch(() => {
        /* Keep the local nudge when Groq is unavailable. */
      });

    return () => {
      active = false;
    };
  }, [fatigueTrigger, uniqueCount, compareList.length, bias]);

  if (!fatigueTrigger) return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 w-[260px] max-w-[calc(100vw-1.5rem)] animate-in slide-in-from-bottom-4 fade-in sm:w-[340px]">
      <Card className="overflow-hidden border-amber-200 p-0 shadow-xl">
        <div className="flex items-center justify-between bg-amber-500 px-3 py-2 text-white">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Brain className="h-3.5 w-3.5" />
            Behavioural Nudge
          </div>
          <button onClick={dismissNudge} aria-label="Dismiss">
            <X className="h-3.5 w-3.5 opacity-80 hover:opacity-100" />
          </button>
        </div>
        <div className="space-y-2 p-3">
          <div className="text-xs font-semibold text-cgsi-navy">{aiNudge?.title ?? title}</div>
          <p className="line-clamp-4 text-[11px] leading-snug text-slate-700">
            {aiNudge?.body ?? body}
          </p>
          <div className="rounded-md bg-amber-50 p-1.5 text-[10px] text-amber-900">
            <span className="font-medium">Next:</span> pick one focused action.
          </div>
          <div className="flex flex-wrap gap-1 pt-0.5">
            <Button
              size="sm"
              className="h-7 bg-cgsi-navy px-2 text-[11px] text-white hover:opacity-90"
              onClick={() => {
                dismissNudge();
                navigate({ to: "/matches" });
              }}
            >
              Top 3 Matches
            </Button>
            <Button
              size="sm"
              asChild
              variant="outline"
              className="h-7 px-2 text-[11px]"
              disabled={compareList.length < 2}
            >
              <Link to="/compare" onClick={dismissNudge}>
                Compare ({compareList.length})
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={dismissNudge}
            >
              Continue
            </Button>
          </div>
          <button
            onClick={() => {
              setPref("disableNudge", true);
              dismissNudge();
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
