import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { Stock } from "@/lib/cgsi-data";
import { useStocks } from "@/lib/stocks";
import { useBehavior } from "@/lib/behavior-store";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { EsgBadge, MatchBadge, RiskBadge } from "@/components/cgsi/badges";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/cgsi/HelpTip";
import { Switch } from "@/components/ui/switch";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  ArrowLeft,
  Leaf,
  Users,
  Building2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Wand2,
  TrendingUp,
  Activity,
  Brain,
  ChevronDown,
  Newspaper,
  MessagesSquare,
  Cpu,
  Loader2,
} from "lucide-react";
import {
  sectorAverages,
  verdict,
  carbonReduction,
  dataConfidence,
  redFlags,
  simpleExplain,
  helpForScore,
  type Verdict,
} from "@/lib/esg-helpers";
import { getAISimplifiedEsgSummary } from "@/lib/cgsi-ai.functions";
import { getMarketSnapshot } from "@/lib/market-data.functions";
import type { MarketSnapshot } from "@/lib/market-data.types";
import { StockAIDecisionTools } from "@/components/cgsi/StockAIDecisionTools";
import { calculatePersonalMatch, getDominantPreferences } from "@/lib/personalized-match";
import { AIFeedback } from "@/components/cgsi/AIFeedback";
import { InvestorDecisionWorkspace } from "@/components/cgsi/InvestorDecisionWorkspace";
import { SimulatedTradeCard } from "@/components/cgsi/SimulatedTradeCard";

export const Route = createFileRoute("/stock/$ticker")({
  head: () => ({
    meta: [
      { title: "Stock Insights · CGSI" },
      { name: "description", content: "ESG and financial stock insights." },
    ],
  }),
  component: StockRoute,
});

function StockRoute() {
  const { ticker } = Route.useParams();
  const { getStock, stocks, loading, error } = useStocks();
  const stock = getStock(ticker);

  if (!stock) {
    return (
      <AppShell>
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {loading
            ? "Loading stock from Firebase…"
            : error
              ? `The stock catalogue could not be loaded: ${error}`
              : `No Firebase stock record exists for ${ticker}.`}
        </Card>
      </AppShell>
    );
  }

  return <StockDetail stock={stock} stocks={stocks} />;
}

