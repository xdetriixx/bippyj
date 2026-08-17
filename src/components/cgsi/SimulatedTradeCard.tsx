import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BriefcaseBusiness, Loader2, ShoppingCart } from "lucide-react";
import type { Stock } from "@/lib/cgsi-data";
import { usePortfolioTransactions, type PortfolioCurrency } from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function SimulatedTradeCard({
  stock,
  price,
  currency,
  priceLabel,
}: {
  stock: Stock;
  price: number;
  currency: PortfolioCurrency;
  priceLabel: string;
}) {
  const { holdings, loading, recordTransaction } = usePortfolioTransactions();
  const [amount, setAmount] = useState("1000");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const numericAmount = Number(amount);
  const quantity = Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount / price : 0;
  const symbol = currency === "SGD" ? "S$" : "$";
  const existingHolding = useMemo(
    () => holdings.find((holding) => holding.ticker === stock.ticker),
    [holdings, stock.ticker],
  );

  const simulatePurchase = async () => {
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || quantity <= 0) {
      setMessage("Enter an amount greater than zero.");
      return;
    }
    if (numericAmount > 100_000_000) {
      setMessage("Enter a simulated amount below 100,000,000.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await recordTransaction({
        ticker: stock.ticker,
        side: "buy",
        quantity,
        executedPrice: price,
        currency,
      });
      setMessage(
        `Added ${quantity.toFixed(6)} ${stock.ticker} shares to your simulated portfolio.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The simulated purchase could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden border-indigo-200">
      <div className="border-b bg-gradient-to-r from-indigo-50 to-emerald-50 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
          <ShoppingCart className="h-4 w-4 text-indigo-600" /> Simulate an Investment
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Practise a purchase using the displayed market price. No money is transferred and no real
          order is placed.
        </p>
      </div>
      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-xs font-medium text-slate-700">
            Amount to simulate ({currency})
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {symbol}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max="100000000"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="h-10 w-full rounded-md border bg-white pl-9 pr-3 text-sm tabular-nums outline-none focus:border-cgsi-navy"
              />
            </div>
          </label>
          <Button
            type="button"
            className="h-10 bg-cgsi-navy text-white"
            disabled={submitting || loading || quantity <= 0}
            onClick={() => void simulatePurchase()}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart />}
            Add to portfolio
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Displayed price
            </div>
            <div className="mt-0.5 font-semibold tabular-nums text-cgsi-navy">
              {symbol}
              {price.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Simulated shares
            </div>
            <div className="mt-0.5 font-semibold tabular-nums text-cgsi-navy">
              {quantity > 0 ? quantity.toFixed(6) : "0"}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          Fractional shares are allowed for learning purposes · Price source: {priceLabel}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-slate-600">
            {existingHolding
              ? `Current holding: ${existingHolding.quantity.toFixed(6)} shares`
              : "You do not currently hold this stock."}
          </span>
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:underline"
          >
            <BriefcaseBusiness className="h-3.5 w-3.5" /> My Portfolio
          </Link>
        </div>
        {message && (
          <div
            className={`mt-3 rounded-md px-3 py-2 text-xs ${message.startsWith("Added") ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
          >
            {message}
          </div>
        )}
      </div>
    </Card>
  );
}
