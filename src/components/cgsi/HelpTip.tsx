import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function HelpTip({ title, body }: { title?: string; body: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Explain this"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-slate-100 hover:text-cgsi-navy"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-sm">
        {title && <div className="mb-1 font-semibold text-cgsi-navy">{title}</div>}
        <p className="leading-relaxed text-slate-700">{body}</p>
      </PopoverContent>
    </Popover>
  );
}
