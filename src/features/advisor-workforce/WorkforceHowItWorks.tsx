import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { PILLAR_LABELS } from "./types";

/**
 * WorkforceHowItWorks.tsx
 * ------------------------------------------------------------------
 * The explainer behind the ? icon above the score.
 *
 * Built as an accordion rather than a popover on purpose. HelpTip in
 * components/cgsi uses a Radix Popover, which portals to document.body
 * and would render outside the phone chassis, and its 288px width is
 * too narrow for this much content. HelpTip stays the right tool for
 * short one-line tips.
 *
 * The fourth block matters most. If an assessor taps this during a
 * demo, the hypothesis behind the whole feature is stated inside the
 * product rather than only on a slide.
 * ------------------------------------------------------------------
 */

const PILLAR_NOTES: Array<{ label: string; note: string }> = [
  {
    label: PILLAR_LABELS.reskillingInvestment,
    note: "Does the company disclose budget, enrolment numbers, or training hours for helping staff transition as AI is adopted?",
  },
  {
    label: PILLAR_LABELS.displacementRisk,
    note: "Is headcount falling in routine roles while AI and automation hiring rises, with little workforce support disclosed? A LOW score here means HIGH risk.",
  },
  {
    label: PILLAR_LABELS.newRoleCreation,
    note: "Is the company creating AI-complementary roles or internal mobility pathways for staff whose roles are affected?",
  },
];

const BANDS: Array<{ label: string; range: string; dot: string }> = [
  { label: "Responsible", range: "70 to 100", dot: "bg-emerald-500" },
  { label: "Watch", range: "50 to 69", dot: "bg-indigo-500" },
  { label: "Caution", range: "30 to 49", dot: "bg-amber-500" },
  { label: "Silent displacement", range: "below 30", dot: "bg-rose-500" },
];

export default function WorkforceHowItWorks() {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="How the AI Workforce Score works"
        title="How this works"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#F27D26] transition-colors cursor-pointer shrink-0"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl shadow-3xs animate-fade-in text-left">
      <div className="flex items-start justify-between p-3.5 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-[#F27D26] shrink-0" />
          <span className="text-[10.5px] font-sans font-black text-slate-900 uppercase tracking-wider leading-none">
            How This Works
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close explanation"
          className="bg-slate-100 hover:bg-slate-200 text-slate-450 hover:text-slate-800 p-1 rounded-full cursor-pointer shrink-0 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="p-3.5 pt-3 space-y-3.5">
        {/* 1. What it measures */}
        <div className="space-y-1">
          <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest block">
            What this measures
          </span>
          <p className="text-[10px] text-slate-650 leading-relaxed font-sans">
            The score reads the company's own published disclosure. It measures what a
            company <strong>reports</strong> about workforce transition, not what it
            does. A low score means transition planning is not evidenced in this
            document, which may reflect either an absence of planning or an absence of
            reporting on it.
          </p>
        </div>

        {/* 2. The three pillars */}
        <div className="space-y-1.5">
          <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest block">
            The three pillars
          </span>
          {PILLAR_NOTES.map(({ label, note }, index) => (
            <div
              key={label}
              className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg space-y-0.5"
            >
              <span className="text-[9.5px] font-extrabold text-slate-700 uppercase tracking-wider leading-none block">
                {index + 1}. {label}
              </span>
              <p className="text-[9.5px] text-slate-550 leading-relaxed font-sans">
                {note}
              </p>
            </div>
          ))}
        </div>

        {/* 3. The bands */}
        <div className="space-y-1.5">
          <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest block">
            Status bands
          </span>
          <div className="space-y-1">
            {BANDS.map(({ label, range, dot }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                <span className="text-[9.5px] font-extrabold text-slate-700 uppercase tracking-wider flex-1">
                  {label}
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-500 shrink-0">
                  {range}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-slate-400 leading-relaxed font-sans">
            Cutoffs are adjustable in the <strong>Rules</strong> tab, since sectors
            automate at different rates.
          </p>
        </div>

        {/* 4. Why this sits outside ESG Social */}
        <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-xl space-y-1">
          <span className="text-[8.5px] font-sans font-extrabold text-[#F27D26] uppercase tracking-widest block leading-none">
            Why ESG Social misses this
          </span>
          <p className="text-[9.5px] text-orange-950 leading-relaxed font-sans">
            Conventional ESG Social metrics measure headcount, turnover, and diversity.
            They were designed before AI-driven automation and record whether a company
            has workers, not whether those workers are being supported through the
            automation of their roles. A company can automate a function entirely,
            disclose no reskilling, and still hold a clean Social score. The IMF
            estimates 40 to 60 percent of jobs are exposed to AI, while Deloitte finds
            only 19 percent of leaders have reliable Social metrics. That gap is what
            this lens is built to surface.
          </p>
        </div>
      </div>
    </div>
  );
}
