import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Leaf,
  Loader2,
  Save,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { Stock } from "@/lib/cgsi-data";
import { useAuth } from "@/lib/auth";
import { sectorAverages } from "@/lib/esg-helpers";
import {
  createReviewSnapshot,
  EMPTY_WORKSPACE,
  loadInvestorWorkspace,
  saveInvestorWorkspace,
  saveReviewSnapshot,
  type DecisionChecklist,
  type InvestmentDecision,
  type InvestmentHorizon,
  type InvestorWorkspace,
  type ReviewSnapshot,
} from "@/lib/investor-workspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

type ChangeAlert = {
  label: string;
  detail: string;
  direction: "positive" | "negative" | "neutral";
};

type MaterialTopic = {
  title: string;
  pillar: "Environmental" | "Social" | "Governance";
  score: number;
  peerScore: number;
  evidence: string;
  financialChannel: string;
  status: "Leader" | "Monitor" | "Attention";
};

const CHECKLIST_ITEMS: { key: keyof DecisionChecklist; label: string }[] = [
  { key: "financialsReviewed", label: "Reviewed revenue, profit, and margin trend" },
  { key: "materialEsgReviewed", label: "Reviewed the material ESG issues below" },
  { key: "risksReviewed", label: "Reviewed risk notes and possible downside" },
  { key: "peerCompared", label: "Compared this company with sector peers" },
];

const RISK_RANK: Record<Stock["risk"], number> = { Low: 1, Medium: 2, High: 3 };

