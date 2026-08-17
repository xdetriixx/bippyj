import { getServerConfig } from "./config.server";
import type { MarketPricePoint, MarketSnapshot } from "./market-data.types";

const ALPHA_VANTAGE_ENDPOINT = "https://www.alphavantage.co/query";
const CACHE_TTL_MS = 12 * 60 * 60 * 1_000;

type AlphaVantagePayload = {
  "Meta Data"?: Record<string, string>;
  "Time Series (Daily)"?: Record<
    string,
    {
      "1. open"?: string;
      "2. high"?: string;
      "3. low"?: string;
      "4. close"?: string;
      "5. volume"?: string;
    }
  >;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
};

type CacheEntry = {
  expiresAt: number;
  snapshot: MarketSnapshot;
};

const snapshotCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<MarketSnapshot>>();

function safeNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function providerError(payload: AlphaVantagePayload) {
  return payload["Error Message"] ?? payload.Note ?? payload.Information;
}

function parseDailySeries(
  ticker: string,
  exchange: "NASDAQ" | "NYSE" | "SGX",
  payload: AlphaVantagePayload,
): MarketSnapshot {
  const error = providerError(payload);
  if (error) throw new Error(error);

  const series = payload["Time Series (Daily)"];
  if (!series) throw new Error("Alpha Vantage returned no daily price series for this symbol.");

  const trend: MarketPricePoint[] = Object.entries(series)
    .map(([date, values]) => ({ date, close: safeNumber(values["4. close"]) }))
    .filter((point): point is MarketPricePoint => point.close !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  if (trend.length < 2)
    throw new Error("Not enough provider history was returned for this symbol.");

  const latest = trend[trend.length - 1];
  const previous = trend[trend.length - 2];
  const changePercent = ((latest.close - previous.close) / previous.close) * 100;

  return {
    ticker,
    price: latest.close,
    changePercent: Number(changePercent.toFixed(2)),
    currency: exchange === "SGX" ? "SGD" : "USD",
    asOf: latest.date,
    trend,
    mode: "provider",
    source: "Alpha Vantage",
    cadence: "End-of-day",
    providerConfigured: true,
    message:
      "Provider-backed daily closing prices. ESG and financial prototype values remain illustrative.",
  };
}

async function requestAlphaVantage(
  ticker: string,
  exchange: "NASDAQ" | "NYSE" | "SGX",
  apiKey: string,
) {
  const url = new URL(ALPHA_VANTAGE_ENDPOINT);
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", ticker);
  url.searchParams.set("outputsize", "compact");
  url.searchParams.set("apikey", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Alpha Vantage request failed (${response.status}).`);
    return parseDailySeries(ticker, exchange, (await response.json()) as AlphaVantagePayload);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAlphaVantageSnapshot(ticker: string, exchange: "NASDAQ" | "NYSE" | "SGX") {
  const apiKey = getServerConfig().alphaVantageApiKey?.trim();
  if (!apiKey) return null;

  const cached = snapshotCache.get(ticker);
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

  const pending = pendingRequests.get(ticker);
  if (pending) return pending;

  const request = requestAlphaVantage(ticker, exchange, apiKey)
    .then((snapshot) => {
      snapshotCache.set(ticker, { snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
      return snapshot;
    })
    .finally(() => pendingRequests.delete(ticker));

  pendingRequests.set(ticker, request);
  return request;
}
