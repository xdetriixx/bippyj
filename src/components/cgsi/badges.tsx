import { Badge } from "@/components/ui/badge";
import type { EsgStrength, RiskLevel } from "@/lib/cgsi-data";

export function RiskBadge({ level }: { level: RiskLevel }) {
  const styles =
    level === "Low"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : level === "Medium"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : "bg-red-100 text-red-800 border-red-200";
  return <Badge variant="outline" className={styles}>{level} Risk</Badge>;
}

export function EsgBadge({ strength, score }: { strength: EsgStrength; score?: number }) {
  const styles =
    strength === "Strong"
      ? "bg-cgsi-green-soft text-emerald-800 border-emerald-200"
      : strength === "Average"
        ? "bg-slate-100 text-slate-700 border-slate-200"
        : "bg-orange-100 text-orange-800 border-orange-200";
  return (
    <Badge variant="outline" className={styles}>
      ESG {strength}
      {typeof score === "number" ? ` · ${score}` : ""}
    </Badge>
  );
}

export function MatchBadge({ score }: { score: number }) {
  return (
    <Badge variant="outline" className="bg-indigo-50 text-indigo-800 border-indigo-200">
      {score}% Match
    </Badge>
  );
}