export function InvestorDecisionWorkspace({
  stock,
  stocks,
  currentPrice,
}: {
  stock: Stock;
  stocks: Stock[];
  currentPrice: number;
}) {
  const { user, profile } = useAuth();
  const [workspace, setWorkspace] = useState<InvestorWorkspace>({
    ...EMPTY_WORKSPACE,
    checklist: { ...EMPTY_WORKSPACE.checklist },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"workspace" | "snapshot" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const currentSnapshot = useMemo(
    () => createReviewSnapshot(stock, currentPrice),
    [currentPrice, stock],
  );
  const changes = useMemo(
    () => (workspace.snapshot ? buildChangeAlerts(workspace.snapshot, currentSnapshot) : []),
    [currentSnapshot, workspace.snapshot],
  );
  const materialTopics = useMemo(() => buildMaterialTopics(stock, stocks), [stock, stocks]);

  useEffect(() => {
    let active = true;
    setMessage(null);
    setLoadError(null);
    if (!user || profile?.role !== "investor") {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void loadInvestorWorkspace(user.uid, stock.ticker)
      .then((saved) => {
        if (active) setWorkspace({ ...saved, checklist: { ...saved.checklist } });
      })
      .catch(() => {
        if (active) setLoadError("Your saved workspace could not be loaded from Firebase.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.role, stock.ticker, user]);

  const completedChecklist = Object.values(workspace.checklist).filter(Boolean).length;
  const readinessItems = completedChecklist + (workspace.thesis.trim() ? 1 : 0);
  const riskOutsideLimit = RISK_RANK[stock.risk] > RISK_RANK[workspace.maxRisk];

  const saveWorkspace = async () => {
    if (!user) return;
    setSaving("workspace");
    setMessage(null);
    try {
      await saveInvestorWorkspace(user.uid, stock.ticker, workspace);
      setMessage("Decision workspace saved to Firebase.");
    } catch {
      setMessage("The workspace could not be saved. Check your Firebase connection and rules.");
    } finally {
      setSaving(null);
    }
  };

  const markReviewed = async () => {
    if (!user) return;
    setSaving("snapshot");
    setMessage(null);
    try {
      await saveInvestorWorkspace(user.uid, stock.ticker, workspace);
      await saveReviewSnapshot(user.uid, stock.ticker, currentSnapshot);
      setWorkspace((current) => ({ ...current, snapshot: currentSnapshot }));
      setMessage("Review baseline updated. Future material changes will appear here.");
    } catch {
      setMessage(
        "The review baseline could not be saved. Check your Firebase connection and rules.",
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-emerald-200">
        <div className="border-b bg-emerald-50/70 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
            <Leaf className="h-4 w-4 text-cgsi-green" /> Material ESG Map
          </div>
          <p className="mt-1 text-xs text-slate-600">
            The most decision-relevant ESG themes for {stock.sector.toLowerCase()} companies,
            connected to possible financial effects. The mapping is illustrative.
          </p>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-3">
          {materialTopics.map((topic) => (
            <div key={topic.title} className="rounded-lg border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {topic.pillar} · financially material
                  </div>
                  <div className="mt-1 text-sm font-semibold text-cgsi-navy">{topic.title}</div>
                </div>
                <StatusPill status={topic.status} />
              </div>
              <div className="mt-3 flex items-end justify-between text-xs">
                <span className="text-muted-foreground">Company / sector</span>
                <span className="font-semibold tabular-nums text-cgsi-navy">
                  {topic.score} / {Math.round(topic.peerScore)}
                </span>
              </div>
              <Progress value={topic.score} className="mt-1.5" />
              <p className="mt-3 text-xs leading-relaxed text-slate-600">{topic.evidence}</p>
              <div className="mt-3 rounded-md bg-slate-50 p-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Possible financial channel
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  {topic.financialChannel}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden border-indigo-200">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-indigo-50/60 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
              <BellRing className="h-4 w-4 text-indigo-600" /> What Changed Since Your Review?
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Only changes above a meaningful threshold are shown, reducing notification noise.
            </p>
          </div>
          {workspace.snapshot && (
            <span className="text-[10px] text-muted-foreground">
              Baseline: {formatReviewDate(workspace.snapshot.asOf)}
            </span>
          )}
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your review baseline
            </div>
          ) : !workspace.snapshot ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-slate-600">
              No review baseline yet. Mark the current information as reviewed, then this panel will
              flag material price, financial, emissions, energy, and ESG changes.
            </div>
          ) : changes.length === 0 ? (
            <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> No material changes have crossed
              the alert thresholds since your last review.
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {changes.map((change) => (
                <ChangeItem key={change.label} change={change} />
              ))}
            </div>
          )}
          {profile?.role === "investor" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={saving !== null || loading}
              onClick={() => void markReviewed()}
            >
              {saving === "snapshot" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {workspace.snapshot ? "Mark changes as reviewed" : "Set current review baseline"}
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden border-cgsi-navy/20">
        <div className="border-b bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-cgsi-navy">
            <ClipboardCheck className="h-4 w-4" /> Investment Decision Workspace
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Record your own reasoning and review process. CGSI does not treat this as an order or
            financial advice.
          </p>
        </div>

        {profile?.role !== "investor" ? (
          <div className="p-5 text-sm text-muted-foreground">
            Decision workspaces are available in investor accounts.
          </div>
        ) : (
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_0.85fr]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Current decision"
                  value={workspace.decision}
                  options={["Undecided", "Buy", "Watch", "Avoid"]}
                  onChange={(value) =>
                    setWorkspace((current) => ({
                      ...current,
                      decision: value as InvestmentDecision,
                    }))
                  }
                />
                <SelectField
                  label="Time horizon"
                  value={workspace.timeHorizon}
                  options={["Short term", "Medium term", "Long term"]}
                  onChange={(value) =>
                    setWorkspace((current) => ({
                      ...current,
                      timeHorizon: value as InvestmentHorizon,
                    }))
                  }
                />
                <SelectField
                  label="Maximum risk"
                  value={workspace.maxRisk}
                  options={["Low", "Medium", "High"]}
                  onChange={(value) =>
                    setWorkspace((current) => ({
                      ...current,
                      maxRisk: value as Stock["risk"],
                    }))
                  }
                />
              </div>

              {riskOutsideLimit && (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> This stock's{" "}
                  {stock.risk.toLowerCase()}
                  risk exceeds your selected {workspace.maxRisk.toLowerCase()} maximum.
                </div>
              )}

              <label className="block text-xs font-medium text-slate-700">
                Investment thesis
                <Textarea
                  value={workspace.thesis}
                  maxLength={1200}
                  rows={5}
                  className="mt-1.5 resize-y bg-white"
                  placeholder="Why might this company fit your goals? What evidence would change your mind?"
                  onChange={(event) =>
                    setWorkspace((current) => ({ ...current, thesis: event.target.value }))
                  }
                />
                <span className="mt-1 block text-right text-[10px] font-normal text-muted-foreground">
                  {workspace.thesis.length}/1200
                </span>
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-cgsi-navy">
                  Review checklist
                </div>
                <span className="text-xs font-medium tabular-nums text-indigo-700">
                  {readinessItems}/5 ready
                </span>
              </div>
              <Progress value={(readinessItems / 5) * 100} className="mt-2" />
              <div className="mt-4 space-y-3">
                {CHECKLIST_ITEMS.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-700"
                  >
                    <Checkbox
                      checked={workspace.checklist[item.key]}
                      onCheckedChange={(checked) =>
                        setWorkspace((current) => ({
                          ...current,
                          checklist: { ...current.checklist, [item.key]: checked === true },
                        }))
                      }
                    />
                    <span className="leading-4">{item.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                Your thesis counts as the fifth readiness item. Readiness measures process
                completion, not investment quality.
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-4 bg-cgsi-navy text-white"
                disabled={saving !== null || loading}
                onClick={() => void saveWorkspace()}
              >
                {saving === "workspace" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save workspace
              </Button>
            </div>
          </div>
        )}
        {(message || loadError) && (
          <div
            className={`border-t px-5 py-3 text-xs ${loadError || message?.includes("could not") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
          >
            {loadError ?? message}
          </div>
        )}
      </Card>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full rounded-md border bg-white px-2 text-xs text-cgsi-navy"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({ status }: { status: MaterialTopic["status"] }) {
  const style =
    status === "Leader"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Attention"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${style}`}>{status}</span>
  );
}

function ChangeItem({ change }: { change: ChangeAlert }) {
  const Icon =
    change.direction === "positive"
      ? TrendingUp
      : change.direction === "negative"
        ? TrendingDown
        : AlertTriangle;
  const style =
    change.direction === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : change.direction === "negative"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div className={`flex gap-2 rounded-lg border p-3 ${style}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="text-xs font-semibold">{change.label}</div>
        <p className="mt-0.5 text-xs opacity-90">{change.detail}</p>
      </div>
    </div>
  );
}

function buildChangeAlerts(previous: ReviewSnapshot, current: ReviewSnapshot): ChangeAlert[] {
  const alerts: ChangeAlert[] = [];
  const percentChange = (before: number, after: number) =>
    before === 0 ? 0 : ((after - before) / Math.abs(before)) * 100;
  const addPercentAlert = (
    label: string,
    before: number,
    after: number,
    threshold: number,
    higherIsPositive: boolean,
  ) => {
    const change = percentChange(before, after);
    if (Math.abs(change) < threshold) return;
    const improved = higherIsPositive ? change > 0 : change < 0;
    alerts.push({
      label,
      detail: `${formatNumber(before)} → ${formatNumber(after)} (${formatSigned(change)}%)`,
      direction: improved ? "positive" : "negative",
    });
  };
  const addPointAlert = (
    label: string,
    before: number,
    after: number,
    threshold: number,
    higherIsPositive = true,
  ) => {
    const change = after - before;
    if (Math.abs(change) < threshold) return;
    const improved = higherIsPositive ? change > 0 : change < 0;
    alerts.push({
      label,
      detail: `${formatNumber(before)} → ${formatNumber(after)} (${formatSigned(change)} points)`,
      direction: improved ? "positive" : "negative",
    });
  };

  addPercentAlert("Market price", previous.price, current.price, 2, true);
  addPointAlert("Overall ESG score", previous.esgScore, current.esgScore, 1);
  addPointAlert("Environmental score", previous.environmental, current.environmental, 3);
  addPointAlert("Social score", previous.social, current.social, 3);
  addPointAlert("Governance score", previous.governance, current.governance, 3);
  addPercentAlert("Latest revenue", previous.revenue, current.revenue, 5, true);
  addPercentAlert("Latest net income", previous.netIncome, current.netIncome, 5, true);
  addPercentAlert("Reported emissions", previous.carbonTotal, current.carbonTotal, 3, false);
  addPointAlert("Renewable energy share", previous.renewableEnergy, current.renewableEnergy, 2);
  return alerts;
}

function buildMaterialTopics(stock: Stock, stocks: Stock[]): MaterialTopic[] {
  const peer = sectorAverages(stock.sector, stocks);
  const latestEnergy = stock.energy.at(-1)?.renewable ?? 0;
  const emissionsChange = stock.carbon.length
    ? ((stock.carbon.at(-1)!.total - stock.carbon[0].total) / stock.carbon[0].total) * 100
    : 0;
  const specifications: Record<
    Stock["sector"],
    Omit<MaterialTopic, "score" | "peerScore" | "status">[]
  > = {
    Technology: [
      {
        title: "Operational energy and emissions",
        pillar: "Environmental",
        evidence: `${latestEnergy.toFixed(1)}% renewable energy; reported emissions changed ${formatSigned(emissionsChange)}% across the displayed period.`,
        financialChannel:
          "Energy costs, data-centre efficiency, transition spending, and carbon exposure.",
      },
      {
        title: "Data responsibility and customer trust",
        pillar: "Governance",
        evidence: `Governance score ${stock.governance}/100 and board independence ${stock.boardIndependence}%.`,
        financialChannel:
          "Regulatory penalties, remediation costs, customer retention, and brand value.",
      },
      {
        title: "Talent and workforce resilience",
        pillar: "Social",
        evidence: `Social score ${stock.social}/100 and workforce indicator ${stock.employeeSat.toFixed(1)}/5.`,
        financialChannel:
          "Hiring costs, productivity, innovation capacity, and operational continuity.",
      },
    ],
    Financials: [
      {
        title: "Customer trust and data security",
        pillar: "Social",
        evidence: `Social score ${stock.social}/100 and workforce indicator ${stock.employeeSat.toFixed(1)}/5.`,
        financialChannel:
          "Customer retention, fraud losses, remediation expense, and regulatory action.",
      },
      {
        title: "Business ethics and oversight",
        pillar: "Governance",
        evidence: `Governance score ${stock.governance}/100 and board independence ${stock.boardIndependence}%.`,
        financialChannel: "Compliance costs, fines, funding confidence, and cost of capital.",
      },
      {
        title: "Climate-linked financing exposure",
        pillar: "Environmental",
        evidence: `Environmental score ${stock.environmental}/100; operational emissions changed ${formatSigned(emissionsChange)}%.`,
        financialChannel:
          "Credit quality, insurance exposure, collateral values, and portfolio losses.",
      },
    ],
    Energy: [
      {
        title: "Greenhouse-gas exposure",
        pillar: "Environmental",
        evidence: `Reported emissions changed ${formatSigned(emissionsChange)}% across the displayed period.`,
        financialChannel: "Carbon costs, asset impairment, permitting risk, and operating margins.",
      },
      {
        title: "Energy transition readiness",
        pillar: "Environmental",
        evidence: `${latestEnergy.toFixed(1)}% renewable energy in the latest displayed period.`,
        financialChannel:
          "Capital expenditure, demand shifts, stranded assets, and future revenue mix.",
      },
      {
        title: "Safety and operational governance",
        pillar: "Governance",
        evidence: `Governance score ${stock.governance}/100 and board independence ${stock.boardIndependence}%.`,
        financialChannel:
          "Shutdowns, liabilities, insurance costs, licence to operate, and financing.",
      },
    ],
    Automotive: [
      {
        title: "Product lifecycle and emissions",
        pillar: "Environmental",
        evidence: `${latestEnergy.toFixed(1)}% renewable energy; reported emissions changed ${formatSigned(emissionsChange)}%.`,
        financialChannel:
          "Compliance costs, product demand, battery inputs, and manufacturing margins.",
      },
      {
        title: "Workforce and product safety",
        pillar: "Social",
        evidence: `Social score ${stock.social}/100 and workforce indicator ${stock.employeeSat.toFixed(1)}/5.`,
        financialChannel:
          "Recall costs, production continuity, legal liabilities, and brand trust.",
      },
      {
        title: "Supply-chain oversight",
        pillar: "Governance",
        evidence: `Governance score ${stock.governance}/100 and board independence ${stock.boardIndependence}%.`,
        financialChannel:
          "Input availability, ethical-sourcing exposure, delays, and working capital.",
      },
    ],
    Industrials: [
      {
        title: "Operational emissions and energy",
        pillar: "Environmental",
        evidence: `${latestEnergy.toFixed(1)}% renewable energy; reported emissions changed ${formatSigned(emissionsChange)}%.`,
        financialChannel:
          "Energy expense, carbon costs, efficiency investment, and contract eligibility.",
      },
      {
        title: "Worker health and safety",
        pillar: "Social",
        evidence: `Social score ${stock.social}/100 and workforce indicator ${stock.employeeSat.toFixed(1)}/5.`,
        financialChannel: "Downtime, compensation costs, productivity, and labour availability.",
      },
      {
        title: "Operational oversight",
        pillar: "Governance",
        evidence: `Governance score ${stock.governance}/100 and board independence ${stock.boardIndependence}%.`,
        financialChannel: "Execution risk, compliance, contract confidence, and cost of capital.",
      },
    ],
  };

  const scoreFor = (pillar: MaterialTopic["pillar"]) =>
    pillar === "Environmental"
      ? stock.environmental
      : pillar === "Social"
        ? stock.social
        : stock.governance;
  const peerFor = (pillar: MaterialTopic["pillar"]) =>
    pillar === "Environmental"
      ? peer.environmental
      : pillar === "Social"
        ? peer.social
        : peer.governance;

  return specifications[stock.sector].map((topic) => {
    const score = scoreFor(topic.pillar);
    const peerScore = peerFor(topic.pillar);
    const status =
      score >= peerScore + 4 && score >= 70
        ? "Leader"
        : score <= peerScore - 4 || score < 60
          ? "Attention"
          : "Monitor";
    return { ...topic, score, peerScore, status };
  });
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatNumber(value: number) {
  return Math.abs(value) >= 1_000
    ? new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value)
    : value.toFixed(1);
}

function formatReviewDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "previous review" : date.toLocaleString();
}
