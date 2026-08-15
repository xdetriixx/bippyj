import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Sparkles,
  GitCompareArrows,
  Bell,
  Search,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useBehavior } from "@/lib/behavior-store";
import { useStocks } from "@/lib/stocks";
import { AIAssistant } from "@/components/cgsi/AIAssistant";
import { RecommendationPopup } from "@/components/cgsi/RecommendationPopup";
import { NudgePopup } from "@/components/cgsi/NudgePopup";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/lib/auth";
import { PhoneChassis } from "@/components/layout/PhoneChassis";

const nav = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
  { to: "/matches", label: "Matches", icon: Sparkles },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth role="investor">
      <AppShellContent>{children}</AppShellContent>
    </RequireAuth>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { compareList } = useBehavior();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { profile, signOut: signOutAccount } = useAuth();
  const { stocks } = useStocks();

  const searchResults = useMemo(() => {
    const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    return stocks
      .filter((stock) => {
        const searchable = [
          stock.ticker,
          stock.name,
          stock.sector,
          stock.exchange,
          `${stock.esgStrength} ESG`,
          `${stock.risk} risk`,
          stock.description,
        ]
          .join(" ")
          .toLowerCase();
        return terms.every((term) => searchable.includes(term));
      })
      .slice(0, 6);
  }, [searchQuery, stocks]);

  async function signOut() {
    await signOutAccount();
    await navigate({ to: "/" });
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const firstResult = searchResults[0];
    if (!firstResult) return;
    closeSearch();
    void navigate({ to: "/stock/$ticker", params: { ticker: firstResult.ticker } });
  }

  return (
    <PhoneChassis screenClassName="bg-cgsi-grey text-foreground">
      <header className="sticky top-0 z-30 border-b bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur md:pt-10">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-cgsi-red text-sm font-bold text-white">
            C
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-cgsi-navy">CGSI Invest Assist</div>
            <div className="truncate text-[10px] text-muted-foreground">
              {profile?.displayName || "Investor"} · Investor dashboard
            </div>
          </div>
          <button
            className={`rounded-full p-1.5 text-slate-600 active:bg-slate-100 ${searchOpen ? "bg-slate-100 text-cgsi-navy" : ""}`}
            aria-label={searchOpen ? "Close search" : "Search stocks"}
            aria-expanded={searchOpen}
            onClick={() => {
              if (searchOpen) closeSearch();
              else setSearchOpen(true);
            }}
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            className="relative rounded-full p-1.5 text-slate-600 active:bg-slate-100"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-cgsi-red" />
          </button>
          <button
            className="rounded-full p-1.5 text-slate-600 active:bg-slate-100"
            aria-label="Sign out"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {searchOpen && (
          <form onSubmit={submitSearch} className="relative mt-2">
            <label className="relative block min-w-0">
              <span className="sr-only">Search stocks or ESG topics</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Ticker, company, sector, ESG or risk"
                autoFocus
                className="h-9 w-full rounded-md border border-input bg-cgsi-grey pl-9 pr-3 text-sm outline-none focus:border-cgsi-navy focus:bg-white"
              />
            </label>

            {searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-white shadow-xl">
                {searchResults.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto p-1">
                    {searchResults.map((stock) => (
                      <Link
                        key={stock.ticker}
                        to="/stock/$ticker"
                        params={{ ticker: stock.ticker }}
                        onClick={closeSearch}
                        className="flex items-center gap-3 rounded px-2.5 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono text-xs font-semibold text-cgsi-navy">
                              {stock.ticker}
                            </span>
                            <span className="truncate text-xs text-slate-700">{stock.name}</span>
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {stock.exchange} · {stock.sector}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-[10px]">
                          <div className="font-medium text-cgsi-navy">ESG {stock.esgScore}</div>
                          <div className="text-muted-foreground">{stock.risk} risk</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No matching stocks found.
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </header>

      <main className="mobile-scroll min-w-0 flex-1 overflow-y-auto px-3 pb-20 pt-3">
        {children}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-40 grid h-14 w-full max-w-[430px] -translate-x-1/2 grid-cols-5 border-t bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:absolute md:left-0 md:max-w-none md:translate-x-0">
        {nav.map((item) => {
          const active = loc.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                active ? "text-cgsi-navy" : "text-slate-500 active:text-cgsi-navy"
              }`}
            >
              <span className={`rounded-full px-2.5 py-0.5 ${active ? "bg-cgsi-green-soft" : ""}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span>{item.label}</span>
              {item.to === "/compare" && compareList.length > 0 && (
                <span className="absolute right-4 top-1 rounded-full bg-cgsi-red px-1.5 text-[9px] font-semibold text-white">
                  {compareList.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!loc.pathname.startsWith("/how-it-works") && !loc.pathname.startsWith("/settings") && (
        <>
          <RecommendationPopup />
          <NudgePopup />
        </>
      )}
      <AIAssistant />
    </PhoneChassis>
  );
}
