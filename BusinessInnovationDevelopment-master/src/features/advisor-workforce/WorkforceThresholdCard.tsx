import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * WorkforceThresholdCard.tsx
 * ------------------------------------------------------------------
 * A fourth card for the Rules tab, letting an advisor set the band
 * cutoffs for the AI Workforce Score.
 *
 * Deliberately mirrors the three risk tier accordions already on that
 * screen: same border-l-4 colour bar, same Configure/Enlarge toggle,
 * same criteria block. It shares the parent's expandedSettingsRisk
 * state so only one card is open at a time.
 *
 * Why this exists: parseBmc already accepts a riskInstructionBar
 * assembled from this screen, so advisor-configurable grading is the
 * established pattern here. The business case is that an advisor
 * covering manufacturing and one covering software should not be
 * forced onto the same silent displacement cutoff.
 * ------------------------------------------------------------------
 */

export interface WorkforceThresholds {
  responsible: number;
  watch: number;
  caution: number;
}

export const DEFAULT_WORKFORCE_THRESHOLDS: WorkforceThresholds = {
  responsible: 70,
  watch: 50,
  caution: 30,
};

/**
 * Builds the prompt fragment passed to scanWorkforce as
 * thresholdInstruction. Mirrors how riskInstructionBar is assembled
 * from the three tier textareas above it.
 *
 * Returns an empty string when the thresholds are unchanged, so the
 * default prompt is not padded with a redundant instruction.
 */
export function buildThresholdInstruction(t: WorkforceThresholds): string {
  const isDefault =
    t.responsible === DEFAULT_WORKFORCE_THRESHOLDS.responsible &&
    t.watch === DEFAULT_WORKFORCE_THRESHOLDS.watch &&
    t.caution === DEFAULT_WORKFORCE_THRESHOLDS.caution;

  if (isDefault) return "";

  return `
This advisor has set custom status bands. Override the default bands with these:
- Responsible: ${t.responsible} and above
- Watch: ${t.watch} to ${t.responsible - 1}
- Caution: ${t.caution} to ${t.watch - 1}
- Silent displacement: below ${t.caution}`;
}

/**
 * Returns a validation message when the bands are out of order, or
 * null when they are usable. Descending order matters because the
 * bands are read top down when assigning a status.
 */
export function validateThresholds(t: WorkforceThresholds): string | null {
  if (t.responsible <= t.watch) {
    return "Responsible must be higher than Watch.";
  }
  if (t.watch <= t.caution) {
    return "Watch must be higher than Caution.";
  }
  if (t.caution < 1) {
    return "Caution must be at least 1, so silent displacement has a range.";
  }
  return null;
}

interface WorkforceThresholdCardProps {
  thresholds: WorkforceThresholds;
  onChange: (next: WorkforceThresholds) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function WorkforceThresholdCard({
  thresholds,
  onChange,
  isExpanded,
  onToggle,
}: WorkforceThresholdCardProps) {
  const validationError = validateThresholds(thresholds);

  const bands: Array<{ key: keyof WorkforceThresholds; label: string; hint: string }> = [
    { key: "responsible", label: "Responsible", hint: "and above" },
    { key: "watch", label: "Watch", hint: "and above" },
    { key: "caution", label: "Caution", hint: "and above" },
  ];

  return (
    <div className="bg-white border border-l-4 border-l-[#F27D26] rounded-xl overflow-hidden shadow-3xs transition-all duration-200">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3.5 text-left font-sans cursor-pointer hover:bg-slate-50/75 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#F27D26]" />
          <span className="text-[10px] font-bold text-[#F27D26] uppercase tracking-widest font-mono">
            AI Workforce Thresholds
          </span>
        </div>
        <span className="text-[9px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1 shrink-0">
          {isExpanded ? "Collapse" : "Configure/Enlarge"}
          {isExpanded ? <ChevronUp className="w-3" /> : <ChevronDown className="w-3" />}
        </span>
      </button>

      {isExpanded && (
        <div className="p-3.5 pt-0 border-t border-slate-100 animate-fade-in space-y-2.5 text-left">
          <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest block mt-2">
            Score band cutoffs:
          </span>

          <p className="text-[9.5px] text-slate-500 leading-relaxed font-sans">
            Sets where the AI Workforce Score changes status. Sectors automate at
            different rates, so a cutoff that is fair in software may be too
            lenient in manufacturing.
          </p>

          <div className="space-y-2">
            {bands.map(({ key, label, hint }) => (
              <div
                key={key}
                className="flex items-center justify-between bg-slate-50 border border-slate-150 px-2.5 py-2 rounded-lg"
              >
                <span className="text-[9.5px] font-extrabold text-slate-700 uppercase tracking-wider">
                  {label}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={thresholds[key]}
                    onChange={(e) =>
                      onChange({ ...thresholds, [key]: Number(e.target.value) })
                    }
                    className="w-14 bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-mono font-bold text-slate-850 text-right focus:outline-none focus:border-[#F27D26]"
                  />
                  <span className="text-[8.5px] font-mono text-slate-400 uppercase w-16">
                    {hint}
                  </span>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between bg-rose-50/60 border border-rose-150 px-2.5 py-2 rounded-lg">
              <span className="text-[9.5px] font-extrabold text-rose-700 uppercase tracking-wider">
                Silent Displacement
              </span>
              <span className="text-[9.5px] font-mono font-bold text-rose-700">
                below {thresholds.caution}
              </span>
            </div>
          </div>

          {validationError && (
            <p className="text-[9.5px] text-red-600 font-medium font-sans leading-relaxed">
              {validationError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
