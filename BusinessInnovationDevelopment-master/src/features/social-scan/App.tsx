import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { scanWithAgent } from "@/lib/scan.functions";
import { scoreTextsWithAI, translateTexts } from "@/lib/nlp.functions";
import { scoreVader } from "@/lib/vader";
import { savePostsToFirestore, saveInsightsToFirestore } from "@/lib/scan-firestore.ts";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import {
  AlertTriangle,
  TrendingUp,
  Activity,
  Shield,
  ScanLine,
  Loader2,
  ChevronDown,
  Home,
  Leaf,
  Users,
  Scale,
  Info,
  Plus,
  Trash2,
  Settings2,
  Filter,
  X,
  Bookmark,
  Download,
  Upload,
  Save,
  Check,
  Circle,
} from "lucide-react";

// ---------- Types ----------
type Severity = "low" | "medium" | "high" | "critical";
type Source = string;
type EsgCategory = "environmental" | "social" | "governance";
type ScanEsg = "environmental" | "social" | "governance";

interface Post {
  id: string;
  company: string;
  product: string;
  source: string;
  author: string;
  text: string;
  originalText?: string;
  language?: string;
  sentiment: number;
  reach: number;
  engagement: number;
  esg: EsgCategory;
  ts: string;
  url?: string;
  isComment?: boolean;
}

interface Alert {
  id: string;
  product: string;
  severity: Severity;
  esg: EsgCategory;
  riskScore: number;
  delta: number;
  reason: string;
  ts: string;
  topPostId: string;
}

// ---------- Mock ingestion ----------
const PRODUCTS = [
  "EcoBottle Pure Water", // plastic waste / recyclability (E)
  "GreenLeaf Instant Noodles", // palm oil sourcing / deforestation (E)
  "FairBrew Kopi 3-in-1", // farmer wages / fair trade (S)
  "PureCare Baby Wipes", // child safety / ingredient disclosure (S)
  "SunRice Cooking Oil", // supply chain transparency (G)
  "CleanHands Sanitizer", // product safety / labeling claims (G)
];

// Catalog of supported social platforms ΓÇö each has a real backend fetcher.
// Users add/remove from this catalog in the UI; adding a platform enables it for scanning.
const PLATFORM_CATALOG: { slug: Source; label: string }[] = [
  { slug: "reddit", label: "Reddit" },
  { slug: "x", label: "X (Twitter)" },
  { slug: "tiktok", label: "TikTok" },
  { slug: "youtube", label: "YouTube" },
  { slug: "instagram", label: "Instagram" },

];
const SOURCES: Source[] = PLATFORM_CATALOG.map((p) => p.slug);
const SOCIAL_PLATFORMS = new Set<string>(SOURCES);
const isSocialPlatform = (slug: string) => SOCIAL_PLATFORMS.has(slug);
const DEFAULT_PLATFORMS: string[] = ["reddit", "x", "youtube"];
const PLATFORMS_STORAGE_KEY = "sw.platforms.v10-socialcrawl";

const WATCHLISTS_STORAGE_KEY = "sw.watchlists.v1";

interface Watchlist {
  id: string;
  name: string;
  company: string;
  products: string[];
  platforms: string[];
  esg: ScanEsg[];
  createdAt: string;
}

// Per-platform volume bounds ΓÇö total scan caps scale with platforms selected
const PER_PLATFORM_MIN = 10;
const PER_PLATFORM_MAX = 500;

// Max scan window
const MAX_RANGE_DAYS = 31;

const KNOWN_PLATFORMS = new Set<string>(SOURCES);
const SCAN_ESG_OPTIONS: { id: ScanEsg; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "environmental", label: "Environmental", icon: <Leaf className="size-4" />, desc: "Emissions, packaging, pollution" },
  { id: "social", label: "Social", icon: <Users className="size-4" />, desc: "Labor, support, community" },
  { id: "governance", label: "Governance", icon: <Scale className="size-4" />, desc: "Legal, leadership, ethics" },
];

// ESG keyword classifier — assigns a bucket based on topical vocabulary.
// Returns null when no ESG signal is present so unrelated posts are dropped.
const ESG_LEX: Record<EsgCategory, string[]> = {
  environmental: [
    "pollution", "polluting", "emission", "emissions", "carbon", "climate", "recycl",
    "plastic", "packaging", "waste", "deforest", "palm oil", "toxic", "spill", "leak",
    "greenwash", "biodivers", "landfill", "sustainab",
  ],
  social: [
    "labor", "labour", "worker", "wage", "wages", "child", "harass", "discriminat",
    "safety", "unsafe", "community", "health", "sick", "injur", "rash", "strike",
    "layoff", "diversity", "human rights",
  ],
  governance: [
    "lawsuit", "sued", "fraud", "accounting", "bribe", "corrupt", "disclosure",
    "board", "executive", "ceo", "fired", "misleading", "compliance", "regulator",
    "sec ", "audit", "ethics", "governance", "scandal", "settlement",
  ],
};
function classifyEsg(text: string): EsgCategory | null {
  const t = text.toLowerCase();
  let best: EsgCategory | null = null;
  let bestScore = 0;
  (Object.keys(ESG_LEX) as EsgCategory[]).forEach((cat) => {
    let score = 0;
    for (const kw of ESG_LEX[cat]) if (t.includes(kw)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  });
  return bestScore > 0 ? best : null;
}


// Social Risk Score (0ΓÇô100) ΓÇö positive posts offset negative ones:
//   50% net negativity (neg share minus pos share, floored at 0)
//   25% inverted average mood (compound ΓåÆ 0..1, higher = worse)
//   15% chatter volume (posts / 200 cap)
//   10% virality (avg reach+engagement, capped)
export function riskBreakdown(posts: Post[]) {
  if (!posts.length) {
    return { negShare: 0, avgMood: 0, volumeNorm: 0, viralityNorm: 0, score: 0 };
  }
  const negCount = posts.filter((p) => p.sentiment < -0.05).length;
  const posCount = posts.filter((p) => p.sentiment > 0.05).length;
  // Positive posts cancel out negative ones so both tones influence the score.
  const negShare = Math.max(0, (negCount - posCount) / posts.length);
  const avgCompound = posts.reduce((s, p) => s + p.sentiment, 0) / posts.length;
  const avgMood = 1 - (avgCompound + 1) / 2; // 0 (best) .. 1 (worst)
  const volumeNorm = Math.min(1, posts.length / 200);
  const avgViral =
    posts.reduce((s, p) => s + p.reach + p.engagement, 0) / posts.length;
  const viralityNorm = Math.min(1, avgViral / 5000);
  const score = Math.round(
    100 *
      (0.5 * negShare + 0.25 * avgMood + 0.15 * volumeNorm + 0.1 * viralityNorm),
  );
  return { negShare, avgMood, volumeNorm, viralityNorm, score };
}

function computeRiskScore(posts: Post[]): number {
  return riskBreakdown(posts).score;
}

const ALERT_THRESHOLD = 60;
function generateAlerts(posts: Post[]): Alert[] {
  const byProduct = new Map<string, Post[]>();
  for (const p of posts) {
    const arr = byProduct.get(p.product) ?? [];
    arr.push(p);
    byProduct.set(p.product, arr);
  }
  const alerts: Alert[] = [];
  for (const [product, group] of byProduct) {
    const risk = computeRiskScore(group);
    if (risk < 40) continue;
    const worst = [...group].sort((a, b) => a.sentiment - b.sentiment)[0];
    const severity: Severity =
      risk >= 80 ? "critical" : risk >= ALERT_THRESHOLD ? "high" : risk >= 50 ? "medium" : "low";
    alerts.push({
      id: `al_${product}`,
      product,
      severity,
      esg: worst.esg,
      riskScore: risk,
      delta: Math.round(risk - 40),
      reason:
        worst.esg === "environmental"
          ? "Packaging / emissions complaints"
          : worst.esg === "social"
            ? "Labor / support concerns"
            : "Legal / leadership signals",
      ts: new Date("2026-06-01T00:00:00Z").toISOString(),
      topPostId: worst.id,
    });
  }
  return alerts.sort((a, b) => b.riskScore - a.riskScore);
}

const severityStyle: Record<Severity, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-400 text-black",
  low: "bg-muted text-muted-foreground",
};

