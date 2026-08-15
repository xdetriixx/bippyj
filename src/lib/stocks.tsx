import { createContext, useContext, type ReactNode } from "react";
import { STOCKS } from "@/data/stock-seed-data";
import type { Stock } from "@/lib/cgsi-data";

type StocksContextValue = {
  stocks: Stock[];
  loading: boolean;
  error: string | null;
  getStock: (ticker: string) => Stock | undefined;
};

const StocksContext = createContext<StocksContextValue | null>(null);

const catalogue: StocksContextValue = {
  stocks: STOCKS,
  loading: false,
  error: null,
  getStock: (ticker) => STOCKS.find((stock) => stock.ticker === ticker.toUpperCase()),
};

export function StocksProvider({ children }: { children: ReactNode }) {
  return <StocksContext.Provider value={catalogue}>{children}</StocksContext.Provider>;
}

export function useStocks() {
  const context = useContext(StocksContext);
  if (!context) throw new Error("useStocks must be used inside StocksProvider.");
  return context;
}
