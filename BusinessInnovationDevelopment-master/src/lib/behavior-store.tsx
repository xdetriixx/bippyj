import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Stock } from "./cgsi-data";
import { useStocks } from "./stocks";

type ViewEvent = { ticker: string; at: number };

export type UserPrefs = {
  disableNudge: boolean;
  disableRecommendation: boolean;
  simpleMode: boolean;
};

type BehaviorContextValue = {
  views: ViewEvent[];
  compareList: string[];
  recordView: (ticker: string) => void;
  toggleCompare: (ticker: string) => void;
  clearCompare: () => void;
  recentWindowMs: number;
  recentViews: ViewEvent[];
  bias: {
    risk: Record<string, number>;
    esg: Record<string, number>;
    sector: Record<string, number>;
    exchange: Record<string, number>;
  };
  fatigueTrigger: boolean;
  recommendation: { stock: Stock; reason: string; matchScore: number; basis: string[] } | null;
  similarPatternTrigger: { dimension: "risk" | "esg"; value: string; count: number } | null;
  dismissSimilarPattern: () => void;
  dismissRecommendation: () => void;
  dismissNudge: () => void;
  prefs: UserPrefs;
  setPref: <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => void;
  resetPrefs: () => void;
};

const BehaviorContext = createContext<BehaviorContextValue | null>(null);
const RECENT_MS = 10 * 60 * 1000;
const PREFS_KEY = "cgsi.prefs.v1";
const VIEWS_KEY = "cgsi.views.v1";
const COMPARE_KEY = "cgsi.compare.v1";
const DEFAULT_PREFS: UserPrefs = {
  disableNudge: false,
  disableRecommendation: false,
  simpleMode: false,
};