const ESG_FILTER_OPTIONS: EsgCategory[] = ["environmental", "social", "governance"];

const esgMeta: Record<EsgCategory, { label: string; icon: React.ReactNode }> = {
  environmental: { label: "Environmental", icon: <Leaf className="size-3" /> },
  social: { label: "Social", icon: <Users className="size-3" /> },
  governance: { label: "Governance", icon: <Scale className="size-3" /> },
};

function formatPlatformLabel(p: string) {
  const found = PLATFORM_CATALOG.find((c) => c.slug === p);
  if (found) return found.label;
  if (p === "twitter") return "X (Twitter)";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function daysBetween(a: string, b: string) {
  // Inclusive day count: 2026-05-05 ΓåÆ 2026-06-05 = 32 days.
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function Dashboard() {
  // Scan-first: user must scan before dashboard appears
  const [hasScanned, setHasScanned] = useState(false);
  const [view, setView] = useState<"dashboard" | "scan">("scan");

  // User-managed platform list (persisted to localStorage)
  const [platforms, setPlatforms] = useState<string[]>(DEFAULT_PLATFORMS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLATFORMS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string") && parsed.length) {
          setPlatforms(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(PLATFORMS_STORAGE_KEY, JSON.stringify(platforms));
    } catch {
      /* ignore */
    }
  }, [platforms]);

  // Watchlists ΓÇö persisted bundles of scan settings
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLISTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setWatchlists(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(WATCHLISTS_STORAGE_KEY, JSON.stringify(watchlists));
    } catch {
      /* ignore */
    }
  }, [watchlists]);

  // Scan form state
  const [scanPlatforms, setScanPlatforms] = useState<string[]>([...DEFAULT_PLATFORMS]);
  const [scanEsg, setScanEsg] = useState<ScanEsg[]>(["environmental", "social", "governance"]);
  const [scanCount, setScanCount] = useState(300);
  const [scanFrom, setScanFrom] = useState("");
  const [scanTo, setScanTo] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanCompany, setScanCompany] = useState("");
  const [scanProducts, setScanProducts] = useState<string[]>([]);

  const [lastScan, setLastScan] = useState<{
    ts: string;
    platforms: string[];
    esg: ScanEsg[];
    postsIngested: number;
    rawPostsIngested: number;
    company: string;
    products: string[];
    from: string;
    to: string;
  } | null>(null);

  const [scanPosts, setScanPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (scanFrom || scanTo) return;
    const today = new Date().toISOString().slice(0, 10);
    setScanFrom(addDays(today, -7));
    setScanTo(today);
  }, [scanFrom, scanTo]);

  const validateCompany = (raw: string): string | null => {
    const t = raw.trim();
    if (t.length === 0) return "Company name is required.";
    if (t.length < 2) return "Must be at least 2 characters.";
    if (t.length > 60) return "Must be 60 characters or fewer.";
    if (!/^[\p{L}\p{N}][\p{L}\p{N} &.,'\-/+]*$/u.test(t))
      return "Use letters, numbers, spaces, & . , ' - / + only.";
    return null;
  };
  const companyError = validateCompany(scanCompany);
  const companyValid = companyError === null;

  const validateProduct = (raw: string): string | null => {
    const t = raw.trim();
    if (!t) return "Enter a keyword.";
    if (t.length < 2) return "Must be at least 2 characters.";
    if (t.length > 40) return "Must be 40 characters or fewer.";
    if (!/^[\p{L}\p{N}][\p{L}\p{N} &.,'\-/+]*$/u.test(t))
      return "Use letters, numbers, spaces, & . , ' - / + only.";
    if (scanProducts.some((p) => p.toLowerCase() === t.toLowerCase()))
      return "Already added.";
    if (scanProducts.length >= 10) return "Limit of 10 reached.";
    return null;
  };
  const addProduct = (raw: string): string | null => {
    const err = validateProduct(raw);
    if (err) return err;
    setScanProducts((prev) => [...prev, raw.trim()]);
    return null;
  };
  const removeProduct = (v: string) =>
    setScanProducts((prev) => prev.filter((p) => p !== v));

  // Watchlist helpers
  const saveWatchlist = (name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed || !companyValid || scanPlatforms.length === 0 || scanEsg.length === 0) {
      return false;
    }
    if (watchlists.some((w) => w.name.toLowerCase() === trimmed.toLowerCase())) {
      return false;
    }
    const wl: Watchlist = {
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      company: scanCompany.trim(),
      products: [...scanProducts],
      platforms: [...scanPlatforms],
      esg: [...scanEsg],
      createdAt: new Date().toISOString(),
    };
    setWatchlists((prev) => [wl, ...prev]);
    return true;
  };
  const deleteWatchlist = (id: string) =>
    setWatchlists((prev) => prev.filter((w) => w.id !== id));
  const loadWatchlist = (w: Watchlist) => {
    setScanCompany(w.company);
    setScanProducts([...w.products]);
    // Add any missing platforms to master list, then select them
    setPlatforms((prev) => {
      const merged = [...prev];
      for (const p of w.platforms) if (!merged.includes(p)) merged.push(p);
      return merged;
    });
    setScanPlatforms([...w.platforms]);
    setScanEsg([...w.esg]);
  };

  // Dashboard filters
  const [dashPlatforms, setDashPlatforms] = useState<string[]>([]);
  const [dashEsg, setDashEsg] = useState<EsgCategory[]>([]);
  const [dashProducts, setDashProducts] = useState<string[]>([]);

  // Volume caps derived from selected platform count
  const selectedCount = scanPlatforms.length;
  const effectiveMin = selectedCount * PER_PLATFORM_MIN;
  const effectiveMax = selectedCount * PER_PLATFORM_MAX;
  const countValid =
    selectedCount > 0 && scanCount >= effectiveMin && scanCount <= effectiveMax;

  // Date range validation
  const rangeDays = scanFrom && scanTo ? daysBetween(scanFrom, scanTo) : 0;
  const rangeValid = !!scanFrom && !!scanTo && rangeDays >= 0 && rangeDays <= MAX_RANGE_DAYS;

  // Auto-clamp target when platform selection changes
  useEffect(() => {
    if (selectedCount === 0) return;
    setScanCount((c) => Math.max(effectiveMin, Math.min(effectiveMax, c)));
  }, [selectedCount, effectiveMin, effectiveMax]);

  // Prune scan selection if a platform is removed from the master list
  useEffect(() => {
    setScanPlatforms((prev) => prev.filter((p) => platforms.includes(p)));
  }, [platforms]);

  const togglePlatform = (s: string) =>
    setScanPlatforms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const toggleScanEsg = (c: ScanEsg) =>
    setScanEsg((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const addPlatform = (name: string) => {
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
    if (!slug) return;
    if (platforms.includes(slug)) return;
    setPlatforms((prev) => [...prev, slug]);
    setScanPlatforms((prev) => [...prev, slug]);
  };

  const removePlatform = (name: string) => {
    setPlatforms((prev) => prev.filter((p) => p !== name));
  };

  // Auto-clamp "to" date if range exceeds max when "from" changes
  const handleFromChange = (v: string) => {
    setScanFrom(v);
    if (v && scanTo && daysBetween(v, scanTo) > MAX_RANGE_DAYS) {
      setScanTo(addDays(v, MAX_RANGE_DAYS - 1));
    }
  };
  const handleToChange = (v: string) => {
    setScanTo(v);
    if (scanFrom && v && daysBetween(scanFrom, v) > MAX_RANGE_DAYS) {
      setScanFrom(addDays(v, -(MAX_RANGE_DAYS - 1)));
    }
  };

  const scanRealPostsFn = useServerFn(scanWithAgent);
  const scoreTextsFn = useServerFn(scoreTextsWithAI);
  const translateTextsFn = useServerFn(translateTexts);
  const [scanError, setScanError] = useState<string | null>(null);
  const [sourceBreakdown, setSourceBreakdown] = useState<
    { source: string; raw: number; kept: number }[] | null
  >(null);

  const runScan = async () => {
    if (
      scanning ||
      scanPlatforms.length === 0 ||
      !countValid ||
      !rangeValid ||
      scanEsg.length === 0 ||
      !companyValid ||
      scanProducts.length === 0
    )
      return;
    setScanning(true);
    setScanError(null);
    setSourceBreakdown(null);
    setScanProgress(10);

    // Smooth progress bar while the network request is in flight ΓÇö the real
    // scan time depends on Firecrawl + public API latency.
    let progress = 10;
    const interval = setInterval(() => {
      progress = Math.min(85, progress + 4);
      setScanProgress(progress);
    }, 150);

    try {
      const raw = await scanRealPostsFn({
        data: {
          company: scanCompany.trim(),
          products: scanProducts,
          platforms: scanPlatforms,
          esg: scanEsg,
          from: scanFrom,
          to: scanTo,
          count: scanCount,
        },
      });
      clearInterval(interval);
      setScanProgress(95);

      // Translate non-English posts to English first, so VADER and the ESG
      // classifier operate on English text. Original text is preserved.
      const translations: Array<{ translated: string; language: string }> = raw.map(
        (p) => ({ translated: p.text, language: "en" }),
      );
      if (raw.length > 0) {
        try {
          const CHUNK = 100;
          for (let i = 0; i < raw.length; i += CHUNK) {
            const slice = raw.slice(i, i + CHUNK).map((p) => p.text);
            const res = await translateTextsFn({ data: { texts: slice } });
            res.forEach((r, j) => {
              translations[i + j] = r;
            });
          }
        } catch (e) {
          console.warn("Translation failed, using original text", e);
        }
      }

      // ESG classification via Lovable AI. Sentiment is computed locally
      // with VADER ΓÇö deterministic, no network, spec-exact compound score.
      let aiScores: Array<{ esg: EsgCategory | null }> = [];
      if (raw.length > 0) {
        try {
          const texts = translations.map((t) => t.translated);
          const CHUNK = 200;
          const chunks: Array<Array<{ esg: EsgCategory | null }>> = [];
          for (let i = 0; i < texts.length; i += CHUNK) {
            const slice = texts.slice(i, i + CHUNK);
            const res = await scoreTextsFn({ data: { texts: slice } });
            chunks.push(res);
          }
          aiScores = chunks.flat();
        } catch (e) {
          console.warn("AI ESG classification failed, falling back to lexicon", e);
        }
      }

      const fallbackEsg: EsgCategory =
        (scanEsg[0] as EsgCategory) ?? "social";
      // Assign detected ESG when it matches a selected category; otherwise
      // fall back to the first selected category so every scanned post is
      // kept and the final count matches what the user requested.
      const scored: Post[] = raw.map((p, i): Post => {
        const tr = translations[i];
        const englishText = tr.translated;
        const isTranslated = tr.language !== "en" && englishText !== p.text;
        const ai = aiScores[i];
        const detected = ai?.esg ?? classifyEsg(englishText);
        const esg: EsgCategory =
          detected && (scanEsg as EsgCategory[]).includes(detected)
            ? detected
            : fallbackEsg;
        const sentiment = scoreVader(englishText).compound;
        return {
          id: p.id || `rp_${i}`,
          company: scanCompany.trim(),
          product: p.product,
          source: p.source,
          author: p.author,
          text: englishText,
          originalText: isTranslated ? p.text : undefined,
          language: tr.language,
          sentiment,
          reach: p.reach,
          engagement: p.engagement,
          esg,
          ts: p.ts,
          url: p.url,
          isComment: p.kind === "comment",
        };
      });

      // Per-source preview: how many raw posts each source returned, and how
      // many survived AI + ESG filtering. Uses selected platforms as the
      // canonical row list so sources that returned zero still appear.
      const rawBySource = new Map<string, number>();
      for (const p of raw) rawBySource.set(p.source, (rawBySource.get(p.source) ?? 0) + 1);
      const keptBySource = new Map<string, number>();
      for (const p of scored) keptBySource.set(p.source, (keptBySource.get(p.source) ?? 0) + 1);
      const rowSources = new Set<string>([
        ...scanPlatforms,
        ...rawBySource.keys(),
        ...keptBySource.keys(),
      ]);
      const breakdown = Array.from(rowSources)
        .map((source) => ({
          source,
          raw: rawBySource.get(source) ?? 0,
          kept: keptBySource.get(source) ?? 0,
        }))
        .sort((a, b) => b.raw - a.raw || a.source.localeCompare(b.source));
      setSourceBreakdown(breakdown);

      setScanPosts(scored);
      const scanMeta = {
        ts: new Date().toISOString(),
        platforms: [...scanPlatforms],
        esg: [...scanEsg],
        postsIngested: scored.length,
        rawPostsIngested: raw.length,
        company: scanCompany.trim(),
        products: [...scanProducts],
        from: scanFrom,
        to: scanTo,
      };
      setLastScan(scanMeta);

      // Best-effort persistence ΓÇö never blocks the UI on a Firestore hiccup.
      // Saves the scan results only, not the scan parameters in scanMeta:
      // raw posts as evidence, plus a per-product risk insight so advisors
      // can act on the summary without reading through raw posts first.
      savePostsToFirestore(scored).catch((e) => {
        console.warn("savePostsToFirestore failed", e);
      });

      const postCountByProduct = new Map<string, number>();
      for (const p of scored) {
        postCountByProduct.set(p.product, (postCountByProduct.get(p.product) ?? 0) + 1);
      }
      const insights = generateAlerts(scored).map((alert) => {
        const topPost = scored.find((p) => p.id === alert.topPostId);
        return {
          company: scanCompany.trim(),
          product: alert.product,
          riskScore: alert.riskScore,
          severity: alert.severity,
          esg: alert.esg,
          reason: alert.reason,
          postCount: postCountByProduct.get(alert.product) ?? 0,
          topPostId: alert.topPostId,
          topPostUrl: topPost?.url,
          topPostText: topPost?.text ?? "",
          ts: new Date().toISOString(),
        };
      });
      saveInsightsToFirestore(insights).catch((e) => {
        console.warn("saveInsightsToFirestore failed", e);
      });

      setDashPlatforms([]);
      setDashEsg([]);
      setDashProducts([]);
      setHasScanned(true);
      setView("dashboard");
      setScanProgress(100);



    } catch (err) {
      clearInterval(interval);
      console.error(err);
      setScanError(
        err instanceof Error ? err.message : "Scan failed ΓÇö check your network and try again.",
      );
    } finally {
      clearInterval(interval);
      setScanning(false);
    }
  };

  // Filtered posts based on dashboard filters (empty filter = all)
  const availableProducts = useMemo(
    () => Array.from(new Set(scanPosts.map((p) => p.product))).sort(),
    [scanPosts],
  );

  const filteredPosts = useMemo(() => {
    return scanPosts.filter((p) => {
      const platformOk = dashPlatforms.length === 0 || dashPlatforms.includes(p.source);
      const esgOk = dashEsg.length === 0 || dashEsg.includes(p.esg);
      const productOk = dashProducts.length === 0 || dashProducts.includes(p.product);
      return platformOk && esgOk && productOk;
    });
  }, [scanPosts, dashPlatforms, dashEsg, dashProducts]);

  const liveRisk = computeRiskScore(filteredPosts);
  const avgSentiment = filteredPosts.length
    ? filteredPosts.reduce((s, p) => s + p.sentiment, 0) / filteredPosts.length
    : 0;
  const alerts = useMemo(() => generateAlerts(filteredPosts), [filteredPosts]);
  const topAlerts = useMemo(() => alerts.slice(0, 5), [alerts]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-md mx-auto border-x border-border">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur px-4 py-3 flex items-center gap-3">
        <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <Shield className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold leading-tight">Sentiment Watch</h1>
          <p className="text-xs text-muted-foreground truncate">
            ASEAN consumer mid-cap ┬╖ {hasScanned ? "Live risk overview" : "Run a scan to begin"}
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 space-y-4">
        {view === "scan" && (
          <ScanView
            platforms={platforms}
            addPlatform={addPlatform}
            removePlatform={removePlatform}
            scanCount={scanCount}
            setScanCount={setScanCount}
            effectiveMin={effectiveMin}
            effectiveMax={effectiveMax}
            perPlatformMin={PER_PLATFORM_MIN}
            perPlatformMax={PER_PLATFORM_MAX}
            countValid={countValid}
            scanPlatforms={scanPlatforms}
            togglePlatform={togglePlatform}
            scanEsg={scanEsg}
            toggleScanEsg={toggleScanEsg}
            scanFrom={scanFrom}
            setScanFrom={handleFromChange}
            scanTo={scanTo}
            setScanTo={handleToChange}
            rangeDays={rangeDays}
            rangeValid={rangeValid}
            maxRangeDays={MAX_RANGE_DAYS}
            scanning={scanning}
            scanProgress={scanProgress}
            runScan={runScan}
            scanError={scanError}
            sourceBreakdown={sourceBreakdown}
            hasScanned={hasScanned}
            scanCompany={scanCompany}
            setScanCompany={setScanCompany}
            companyValid={companyValid}
            companyError={companyError}
            scanProducts={scanProducts}
            addProduct={addProduct}
            validateProduct={validateProduct}
            removeProduct={removeProduct}
            watchlists={watchlists}
            saveWatchlist={saveWatchlist}
            deleteWatchlist={deleteWatchlist}
            loadWatchlist={loadWatchlist}
          />
        )}

        {view === "dashboard" && hasScanned && (
          <DashboardView
            liveRisk={liveRisk}
            avgSentiment={avgSentiment}
            alertsCount={alerts.length}
            filteredPosts={filteredPosts}
            lastScan={lastScan}
            sourceBreakdown={sourceBreakdown}
            availablePlatforms={lastScan?.platforms ?? platforms}
            dashPlatforms={dashPlatforms}
            setDashPlatforms={setDashPlatforms}
            dashEsg={dashEsg}
            setDashEsg={setDashEsg}
            dashProducts={dashProducts}
            setDashProducts={setDashProducts}
            availableProducts={availableProducts}
          />
        )}

        {view === "dashboard" && !hasScanned && (() => {
          const checklist: { ok: boolean; label: string; value: string; required: boolean }[] = [
            {
              ok: companyValid,
              label: "Company",
              value: scanCompany.trim() || "Not set",
              required: true,
            },
            {
              ok: scanProducts.length > 0,
              label: "Keywords",
              value:
                scanProducts.length === 0
                  ? "Add at least one"
                  : `${scanProducts.length} tracked`,
              required: true,
            },
            {
              ok: scanPlatforms.length > 0,
              label: "Platforms",
              value:
                scanPlatforms.length === 0
                  ? "Select at least one"
                  : `${scanPlatforms.length} selected`,
              required: true,
            },
            {
              ok: scanEsg.length > 0,
              label: "ESG categories",
              value:
                scanEsg.length === 0
                  ? "Pick at least one"
                  : `${scanEsg.length} selected`,
              required: true,
            },
            {
              ok: !!scanFrom && !!scanTo && rangeValid,
              label: "Date range",
              value:
                scanFrom && scanTo ? `${scanFrom} ΓåÆ ${scanTo}` : "Not set",
              required: true,
            },
            {
              ok: countValid,
              label: "Posts to ingest",
              value: scanCount.toLocaleString(),
              required: true,
            },
          ];
          const missing = checklist.filter((c) => c.required && !c.ok).length;
          const ready = missing === 0;
          return (
            <Card>
              <CardContent className="py-6 space-y-4">
                <div className="text-center space-y-1">
                  <ScanLine className="size-8 mx-auto text-muted-foreground" />
                  <h2 className="text-base font-semibold">No data yet</h2>
                  <p className="text-xs text-muted-foreground">
                    {ready
                      ? "All prerequisites are set. Run your first scan to populate the dashboard."
                      : `Complete ${missing} prerequisite${missing === 1 ? "" : "s"} before scanning.`}
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {checklist.map((c) => (
                    <li
                      key={c.label}
                      className="flex items-center gap-2 text-xs"
                    >
                      {c.ok ? (
                        <Check className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle
                          className={`size-4 shrink-0 ${
                            c.required ? "text-destructive" : "text-muted-foreground"
                          }`}
                        />
                      )}
                      <span className="font-medium">{c.label}</span>
                      {!c.required && (
                        <span className="text-[10px] text-muted-foreground">
                          (optional)
                        </span>
                      )}
                      <span className="ml-auto text-muted-foreground truncate max-w-[55%] text-right">
                        {c.value}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button onClick={() => setView("scan")} className="gap-2 w-full">
                  <ScanLine className="size-4" />
                  {ready ? "Go to scan" : "Finish setup"}
                </Button>
              </CardContent>
            </Card>
          );
        })()}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t border-border bg-card/95 backdrop-blur grid grid-cols-2 z-30">
        <button
          onClick={() => setView("dashboard")}
          className={`flex flex-col items-center gap-1 py-3 text-xs ${
            view === "dashboard" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Home className="size-5" />
          Dashboard
        </button>
        <button
          onClick={() => setView("scan")}
          className={`flex flex-col items-center gap-1 py-3 text-xs ${
            view === "scan" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <ScanLine className="size-5" />
          Scan
        </button>
      </nav>
    </div>
  );
}

// ---------- Dashboard view ----------
function DashboardView({
  liveRisk,
  avgSentiment,
  alertsCount,
  filteredPosts,
  lastScan,
  sourceBreakdown,
  availablePlatforms,
  dashPlatforms,
  setDashPlatforms,
  dashEsg,
  setDashEsg,
  dashProducts,
  setDashProducts,
  availableProducts,
}: {
  liveRisk: number;
  avgSentiment: number;
  alertsCount: number;
  filteredPosts: Post[];
  lastScan: { ts: string; platforms: string[]; esg: ScanEsg[]; postsIngested: number; rawPostsIngested: number; company: string; products: string[]; from: string; to: string } | null;
  sourceBreakdown: { source: string; raw: number; kept: number }[] | null;
  availablePlatforms: string[];
  dashPlatforms: string[];
  setDashPlatforms: (v: string[]) => void;
  dashEsg: EsgCategory[];
  setDashEsg: (v: EsgCategory[]) => void;
  dashProducts: string[];
  setDashProducts: (v: string[]) => void;
  availableProducts: string[];
}) {
  const tone =
    liveRisk > 60 ? "text-destructive" : liveRisk > 40 ? "text-orange-500" : "text-emerald-600";

  const togglePlat = (p: string) =>
    setDashPlatforms(dashPlatforms.includes(p) ? dashPlatforms.filter((x) => x !== p) : [...dashPlatforms, p]);
  const toggleEsg = (e: EsgCategory) =>
    setDashEsg(dashEsg.includes(e) ? dashEsg.filter((x) => x !== e) : [...dashEsg, e]);
  const toggleProduct = (p: string) =>
    setDashProducts(dashProducts.includes(p) ? dashProducts.filter((x) => x !== p) : [...dashProducts, p]);

  const platLabel =
    dashPlatforms.length === 0
      ? "All platforms"
      : dashPlatforms.length <= 2
        ? dashPlatforms.map(formatPlatformLabel).join(", ")
        : `${dashPlatforms.length} platforms`;
  const esgLabel =
    dashEsg.length === 0
      ? "All categories"
      : dashEsg.length <= 2
        ? dashEsg.map((e) => esgMeta[e].label).join(", ")
        : `${dashEsg.length} categories`;
  const productLabel =
    dashProducts.length === 0
      ? "All keywords"
      : dashProducts.length <= 2
        ? dashProducts.join(", ")
        : `${dashProducts.length} keywords`;

  const filtersActive =
    dashPlatforms.length > 0 || dashEsg.length > 0 || dashProducts.length > 0;

  const [compact, setCompact] = useState(false);
  useEffect(() => {
    // Hysteresis prevents a feedback loop where shrinking the sticky header
    // reduces page height, scrolls back below the threshold, and re-expands.
    const onScroll = () => {
      const y = window.scrollY;
      setCompact((prev) => (prev ? y > 20 : y > 80));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);





  // Day drilldown: clicking a point on the risk trend filters the alerts
  // section to just that day. Key is the "MM-DD" label shown on the axis.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  useEffect(() => {
    setSelectedDay(null);
  }, [filteredPosts]);

  const alertPosts = useMemo(() => {
    if (!selectedDay) return filteredPosts;
    return filteredPosts.filter((p) => p.ts.slice(5, 10) === selectedDay);
  }, [filteredPosts, selectedDay]);

  // Top posts grouped by platform ΓÇö up to 3 highest-impact posts per platform
  // (ranked by engagement + reach, tiebreaker: absolute sentiment).
  const topPostsByPlatform = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of alertPosts) {
      const arr = map.get(p.source) ?? [];
      arr.push(p);
      map.set(p.source, arr);
    }
    return Array.from(map.entries())
      .map(([platform, posts]) => ({
        platform,
        posts: [...posts]
          .sort(
            (a, b) =>
              b.engagement + b.reach - (a.engagement + a.reach) ||
              Math.abs(b.sentiment) - Math.abs(a.sentiment),
          )
          .slice(0, 3),
        total: posts.length,
      }))
      .sort((a, b) => b.total - a.total);
  }, [alertPosts]);

  // Platform summary ΓÇö every platform that returned posts, with sentiment mix.
  const platformSummary = useMemo(() => {
    const map = new Map<
      string,
      { platform: string; total: number; negCount: number; posCount: number; sentSum: number }
    >();
    for (const p of alertPosts) {
      const e =
        map.get(p.source) ?? { platform: p.source, total: 0, negCount: 0, posCount: 0, sentSum: 0 };
      e.total += 1;
      e.sentSum += p.sentiment;
      if (p.sentiment < -0.05) e.negCount += 1;
      else if (p.sentiment > 0.05) e.posCount += 1;
      map.set(p.source, e);
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, avgSent: e.sentSum / e.total }))
      .sort((a, b) => b.total - a.total || b.negCount - a.negCount);
  }, [alertPosts]);

  // Trend computed from the actual scan range (or last 14 days as fallback)
  const trend = useMemo(() => {
    const fromMs = lastScan?.from
      ? new Date(`${lastScan.from}T00:00:00Z`).getTime()
      : null;
    const toMs = lastScan?.to
      ? new Date(`${lastScan.to}T23:59:59Z`).getTime()
      : null;
    let start: number, end: number;
    if (fromMs && toMs && toMs > fromMs) {
      start = fromMs;
      end = toMs;
    } else if (filteredPosts.length > 0) {
      const times = filteredPosts.map((p) => new Date(p.ts).getTime());
      start = Math.min(...times);
      end = Math.max(...times);
    } else {
      return [] as { date: string; risk: number }[];
    }
    const dayMs = 86_400_000;
    // start is 00:00:00Z of the first day; end is 23:59:59Z of the last day.
    // floor((end-start)/dayMs) gives (N-1) full-day gaps ΓåÆ +1 = N days.
    const days = Math.max(1, Math.floor((end - start) / dayMs) + 1);

    const buckets: Post[][] = Array.from({ length: days }, () => []);
    for (const p of filteredPosts) {
      const t = new Date(p.ts).getTime();
      const idx = Math.max(0, Math.min(days - 1, Math.floor((t - start) / dayMs)));
      buckets[idx].push(p);
    }
    return buckets.map((bucket, i) => {
      const day = new Date(start + i * dayMs);
      return {
        date: day.toISOString().slice(5, 10),
        risk: bucket.length === 0 ? 0 : computeRiskScore(bucket),
      };
    });
  }, [filteredPosts, lastScan]);




  return (
    <>
      {/* Sticky summary ΓÇö Risk score + Alerts + Sentiment stay visible while scrolling */}
      <div
        className={`sticky top-[57px] z-10 -mx-4 px-4 bg-background/95 backdrop-blur border-b border-border transition-all duration-200 ${
          compact ? "pt-1.5 pb-1.5 space-y-1.5" : "pt-2 pb-3 space-y-3"
        }`}
      >
        {compact ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk</span>
              <span className={`text-xl font-bold tabular-nums ${tone}`}>{liveRisk}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-orange-500" />
              <span className="text-sm font-semibold tabular-nums">{alertsCount}</span>
              <span className="text-[11px] text-muted-foreground">alerts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold tabular-nums">{avgSentiment.toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="pt-4 pb-3 text-center space-y-0.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Social Risk Score
                </p>
                <div className={`text-5xl font-bold tabular-nums ${tone}`}>{liveRisk}</div>
                <p className="text-[11px] text-muted-foreground">
                  {liveRisk > 60 ? "Elevated ΓÇö review alerts" : liveRisk > 40 ? "Watch closely" : "Healthy"}
                </p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Alerts</p>
                    <AlertTriangle className="size-4 text-orange-500" />
                  </div>
                  <p className="text-xl font-bold tabular-nums mt-0.5">{alertsCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Sentiment</p>
                    <TrendingUp className="size-4 text-muted-foreground" />
                  </div>
                  <p className="text-xl font-bold tabular-nums mt-0.5">{avgSentiment.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Filters ΓÇö sit just above the trend, scroll normally */}
      <Card>
        <CardContent className="pt-3 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <p className="text-sm font-semibold">Filters</p>
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setDashPlatforms([]);
                  setDashEsg([]);
                  setDashProducts([]);
                }}
                className="text-[11px] text-primary"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-between h-9 text-xs">
                  <span className="truncate">{platLabel}</span>
                  <ChevronDown className="size-3 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                {availablePlatforms.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={dashPlatforms.includes(p)}
                      onCheckedChange={() => togglePlat(p)}
                    />
                    {formatPlatformLabel(p)}
                  </label>
                ))}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="justify-between h-9 text-xs">
                  <span className="truncate">{esgLabel}</span>
                  <ChevronDown className="size-3 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                {ESG_FILTER_OPTIONS.map((e) => (
                  <label
                    key={e}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={dashEsg.includes(e)}
                      onCheckedChange={() => toggleEsg(e)}
                    />
                    {esgMeta[e].icon}
                    {esgMeta[e].label}
                  </label>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between h-9 text-xs">
                <span className="truncate">{productLabel}</span>
                <ChevronDown className="size-3 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-2 max-h-64 overflow-y-auto" align="start">
              {availableProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-1.5">No products found.</p>
              ) : (
                availableProducts.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={dashProducts.includes(p)}
                      onCheckedChange={() => toggleProduct(p)}
                    />
                    <span className="truncate">{p}</span>
                  </label>
                ))
              )}
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {lastScan && filteredPosts.length === 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="size-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Scan completed</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {filtersActive
                    ? "No posts match the current dashboard filters. Clear filters to see the full scan result."
                    : lastScan.rawPostsIngested > 0
                      ? `${lastScan.rawPostsIngested.toLocaleString()} raw posts were found, but none matched the selected ESG categories after classification.`
                      : "No posts were returned by the selected public sources for this company, keyword set, and timeframe."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted p-2">
                <p className="text-[10px] uppercase text-muted-foreground">Raw found</p>
                <p className="text-lg font-bold tabular-nums">{lastScan.rawPostsIngested}</p>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <p className="text-[10px] uppercase text-muted-foreground">After ESG</p>
                <p className="text-lg font-bold tabular-nums">{lastScan.postsIngested}</p>
              </div>
            </div>

            {sourceBreakdown && sourceBreakdown.length > 0 && (
              <div className="space-y-1">
                {sourceBreakdown.slice(0, 6).map((row) => (
                  <div key={row.source} className="flex items-center gap-2 text-[11px]">
                    <span className="flex-1 truncate font-medium">{formatPlatformLabel(row.source)}</span>
                    <span className="text-muted-foreground tabular-nums">{row.raw}</span>
                    <span className="text-muted-foreground">ΓåÆ</span>
                    <span className="font-semibold tabular-nums">{row.kept}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {/* Trend */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold">Risk trend ({trend.length} day{trend.length === 1 ? "" : "s"})</p>
              {lastScan?.from && lastScan?.to && (
                <p className="text-[11px] text-muted-foreground">{lastScan.from} ΓåÆ {lastScan.to}</p>
              )}
            </div>
            <Activity className="size-4 text-muted-foreground" />
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trend}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                onClick={(state: { activeLabel?: string } | null) => {
                  const label = state?.activeLabel;
                  if (!label) return;
                  setSelectedDay((prev) => (prev === label ? null : label));
                }}
              >
                <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={28} allowDecimals={false} />

                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <ReferenceLine y={ALERT_THRESHOLD} stroke="var(--color-destructive)" strokeDasharray="3 3" />
                {selectedDay && (
                  <ReferenceLine x={selectedDay} stroke="var(--color-primary)" strokeWidth={1.5} />
                )}
                <Line
                  type="monotone"
                  dataKey="risk"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5, style: { cursor: "pointer" } }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            Tap a day on the chart to filter alerts below.
          </p>
        </CardContent>
      </Card>

      {/* Alerts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold">Alerts</p>
          {selectedDay && (
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-[11px] text-primary inline-flex items-center gap-1"
            >
              <X className="size-3" />
              {selectedDay} ┬╖ clear
            </button>
          )}
        </div>
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="posts" className="text-xs">Posts</TabsTrigger>
            <TabsTrigger value="platforms" className="text-xs">Platforms</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-3 mt-2">
            {topPostsByPlatform.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-xs text-muted-foreground">
                  {selectedDay
                    ? `No posts on ${selectedDay}.`
                    : "No posts match these filters."}
                </CardContent>
              </Card>
            ) : (
              topPostsByPlatform.map((group) => (
                <div key={group.platform} className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-semibold">
                      {formatPlatformLabel(group.platform)}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {group.total} post{group.total === 1 ? "" : "s"}
                    </span>
                  </div>
                  {group.posts.map((post) => {
                    const tone =
                      post.sentiment < -0.2
                        ? "text-destructive"
                        : post.sentiment < 0
                          ? "text-orange-500"
                          : post.sentiment > 0.2
                            ? "text-emerald-600"
                            : "text-muted-foreground";
                    const meta = esgMeta[post.esg];
                    return (
                      <Card key={post.id}>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-medium truncate">
                                  {post.author}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4 gap-1"
                                >
                                  {meta.icon}
                                  <span>{meta.label}</span>
                                </Badge>
                                {post.isComment && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 h-4"
                                  >
                                    comment
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                                ΓÇ£{post.text}ΓÇ¥
                              </p>
                              {post.originalText && (
                                <p className="text-[10px] text-muted-foreground/80 line-clamp-2">
                                  <span className="uppercase font-medium mr-1">
                                    {post.language ?? "orig"}:
                                  </span>
                                  {post.originalText}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground">
                                {post.engagement.toLocaleString()} eng ┬╖{" "}
                                {post.reach.toLocaleString()} reach ┬╖{" "}
                                {post.ts.slice(0, 10)}
                              </p>
                              {post.url && (
                                <a
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  View original post Γåù
                                </a>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={`text-lg font-bold tabular-nums ${tone}`}
                              >
                                {post.sentiment.toFixed(2)}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                sentiment
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="platforms" className="space-y-2 mt-2">
            {platformSummary.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-xs text-muted-foreground">
                  {selectedDay
                    ? `No posts on ${selectedDay}.`
                    : "No platform data yet."}
                </CardContent>
              </Card>
            ) : (
              platformSummary.map((p) => {
                const tone =
                  p.avgSent < -0.2
                    ? "text-destructive"
                    : p.avgSent < 0
                      ? "text-orange-500"
                      : p.avgSent > 0.2
                        ? "text-emerald-600"
                        : "text-muted-foreground";
                return (
                  <Card key={p.platform}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="font-semibold text-sm truncate">
                            {formatPlatformLabel(p.platform)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.total} post{p.total === 1 ? "" : "s"} ┬╖{" "}
                            {p.negCount} negative ┬╖ {p.posCount} positive
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`text-2xl font-bold tabular-nums ${tone}`}
                          >
                            {p.avgSent.toFixed(2)}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            avg sentiment
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>


      {/* How the score is calculated ΓÇö simplified */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">How is this score calculated?</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We combine four signals from your scanned posts into a single score from 0 to 100. The higher the score, the bigger the reputational risk.
          </p>
          <div className="space-y-2">
            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-semibold">Net negativity</p>
                <span className="text-[10px] text-muted-foreground">50%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Share of negative posts, offset by positive ones ΓÇö the biggest driver.</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-semibold">Overall mood</p>
                <span className="text-[10px] text-muted-foreground">25%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Average tone across every post we scanned.</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-semibold">How much chatter?</p>
                <span className="text-[10px] text-muted-foreground">15%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">More posts about you = more attention to manage.</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs font-semibold">How far it spreads</p>
                <span className="text-[10px] text-muted-foreground">10%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Likes, shares and comments ΓÇö viral posts weigh more.</p>
            </div>
          </div>
          <div className="rounded-lg border border-border p-3 text-[11px] text-muted-foreground space-y-1">
            <p><span className="font-semibold text-foreground">0ΓÇô39</span> Healthy ΓÇö nothing urgent.</p>
            <p><span className="font-semibold text-orange-500">40ΓÇô59</span> Watch closely.</p>
            <p><span className="font-semibold text-destructive">60+</span> Triggers an alert ΓÇö review now.</p>
          </div>
        </CardContent>
      </Card>


      {/* Last scan footer */}
      {lastScan && (
        <p className="text-[11px] text-center text-muted-foreground pt-2">
          Last scan {new Date(lastScan.ts).toISOString().slice(0, 16).replace("T", " ")} UTC ┬╖{" "}
          {lastScan.postsIngested.toLocaleString()} ESG posts from {lastScan.rawPostsIngested.toLocaleString()} raw ┬╖ {lastScan.platforms.length} platforms
        </p>
      )}
    </>
  );
}


// ---------- Scan view ----------
function ScanView(props: {
  platforms: string[];
  addPlatform: (name: string) => void;
  removePlatform: (name: string) => void;
  scanCount: number;
  setScanCount: (v: number | ((c: number) => number)) => void;
  effectiveMin: number;
  effectiveMax: number;
  perPlatformMin: number;
  perPlatformMax: number;
  countValid: boolean;
  scanPlatforms: string[];
  togglePlatform: (s: string) => void;
  scanEsg: ScanEsg[];
  toggleScanEsg: (c: ScanEsg) => void;
  scanFrom: string;
  setScanFrom: (v: string) => void;
  scanTo: string;
  setScanTo: (v: string) => void;
  rangeDays: number;
  rangeValid: boolean;
  maxRangeDays: number;
  scanning: boolean;
  scanProgress: number;
  runScan: () => void;
  scanError: string | null;
  sourceBreakdown: { source: string; raw: number; kept: number }[] | null;
  hasScanned: boolean;
  scanCompany: string;
  setScanCompany: (v: string) => void;
  companyValid: boolean;
  companyError: string | null;
  scanProducts: string[];
  addProduct: (v: string) => string | null;
  validateProduct: (v: string) => string | null;
  removeProduct: (v: string) => void;
  watchlists: Watchlist[];
  saveWatchlist: (name: string) => boolean;
  deleteWatchlist: (id: string) => void;
  loadWatchlist: (w: Watchlist) => void;
}) {
  const {
    platforms,
    addPlatform,
    removePlatform,
    scanCount,
    setScanCount,
    effectiveMin,
    effectiveMax,
    perPlatformMin,
    perPlatformMax,
    countValid,
    scanPlatforms,
    togglePlatform,
    scanEsg,
    toggleScanEsg,
    scanFrom,
    setScanFrom,
    scanTo,
    setScanTo,
    rangeDays,
    rangeValid,
    maxRangeDays,
    scanning,
    scanProgress,
    runScan,
    scanError,
    sourceBreakdown,
    hasScanned,
    scanCompany,
    setScanCompany,
    companyValid,
    companyError,
    scanProducts,
    addProduct,
    validateProduct,
    removeProduct,
    watchlists,
    saveWatchlist,
    deleteWatchlist,
    loadWatchlist,
  } = props;
  const [newProduct, setNewProduct] = useState("");
  const [productError, setProductError] = useState<string | null>(null);
  const liveProductError = newProduct.length > 0 ? validateProduct(newProduct) : null;
  const tryAddProduct = () => {
    const err = addProduct(newProduct);
    if (err) {
      setProductError(err);
      return;
    }
    setNewProduct("");
    setProductError(null);
  };
  const [scanCountInput, setScanCountInput] = useState(String(scanCount));
  useEffect(() => {
    setScanCountInput(String(scanCount));
  }, [scanCount]);

  const [managing, setManaging] = useState(false);
  const [newPlatform, setNewPlatform] = useState("");
  const [platformError, setPlatformError] = useState<string | null>(null);
  const noneSelected = scanPlatforms.length === 0;
  const noEsg = scanEsg.length === 0;
  const perPlatformShare =
    scanPlatforms.length > 0 ? Math.floor(scanCount / scanPlatforms.length) : 0;

  const validatePlatform = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return "Enter a platform name.";
    if (trimmed.length < 2) return "Name must be at least 2 characters.";
    if (trimmed.length > 24) return "Name must be 24 characters or fewer.";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(trimmed))
      return "Use letters, numbers, spaces, _ or - only.";
    const slug = trimmed.toLowerCase().replace(/\s+/g, "-");
    if (platforms.includes(slug)) return "That platform already exists.";
    if (!isSocialPlatform(slug)) return "Only supported social platforms can be added.";
    return null;
  };

  const handleAdd = () => {
    const err = validatePlatform(newPlatform);
    if (err) {
      setPlatformError(err);
      return;
    }
    addPlatform(newPlatform);
    setNewPlatform("");
    setPlatformError(null);
  };

  // Compose platforms label ΓÇö list them instead of "All platforms"
  const platformsLabel = (() => {
    if (platforms.length === 0) return "No platforms ΓÇö add one";
    if (scanPlatforms.length === 0) return "Select platforms";
    const labels = scanPlatforms.map(formatPlatformLabel);
    const joined = labels.join(", ");
    return joined.length > 40 ? `${labels.length}: ${labels.slice(0, 2).join(", ")}ΓÇª` : joined;
  })();

  return (
    <>
    <WatchlistsCard
      watchlists={watchlists}
      saveWatchlist={saveWatchlist}
      deleteWatchlist={deleteWatchlist}
      loadWatchlist={loadWatchlist}
      canSave={companyValid && scanPlatforms.length > 0 && scanEsg.length > 0 && !scanning}
    />
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="text-center space-y-1">
          <ScanLine className="size-8 mx-auto text-primary" />
          <h2 className="text-lg font-semibold">New scan</h2>
          <p className="text-xs text-muted-foreground">
            {hasScanned ? "Run again to refresh the dashboard" : "Configure and run your first ingestion"}
          </p>
        </div>

        {/* Targets ΓÇö company + products */}
        <div className="space-y-1.5">
          <Label htmlFor="scan-company" className="text-xs">
            Company to scan <span className="text-destructive">*</span>
          </Label>
          <Input
            id="scan-company"
            value={scanCompany}
            onChange={(e) => setScanCompany(e.target.value)}
            onBlur={(e) => setScanCompany(e.target.value.replace(/\s+/g, " ").trim())}
            placeholder="Company name"
            disabled={scanning}
            maxLength={60}
            aria-invalid={scanCompany.length > 0 && !companyValid}
            aria-describedby="scan-company-error"
            className={scanCompany.length > 0 && !companyValid ? "border-destructive" : ""}
          />
          {scanCompany.length > 0 && companyError && (
            <p id="scan-company-error" className="text-[11px] text-destructive">
              {companyError}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scan-product" className="text-xs">
            Keywords <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="scan-product"
              value={newProduct}
              onChange={(e) => {
                setNewProduct(e.target.value);
                if (productError) setProductError(null);
              }}
              placeholder="Add keyword (e.g. EcoBottle)"
              disabled={scanning || scanProducts.length >= 10}
              maxLength={40}
              aria-invalid={!!productError}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  tryAddProduct();
                }
              }}
              className={`h-9 ${productError ? "border-destructive" : ""}`}
            />
            <Button
              type="button"
              size="sm"
              className="gap-1 h-9"
              disabled={
                scanning ||
                !newProduct.trim() ||
                scanProducts.length >= 10 ||
                !!liveProductError
              }
              onClick={tryAddProduct}
            >
              <Plus className="size-4" /> Add
            </Button>
          </div>
          {(productError || liveProductError) && (
            <p className="text-[11px] text-destructive">
              {productError ?? liveProductError}
            </p>
          )}
          {scanProducts.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {scanProducts.map((p) => (
                <Badge key={p} variant="secondary" className="gap-1 text-[10px]">
                  {p}
                  <button
                    type="button"
                    onClick={() => removeProduct(p)}
                    className="hover:text-destructive"
                    aria-label={`Remove ${p}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Narrow the scan to specific keywords. At least one required. Max 10.
          </p>
        </div>

        {/* Platforms selector */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Platforms</Label>
            <button
              type="button"
              className="text-[11px] text-primary flex items-center gap-1"
              onClick={() => setManaging((m) => !m)}
            >
              <Settings2 className="size-3" />
              {managing ? "Done" : "Manage"}
            </button>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled={scanning || platforms.length === 0}
              >
                <span className="truncate text-sm text-left">{platformsLabel}</span>
                <ChevronDown className="size-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
              {platforms.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={scanPlatforms.includes(s)}
                    onCheckedChange={() => togglePlatform(s)}
                  />
                  {formatPlatformLabel(s)}
                </label>
              ))}
            </PopoverContent>
          </Popover>
          {/* Show selected platform chips so users always see exactly what's included */}
          {scanPlatforms.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {scanPlatforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px]">
                  {formatPlatformLabel(p)}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Manage platforms */}
        {managing && (
          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
            <p className="text-xs font-medium">Manage platforms</p>
            <div className="space-y-1">
              {platforms.length === 0 && (
                <p className="text-xs text-muted-foreground">No platforms yet.</p>
              )}
              {platforms.map((p) => (
                <div
                  key={p}
                  className="flex items-center justify-between rounded-md bg-background px-2 py-1.5"
                >
                  <span className="text-sm">{formatPlatformLabel(p)}</span>
                  <button
                    type="button"
                    onClick={() => removePlatform(p)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${p}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {(() => {
                const available = PLATFORM_CATALOG.filter((p) => !platforms.includes(p.slug));
                if (available.length === 0) {
                  return (
                    <p className="text-[11px] text-muted-foreground">
                      All supported platforms are added.
                    </p>
                  );
                }
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {available.map((p) => (
                      <Button
                        key={p.slug}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1"
                        onClick={() => addPlatform(p.slug)}
                      >
                        <Plus className="size-3.5" /> {p.label}
                      </Button>
                    ))}
                  </div>
                );
              })()}
              {platformError && (
                <p className="text-[11px] text-destructive">{platformError}</p>
              )}
            </div>
          </div>
        )}

        {/* ESG categories checklist */}
        <div className="space-y-1.5">
          <Label className="text-xs">ESG categories to scan</Label>
          <div className="space-y-1.5">
            {SCAN_ESG_OPTIONS.map((opt) => {
              const checked = scanEsg.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                    checked ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleScanEsg(opt.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {opt.icon}
                      <span className="text-sm font-medium">{opt.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
          {noEsg && (
            <p className="text-[11px] text-destructive">Select at least one category.</p>
          )}
        </div>

        {/* Posts target */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="scan-count" className="text-xs">
              Posts to ingest
            </Label>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {noneSelected
                ? "select platforms"
                : `${effectiveMin.toLocaleString()}ΓÇô${effectiveMax.toLocaleString()} allowed`}
            </span>
          </div>
          <Input
            id="scan-count"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={scanCountInput}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setScanCountInput(raw);
              const n = Number(raw);
              if (raw !== "" && Number.isFinite(n)) setScanCount(n);
            }}
            onBlur={() => {
              const n = Number(scanCountInput);
              if (!scanCountInput || !Number.isFinite(n)) {
                setScanCount(effectiveMin);
                setScanCountInput(String(effectiveMin));
                return;
              }
              const clamped = Math.max(effectiveMin, Math.min(effectiveMax, n));
              setScanCount(clamped);
              setScanCountInput(String(clamped));
            }}
            disabled={scanning || noneSelected}
            className={!noneSelected && !countValid ? "border-destructive" : ""}
          />
          <p className="text-[11px] text-muted-foreground">
            {noneSelected
              ? `Caps scale with platforms: ${perPlatformMin}ΓÇô${perPlatformMax} per platform.`
              : `${perPlatformMin}ΓÇô${perPlatformMax} per platform ├ù ${scanPlatforms.length} selected Γëê ${perPlatformShare.toLocaleString()} each.`}
          </p>
        </div>

        {/* Date range */}
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <Label className="text-xs">Time frame</Label>
            <span
              className={`text-[11px] tabular-nums ${
                rangeValid ? "text-muted-foreground" : "text-destructive"
              }`}
            >
              {scanFrom && scanTo ? `${rangeDays} day${rangeDays === 1 ? "" : "s"}` : "ΓÇö"} ┬╖ max{" "}
              {maxRangeDays}d
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="scan-from" className="text-[11px] text-muted-foreground">From</Label>
              <Input
                id="scan-from"
                type="date"
                value={scanFrom}
                max={scanTo}
                onChange={(e) => setScanFrom(e.target.value)}
                disabled={scanning}
                className={!rangeValid ? "border-destructive" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="scan-to" className="text-[11px] text-muted-foreground">To</Label>
              <Input
                id="scan-to"
                type="date"
                value={scanTo}
                min={scanFrom}
                onChange={(e) => setScanTo(e.target.value)}
                disabled={scanning}
                className={!rangeValid ? "border-destructive" : ""}
              />
            </div>
          </div>
          {!rangeValid && scanFrom && scanTo && (
            <p className="text-[11px] text-destructive">
              Time frame must be {maxRangeDays} days or fewer.
            </p>
          )}
        </div>

        {scanning && (
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              ScanningΓÇª {scanProgress}%
            </p>
          </div>
        )}

        {(() => {
          const errors: string[] = [];
          if (!companyValid) errors.push(`Company name: ${companyError ?? "invalid"}`);
          if (scanProducts.length === 0) errors.push("Add at least one keyword.");
          if (platforms.length === 0) errors.push("Add at least one platform under Manage.");
          else if (noneSelected) errors.push("Select at least one platform to scan.");
          const nonSocial = scanPlatforms.filter((p) => !isSocialPlatform(p));
          if (nonSocial.length > 0) {
            errors.push(`Only social media platforms are allowed. Remove: ${nonSocial.join(", ")}.`);
          }
          if (noEsg) errors.push("Pick at least one ESG category.");
          if (!scanFrom || !scanTo) errors.push("Choose both a start and end date.");
          else if (rangeDays < 0) errors.push("Start date must be before end date.");
          else if (!rangeValid) errors.push(`Time frame must be ${maxRangeDays} days or fewer.`);
          if (!noneSelected && !countValid) {
            errors.push(
              `Posts to ingest must be between ${effectiveMin.toLocaleString()} and ${effectiveMax.toLocaleString()}.`,
            );
          }
          if (errors.length === 0 || scanning) return null;
          return (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" />
                <p className="text-xs font-semibold text-destructive">
                  Fix {errors.length} issue{errors.length === 1 ? "" : "s"} before scanning
                </p>
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {errors.map((e) => (
                  <li key={e} className="text-[11px] text-destructive leading-snug">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}

        {scanError && !scanning && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <p className="text-xs font-semibold text-destructive">Scan failed</p>
            </div>
            <p className="text-[11px] text-destructive/90 mt-1 leading-snug">{scanError}</p>
          </div>
        )}

        {sourceBreakdown && !scanning && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              <p className="text-xs font-semibold">Results by source</p>
              <span className="ml-auto text-[10px] text-muted-foreground">
                raw ΓåÆ after ESG
              </span>
            </div>
            {sourceBreakdown.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No sources scanned.</p>
            ) : (
              <ul className="space-y-1">
                {sourceBreakdown.map((row) => {
                  const dropped = Math.max(0, row.raw - row.kept);
                  return (
                    <li
                      key={row.source}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <span className="flex-1 truncate font-medium">
                        {formatPlatformLabel(row.source)}
                      </span>
                      <span
                        className={
                          row.raw === 0
                            ? "text-muted-foreground"
                            : "text-foreground tabular-nums"
                        }
                      >
                        {row.raw}
                      </span>
                      <span className="text-muted-foreground">ΓåÆ</span>
                      <span
                        className={
                          row.kept === 0
                            ? "text-muted-foreground tabular-nums"
                            : "text-primary font-semibold tabular-nums"
                        }
                      >
                        {row.kept}
                      </span>
                      {dropped > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          (ΓêÆ{dropped})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-[10px] text-muted-foreground leading-snug">
              Raw = posts returned by the source. After ESG = posts kept after
              AI classification and your ESG-category filter.
            </p>
          </div>
        )}



        <Button
          className="w-full gap-2 h-11"
          onClick={runScan}
          disabled={
            scanning || !countValid || noneSelected || noEsg || !rangeValid || !companyValid || scanProducts.length === 0
          }
        >
          {scanning ? (
            <>
              <Loader2 className="size-4 animate-spin" /> ScanningΓÇª
            </>
          ) : (
            <>
              <ScanLine className="size-4" /> Start scan
            </>
          )}
        </Button>
      </CardContent>
    </Card>
    </>
  );
}

// ---------- Watchlists ----------
function watchlistToCsv(w: Watchlist): string {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const created = (() => {
    const d = new Date(w.createdAt);
    return Number.isFinite(d.getTime()) ? d.toLocaleString() : w.createdAt;
  })();
  const rows: string[][] = [
    ["Field", "Value"],
    ["Name", w.name],
    ["Company", w.company],
    ["Created at", created],
    ["Platforms", w.platforms.join(", ")],
    ["ESG categories", w.esg.join(", ")],
    ["Keywords", w.products.join(", ")],
  ];
  // Prepend BOM so Excel opens UTF-8 cleanly; CRLF line endings for spreadsheet apps.
  return "\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}


function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(s: string) {
  return s.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 40) || "watchlist";
}

function WatchlistsCard({
  watchlists,
  saveWatchlist,
  deleteWatchlist,
  loadWatchlist,
  canSave,
}: {
  watchlists: Watchlist[];
  saveWatchlist: (name: string) => boolean;
  deleteWatchlist: (id: string) => void;
  loadWatchlist: (w: Watchlist) => void;
  canSave: boolean;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!canSave) {
      setError("Fill company, platforms and at least one ESG category first.");
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 40) {
      setError("Name must be 40 characters or fewer.");
      return;
    }
    const ok = saveWatchlist(trimmed);
    if (!ok) {
      setError("A watchlist with that name already exists.");
      return;
    }
    setName("");
    setError(null);
  };

  const exportAllJson = () => {
    downloadFile(
      `watchlists_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(watchlists, null, 2),
      "application/json",
    );
  };

  const exportOneCsv = (w: Watchlist) => {
    downloadFile(`${sanitizeFilename(w.name)}.csv`, watchlistToCsv(w), "text/csv");
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="size-4 text-primary" />
            <p className="text-sm font-semibold">Watchlists</p>
            {watchlists.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {watchlists.length}
              </Badge>
            )}
          </div>
          {watchlists.length > 0 && (
            <button
              type="button"
              onClick={exportAllJson}
              className="text-[11px] text-primary flex items-center gap-1"
            >
              <Upload className="size-3" /> Export all
            </button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Save the current scan setup as a reusable watchlist. Export to CSV or JSON.
        </p>

        <div className="space-y-1">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Name this watchlist (e.g. Q3 ESG)"
              maxLength={40}
              className={`h-9 ${error ? "border-destructive" : ""}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            <Button type="button" size="sm" onClick={handleSave} className="gap-1 h-9">
              <Save className="size-4" /> Save
            </Button>
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
        </div>

        {watchlists.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No watchlists yet.</p>
        ) : (
          <div className="space-y-1.5">
            {watchlists.map((w) => (
              <div
                key={w.id}
                className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{w.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {w.company} ┬╖ {w.platforms.length} platform
                      {w.platforms.length === 1 ? "" : "s"} ┬╖{" "}
                      {w.products.length} product{w.products.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteWatchlist(w.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`Delete ${w.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[11px] flex-1 gap-1"
                    onClick={() => loadWatchlist(w)}
                  >
                    Load
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => exportOneCsv(w)}
                  >
                    <Download className="size-3" /> CSV
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Dashboard;
