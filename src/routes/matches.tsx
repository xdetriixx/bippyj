import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import type { Stock } from "@/lib/cgsi-data";
import { useStocks } from "@/lib/stocks";
import { useBehavior } from "@/lib/behavior-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EsgBadge, MatchBadge, RiskBadge } from "@/components/cgsi/badges";
import { Sparkles } from "lucide-react";
import {
  calculatePersonalMatch,
  getDominantPreferences,
  type PersonalMatchResult,
} from "@/lib/personalized-match";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "Top Matched Stocks · CGSI" },
      {
        name: "description",
        content:
          "Your AI-personalised top matched stocks based on your ESG preference, risk tolerance, and behaviour.",
      },
    ],
  }),
  component: Matches,
});

function Matches() {
  const { stocks } = useStocks();
  const { bias, recentViews, toggleCompare, compareList } = useBehavior();
  const preferences = getDominantPreferences(bias);

  // Rank using the same normalized preference-alignment model shown on stock pages.
  const ranked = [...stocks]
    .map((stock) => ({ stock, match: calculatePersonalMatch(stock, preferences) }))
    .sort((a, b) => b.match.score - a.match.score);

  const reasonFor = (stock: Stock, match: PersonalMatchResult) => {
    const matched = match.dimensions.filter(
      (dimension) => dimension.target !== null && dimension.matched,
    );
    if (matched.length === 0) {
      return `Ranked mainly from its base match score; it does not currently match your dominant browsing preferences.`;
    }

    return `Matches ${matched.map((dimension) => `${dimension.label.toLowerCase()} (${dimension.companyValue})`).join(", ")}; ${match.matchedCount} of ${match.availableCount} dominant preferences aligned.`;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-cgsi-green-soft px-3 py-1 text-xs font-medium text-emerald-800">
            <Sparkles className="h-3.5 w-3.5" />
            Explainable matching
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-cgsi-navy">Top Matched Stocks</h1>
          <p className="text-sm text-muted-foreground">
            Built from your ESG preference, risk tolerance, sector interest, and recent browsing
            behaviour
            {recentViews.length > 0 ? ` (${recentViews.length} recent views).` : "."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {ranked.map(({ stock, match }, i) => (
            <Card
              key={stock.ticker}
              className="flex flex-col gap-4 p-5 md:flex-row md:items-center"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cgsi-navy text-lg font-semibold text-white">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <div className="font-semibold text-cgsi-navy">{stock.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{stock.ticker}</div>
                  <div className="text-xs text-muted-foreground">· ${stock.price.toFixed(2)}</div>
                </div>
                <p className="mt-1 text-sm text-slate-600">{reasonFor(stock, match)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <MatchBadge score={match.score} />
                  <EsgBadge strength={stock.esgStrength} score={stock.esgScore} />
                  <RiskBadge level={stock.risk} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 md:w-48">
                <Button asChild className="bg-cgsi-navy text-white hover:opacity-90">
                  <Link to="/stock/$ticker" params={{ ticker: stock.ticker }}>
                    View ESG Insight
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toggleCompare(stock.ticker)}
                  disabled={!compareList.includes(stock.ticker) && compareList.length >= 3}
                >
                  {compareList.includes(stock.ticker) ? "Remove from Compare" : "Add to Compare"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
