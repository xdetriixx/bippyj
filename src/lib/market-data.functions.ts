import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAlphaVantageSnapshot } from "./market-data.server";
import type { MarketSnapshot } from "./market-data.types";

const requestSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(16)
    .regex(/^[A-Z0-9.-]+$/),
  exchange: z.enum(["NASDAQ", "NYSE", "SGX"]),
  price: z.number(),
  change: z.number(),
  trend: z.array(z.number()).min(1).max(90),
});

function illustrativeSnapshot(
  stock: z.infer<typeof requestSchema>,
  message: string,
  configured: boolean,
): MarketSnapshot {
  const today = new Date();
  const trend = stock.trend.map((close, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (stock.trend.length - 1 - index));
    return { date: date.toISOString().slice(0, 10), close };
  });

  return {
    ticker: stock.ticker,
    price: stock.price,
    changePercent: stock.change,
    currency: stock.exchange === "SGX" ? "SGD" : "USD",
    asOf: "Prototype dataset",
    trend,
    mode: "illustrative",
    source: "CGSI prototype",
    cadence: "Illustrative",
    providerConfigured: configured,
    message,
  };
}

export const getMarketSnapshot = createServerFn({ method: "POST" })
  .validator(requestSchema)
  .handler(async ({ data }) => {
    try {
      const snapshot = await getAlphaVantageSnapshot(data.ticker, data.exchange);
      if (snapshot) return snapshot;
      return illustrativeSnapshot(
        data,
        "Add ALPHA_VANTAGE_API_KEY on the server to enable end-of-day market prices.",
        false,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The market provider is unavailable.";
      return illustrativeSnapshot(
        data,
        `Provider unavailable; showing the illustrative fallback. ${reason}`,
        true,
      );
    }
  });