export function BehaviorProvider({ children }: { children: ReactNode }) {
  const { stocks } = useStocks();
  const [views, setViews] = useState<ViewEvent[]>([]);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [dismissedRec, setDismissedRec] = useState<string | null>(null);
  const [recSnoozedUntil, setRecSnoozedUntil] = useState<number>(0);
  const [nudgeDismissedAt, setNudgeDismissedAt] = useState<number>(0);
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const rawPrefs = window.localStorage.getItem(PREFS_KEY);
      if (rawPrefs) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(rawPrefs) });
      const rawViews = window.localStorage.getItem(VIEWS_KEY);
      if (rawViews) {
        const parsed = JSON.parse(rawViews) as ViewEvent[];
        if (Array.isArray(parsed)) setViews(parsed);
      }
      const rawCompare = window.localStorage.getItem(COMPARE_KEY);
      if (rawCompare) {
        const parsed = JSON.parse(rawCompare) as string[];
        if (Array.isArray(parsed)) setCompareList(parsed);
      }
    } catch {
      // Continue with in-memory state when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== "undefined")
        window.localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
    } catch {
      // Continue with in-memory views when browser storage is unavailable.
    }
  }, [views]);

  useEffect(() => {
    try {
      if (typeof window !== "undefined")
        window.localStorage.setItem(COMPARE_KEY, JSON.stringify(compareList));
    } catch {
      // Continue with in-memory comparisons when browser storage is unavailable.
    }
  }, [compareList]);

  const setPref: BehaviorContextValue["setPref"] = useCallback((key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Continue with in-memory preferences when browser storage is unavailable.
      }
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(DEFAULT_PREFS));
    } catch {
      // Reset still applies in memory when browser storage is unavailable.
    }
  }, []);

  const recordView = useCallback((ticker: string) => {
    const at = Date.now();
    setViews((v) => [...v, { ticker, at }]);
  }, []);

  const toggleCompare = useCallback(
    (ticker: string) => {
      const included = compareList.includes(ticker);
      if (!included && compareList.length >= 3) return;
      setCompareList(
        included ? compareList.filter((item) => item !== ticker) : [...compareList, ticker],
      );
    },
    [compareList],
  );

  const clearCompare = useCallback(() => {
    setCompareList([]);
  }, []);

  const recentViews = useMemo(() => {
    const now = Date.now();
    return views.filter((v) => now - v.at <= RECENT_MS);
  }, [views]);

  const bias = useMemo(() => {
    const risk: Record<string, number> = {};
    const esg: Record<string, number> = {};
    const sector: Record<string, number> = {};
    const exchange: Record<string, number> = {};
    const seen = new Set<string>();
    for (const v of recentViews) {
      if (seen.has(v.ticker)) continue;
      seen.add(v.ticker);
      const s = stocks.find((x) => x.ticker === v.ticker);
      if (!s) continue;
      risk[s.risk] = (risk[s.risk] ?? 0) + 1;
      esg[s.esgStrength] = (esg[s.esgStrength] ?? 0) + 1;
      sector[s.sector] = (sector[s.sector] ?? 0) + 1;
      exchange[s.exchange] = (exchange[s.exchange] ?? 0) + 1;
    }
    return { risk, esg, sector, exchange };
  }, [recentViews, stocks]);

  const uniqueRecentCount = useMemo(
    () => new Set(recentViews.map((v) => v.ticker)).size,
    [recentViews],
  );

  const fatigueTrigger =
    !prefs.disableNudge && uniqueRecentCount >= 8 && Date.now() - nudgeDismissedAt > 5 * 60 * 1000;

  const recommendation = useMemo(() => {
    if (prefs.disableRecommendation) return null;
    if (recSnoozedUntil > Date.now()) return null;
    const findDominant = (rec: Record<string, number>) => {
      let key: string | null = null;
      let max = 0;
      for (const k in rec)
        if (rec[k] > max) {
          max = rec[k];
          key = k;
        }
      return max >= 4 ? key : null;
    };
    const domRisk = findDominant(bias.risk);
    const domEsg = findDominant(bias.esg);
    const domSector = findDominant(bias.sector);
    const domExchange = findDominant(bias.exchange);

    const viewedTickers = new Set(recentViews.map((v) => v.ticker));
    const candidates = stocks.filter((s) => !viewedTickers.has(s.ticker));
    if (candidates.length === 0) return null;

    let chosen: Stock | null = null;
    let reason = "";
    const basis: string[] = [];

    if (domRisk) {
      chosen = candidates.find((s) => s.risk === domRisk) ?? null;
      if (chosen) {
        reason = `You have recently viewed several ${domRisk.toLowerCase()}-risk stocks. ${chosen.name} matches your current risk appetite with a similar profile.`;
        basis.push(`Risk preference: ${domRisk}`);
      }
    }
    if (!chosen && domEsg) {
      chosen = candidates.find((s) => s.esgStrength === domEsg) ?? null;
      if (chosen) {
        reason = `You often view ${domEsg.toLowerCase()}-ESG companies. ${chosen.name} offers a similar ESG profile worth exploring.`;
        basis.push(`ESG preference: ${domEsg}`);
      }
    }
    if (!chosen && domSector) {
      chosen = candidates.find((s) => s.sector === domSector) ?? null;
      if (chosen) {
        reason = `You've focused on the ${domSector} sector. ${chosen.name} is another ${domSector} name aligned with your interest.`;
        basis.push(`Sector interest: ${domSector}`);
      }
    }
    if (!chosen && domExchange) {
      chosen = candidates.find((s) => s.exchange === domExchange) ?? null;
      if (chosen) {
        reason = `You've been exploring ${domExchange}-listed companies. ${chosen.name} is another ${domExchange} name to consider.`;
        basis.push(`Exchange focus: ${domExchange}`);
      }
    }

    if (!chosen) return null;
    if (dismissedRec === chosen.ticker) return null;

    // Add supporting signals
    if (chosen && domRisk && chosen.risk === domRisk && !basis.some((b) => b.startsWith("Risk")))
      basis.push(`Matches your ${domRisk}-risk pattern`);
    if (
      chosen &&
      domEsg &&
      chosen.esgStrength === domEsg &&
      !basis.some((b) => b.startsWith("ESG"))
    )
      basis.push(`Aligns with ${domEsg} ESG focus`);
    if (
      chosen &&
      domSector &&
      chosen.sector === domSector &&
      !basis.some((b) => b.startsWith("Sector"))
    )
      basis.push(`Fits ${domSector} sector interest`);
    if (compareList.length > 0)
      basis.push(
        `${compareList.length} stock${compareList.length > 1 ? "s" : ""} in your compare list`,
      );

    return { stock: chosen, reason, matchScore: chosen.match, basis };
  }, [
    bias,
    recentViews,
    dismissedRec,
    prefs.disableRecommendation,
    compareList,
    recSnoozedUntil,
    stocks,
  ]);

  const [similarDismissedKey, setSimilarDismissedKey] = useState<string | null>(null);
  const similarPatternTrigger = useMemo(() => {
    if (prefs.disableRecommendation) return null;
    const pickDom = (rec: Record<string, number>): [string, number] | null => {
      let k: string | null = null;
      let max = 0;
      for (const key in rec)
        if (rec[key] > max) {
          max = rec[key];
          k = key;
        }
      return k && max >= 4 ? [k, max] : null;
    };
    const r = pickDom(bias.risk);
    if (r) {
      const key = `risk:${r[0]}`;
      if (similarDismissedKey !== key)
        return { dimension: "risk" as const, value: r[0], count: r[1] };
    }
    const e = pickDom(bias.esg);
    if (e) {
      const key = `esg:${e[0]}`;
      if (similarDismissedKey !== key)
        return { dimension: "esg" as const, value: e[0], count: e[1] };
    }
    return null;
  }, [bias, similarDismissedKey, prefs.disableRecommendation]);

  const value: BehaviorContextValue = {
    views,
    compareList,
    recordView,
    toggleCompare,
    clearCompare,
    recentWindowMs: RECENT_MS,
    recentViews,
    bias,
    fatigueTrigger,
    recommendation,
    similarPatternTrigger,
    dismissSimilarPattern: () =>
      setSimilarDismissedKey(
        similarPatternTrigger
          ? `${similarPatternTrigger.dimension}:${similarPatternTrigger.value}`
          : null,
      ),
    dismissRecommendation: () => {
      setDismissedRec(recommendation?.stock.ticker ?? null);
      setRecSnoozedUntil(Date.now() + 5 * 60 * 1000);
    },
    dismissNudge: () => {
      setNudgeDismissedAt(Date.now());
    },
    prefs,
    setPref,
    resetPrefs,
  };

  return <BehaviorContext.Provider value={value}>{children}</BehaviorContext.Provider>;
}

export function useBehavior() {
  const ctx = useContext(BehaviorContext);
  if (!ctx) throw new Error("useBehavior must be used inside BehaviorProvider");
  return ctx;
}
