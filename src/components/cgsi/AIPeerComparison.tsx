import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CircleAlert,
  Loader2,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { Stock } from "@/lib/cgsi-data";
import { toDecisionStockContext } from "@/lib/decision-ai-context";
import { getAIEsgPeerComparison } from "@/lib/decision-ai.functions";
import { fallbackPeerComparison } from "@/lib/decision-ai-fallbacks";
import type { PeerComparisonResult, PeerQuestion } from "@/lib/decision-ai.types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AIFeedback } from "@/components/cgsi/AIFeedback";

const QUESTIONS: PeerQuestion[] = [
  "Overall ESG differences",
  "Stronger governance",
  "Climate transition credibility",
  "Evidence quality",
  "Largest ESG-related financial exposure",
];

export function AIPeerComparison({ stocks, catalogue }: { stocks: Stock[]; catalogue: Stock[] }) {
  const contexts = useMemo(
    () => stocks.map((stock) => toDecisionStockContext(stock, catalogue)),
    [catalogue, stocks],
  );
  const tickerKey = stocks.map((stock) => stock.ticker).join("|");
  const [question, setQuestion] = useState<PeerQuestion>(QUESTIONS[0]);
  const [result, setResult] = useState<PeerComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"groq" | "fallback" | null>(null);

  useEffect(() => {
    setResult(null);
    setSource(null);
  }, [tickerKey, question]);

  const runComparison = async () => {
    if (contexts.length < 2) return;
    setLoading(true);
    try {
      const response = await getAIEsgPeerComparison({
        data: { stocks: contexts, question },
      });
      setResult(response);
      setSource("groq");
    } catch (error) {
      if (import.meta.env.DEV) console.error("AI peer comparison failed; using fallback.", error);
      const response = fallbackPeerComparison(contexts, question);
      setResult(response);
      setSource("fallback");
    } finally {
      setLoading(false);
    }
  };

  if (stocks.length < 2) {
    return (
      <Card className="border-dashed p-5 text-center text-sm text-muted-foreground">
        Select at least two stocks to unlock the AI ESG Peer Comparison.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-indigo-200">
      <div className="border-b bg-gradient-to-r from-indigo-50 to-emerald-50 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
          <BarChart3 className="h-4 w-4 text-indigo-600" /> AI ESG Peer Comparison
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Ask one focused question, rank the displayed evidence, and connect ESG differences to
          possible financial relevance without a buy/sell recommendation.
        </p>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Investor question
            <select
              value={question}
              onChange={(event) => setQuestion(event.target.value as PeerQuestion)}
              className="mt-1 h-9 w-full rounded-md border bg-white px-2 text-xs normal-case text-cgsi-navy"
            >
              {QUESTIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            size="sm"
            className="h-9 bg-cgsi-navy text-white"
            disabled={loading}
            onClick={() => void runComparison()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles />}
            Analyse peers
          </Button>
        </div>

        {result && (
          <div className="space-y-4">
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
              {source === "groq"
                ? "Groq-generated · grounded in displayed data"
                : "Structured local fallback"}
            </span>

            <section className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                Direct answer · {question}
              </div>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-cgsi-navy">
                {result.directAnswer}
              </p>
            </section>

            <section>
              <SectionTitle>Question-specific ranking</SectionTitle>
              <p className="mt-1 text-xs text-slate-500">
                Ranked only for “{question}”, not as an overall investment ranking.
              </p>
              <div className="mt-2 grid gap-2">
                {[...result.companyAssessments]
                  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                  .map((item) => (
                    <div key={item.ticker} className="rounded-lg border bg-white p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                          {item.rank ?? "—"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-cgsi-navy">
                              {item.ticker}
                            </span>
                            {item.rank === 1 && <Trophy className="h-3.5 w-3.5 text-amber-600" />}
                            <span className="text-xs font-medium text-slate-700">
                              {item.verdict}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-700">
                            {item.rationale}
                          </p>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                            Caveat: {item.caveat}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <section>
              <SectionTitle>Comparable facts</SectionTitle>
              <div className="mt-2 hidden overflow-x-auto rounded-lg border sm:block">
                <table className="w-full min-w-[520px] text-xs">
                  <thead className="bg-slate-50 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Metric</th>
                      {stocks.map((stock) => (
                        <th key={stock.ticker} className="px-3 py-2 text-left font-medium">
                          {stock.ticker}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.comparableFacts.map((fact) => (
                      <tr key={fact.metric}>
                        <td className="px-3 py-2 font-medium text-cgsi-navy">{fact.metric}</td>
                        {stocks.map((stock) => (
                          <td key={stock.ticker} className="px-3 py-2 tabular-nums text-slate-700">
                            {fact.values.find((value) => value.ticker === stock.ticker)?.value ??
                              "—"}
                          </td>
                        ))}
                        <td className="max-w-[240px] px-3 py-2 text-slate-600">
                          {fact.interpretation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 grid gap-2 sm:hidden">
                {result.comparableFacts.map((fact) => (
                  <div key={fact.metric} className="rounded-lg border bg-white p-3">
                    <div className="text-xs font-semibold text-cgsi-navy">{fact.metric}</div>
                    <dl className="mt-2 grid gap-1.5">
                      {stocks.map((stock) => (
                        <div key={stock.ticker} className="flex items-start justify-between gap-3">
                          <dt className="font-mono text-[11px] font-medium text-slate-500">
                            {stock.ticker}
                          </dt>
                          <dd className="text-right text-xs font-medium tabular-nums text-slate-700">
                            {fact.values.find((value) => value.ticker === stock.ticker)?.value ??
                              "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-2 border-t pt-2 text-[11px] leading-relaxed text-slate-500">
                      {fact.interpretation}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <ListPanel title="Important differences" items={result.importantDifferences} />
              <ListPanel title="Missing data" items={result.missingData} warning />
            </div>

            <section>
              <SectionTitle>Why the differences may matter financially</SectionTitle>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.financialRelevance.map((item) => (
                  <div
                    key={item.ticker}
                    className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3"
                  >
                    <div className="font-mono text-xs font-semibold text-cgsi-navy">
                      {item.ticker}
                    </div>
                    <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-700">
                      {item.esgSignal}
                    </p>
                    <div className="mt-2 flex gap-1.5 text-xs leading-relaxed text-slate-600">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cgsi-green" />
                      <span>{item.possibleFinancialEffect}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionTitle>Evidence quality</SectionTitle>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.evidenceQuality.map((item) => (
                  <div key={item.ticker} className="rounded-lg border bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-cgsi-navy">
                        {item.ticker}
                      </span>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {item.level}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.reason}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                  Cross-sector caution
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-900">{result.sectorCaveat}</p>
              </div>
            </div>

            <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                  Suggested research step
                </div>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">{result.nextStep}</p>
              </div>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-indigo-700">
                Neutral conclusion
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{result.conclusion}</p>
            </div>
            <AIFeedback
              feature="peer_comparison"
              tickers={contexts.map((stock) => stock.ticker)}
              context={question}
            />
          </div>
        )}

        {!result && !loading && (
          <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
            Choose a question and generate a structured comparison of the selected companies.
          </div>
        )}
      </div>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-cgsi-navy">{children}</h3>
  );
}

function ListPanel({
  title,
  items,
  warning = false,
}: {
  title: string;
  items: string[];
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${warning ? "border-amber-200 bg-amber-50/60" : "bg-slate-50"}`}
    >
      <div className="text-xs font-semibold text-cgsi-navy">{title}</div>
      <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className={warning ? "text-amber-700" : "text-cgsi-green"}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
