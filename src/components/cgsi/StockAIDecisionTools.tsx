import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Brain, Gauge, Link2, Loader2, Sparkles } from "lucide-react";
import type { Stock } from "@/lib/cgsi-data";
import { toDecisionStockContext } from "@/lib/decision-ai-context";
import {
  getAIDecisionBrief,
  getAIEsgFinancialBridge,
  getAIEsgScenario,
} from "@/lib/decision-ai.functions";
import {
  fallbackDecisionBrief,
  fallbackImpactBridge,
  fallbackScenario,
} from "@/lib/decision-ai-fallbacks";
import type {
  ConfidenceLevel,
  DecisionBriefMode,
  DecisionBriefResult,
  ImpactBridgeResult,
  ScenarioIntensity,
  ScenarioResult,
  ScenarioType,
} from "@/lib/decision-ai.types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIFeedback } from "@/components/cgsi/AIFeedback";

const BRIEF_MODES: Array<{ value: DecisionBriefMode; label: string; description: string }> = [
  { value: "30-second", label: "30-second", description: "Fast scan · key points only" },
  { value: "beginner", label: "Beginner", description: "Plain English · terms explained" },
  { value: "detailed", label: "Detailed", description: "Benchmarks · evidence · financial links" },
];

const SCENARIOS: ScenarioType[] = [
  "Higher carbon pricing",
  "Stricter emissions regulation",
  "Increased renewable-energy adoption",
  "Supply-chain disruption",
  "New AI-governance requirements",
];

const INTENSITIES: ScenarioIntensity[] = ["Moderate", "Elevated", "Severe"];

type ResultSource = "groq" | "fallback" | null;

