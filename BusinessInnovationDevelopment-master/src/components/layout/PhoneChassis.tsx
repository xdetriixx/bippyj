import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PhoneChassisProps = {
  children: ReactNode;
  screenClassName?: string;
  scrollable?: boolean;
};

export function PhoneChassis({ children, screenClassName, scrollable = false }: PhoneChassisProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white md:px-4 md:py-8">
      <div className="mobile-app relative flex min-h-screen w-full max-w-none flex-col overflow-hidden bg-slate-950 md:h-[840px] md:min-h-0 md:w-[400px] md:max-w-[400px] md:rounded-[48px] md:border-[11px] md:border-slate-900 md:shadow-[0_30px_70px_-15px_rgba(0,0,0,0.6)] md:ring-1 md:ring-slate-800/80">
        <div className="pointer-events-none absolute inset-0 z-[60] hidden rounded-[37px] bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.08] md:block" />

        <div className="pointer-events-none absolute top-1 left-1/2 z-[70] mt-2 hidden h-7 w-[125px] -translate-x-1/2 items-center justify-between rounded-full border border-slate-900/60 bg-slate-950 px-3 shadow-[inset_0_1px_5px_rgba(255,255,255,0.15)] md:flex">
          <div className="h-[10px] w-[10px] rounded-full border border-slate-900 bg-indigo-950 shadow-xs" />
          <div className="flex items-center gap-1">
            <span className="text-[7.5px] font-bold tracking-widest text-slate-500 uppercase">
              Active
            </span>
            <div className="h-1.5 w-1.5 animate-[pulse_1s_infinite] rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
          </div>
        </div>

        <div className="absolute top-[110px] -left-[14px] hidden h-[35px] w-[3px] rounded-l bg-slate-800 md:block" />
        <div className="absolute top-[160px] -left-[14px] hidden h-[55px] w-[3px] rounded-l bg-slate-800 md:block" />
        <div className="absolute top-[225px] -left-[14px] hidden h-[55px] w-[3px] rounded-l bg-slate-800 md:block" />
        <div className="absolute top-[160px] -right-[14px] hidden h-[80px] w-[4px] rounded-r bg-slate-800 md:block" />

        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col",
            scrollable && "overflow-y-auto overscroll-contain",
            screenClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
