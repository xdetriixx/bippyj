import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useBehavior } from "@/lib/behavior-store";
import { useStocks } from "@/lib/stocks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EsgBadge, MatchBadge, RiskBadge } from "@/components/cgsi/badges";
import { AIPeerComparison } from "@/components/cgsi/AIPeerComparison";
import { X } from "lucide-react";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Stocks · CGSI" },
      {
        name: "description",
        content:
          "Compare up to three stocks side by side with ESG, risk, and AI-generated summary.",
      },
    ],
  }),
  component: Compare,
});

function Compare() {
  const { stocks: catalogue, getStock } = useStocks();
  const { compareList, toggleCompare, clearCompare } = useBehavior();
  const stocks = compareList.map((t) => getStock(t)).filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-cgsi-navy">Compare Stocks</h1>
            <p className="text-sm text-muted-foreground">
              Pick up to 3 stocks side by side. Add them from any stock card or the Top Matches
              page.
            </p>
          </div>
          {stocks.length > 0 && (
            <Button variant="ghost" onClick={clearCompare}>
              Clear all
            </Button>
          )}
        </div>

        {stocks.length === 0 ? (
          <Card className="p-10 text-center">
            <div className="text-sm text-muted-foreground">
              No stocks selected. Browse the{" "}
              <Link to="/dashboard" className="text-cgsi-navy underline">
                dashboard
              </Link>{" "}
              and tap “Compare” on any card.
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {catalogue.slice(0, 3).map((s) => (
                <Button key={s.ticker} variant="outline" onClick={() => toggleCompare(s.ticker)}>
                  + {s.ticker}
                </Button>
              ))}
            </div>
          </Card>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-cgsi-grey px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Metric
                    </th>
                    {stocks.map((s) => (
                      <th key={s.ticker} className="bg-white px-3 py-3 text-left">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-cgsi-navy">{s.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {s.ticker}
                            </div>
                          </div>
                          <button onClick={() => toggleCompare(s.ticker)} aria-label="Remove">
                            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&_td]:border-t [&_td]:px-3 [&_td]:py-3">
                  <Row label="Price">
                    {stocks.map((s) => (
                      <span key={s.ticker} className="font-medium tabular-nums">
                        {s.exchange === "SGX" ? "S$" : "$"}
                        {s.price.toFixed(2)}
                      </span>
                    ))}
                  </Row>
                  <Row label="Daily Change">
                    {stocks.map((s) => (
                      <span
                        key={s.ticker}
                        className={s.change >= 0 ? "text-emerald-700" : "text-red-700"}
                      >
                        {s.change >= 0 ? "+" : ""}
                        {s.change.toFixed(2)}%
                      </span>
                    ))}
                  </Row>
                  <Row label="ESG Score">
                    {stocks.map((s) => (
                      <EsgBadge key={s.ticker} strength={s.esgStrength} score={s.esgScore} />
                    ))}
                  </Row>
                  <Row label="Environmental">
                    {stocks.map((s) => (
                      <span key={s.ticker} className="tabular-nums">
                        {s.environmental}/100
                      </span>
                    ))}
                  </Row>
                  <Row label="Social">
                    {stocks.map((s) => (
                      <span key={s.ticker} className="tabular-nums">
                        {s.social}/100
                      </span>
                    ))}
                  </Row>
                  <Row label="Governance">
                    {stocks.map((s) => (
                      <span key={s.ticker} className="tabular-nums">
                        {s.governance}/100
                      </span>
                    ))}
                  </Row>
                  <Row label="Risk Level">
                    {stocks.map((s) => (
                      <RiskBadge key={s.ticker} level={s.risk} />
                    ))}
                  </Row>
                  <Row label="Match Score">
                    {stocks.map((s) => (
                      <MatchBadge key={s.ticker} score={s.match} />
                    ))}
                  </Row>
                  <Row label="Beginner Take">
                    {stocks.map((s) => (
                      <span key={s.ticker} className="block text-xs text-slate-600">
                        {s.beginnerSummary.meaning[0]}
                      </span>
                    ))}
                  </Row>
                </tbody>
              </table>
            </div>

            <AIPeerComparison stocks={stocks} catalogue={catalogue} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode[] }) {
  return (
    <tr>
      <td className="sticky left-0 bg-cgsi-grey text-xs font-medium text-muted-foreground">
        {label}
      </td>
      {children.map((c, i) => (
        <td key={i}>{c}</td>
      ))}
    </tr>
  );
}
