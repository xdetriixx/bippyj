import { useMemo, useState, type FormEvent } from "react";
import { Bot, Loader2, MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBehavior } from "@/lib/behavior-store";
import { Link } from "@tanstack/react-router";
import { askCGSIAssistant } from "@/lib/cgsi-ai.functions";
import { useStocks } from "@/lib/stocks";

type ChatMessage = { role: "user" | "assistant"; content: string };

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Hi, I'm your CGSI AI Assistant. Ask me about any of the 30 prototype stocks, ESG scores, risk levels, or comparisons in plain English.",
};

export function AIAssistant() {
  const { stocks } = useStocks();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [loading, setLoading] = useState(false);
  const { recentViews, bias, compareList } = useBehavior();

  const recentTickers = useMemo(
    () => [...new Set(recentViews.map((view) => view.ticker))].slice(-20),
    [recentViews],
  );
  const stockFacts = useMemo(
    () =>
      stocks.map((stock) => ({
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        esgScore: stock.esgScore,
        esgStrength: stock.esgStrength,
        risk: stock.risk,
        environmental: stock.environmental,
        social: stock.social,
        governance: stock.governance,
      })),
    [stocks],
  );
  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const userMessage: ChatMessage = { role: "user", content: question };
    const nextMessages = [...messages, userMessage].slice(-12);
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const result = await askCGSIAssistant({
        data: {
          messages: nextMessages,
          context: {
            recentTickers,
            compareTickers: compareList,
            bias,
            stockFacts,
          },
        },
      });
      setMessages((current) =>
        [...current, { role: "assistant" as const, content: result.answer }].slice(-12),
      );
    } catch {
      setMessages((current) =>
        [
          ...current,
          {
            role: "assistant" as const,
            content: "I couldn't reach the AI service just now. Please try again in a moment.",
          },
        ].slice(-12),
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute right-4 bottom-20 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-cgsi-navy text-white shadow-lg transition hover:scale-105"
        aria-label="Open CGSI AI Assistant"
      >
        <Bot className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="absolute right-3 bottom-[4.25rem] z-50 flex max-h-[calc(100%-5.25rem)] w-[calc(100%-1.5rem)] max-w-[320px] flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
      <div className="flex shrink-0 items-center justify-between bg-cgsi-navy px-3 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-emerald-300" />
          <div>
            <div className="text-sm font-semibold">CGSI AI Assistant</div>
            <div className="text-[11px] opacity-70">Powered by Groq</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close AI assistant">
          <X className="h-4 w-4 opacity-80 hover:opacity-100" />
        </button>
      </div>

      <div aria-live="polite" className="min-h-0 flex-1 space-y-2 overflow-auto bg-slate-50 p-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex items-start gap-2 ${message.role === "user" ? "justify-end" : ""}`}
          >
            {message.role === "assistant" && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cgsi-navy text-white">
                <MessageSquare className="h-3 w-3" />
              </div>
            )}
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-5 shadow-sm ${
                message.role === "user"
                  ? "rounded-tr-sm bg-cgsi-navy text-white"
                  : "rounded-tl-sm bg-white text-slate-700"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex shrink-0 gap-2 border-t bg-white p-2.5">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about ESG or risk…"
          maxLength={2_000}
          className="h-9 min-w-0 flex-1 rounded-md border px-3 text-xs outline-none focus:border-cgsi-navy"
          aria-label="Message the AI assistant"
        />
        <Button
          type="submit"
          size="sm"
          disabled={loading || !input.trim()}
          className="bg-cgsi-navy text-white"
        >
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>

      <div className="flex shrink-0 gap-2 border-t bg-slate-50 px-3 py-1.5">
        <Button asChild size="sm" variant="ghost" className="h-7 flex-1 text-xs">
          <Link to="/matches" onClick={() => setOpen(false)}>
            Top Matches
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="h-7 flex-1 text-xs">
          <Link to="/compare" onClick={() => setOpen(false)}>
            Compare
          </Link>
        </Button>
      </div>
    </div>
  );
}
