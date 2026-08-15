export type MarketDataMode = "provider" | "illustrative";

export type MarketPricePoint = {
  date: string;
  close: number;
};

export type MarketSnapshot = {
  ticker: string;
  price: number;
  changePercent: number;
  currency: "USD" | "SGD";
  asOf: string;
  trend: MarketPricePoint[];
  mode: MarketDataMode;
  source: "Alpha Vantage" | "CGSI prototype";
  cadence: "End-of-day" | "Illustrative";
  providerConfigured: boolean;
  message: string;
};
