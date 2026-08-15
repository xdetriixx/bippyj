import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { ArrowDown, Database, Cpu, UserCog, Lightbulb, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works · CGSI" },
      { name: "description", content: "How the CGSI Decision Intelligence Assistant turns ESG and financial data into simpler, more confident investment decisions." },
    ],
  }),
  component: HowItWorks,
});

const flow = [
  { icon: Database, title: "CGSI ESG + Financial Data", desc: "Live ESG scores, financial fundamentals, and market data from CGSI's research universe." },
  { icon: Cpu, title: "AI Processing Engine", desc: "Normalises ESG metrics, scores risk, and matches them against investor profiles." },
  { icon: UserCog, title: "User Behaviour & Preference Analysis", desc: "Tracks browsing patterns, risk appetite, sector interest, and comparison habits." },
  { icon: Lightbulb, title: "Simplified Recommendations & Nudges", desc: "Plain-English explanations, personalised matches, and behavioural nudges." },
  { icon: CheckCircle2, title: "Faster, More Confident Decisions", desc: "Investors act with clearer context and less cognitive overload." },
];

const benefits = [
  "Reduces cognitive overload",
  "Simplifies complex ESG and financial information",
  "Helps beginner investors understand ESG data",
  "Improves investor confidence",
  "Encourages better use of CGSI ESG insights",
  "Reduces emotional and impulsive investing behaviour",
];

function HowItWorks() {
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-cgsi-navy">How It Works</h1>
          <p className="text-sm text-muted-foreground">
            The CGSI Decision Intelligence Assistant is an added decision-support layer inside CGSI's existing investment platform.
          </p>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {flow.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative">
                  <div className="rounded-lg border bg-cgsi-grey p-4">
                    <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-cgsi-navy text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="text-sm font-semibold text-cgsi-navy">{step.title}</div>
                    <div className="mt-1 text-xs text-slate-600">{step.desc}</div>
                  </div>
                  {i < flow.length - 1 && (
                    <ArrowDown className="absolute left-1/2 top-full hidden h-4 w-4 -translate-x-1/2 translate-y-1 text-muted-foreground md:hidden" />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-cgsi-navy">Why this is useful</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {benefits.map((b) => (
              <div key={b} className="flex items-start gap-3 rounded-lg border bg-white p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cgsi-green" />
                <div className="text-sm text-slate-700">{b}</div>
              </div>
            ))}
          </div>
        </div>

        <Card className="p-5">
          <div className="text-sm font-semibold text-cgsi-navy">Where the data comes from</div>
          <p className="mt-1 text-sm text-slate-700">
            This prototype uses sample data. In the real CGSI platform, the assistant would draw from:
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-700 md:grid-cols-2">
            {[
              "Company annual reports",
              "Company sustainability reports",
              "SGX disclosures and filings",
              "Third-party ESG rating providers",
              "CGSI market and pricing data",
              "CGSI research reports",
              "Anonymised user behaviour on the CGSI platform",
            ].map((d) => (
              <li key={d} className="flex gap-1.5">
                <span className="text-cgsi-green">•</span>
                {d}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="border-l-4 border-l-cgsi-red p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-cgsi-red">Prototype Scope</div>
          <p className="mt-1 text-sm text-slate-700">
            This is a clickable prototype built for academic evaluation. Sample data is realistic but illustrative. The
            architecture is designed to plug into CGSI's existing ESG and financial data feeds.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
