import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Stock } from "@/lib/cgsi-data";
import { EsgBadge, MatchBadge, RiskBadge } from "./badges";
import { useBehavior } from "@/lib/behavior-store";
import { MiniChart } from "./MiniChart";
import { getMarketSnapshot } from "@/lib/market-data.functions";
import type { MarketSnapshot } from "@/lib/market-data.types";

export function StockCard({ stock }: { stock: Stock }) {
  const { toggleCompare, compareList } = useBehavior();
  const [expanded, setExpanded] = useState(false);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState(false);
  const displayPrice = market?.price ?? stock.price;
  const displayChange = market?.changePercent ?? stock.change;
  const positive = displayChange >= 0;
  const inCompare = compareList.includes(stock.ticker);
  const currencySymbol = stock.exchange === "SGX" ? "S$" : "$";

  useEffect(() => {
    if (!expanded || market || marketLoading || marketError) return;

    let active = true;
    setMarketLoading(true);
    void getMarketSnapshot({
      data: {
        ticker: stock.ticker,
        exchange: stock.exchange,
        price: stock.price,
        change: stock.change,
        trend: stock.trend,
      },
    })
      .then((snapshot) => {
        if (active) setMarket(snapshot);
      })
      .catch(() => {
        if (active) setMarketError(true);
      })
      .finally(() => {
        if (active) setMarketLoading(false);
      });

    return () => {
      active = false;
    };
  }, [expanded, market, marketError, marketLoading, stock]);

  return (
    <Card className="p-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 font-mono text-sm font-semibold text-cgsi-navy">
              {stock.ticker}
            </span>
            <span className="truncate text-xs text-slate-700">{stock.name}</span>
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {stock.exchange} · {stock.sector}
          </div>
        </div>

        <EsgBadge strength={stock.esgStrength} score={stock.esgScore} />

        <div className="w-[68px] shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums text-slate-900">
            {currencySymbol}
            {displayPrice.toFixed(2)}
          </div>
          <div
            className={`text-[10px] font-medium ${positive ? "text-emerald-700" : "text-red-700"}`}
          >
            {positive ? "+" : ""}
            {displayChange.toFixed(2)}%
          </div>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="mt-3 border-t pt-3">
          <div className="mb-3 rounded-md bg-slate-50 px-2 py-1.5">
            <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wide text-muted-foreground">
              <span>30-session closing trend</span>
              <span className="inline-flex items-center gap-1">
                {marketLoading && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {marketLoading
                  ? "Loading provider"
                  : market
                    ? `${market.source} · ${market.cadence}`
                    : marketError
                      ? "Illustrative fallback"
                      : "Load on demand"}
              </span>
            </div>
            <MiniChart
              data={market?.trend.map((point) => point.close) ?? stock.trend}
              positive={positive}
            />
            {market && (
              <div
                className={`mt-1 text-[9px] ${
                  market.mode === "provider" ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {market.mode === "provider" ? `As of ${market.asOf}` : market.message}
              </div>
            )}
            {marketError && (
              <div className="mt-1 text-[9px] text-amber-700">
                Market service could not be reached; illustrative values remain visible.
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <RiskBadge level={stock.risk} />
            <MatchBadge score={stock.match} />
            <span className="ml-auto text-[10px] text-muted-foreground">
              Tap View for full ESG details
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
            {stock.description}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 flex-1 text-xs"
              onClick={() => toggleCompare(stock.ticker)}
            >
              {inCompare ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {inCompare ? "Added" : "Compare"}
            </Button>
            <Button
              asChild
              size="sm"
              className="h-8 flex-1 bg-cgsi-navy text-xs text-white hover:opacity-90"
            >
              <Link to="/stock/$ticker" params={{ ticker: stock.ticker }}>
                View Insights
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
