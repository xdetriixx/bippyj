import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Leaf,
  Loader2,
  Scale,
  ShieldCheck,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Stock } from "@/lib/cgsi-data";
import { getMarketSnapshot } from "@/lib/market-data.functions";
import type { MarketSnapshot } from "@/lib/market-data.types";
import {
  usePortfolioTransactions,
  type PortfolioCurrency,
  type PortfolioHolding,
} from "@/lib/portfolio";
import { useStocks } from "@/lib/stocks";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "My Simulated Portfolio · CGSI" },
      {
        name: "description",
        content: "Review simulated holdings, performance, concentration, and ESG exposure.",
      },
    ],
  }),
  component: PortfolioRoute,
});

type HoldingView = PortfolioHolding & {
  stock: Stock;
  market: MarketSnapshot | null;
  currentPrice: number;
  currentValue: number;
  unrealizedGain: number;
  returnPercent: number;
};

function PortfolioRoute() {
  const { stocks, loading: stocksLoading } = useStocks();
  const { transactions, holdings, loading, error, recordTransaction } = usePortfolioTransactions();
  const [markets, setMarkets] = useState<Record<string, MarketSnapshot>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const tickerKey = holdings
    .map((holding) => holding.ticker)
    .sort()
    .join("|");

  useEffect(() => {
    let active = true;
    const heldStocks = holdings
      .map((holding) => stocks.find((stock) => stock.ticker === holding.ticker))
      .filter((stock): stock is Stock => Boolean(stock));
    if (heldStocks.length === 0) {
      setMarkets({});
      setPricesLoading(false);
      return () => {
        active = false;
      };
    }

    setPricesLoading(true);
    void Promise.all(
      heldStocks.map(async (stock) => {
        const market = await getMarketSnapshot({
          data: {
            ticker: stock.ticker,
            exchange: stock.exchange,
            price: stock.price,
            change: stock.change,
            trend: stock.trend,
          },
        });
        return [stock.ticker, market] as const;
      }),
    )
      .then((entries) => {
        if (active) setMarkets(Object.fromEntries(entries));
      })
      .finally(() => {
        if (active) setPricesLoading(false);
      });

    return () => {
      active = false;
    };
    // tickerKey represents the holdings set without retriggering on reconstructed object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks, tickerKey]);

  const holdingViews = useMemo<HoldingView[]>(
    () =>
      holdings.flatMap((holding) => {
        const stock = stocks.find((candidate) => candidate.ticker === holding.ticker);
        if (!stock) return [];
        const market: MarketSnapshot | null = markets[holding.ticker] ?? null;
        const currentPrice = market?.price ?? stock.price;
        const currentValue = holding.quantity * currentPrice;
        const unrealizedGain = currentValue - holding.costBasis;
        const view: HoldingView = {
          ...holding,
          stock,
          market,
          currentPrice,
          currentValue,
          unrealizedGain,
          returnPercent: holding.costBasis > 0 ? (unrealizedGain / holding.costBasis) * 100 : 0,
        };
        return [view];
      }),
    [holdings, markets, stocks],
  );

  const summaries = useMemo(
    () =>
      (["SGD", "USD"] as PortfolioCurrency[])
        .map((currency) => {
          const currencyHoldings = holdingViews.filter((holding) => holding.currency === currency);
          const costBasis = currencyHoldings.reduce((sum, holding) => sum + holding.costBasis, 0);
          const currentValue = currencyHoldings.reduce(
            (sum, holding) => sum + holding.currentValue,
            0,
          );
          return {
            currency,
            holdingCount: currencyHoldings.length,
            costBasis,
            currentValue,
            gain: currentValue - costBasis,
            returnPercent: costBasis > 0 ? ((currentValue - costBasis) / costBasis) * 100 : 0,
          };
        })
        .filter((summary) => summary.holdingCount > 0),
    [holdingViews],
  );

  const ranked = useMemo(
    () => [...holdingViews].sort((left, right) => right.returnPercent - left.returnPercent),
    [holdingViews],
  );
  const averageEsg = holdingViews.length
    ? holdingViews.reduce((sum, holding) => sum + holding.stock.esgScore, 0) / holdingViews.length
    : 0;
  const largestSector = useMemo(() => {
    const counts = new Map<string, number>();
    holdingViews.forEach((holding) =>
      counts.set(holding.stock.sector, (counts.get(holding.stock.sector) ?? 0) + 1),
    );
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0] ?? null;
  }, [holdingViews]);
  const alerts = useMemo(() => buildPortfolioAlerts(holdingViews), [holdingViews]);
  const pageLoading = loading || stocksLoading;

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] text-indigo-900">
          <span className="font-semibold">Learning simulation only.</span> No real securities are
          purchased, no money is transferred, and fractional shares are illustrative.
        </div>

        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-5 w-5 text-cgsi-navy" />
              <h1 className="text-lg font-semibold text-cgsi-navy">My Portfolio</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {holdingViews.length} open holding{holdingViews.length === 1 ? "" : "s"} ·{" "}
              {transactions.length} transaction{transactions.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex h-8 items-center rounded-md border bg-white px-3 text-xs font-medium text-cgsi-navy"
          >
            Browse stocks
          </Link>
        </div>

        {pageLoading ? (
          <Card className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your simulated portfolio
          </Card>
        ) : error ? (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Your Firebase portfolio could not be loaded: {error}
          </Card>
        ) : holdingViews.length === 0 ? (
          <EmptyPortfolio />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {summaries.map((summary) => (
                <CurrencySummary key={summary.currency} {...summary} loading={pricesLoading} />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MetricCard
                icon={Leaf}
                label="Equal-weight ESG"
                value={averageEsg.toFixed(1)}
                caption="Across holdings"
              />
              <MetricCard
                icon={Scale}
                label="Largest sector"
                value={largestSector?.[0] ?? "—"}
                caption={largestSector ? `${largestSector[1]} holding(s)` : "No holdings"}
              />
              <MetricCard
                icon={ShieldCheck}
                label="High-risk stocks"
                value={String(
                  holdingViews.filter((holding) => holding.stock.risk === "High").length,
                )}
                caption="Review exposure"
              />
            </div>

            {alerts.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
                  <AlertTriangle className="h-4 w-4" /> Portfolio review alerts
                </div>
                <div className="mt-3 space-y-2">
                  {alerts.map((alert) => (
                    <div
                      key={alert}
                      className="rounded-md bg-white/80 p-2.5 text-xs text-amber-950"
                    >
                      {alert}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="border-b bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
                  <BarChart3 className="h-4 w-4" /> Holding performance
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Ranked by percentage return since purchase so different investment amounts and
                  currencies remain comparable.
                </p>
              </div>
              <div className="space-y-3 p-3">
                {ranked.map((holding, index) => (
                  <HoldingCard
                    key={holding.ticker}
                    holding={holding}
                    rank={index + 1}
                    pricesLoading={pricesLoading}
                    onSell={recordTransaction}
                  />
                ))}
              </div>
            </Card>

            <PerformanceComparison ranked={ranked} />
            <TransactionHistory transactions={transactions} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function EmptyPortfolio() {
  return (
    <Card className="p-7 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-indigo-50 text-indigo-700">
        <ShoppingCart className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold text-cgsi-navy">Your portfolio is empty</h2>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Open a stock, review its financial and ESG information, then use Simulate an Investment to
        add your first paper holding.
      </p>
      <Button asChild className="mt-4 bg-cgsi-navy text-white">
        <Link to="/dashboard">Explore stocks</Link>
      </Button>
    </Card>
  );
}

function CurrencySummary({
  currency,
  holdingCount,
  costBasis,
  currentValue,
  gain,
  returnPercent,
  loading,
}: {
  currency: PortfolioCurrency;
  holdingCount: number;
  costBasis: number;
  currentValue: number;
  gain: number;
  returnPercent: number;
  loading: boolean;
}) {
  const positive = gain >= 0;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {currency} portfolio value
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-cgsi-navy">
            {formatMoney(currentValue, currency)}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : positive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {formatSignedPercent(returnPercent)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
        <div>
          <div className="text-[9px] uppercase text-muted-foreground">Open cost basis</div>
          <div className="font-medium tabular-nums">{formatMoney(costBasis, currency)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-muted-foreground">Unrealised gain/loss</div>
          <div
            className={`font-medium tabular-nums ${positive ? "text-emerald-700" : "text-red-700"}`}
          >
            {formatSignedMoney(gain, currency)}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">
        {holdingCount} holding{holdingCount === 1 ? "" : "s"} · currencies are not combined
      </p>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <Card className="min-w-0 p-3">
      <Icon className="h-4 w-4 text-indigo-600" />
      <div className="mt-2 text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold text-cgsi-navy">{value}</div>
      <div className="mt-0.5 truncate text-[9px] text-muted-foreground">{caption}</div>
    </Card>
  );
}

function HoldingCard({
  holding,
  rank,
  pricesLoading,
  onSell,
}: {
  holding: HoldingView;
  rank: number;
  pricesLoading: boolean;
  onSell: (transaction: {
    ticker: string;
    side: "sell";
    quantity: number;
    executedPrice: number;
    currency: PortfolioCurrency;
  }) => Promise<void>;
}) {
  const [sellQuantity, setSellQuantity] = useState("");
  const [selling, setSelling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const positive = holding.returnPercent >= 0;
  const sell = async () => {
    const quantity = Number(sellQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > holding.quantity + 0.00000001) {
      setMessage(`Enter a quantity between 0 and ${holding.quantity.toFixed(6)}.`);
      return;
    }
    setSelling(true);
    setMessage(null);
    try {
      await onSell({
        ticker: holding.ticker,
        side: "sell",
        quantity,
        executedPrice: holding.currentPrice,
        currency: holding.currency,
      });
      setSellQuantity("");
      setMessage(
        `Simulated sale recorded at ${formatMoney(holding.currentPrice, holding.currency)}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The simulated sale could not be saved.");
    } finally {
      setSelling(false);
    }
  };

  return (
    <div className="rounded-lg border bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
            {rank}
          </span>
          <div className="min-w-0">
            <Link
              to="/stock/$ticker"
              params={{ ticker: holding.ticker }}
              className="font-mono text-sm font-semibold text-cgsi-navy hover:underline"
            >
              {holding.ticker}
            </Link>
            <div className="truncate text-[10px] text-muted-foreground">{holding.stock.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-700" : "text-red-700"}`}
          >
            {pricesLoading ? "Refreshing…" : formatSignedPercent(holding.returnPercent)}
          </div>
          <div className="text-[9px] text-muted-foreground">since average purchase</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-slate-50 p-2.5 text-xs">
        <HoldingStat label="Shares" value={holding.quantity.toFixed(6)} />
        <HoldingStat
          label="Average cost"
          value={formatMoney(holding.averageCost, holding.currency)}
        />
        <HoldingStat
          label="Current price"
          value={formatMoney(holding.currentPrice, holding.currency)}
        />
        <HoldingStat label="Cost basis" value={formatMoney(holding.costBasis, holding.currency)} />
        <HoldingStat
          label="Current value"
          value={formatMoney(holding.currentValue, holding.currency)}
        />
        <HoldingStat
          label="Gain/loss"
          value={formatSignedMoney(holding.unrealizedGain, holding.currency)}
          tone={positive ? "positive" : "negative"}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
        <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-800">
          ESG {holding.stock.esgScore}
        </span>
        <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">
          {holding.stock.sector}
        </span>
        <span className="rounded bg-amber-50 px-2 py-1 text-amber-800">
          {holding.stock.risk} risk
        </span>
      </div>
      <div className="mt-2 text-[9px] text-muted-foreground">
        {holding.market?.source ?? "Stock catalogue"} · {holding.market?.asOf ?? "fallback value"}
      </div>

      <div className="mt-3 flex gap-2 border-t pt-3">
        <input
          type="number"
          inputMode="decimal"
          min="0.00000001"
          max={holding.quantity}
          step="0.000001"
          value={sellQuantity}
          placeholder={`Up to ${holding.quantity.toFixed(4)}`}
          onChange={(event) => setSellQuantity(event.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border px-2 text-xs tabular-nums outline-none focus:border-cgsi-navy"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={selling || pricesLoading}
          onClick={() => void sell()}
        >
          {selling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowDownRight />}
          Simulate sell
        </Button>
      </div>
      {message && <div className="mt-2 text-[10px] text-slate-600">{message}</div>}
    </div>
  );
}

function HoldingStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[8px] uppercase text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 truncate font-medium tabular-nums ${tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : "text-cgsi-navy"}`}
      >
        {value}
      </div>
    </div>
  );
}

function PerformanceComparison({ ranked }: { ranked: HoldingView[] }) {
  if (ranked.length < 2) return null;
  const best = ranked[0];
  const worst = ranked.at(-1)!;
  const maximum = Math.max(...ranked.map((holding) => Math.abs(holding.returnPercent)), 1);
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
        <Scale className="h-4 w-4" /> Compare My Holdings
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-1 text-[9px] uppercase text-emerald-700">
            <ArrowUpRight className="h-3 w-3" /> Best performer
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-cgsi-navy">{best.ticker}</div>
          <div className="text-xs font-medium text-emerald-700">
            {formatSignedPercent(best.returnPercent)}
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-1 text-[9px] uppercase text-red-700">
            <ArrowDownRight className="h-3 w-3" /> Weakest performer
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-cgsi-navy">{worst.ticker}</div>
          <div className="text-xs font-medium text-red-700">
            {formatSignedPercent(worst.returnPercent)}
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {ranked.map((holding) => (
          <div key={holding.ticker}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-cgsi-navy">{holding.ticker}</span>
              <span className={holding.returnPercent >= 0 ? "text-emerald-700" : "text-red-700"}>
                {formatSignedPercent(holding.returnPercent)} · ESG {holding.stock.esgScore}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${holding.returnPercent >= 0 ? "bg-emerald-500" : "bg-red-400"}`}
                style={{
                  width: `${Math.max(4, (Math.abs(holding.returnPercent) / maximum) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TransactionHistory({
  transactions,
}: {
  transactions: ReturnType<typeof usePortfolioTransactions>["transactions"];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b bg-slate-50 px-4 py-3">
        <div className="text-sm font-semibold text-cgsi-navy">Transaction history</div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Firebase stores these records; portfolio totals above are reconstructed from them.
        </p>
      </div>
      <div className="divide-y">
        {transactions.slice(0, 12).map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
          >
            <div className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full ${transaction.side === "buy" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
              >
                {transaction.side === "buy" ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
              </span>
              <div>
                <div className="font-medium text-cgsi-navy">
                  {transaction.side === "buy" ? "Bought" : "Sold"} {transaction.ticker}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {formatTransactionDate(transaction.executedAt)}
                </div>
              </div>
            </div>
            <div className="text-right tabular-nums">
              <div>{transaction.quantity.toFixed(6)} shares</div>
              <div className="text-[9px] text-muted-foreground">
                @ {formatMoney(transaction.executedPrice, transaction.currency)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function buildPortfolioAlerts(holdings: HoldingView[]) {
  const alerts: string[] = [];
  const highRisk = holdings.filter((holding) => holding.stock.risk === "High");
  const weakEsg = holdings.filter((holding) => holding.stock.esgStrength === "Weak");
  if (highRisk.length > 0) {
    alerts.push(
      `${highRisk.map((holding) => holding.ticker).join(", ")} carry high modelled risk.`,
    );
  }
  if (weakEsg.length > 0) {
    alerts.push(
      `${weakEsg.map((holding) => holding.ticker).join(", ")} have weak overall ESG profiles.`,
    );
  }

  (["SGD", "USD"] as PortfolioCurrency[]).forEach((currency) => {
    const currencyHoldings = holdings.filter((holding) => holding.currency === currency);
    const total = currencyHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
    const largest = [...currencyHoldings].sort(
      (left, right) => right.currentValue - left.currentValue,
    )[0];
    if (largest && currencyHoldings.length > 1 && largest.currentValue / total >= 0.5) {
      alerts.push(
        `${largest.ticker} represents ${((largest.currentValue / total) * 100).toFixed(0)}% of your ${currency} portfolio value.`,
      );
    }
  });
  const fallbackCount = holdings.filter(
    (holding) => holding.market?.mode === "illustrative",
  ).length;
  if (fallbackCount > 0) {
    alerts.push(
      `${fallbackCount} holding${fallbackCount === 1 ? " is" : "s are"} using illustrative fallback prices; returns are not live.`,
    );
  }
  return alerts;
}

function formatMoney(value: number, currency: PortfolioCurrency) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedMoney(value: number, currency: PortfolioCurrency) {
  return `${value >= 0 ? "+" : "−"}${formatMoney(Math.abs(value), currency)}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTransactionDate(value: Date) {
  if (value.getTime() === 0) return "Saving timestamp…";
  return value.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
