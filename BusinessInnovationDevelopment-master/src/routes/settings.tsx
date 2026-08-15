import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useBehavior } from "@/lib/behavior-store";
import { Bell, Sparkles, BookOpen, RefreshCw, HardDrive } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "User Settings · CGSI" },
      {
        name: "description",
        content: "Manage your notification, recommendation, and explanation preferences.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { prefs, setPref, resetPrefs, recentViews, bias } = useBehavior();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-cgsi-navy">User Settings</h1>
          <p className="text-sm text-muted-foreground">
            Control how the AI assistant communicates with you. Changes save automatically and
            persist on this device.
          </p>
        </div>

        <Card className="divide-y">
          <Row
            icon={Bell}
            title="Behavioural nudges"
            desc="Show a popup when you may be experiencing decision fatigue after viewing many stocks quickly."
            checked={!prefs.disableNudge}
            onChange={(v) => setPref("disableNudge", !v)}
            statusOn="Enabled — nudges will appear after 8+ unique stock views"
            statusOff="Disabled — nudges will not appear"
          />
          <Row
            icon={Sparkles}
            title="AI recommendation cards"
            desc="Show personalised stock recommendations based on your recent browsing behaviour."
            checked={!prefs.disableRecommendation}
            onChange={(v) => setPref("disableRecommendation", !v)}
            statusOn="Enabled — recommendations appear after 4+ similar views"
            statusOff="Disabled — no recommendation popups"
          />
          <Row
            icon={BookOpen}
            title="Default to Simple ESG view"
            desc="Open every stock page in Simplified ESG mode with beginner-friendly explanations."
            checked={prefs.simpleMode}
            onChange={(v) => setPref("simpleMode", v)}
            statusOn="Enabled — Simplified ESG view opens by default"
            statusOff="Disabled — Normal ESG view opens by default"
          />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-cgsi-navy">
                Your current behavioural profile
              </div>
              <div className="text-xs text-muted-foreground">
                Built from your last 10 minutes of activity. This drives matching and
                recommendations.
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={resetPrefs}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reset preferences
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Unique stocks viewed"
              value={String(new Set(recentViews.map((v) => v.ticker)).size)}
            />
            <Stat label="Top risk pattern" value={topKey(bias.risk) ?? "—"} />
            <Stat label="Top ESG pattern" value={topKey(bias.esg) ?? "—"} />
            <Stat label="Top sector" value={topKey(bias.sector) ?? "—"} />
          </div>
        </Card>

        <Card className="border-l-4 border-l-cgsi-navy p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-cgsi-navy">
            <HardDrive className="h-4 w-4" /> Where your settings are stored
          </div>
          <p className="mt-1 text-sm text-slate-700">
            Preferences, recent stock views, and comparison choices remain only in this browser's
            local storage. They are not written to Firebase.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function topKey(rec: Record<string, number>): string | null {
  let key: string | null = null;
  let max = 0;
  for (const k in rec)
    if (rec[k] > max) {
      max = rec[k];
      key = k;
    }
  return key;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-cgsi-grey p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold text-cgsi-navy">{value}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  desc,
  checked,
  onChange,
  statusOn,
  statusOff,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  statusOn: string;
  statusOff: string;
}) {
  return (
    <div className="flex items-start gap-4 p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cgsi-navy text-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-cgsi-navy">{title}</div>
        <p className="mt-0.5 text-xs text-slate-600">{desc}</p>
        <div
          className={`mt-1.5 text-[11px] font-medium ${checked ? "text-emerald-700" : "text-muted-foreground"}`}
        >
          {checked ? statusOn : statusOff}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