export function StockAIDecisionTools({ stock, stocks }: { stock: Stock; stocks: Stock[] }) {
  const context = useMemo(() => toDecisionStockContext(stock, stocks), [stock, stocks]);
  const [briefMode, setBriefMode] = useState<DecisionBriefMode>("30-second");
  const [scenario, setScenario] = useState<ScenarioType>(SCENARIOS[0]);
  const [intensity, setIntensity] = useState<ScenarioIntensity>("Moderate");
  const [bridge, setBridge] = useState<ImpactBridgeResult | null>(null);
  const [brief, setBrief] = useState<DecisionBriefResult | null>(null);
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState<"bridge" | "brief" | "scenario" | null>(null);
  const [bridgeSource, setBridgeSource] = useState<ResultSource>(null);
  const [briefSource, setBriefSource] = useState<ResultSource>(null);
  const [scenarioSource, setScenarioSource] = useState<ResultSource>(null);

  useEffect(() => {
    setBrief(null);
    setBriefSource(null);
  }, [briefMode]);

  useEffect(() => {
    setScenarioResult(null);
    setScenarioSource(null);
  }, [scenario, intensity]);

  const runBridge = async () => {
    setLoading("bridge");
    try {
      const result = await getAIEsgFinancialBridge({ data: { stock: context } });
      setBridge(result);
      setBridgeSource("groq");
    } catch {
      const result = fallbackImpactBridge(context);
      setBridge(result);
      setBridgeSource("fallback");
    } finally {
      setLoading(null);
    }
  };

  const runBrief = async () => {
    setLoading("brief");
    try {
      const result = await getAIDecisionBrief({ data: { stock: context, mode: briefMode } });
      setBrief(result);
      setBriefSource("groq");
    } catch {
      const result = fallbackDecisionBrief(context, briefMode);
      setBrief(result);
      setBriefSource("fallback");
    } finally {
      setLoading(null);
    }
  };

  const runScenario = async () => {
    setLoading("scenario");
    try {
      const result = await getAIEsgScenario({ data: { stock: context, scenario, intensity } });
      setScenarioResult(result);
      setScenarioSource("groq");
    } catch {
      const result = fallbackScenario(context, scenario, intensity);
      setScenarioResult(result);
      setScenarioSource("fallback");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="overflow-hidden border-indigo-200">
      <div className="border-b bg-gradient-to-r from-indigo-50 to-emerald-50 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
          <Brain className="h-4 w-4 text-indigo-600" /> AI Decision Intelligence
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Explore financial channels, organise evidence, and test assumptions. Illustrative analysis
          only—not a forecast or recommendation.
        </p>
      </div>

      <Tabs defaultValue="bridge" className="p-3 sm:p-5">
        <TabsList className="grid h-auto w-full grid-cols-3 bg-slate-100 p-1">
          <TabsTrigger value="bridge" className="px-1.5 py-2 text-[10px] sm:text-xs">
            Impact Bridge
          </TabsTrigger>
          <TabsTrigger value="brief" className="px-1.5 py-2 text-[10px] sm:text-xs">
            Decision Brief
          </TabsTrigger>
          <TabsTrigger value="scenario" className="px-1.5 py-2 text-[10px] sm:text-xs">
            Scenario Explorer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bridge" className="mt-4 space-y-3">
          <ToolIntro
            icon={Link2}
            title="ESG-to-Financial Impact Bridge"
            body="Connects displayed ESG signals to possible costs, margins, financing, and operational channels."
          />
          <Button
            type="button"
            size="sm"
            className="bg-cgsi-navy text-white"
            disabled={loading !== null}
            onClick={() => void runBridge()}
          >
            {loading === "bridge" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles />}
            {bridge ? "Refresh bridge" : "Generate impact bridge"}
          </Button>
          {bridge && (
            <div className="space-y-3">
              <ResultSourceBadge source={bridgeSource} />
              {bridge.items.map((item) => (
                <div key={item.issue} className="rounded-lg border bg-white p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                        {item.issue}
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{item.signal}</p>
                    </div>
                    <ConfidencePill level={item.confidence} />
                  </div>
                  <div className="mt-3 flex gap-2 rounded-md bg-slate-50 p-2.5">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cgsi-green" />
                    <div>
                      <div className="text-[10px] font-medium uppercase text-muted-foreground">
                        Possible financial channel · {item.timeHorizon}
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
                        {item.financialChannel}
                      </p>
                    </div>
                  </div>
                  <TwoColumnLists evidence={item.evidence} assumptions={item.assumptions} />
                </div>
              ))}
              <Limitations items={bridge.limitations} />
              <AIFeedback feature="impact_bridge" tickers={[context.ticker]} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="brief" className="mt-4 space-y-3">
          <ToolIntro
            icon={Activity}
            title="Before You Decide"
            body="A neutral checklist of fit, risk, financial context, and information gaps."
          />
          <div className="flex flex-wrap gap-1.5">
            {BRIEF_MODES.map((mode) => (
              <Button
                key={mode.value}
                type="button"
                size="sm"
                variant={briefMode === mode.value ? "default" : "outline"}
                className={
                  briefMode === mode.value ? "h-8 bg-cgsi-navy text-xs text-white" : "h-8 text-xs"
                }
                disabled={loading === "brief"}
                onClick={() => setBriefMode(mode.value)}
              >
                {mode.label}
              </Button>
            ))}
          </div>
          <div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              {BRIEF_MODES.find((mode) => mode.value === briefMode)?.label} format
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              {BRIEF_MODES.find((mode) => mode.value === briefMode)?.description}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-cgsi-navy text-white"
            disabled={loading !== null}
            onClick={() => void runBrief()}
          >
            {loading === "brief" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles />}
            {brief ? "Regenerate brief" : "Create decision brief"}
          </Button>
          {brief && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ResultSourceBadge source={briefSource} />
                <span className="inline-flex rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700">
                  {BRIEF_MODES.find((mode) => mode.value === briefMode)?.label} brief
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <BriefList title="Why it may fit" items={brief.fitReasons} tone="positive" />
                <BriefList title="Risks to examine" items={brief.risks} tone="warning" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <FactPanel title="Strongest ESG factor" {...brief.strongestEsgFactor} />
                <FactPanel title="Important financial factor" {...brief.importantFinancialFactor} />
              </div>
              <Limitations title="Missing or uncertain information" items={brief.uncertainties} />
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-indigo-700">
                  Suggested next action
                </div>
                <p className="mt-1 text-sm text-slate-700">{brief.nextAction}</p>
              </div>
              <AIFeedback feature="decision_brief" tickers={[context.ticker]} context={briefMode} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="scenario" className="mt-4 space-y-3">
          <ToolIntro
            icon={Gauge}
            title="ESG Scenario Explorer"
            body="Tests possible financial pressure using qualitative ranges and explicit assumptions."
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Scenario
              <select
                value={scenario}
                onChange={(event) => setScenario(event.target.value as ScenarioType)}
                className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-xs normal-case text-cgsi-navy"
              >
                {SCENARIOS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Intensity
              </div>
              <div className="mt-1 flex gap-1">
                {INTENSITIES.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={intensity === item ? "default" : "outline"}
                    className={
                      intensity === item
                        ? "h-9 bg-cgsi-navy px-2 text-[10px] text-white"
                        : "h-9 px-2 text-[10px]"
                    }
                    onClick={() => setIntensity(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-cgsi-navy text-white"
            disabled={loading !== null}
            onClick={() => void runScenario()}
          >
            {loading === "scenario" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles />}
            Run scenario
          </Button>
          {scenarioResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ResultSourceBadge source={scenarioSource} />
                <ConfidencePill level={scenarioResult.confidence} />
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {scenarioResult.summary}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {scenarioResult.affectedMetrics.map((metric) => (
                  <div key={metric.metric} className="rounded-lg border bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-cgsi-navy">{metric.metric}</span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        {metric.impactRange}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">
                      {metric.direction}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      {metric.rationale}
                    </p>
                  </div>
                ))}
              </div>
              <TwoColumnLists
                evidence={scenarioResult.assumptions}
                assumptions={scenarioResult.uncertainties}
                evidenceTitle="Assumptions"
                assumptionsTitle="Uncertainties"
              />
              <AIFeedback
                feature="scenario_explorer"
                tickers={[context.ticker]}
                context={`${scenario} · ${intensity}`}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ToolIntro({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold text-cgsi-navy">{title}</div>
        <p className="mt-0.5 text-xs text-slate-600">{body}</p>
      </div>
    </div>
  );
}

function ResultSourceBadge({ source }: { source: ResultSource }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
      {source === "groq"
        ? "Groq-generated · grounded in displayed data"
        : "Structured local fallback"}
    </span>
  );
}

function ConfidencePill({ level }: { level: ConfidenceLevel }) {
  const style =
    level === "High"
      ? "bg-emerald-50 text-emerald-700"
      : level === "Medium"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${style}`}>
      {level} confidence
    </span>
  );
}

function TwoColumnLists({
  evidence,
  assumptions,
  evidenceTitle = "Displayed evidence",
  assumptionsTitle = "Important assumptions",
}: {
  evidence: string[];
  assumptions: string[];
  evidenceTitle?: string;
  assumptionsTitle?: string;
}) {
  return (
    <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
      <SmallList title={evidenceTitle} items={evidence} />
      <SmallList title={assumptionsTitle} items={assumptions} />
    </div>
  );
}

function SmallList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <ul className="mt-1 space-y-1 text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="text-cgsi-green">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Limitations({ title = "Limitations", items }: { title?: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-amber-800">{title}</div>
      <ul className="mt-1 space-y-1 text-xs text-amber-900">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function BriefList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "warning";
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${tone === "positive" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}
    >
      <div className="text-xs font-semibold text-cgsi-navy">{title}</div>
      <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span>{tone === "positive" ? "✓" : "!"}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FactPanel({
  title,
  factor,
  evidence,
}: {
  title: string;
  factor: string;
  evidence: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="mt-1 text-sm font-semibold text-cgsi-navy">{factor}</div>
      <p className="mt-1 text-xs text-slate-600">{evidence}</p>
    </div>
  );
}
