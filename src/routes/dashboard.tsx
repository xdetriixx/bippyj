import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StockCard } from "@/components/cgsi/StockCard";
import type { EsgStrength, RiskLevel } from "@/lib/cgsi-data";
import { useStocks } from "@/lib/stocks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortfolioTransactions, type PortfolioCurrency } from "@/lib/portfolio";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - CGSI Decision Intelligence" },
      {
        name: "description",
        content:
          "Browse stocks with ESG insights, match scores, and AI-powered behavioural nudges.",
      },
    ],
  }),
  component: Dashboard,
});

const RISK_OPTIONS: ("All" | RiskLevel)[] = ["All", "Low", "Medium", "High"];
const ESG_OPTIONS: ("All" | EsgStrength)[] = ["All", "Strong", "Average", "Weak"];

function Dashboard() {
  const { stocks } = useStocks();
  const [risk, setRisk] = useState<(typeof RISK_OPTIONS)[number]>("All");
  const [esg, setEsg] = useState<(typeof ESG_OPTIONS)[number]>("All");
  const [sector, setSector] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(stocks.map((stock) => stock.sector)))],
    [stocks],
  );
  const filtered = useMemo(
    () =>
      stocks.filter(
        (stock) =>
          (risk === "All" || stock.risk === risk) &&
          (esg === "All" || stock.esgStrength === esg) &&
          (sector === "All" || stock.sector === sector),
      ),
    [risk, esg, sector, stocks],
  );

  const activeFilterCount = [risk, esg, sector].filter((value) => value !== "All").length;

  return (
    <AppShell>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900">
          <span className="font-medium">Provider-ready market workspace</span>
          <span>Expand a stock to load end-of-day prices · ESG data remains illustrative</span>
        </div>

        <PortfolioDashboardCard />

        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-cgsi-navy">Market Overview</h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {stocks.length} stocks
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={filtersOpen ? "default" : "outline"}
            className={filtersOpen ? "h-8 bg-cgsi-navy text-xs text-white" : "h-8 text-xs"}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Button>
        </div>

        {filtersOpen && (
          <Card className="grid grid-cols-3 gap-2 p-3">
            <CompactSelect label="Risk" value={risk} options={RISK_OPTIONS} onChange={setRisk} />
            <CompactSelect label="ESG" value={esg} options={ESG_OPTIONS} onChange={setEsg} />
            <CompactSelect label="Sector" value={sector} options={sectors} onChange={setSector} />
          </Card>
        )}

        <div className="space-y-2">
          {filtered.map((stock) => (
            <StockCard key={stock.ticker} stock={stock} />
          ))}
          {filtered.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No stocks match these filters. Try widening your criteria.
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function PortfolioDashboardCard() {
  const { holdings, transactions, loading } = usePortfolioTransactions();
  const totals = (["SGD", "USD"] as PortfolioCurrency[])
    .map((currency) => ({
      currency,
      value: holdings
        .filter((holding) => holding.currency === currency)
        .reduce((sum, holding) => sum + holding.costBasis, 0),
    }))
    .filter((total) => total.value > 0);

  return (
    <Card className="p-3">
      <Link to="/portfolio" className="block rounded-md outline-none focus-visible:ring-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-700">
              <BriefcaseBusiness className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                My simulated portfolio
              </div>
              <div className="mt-0.5 text-sm font-semibold text-cgsi-navy">
                {loading
                  ? "Loading portfolio…"
                  : `${holdings.length} open holding${holdings.length === 1 ? "" : "s"}`}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {transactions.length} recorded transaction{transactions.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-indigo-600" />
        </div>
        {!loading && totals.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
            {totals.map((total) => (
              <MiniStat
                key={total.currency}
                label={`${total.currency} open cost basis`}
                value={new Intl.NumberFormat("en-SG", {
                  style: "currency",
                  currency: total.currency,
                }).format(total.value)}
              />
            ))}
          </div>
        )}
      </Link>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-semibold text-cgsi-navy">{value}</div>
    </div>
  );
}

function CompactSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="min-w-0 text-[10px] font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 h-8 w-full min-w-0 rounded-md border bg-white px-1.5 text-xs text-cgsi-navy outline-none focus:border-cgsi-navy"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