function StockDetail({ stock, stocks }: { stock: Stock; stocks: Stock[] }) {
  const { recordView, bias, recentViews } = useBehavior();

  const [view, setView] = useState<"normal" | "simple">("normal");
  const [aiSummary, setAiSummary] = useState(false);
  const [groqSummary, setGroqSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const displayPrice = market?.price ?? stock.price;
  const displayChange = market?.changePercent ?? stock.change;
  const positive = displayChange >= 0;
  const peer = useMemo(() => sectorAverages(stock.sector, stocks), [stock.sector, stocks]);
  const conf = dataConfidence(stock);
  const flags = redFlags(stock);
  const co2Reduction = carbonReduction(stock);
  const currencySymbol = stock.exchange === "SGX" ? "S$" : "$";
  const financialUnit = stock.exchange === "SGX" ? "SGD millions" : "USD millions";

  useEffect(() => {
    recordView(stock.ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.ticker]);

  useEffect(() => {
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
        /* Static prototype values remain visible if the server function cannot be reached. */
      })
      .finally(() => {
        if (active) setMarketLoading(false);
      });

    return () => {
      active = false;
    };
  }, [stock]);

  useEffect(() => {
    let active = true;
    if (view !== "simple" && !aiSummary)
      return () => {
        active = false;
      };
    if (groqSummary)
      return () => {
        active = false;
      };

    setSummaryLoading(true);
    void getAISimplifiedEsgSummary({
      data: {
        stock: {
          ticker: stock.ticker,
          name: stock.name,
          sector: stock.sector,
          risk: stock.risk,
          esgStrength: stock.esgStrength,
          esgScore: stock.esgScore,
          environmental: stock.environmental,
          social: stock.social,
          governance: stock.governance,
          analystNote: stock.analystNote,
          riskNote: stock.riskNote,
          dataMode: "illustrative prototype",
          asOf: "FY2025",
          peerEsgScore: Number(peer.esgScore.toFixed(1)),
          emissionsChangePct: Number(co2Reduction.toFixed(1)),
          renewableEnergyPct: stock.energy[stock.energy.length - 1].renewable,
          financialUnit,
          latestRevenue: stock.financial[stock.financial.length - 1].revenue,
          latestNetIncome: stock.financial[stock.financial.length - 1].netIncome,
        },
      },
    })
      .then((result) => {
        if (active) {
          setGroqSummary(result.summary);
        }
      })
      .catch(() => {
        /* The existing local explanation remains available. */
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [view, aiSummary, groqSummary, stock, peer.esgScore, co2Reduction, financialUnit]);

  // ----- Behavioral profile (mirrors /matches algorithm) -----
  const uniqueViewed = useMemo(() => new Set(recentViews.map((v) => v.ticker)).size, [recentViews]);
  const dom = useMemo(() => getDominantPreferences(bias), [bias]);
  const personalMatch = useMemo(() => calculatePersonalMatch(stock, dom), [dom, stock]);
  const personalScore = personalMatch.score;

  const archetype = useMemo(() => deriveArchetype(dom, uniqueViewed), [dom, uniqueViewed]);

  const algoTags = useMemo(() => {
    const tags: string[] = [];
    if (dom.risk) tags.push(`#${dom.risk}-risk-pattern`);
    if (dom.esg) tags.push(`#${dom.esg}-ESG-aligned`);
    if (dom.sector) tags.push(`#${dom.sector}-focus`);
    if (dom.exchange) tags.push(`#${dom.exchange}-bias`);
    if (tags.length === 0) tags.push("#Baseline-explorer");
    return tags;
  }, [dom]);

  // ----- Sentiment chips -----
  const sentimentChips = useMemo(() => buildSentimentChips(stock), [stock]);

  return (
    <AppShell>
      <div className="space-y-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-[11px] ${
            market?.mode === "provider"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <span className="inline-flex items-center gap-1.5 font-medium">
            {marketLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {marketLoading
              ? "Checking market provider"
              : market?.mode === "provider"
                ? "Provider-backed market prices"
                : "Illustrative market fallback"}
          </span>
          <span>
            {market?.mode === "provider"
              ? `${market.source} ${market.cadence.toLowerCase()} · as of ${market.asOf}`
              : "ESG and financial periods remain illustrative through FY2025"}
          </span>
        </div>

        {/* Header */}
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs text-muted-foreground">
                {stock.exchange} · {stock.sector}
              </div>
              <h1 className="text-2xl font-semibold text-cgsi-navy">{stock.name}</h1>
              <div className="font-mono text-sm text-muted-foreground">{stock.ticker}</div>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{stock.description}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tabular-nums">
                {currencySymbol}
                {displayPrice.toFixed(2)}
              </div>
              <div
                className={`text-sm font-medium ${positive ? "text-emerald-700" : "text-red-700"}`}
              >
                {positive ? "+" : ""}
                {displayChange.toFixed(2)}% {market?.mode === "provider" ? "last session" : "today"}
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                <EsgBadge strength={stock.esgStrength} score={stock.esgScore} />
                <RiskBadge level={stock.risk} />
                <MatchBadge score={stock.match} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
                <Activity className="h-4 w-4" /> Market Price History
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Last 30 daily closes · {market?.source ?? "checking provider"}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                market?.mode === "provider"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {marketLoading ? "Loading" : (market?.cadence ?? "Illustrative fallback")}
            </span>
          </div>
          {market ? (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={market.trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(date: string) => date.slice(5)}
                      minTickGap={24}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      width={52}
                      tickFormatter={(value: number) => `${currencySymbol}${value.toFixed(0)}`}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `${currencySymbol}${Number(value).toFixed(2)}`,
                        "Close",
                      ]}
                      labelFormatter={(date) => `Session: ${date}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke={positive ? "#059669" : "#dc2626"}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                {market.message}
              </p>
            </>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-md bg-slate-50 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading market history
            </div>
          )}
        </Card>

        {/* Investor Mandate Alignment */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
            <Brain className="h-4 w-4 text-cgsi-navy" />
            Investor Mandate Alignment
            <HelpTip body="A live snapshot of your browsing pattern in the last 10 minutes — used to personalise this page." />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
            <StatTile label="Analyzed Assets" value={String(uniqueViewed || 0)} />
            <StatTile label="Risk Profile Filter" value={dom.risk ?? "—"} />
            <StatTile label="Core ESG Benchmark" value={dom.esg ?? "—"} />
            <StatTile label="Target Sector" value={dom.sector ?? "—"} />
            <StatTile label="Target Exchange" value={dom.exchange ?? "—"} />
          </div>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-700">
                Overall Behavioral Profile
              </div>
              <div className="mt-1 text-xl font-semibold text-cgsi-navy">{archetype}</div>
              <p className="mt-1 max-w-xl text-sm text-slate-600">
                Personalised match for{" "}
                <span className="font-medium text-cgsi-navy">{stock.ticker}</span> blends the base
                match score with your recent risk, ESG, sector, and exchange biases — the same
                algorithm used on Top Matched Stocks.
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Mandate Alignment Score
                </div>
                <button
                  onClick={() => setExplainOpen((o) => !o)}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  Explain Insights
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${explainOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
              <div className="text-3xl font-semibold text-cgsi-navy tabular-nums">
                {personalScore}
              </div>
              <div className="text-[11px] text-muted-foreground">vs base {stock.match}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {algoTags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-800"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="mt-3 text-xs font-medium text-slate-700">
            {personalMatch.availableCount > 0
              ? `${personalMatch.matchedCount} of ${personalMatch.availableCount} dominant preferences matched`
              : "Browse more stocks to build a personalised preference profile"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {personalMatch.dimensions
              .filter((dimension) => dimension.target !== null)
              .map((dimension) => (
                <span
                  key={dimension.key}
                  className={`rounded-full border px-2 py-1 text-[10px] font-medium ${
                    dimension.matched
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {dimension.matched ? "✓" : "×"} {dimension.label}: {dimension.companyValue}
                  {!dimension.matched && ` (target ${dimension.target})`}
                </span>
              ))}
          </div>
          {explainOpen && (
            <div className="mt-4 rounded-md border border-indigo-100 bg-indigo-50/50 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-800">
                Score Composition
              </div>
              <div className="mb-3 rounded-md bg-white p-3 text-xs text-slate-700">
                <div className="flex justify-between gap-3">
                  <span>Base score contribution</span>
                  <span className="font-medium tabular-nums">
                    {stock.match} × 60% = {(stock.match * 0.6).toFixed(1)}
                  </span>
                </div>
                <div className="mt-1 flex justify-between gap-3">
                  <span>Preference alignment contribution</span>
                  <span className="font-medium tabular-nums">
                    {personalMatch.alignmentScore ?? stock.match} × 40% ={" "}
                    {((personalMatch.alignmentScore ?? stock.match) * 0.4).toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {personalMatch.dimensions
                  .filter((dimension) => dimension.target !== null)
                  .map((dimension) => (
                    <div key={dimension.key}>
                      <div className="flex items-center justify-between text-xs text-slate-700">
                        <span>
                          {dimension.label}: target {dimension.target}, company{" "}
                          {dimension.companyValue}
                        </span>
                        <span className="font-medium tabular-nums text-cgsi-navy">
                          {dimension.matched ? dimension.weight : 0}/{dimension.weight}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${dimension.matched ? "bg-emerald-500" : "bg-rose-300"}`}
                          style={{ width: dimension.matched ? "100%" : "0%" }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>

        {/* Research coverage */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
            <Sparkles className="h-4 w-4 text-cgsi-green" />
            Research Coverage
            <HelpTip body="The current prototype models these research categories. Live feeds and source-document validation are not connected yet." />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <AltDataCard
              icon={Newspaper}
              title="Company Disclosures"
              body="Illustrative annual-report, sustainability, and governance fields used across this profile."
              tag="Prototype coverage"
            />
            <AltDataCard
              icon={MessagesSquare}
              title="Workforce Indicators"
              body="Illustrative employee, board, and social-risk indicators awaiting source integration."
              tag="Source validation pending"
            />
            <AltDataCard
              icon={Cpu}
              title="Sector Materiality"
              body="Prototype sector benchmarks highlight which ESG themes may be financially relevant."
              tag="CGSI sample universe"
            />
          </div>
        </Card>

        {/* Red Flags */}
        {flags.length > 0 && (
          <Card className="border-l-4 border-l-amber-500 p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <AlertTriangle className="h-4 w-4" /> ESG Red Flag Alerts ({flags.length})
            </div>
            <div className="space-y-2">
              {flags.map((f) => (
                <div
                  key={f.title}
                  className={`rounded-md border p-3 ${
                    f.severity === "high"
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{f.title}</div>
                  <p className="mt-0.5 text-xs text-slate-700">{f.body}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Tabs value={view} onValueChange={(v) => setView(v as "normal" | "simple")}>
          <TabsList className="bg-white">
            <TabsTrigger value="normal">Analyst View</TabsTrigger>
            <TabsTrigger value="simple">Beginner View</TabsTrigger>
          </TabsList>

          {/* BEGINNER */}
          <TabsContent value="simple" className="space-y-4">
            <Card className="border-emerald-200 bg-cgsi-green-soft/40 p-6">
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-800">
                Overall ESG Rating
                <HelpTip
                  title="What does this mean?"
                  body={`This rating summarises Environmental, Social, and Governance performance. ${stock.name} scores ${stock.esgScore}/100 — ${verdict(stock.esgScore, peer.esgScore).toLowerCase()} the sector average of ${Math.round(peer.esgScore)}.`}
                />
              </div>
              <div className="mt-1 text-3xl font-semibold text-cgsi-navy">{stock.esgStrength}</div>
              <p className="mt-2 max-w-2xl text-sm text-slate-700">
                <span className="font-medium">What this means: </span>
                This company is performing
                {stock.esgStrength === "Strong"
                  ? " well"
                  : stock.esgStrength === "Average"
                    ? " adequately"
                    : " below peers"}{" "}
                in sustainability, employee treatment, and governance practices.
              </p>
            </Card>

            <Card className="border-indigo-200 bg-indigo-50/50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
                {summaryLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                ) : (
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                )}
                AI simplified ESG summary · illustrative data
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                {summaryLoading
                  ? "Simplifying this ESG profile…"
                  : (groqSummary ?? simpleExplain(stock, stocks))}
              </p>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SimpleCard
                icon={Leaf}
                title="Environmental"
                body={stock.beginnerSummary.environmental}
                score={stock.environmental}
                peer={peer.environmental}
                color="emerald"
              />
              <SimpleCard
                icon={Users}
                title="Social"
                body={stock.beginnerSummary.social}
                score={stock.social}
                peer={peer.social}
                color="navy"
              />
              <SimpleCard
                icon={Building2}
                title="Governance"
                body={stock.beginnerSummary.governance}
                score={stock.governance}
                peer={peer.governance}
                color="navy"
              />
            </div>

            <Card className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cgsi-navy" />
                <div className="text-sm font-semibold text-cgsi-navy">Investor Meaning</div>
              </div>
              <ul className="space-y-2 text-sm text-slate-700">
                {stock.beginnerSummary.meaning.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cgsi-green" />
                    {m}
                  </li>
                ))}
              </ul>
            </Card>
          </TabsContent>

          {/* ANALYST */}
          <TabsContent value="normal" className="space-y-4">
            {/* AI summary toggle (analyst-only) */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-white px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Wand2 className="h-4 w-4 text-cgsi-green" />
                <span className="font-medium text-cgsi-navy">AI Generated Summary</span>
                <span className="text-xs text-muted-foreground">
                  Plain-English interpretation of the analyst data below.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{aiSummary ? "On" : "Off"}</span>
                <Switch checked={aiSummary} onCheckedChange={setAiSummary} />
              </div>
            </div>

            {aiSummary && (
              <Card className="border-emerald-200 bg-cgsi-green-soft/40 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
                  {summaryLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-cgsi-green" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-cgsi-green" />
                  )}
                  AI Summary
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {summaryLoading
                    ? "Groq is simplifying the analyst data…"
                    : (groqSummary ?? simpleExplain(stock, stocks))}
                </p>
                {!summaryLoading && (
                  <div className="mt-3">
                    <AIFeedback feature="simplified_esg_summary" tickers={[stock.ticker]} />
                  </div>
                )}
              </Card>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <ScoreCard
                label="ESG Score"
                value={stock.esgScore}
                max={100}
                help={helpForScore("ESG", stock.esgScore, peer.esgScore)}
              />
              <ScoreCard
                label="Environmental"
                value={stock.environmental}
                max={100}
                help={helpForScore("Environmental", stock.environmental, peer.environmental)}
              />
              <ScoreCard
                label="Social"
                value={stock.social}
                max={100}
                help={helpForScore("Social", stock.social, peer.social)}
              />
              <ScoreCard
                label="Governance"
                value={stock.governance}
                max={100}
                help={helpForScore("Governance", stock.governance, peer.governance)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Reported GHG Emissions by Scope"
                caption="Illustrative FY2021–FY2025 profile · tonnes CO₂e"
                help="Scope 1 is direct operational emissions, Scope 2 is purchased energy, and Scope 3 covers the wider value chain."
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stock.carbon} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${Math.round(Number(value) / 1_000)}k`}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="scope1" stackId="emissions" fill="#0f766e" name="Scope 1" />
                    <Bar dataKey="scope2" stackId="emissions" fill="#22c55e" name="Scope 2" />
                    <Bar dataKey="scope3" stackId="emissions" fill="#94a3b8" name="Scope 3" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <div>
                <ChartCard
                  title="Operational Energy Mix"
                  caption="Illustrative annual electricity mix · percentage of total"
                  help="Each column totals 100%. A rising renewable share can reduce exposure to purchased-energy emissions."
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={stock.energy}
                      margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${Math.round(Number(value))}%`}
                      />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar
                        dataKey="renewable"
                        stackId="energy"
                        fill="var(--cgsi-green)"
                        name="Renewable"
                      />
                      <Bar
                        dataKey="nonrenewable"
                        stackId="energy"
                        fill="#cbd5e1"
                        name="Other energy"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <Card className="p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1 text-sm font-medium text-cgsi-navy">
                    ESG Performance History
                    <HelpTip
                      title="About this chart"
                      body="Illustrative CGSI composite score by fiscal year. Higher values indicate stronger performance in this prototype methodology."
                    />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={stock.esgTrend}
                    margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--cgsi-navy)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--cgsi-navy)" }}
                      activeDot={{ r: 5 }}
                      name="ESG performance score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <ChartCard
                title="Quarterly Financial Performance"
                caption={`Illustrative reported values · ${financialUnit}`}
                help="Revenue and net income are shown by fiscal quarter using the same currency and unit. These prototype figures are not company filings."
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={stock.financial}
                    margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                    <XAxis dataKey="period" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="revenue" fill="var(--cgsi-navy)" name="Revenue" />
                    <Bar dataKey="netIncome" fill="var(--cgsi-green)" name="Net income" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card className="p-4">
                <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
                  Board Independence
                  <HelpTip
                    body={`The share of directors who are not company insiders. ${stock.boardIndependence}% vs ${Math.round(peer.boardIndependence)}% sector average.`}
                  />
                </div>
                <div className="mt-1 text-2xl font-semibold text-cgsi-navy">
                  {stock.boardIndependence}%
                </div>
                <Progress value={stock.boardIndependence} className="mt-2" />
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
                  Employee Indicator
                  <HelpTip body="Illustrative workforce sentiment indicator for prototype demonstration. No live review-platform feed is connected." />
                </div>
                <div className="mt-1 text-2xl font-semibold text-cgsi-navy">
                  {stock.employeeSat.toFixed(1)} / 5
                </div>
                <Progress value={(stock.employeeSat / 5) * 100} className="mt-2" />
              </Card>

              {/* Illustrative materiality signals */}
              <Card className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2 text-xs uppercase text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Materiality Signals
                  </span>
                  <span className="text-[10px] font-medium normal-case text-muted-foreground">
                    Illustrative
                  </span>
                </div>
                <RiskBadge level={stock.risk} />
                <div className="flex flex-wrap gap-1">
                  {sentimentChips.map((c) => (
                    <span
                      key={c.label}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        c.tone === "high"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : c.tone === "med"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-slate-600">{stock.riskNote}</div>
              </Card>
            </div>

            <Card className="border-l-4 border-l-cgsi-navy p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-cgsi-navy">
                Analyst Note
              </div>
              <p className="mt-1 text-sm text-slate-700">{stock.analystNote}</p>
            </Card>
          </TabsContent>
        </Tabs>

        <SimulatedTradeCard
          stock={stock}
          price={displayPrice}
          currency={market?.currency ?? (stock.exchange === "SGX" ? "SGD" : "USD")}
          priceLabel={`${market?.source ?? "Stock catalogue"} · ${market?.asOf ?? "current displayed value"}`}
        />

        <InvestorDecisionWorkspace stock={stock} stocks={stocks} currentPrice={displayPrice} />

        <StockAIDecisionTools stock={stock} stocks={stocks} />

        {/* What this means for investors */}
        <Card className="border-l-4 border-l-cgsi-green p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
            <TrendingUp className="h-4 w-4 text-cgsi-green" />
            What this means for investors
            <HelpTip body="How the ESG rating typically affects investment decisions, perceived risk, investor confidence, and long-term resilience." />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Bullet title="Investment decision">
              {stock.esgStrength === "Strong"
                ? "Strong ESG performance often makes this stock easier to hold through volatility for long-term portfolios."
                : stock.esgStrength === "Average"
                  ? "Average ESG means this stock is acceptable for diversified portfolios but is not a flagship sustainability pick."
                  : "Weak ESG suggests caution — only suitable if the financial thesis clearly compensates for the ESG risk."}
            </Bullet>
            <Bullet title="Risk impact">
              {stock.esgStrength === "Weak"
                ? "Weak ESG raises the chance of fines, lawsuits, brand damage, or write-downs of stranded assets."
                : "Stable ESG profile reduces the chance of sudden regulatory or reputational shocks."}
            </Bullet>
            <Bullet title="Investor confidence">
              {`Sector peers average ${Math.round(peer.esgScore)}/100 ESG. ${stock.name} is ${verdict(stock.esgScore, peer.esgScore).toLowerCase()}, which ${stock.esgScore >= peer.esgScore ? "supports" : "weakens"} institutional investor confidence.`}
            </Bullet>
            <Bullet title="Long-term sustainability">
              {co2Reduction > 5
                ? `The illustrative emissions profile falls by approximately ${Math.round(co2Reduction)}% from FY2021 to FY2025. Validate this direction against company-reported Scope 1, 2, and 3 data.`
                : "The illustrative emissions profile is broadly stable. Source-document validation is needed before drawing a transition conclusion."}
            </Bullet>
          </div>
        </Card>

        {/* Industry comparison */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
            <Building2 className="h-4 w-4" /> Industry Comparison
            <HelpTip
              body={`Benchmarked against ${peer.peerCount} other companies in the ${stock.sector} sector inside the CGSI universe.`}
            />
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-cgsi-grey text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Metric</th>
                  <th className="px-3 py-2 text-right font-medium">{stock.ticker}</th>
                  <th className="px-3 py-2 text-right font-medium">{stock.sector} avg.</th>
                  <th className="px-3 py-2 text-right font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                <CompareRow label="ESG score" value={stock.esgScore} peer={peer.esgScore} />
                <CompareRow
                  label="Environmental"
                  value={stock.environmental}
                  peer={peer.environmental}
                />
                <CompareRow label="Social" value={stock.social} peer={peer.social} />
                <CompareRow label="Governance" value={stock.governance} peer={peer.governance} />
                <CompareRow
                  label="Emissions reduction (FY21–FY25, %)"
                  value={co2Reduction}
                  peer={peer.carbonReduction}
                />
              </tbody>
            </table>
          </div>
        </Card>

        {/* Data confidence */}
        <Card className="p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
            <ShieldCheck className="h-4 w-4" />
            Prototype Data Coverage
            <HelpTip body="How complete the illustrative profile is inside this prototype. This is not a third-party verification or live-data confidence rating." />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                conf.level === "High"
                  ? "bg-cgsi-green-soft text-emerald-800"
                  : conf.level === "Medium"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {conf.level} coverage
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-slate-700">
            {conf.reasons.map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="text-cgsi-green">•</span>
                {r}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-cgsi-navy text-white hover:opacity-90">
            <Link to="/matches">See Top Matches</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/compare">Compare Stocks</Link>
          </Button>
        </div>

        {/* Peers */}
        <div>
          <div className="mb-3 text-sm font-semibold text-cgsi-navy">
            Other stocks in the same sector
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stocks
              .filter((s) => s.sector === stock.sector && s.ticker !== stock.ticker)
              .map((s) => (
                <Link
                  key={s.ticker}
                  to="/stock/$ticker"
                  params={{ ticker: s.ticker }}
                  className="rounded-lg border bg-white p-3 text-sm transition hover:border-cgsi-navy hover:shadow-sm"
                >
                  <div className="font-medium text-cgsi-navy">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ${s.price.toFixed(2)} · {s.esgStrength} ESG · {s.risk} risk
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ===== Subcomponents & helpers =====

function AltDataCard({
  icon: Icon,
  title,
  body,
  tag,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tag: string;
}) {
  return (
    <div className="rounded-md border bg-white p-4 transition hover:border-cgsi-navy hover:shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cgsi-green-soft text-emerald-700">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold text-cgsi-navy">{title}</div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{body}</p>
      <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
        {tag}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-cgsi-grey p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-cgsi-navy">{value}</div>
    </div>
  );
}

function deriveArchetype(
  dom: { risk: string | null; esg: string | null; sector: string | null; exchange: string | null },
  unique: number,
): string {
  if (unique < 2) return "Just Exploring";
  if (dom.risk === "High" && dom.sector === "Technology") return "High-Risk Tech Enthusiast";
  if (dom.risk === "Low" && dom.esg === "Strong") return "Stability-First ESG Investor";
  if (dom.esg === "Strong" && dom.risk === "Medium") return "Growth-Tilted ESG Explorer";
  if (dom.risk === "High") return "Aggressive Growth Seeker";
  if (dom.esg === "Strong") return "Sustainability-First Investor";
  if (dom.sector) return `${dom.sector}-Focused Investor`;
  return "Balanced Explorer";
}

function buildSentimentChips(stock: Stock): { label: string; tone: "high" | "med" | "low" }[] {
  const chips: { label: string; tone: "high" | "med" | "low" }[] = [];
  if (stock.sector === "Technology") {
    chips.push({ label: "AI Ethics Liability", tone: stock.risk === "High" ? "high" : "med" });
    chips.push({ label: "Data Center Power Surge", tone: "med" });
  }
  if (stock.sector === "Energy") {
    chips.push({ label: "Carbon Transition Risk", tone: "high" });
    chips.push({ label: "Grid Reliability Watch", tone: "med" });
  }
  if (stock.sector === "Financials") {
    chips.push({ label: "Rate-Cycle Exposure", tone: "med" });
    chips.push({ label: "Climate Stress-Test Pending", tone: "low" });
  }
  if (stock.sector === "Automotive") {
    chips.push({ label: "EV Supply Chain Bottleneck", tone: "high" });
    chips.push({ label: "Battery Materials Volatility", tone: "med" });
  }
  if (stock.sector === "Industrials") {
    chips.push({ label: "Supply Chain Bottleneck", tone: "med" });
    chips.push({ label: "Decarbonisation Pressure", tone: "med" });
  }
  if (stock.risk === "High") chips.push({ label: "Elevated Volatility Signal", tone: "high" });
  if (stock.esgStrength === "Weak") chips.push({ label: "Governance Watchlist", tone: "high" });
  return chips.slice(0, 4);
}

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <div className="text-xs font-semibold text-cgsi-navy">{title}</div>
      <p className="mt-1 text-sm text-slate-700">{children}</p>
    </div>
  );
}

function CompareRow({ label, value, peer }: { label: string; value: number; peer: number }) {
  const v: Verdict = verdict(value, peer);
  const color =
    v === "Better than peers"
      ? "bg-cgsi-green-soft text-emerald-800"
      : v === "Weaker than peers"
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-700";
  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-slate-700">{label}</td>
      <td className="px-3 py-2 text-right font-semibold text-cgsi-navy tabular-nums">
        {value.toFixed(1)}
      </td>
      <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{peer.toFixed(1)}</td>
      <td className="px-3 py-2 text-right">
        <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${color}`}>
          {v}
        </span>
      </td>
    </tr>
  );
}

function ScoreCard({
  label,
  value,
  max,
  help,
}: {
  label: string;
  value: number;
  max: number;
  help: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
        {label}
        <HelpTip title={`About the ${label} score`} body={help} />
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-2xl font-semibold text-cgsi-navy">{value}</div>
        <div className="text-xs text-muted-foreground">/ {max}</div>
      </div>
      <Progress value={(value / max) * 100} className="mt-2" />
    </Card>
  );
}

function ChartCard({
  title,
  help,
  caption,
  children,
}: {
  title: string;
  help: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-1 flex items-center gap-1 text-sm font-medium text-cgsi-navy">
        {title}
        <HelpTip title={`About this chart`} body={help} />
      </div>
      {caption && <div className="mb-2 text-[11px] text-muted-foreground">{caption}</div>}
      {children}
    </Card>
  );
}

function SimpleCard({
  icon: Icon,
  title,
  body,
  score,
  peer,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  score: number;
  peer: number;
  color: "emerald" | "navy";
}) {
  return (
    <Card className="p-5">
      <div
        className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md ${
          color === "emerald" ? "bg-cgsi-green-soft text-emerald-700" : "bg-cgsi-navy text-white"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-1 text-sm font-semibold text-cgsi-navy">
        {title}
        <HelpTip title={`${title} score`} body={helpForScore(title, score, peer)} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Score: {score}/100 · peer avg {Math.round(peer)}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
    </Card>
  );
}
