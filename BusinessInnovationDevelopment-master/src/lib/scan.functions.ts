import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chatCompletion } from "./ai-gateway";

const ScanInput = z.object({
  company: z.string().min(1),
  products: z.array(z.string()).min(1),
  platforms: z.array(z.string()),
  esg: z.array(z.enum(["environmental", "social", "governance"])),
  from: z.string(),
  to: z.string(),
  count: z.number(),
});

export type RawScannedPost = {
  id: string;
  product: string;
  source: string;
  author: string;
  text: string;
  url: string;
  reach: number;
  engagement: number;
  ts: string;
  kind?: "post" | "comment"; // undefined/"post" = a top-level post
  parentUrl?: string; // set on comments — the post they were left on
};

// Platforms scraped via SocialCrawl's unified API. LinkedIn and Facebook are
// intentionally excluded (no reliable organic keyword-post search available).
export const REAL_SCAN_PLATFORMS = [
  "reddit",
  "x",
  "tiktok",
  "youtube",
  "instagram",
] as const;
export type RealScanPlatform = (typeof REAL_SCAN_PLATFORMS)[number];

// ---------------- SocialCrawl ----------------

const SC_BASE = "https://www.socialcrawl.dev/v1";

// Per-platform endpoint. All accept `query=` and return the same envelope.
// YouTube uses the official YouTube Data API v3 instead of SocialCrawl.
const SC_ENDPOINT: Record<Exclude<RealScanPlatform, "youtube">, string> = {
  reddit: "/reddit/search",
  x: "/twitter/ai-search",
  tiktok: "/tiktok/search",
  instagram: "/instagram/search/reels",
};


function keywordTerms(keywords: string[]): string[] {
  return Array.from(
    new Set(
      keywords
        .flatMap((k) => k.split(/[,;]+/))
        .map((k) => k.replace(/["“”]/g, "").trim())
        .filter(Boolean),
    ),
  );
}

function truncate(s: string, n = 800): string {
  return s.length > n ? s.slice(0, n) : s;
}

// SocialCrawl unified item shape (subset we use).
type SCItem = {
  post?: {
    id?: string;
    url?: string | null;
    content?: { text?: string | null };
    author?: { username?: string | null; display_name?: string | null };
    engagement?: {
      views?: number | null;
      likes?: number | null;
      comments?: number | null;
      shares?: number | null;
      saves?: number | null;
    };
    published_at?: string | number | null;
  };
  computed?: { estimated_reach?: number | null };
};

function mapItem(it: SCItem, source: string, product: string, idx: number): RawScannedPost {
  const post = it.post ?? {};
  const eng = post.engagement ?? {};
  const author =
    post.author?.username || post.author?.display_name || "anon";
  const likes = Number(eng.likes ?? 0);
  const comments = Number(eng.comments ?? 0);
  const shares = Number(eng.shares ?? 0);
  const saves = Number(eng.saves ?? 0);
  const views = Number(eng.views ?? 0);
  const reach =
    Number(it.computed?.estimated_reach ?? 0) ||
    views ||
    likes + comments * 10;
  let ts = new Date().toISOString();
  if (post.published_at != null) {
    const raw = post.published_at;
    const d = typeof raw === "number" ? new Date(raw * (raw < 1e12 ? 1000 : 1)) : new Date(raw);
    if (!Number.isNaN(d.getTime())) ts = d.toISOString();
  }
  return {
    id: `${source}_${String(post.id ?? idx)}`,
    product,
    source,
    author: source === "reddit" ? `u/${author}` : source === "youtube" ? String(author) : `@${author}`,
    text: truncate(String(post.content?.text ?? "")),
    url: String(post.url ?? ""),
    reach,
    engagement: likes + comments + shares + saves,
    ts,
  };
}

async function fetchSocialCrawl(
  platform: Exclude<RealScanPlatform, "youtube">,
  companyQuery: string,
  keywords: string[],
  maxItems: number,
): Promise<RawScannedPost[]> {
  const token = process.env.SOCIALCRAWL_API_KEY;
  if (!token) {
    console.error("SOCIALCRAWL_API_KEY not configured");
    return [];
  }
  const terms = keywordTerms(keywords);
  if (terms.length === 0) return [];
  const perTerm = Math.max(10, Math.ceil(maxItems / terms.length));
  const path = SC_ENDPOINT[platform];

  const batches = await Promise.all(
    terms.map(async (term) => {
      const query = companyQuery ? `${companyQuery} ${term}` : term;
      const url = `${SC_BASE}${path}?query=${encodeURIComponent(query)}`;
      const started = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45_000);
        const res = await fetch(url, {
          method: "GET",
          headers: { "x-api-key": token, Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(
            `SocialCrawl ${platform} [${res.status}] "${query}": ${body.slice(0, 300)}`,
          );
          return [] as RawScannedPost[];
        }
        const json = (await res.json()) as {
          success?: boolean;
          data?: { items?: SCItem[] };
        };
        const items = json.data?.items ?? [];
        console.log(
          `SocialCrawl ${platform} "${query}" -> ${items.length} in ${Date.now() - started}ms`,
        );
        return items.slice(0, perTerm).map((it, i) => mapItem(it, platform, term, i));
      } catch (e) {
        console.error(`SocialCrawl ${platform} error "${query}"`, e);
        return [] as RawScannedPost[];
      }
    }),
  );
  return batches.flat();
}

// ---------------- YouTube Data API v3 ----------------

type YTSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
};

type YTVideoItem = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
};

async function fetchYouTube(
  companyQuery: string,
  keywords: string[],
  maxItems: number,
  from: string,
  to: string,
): Promise<RawScannedPost[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    console.error("YOUTUBE_API_KEY not configured");
    return [];
  }
  const terms = keywordTerms(keywords);
  if (terms.length === 0) return [];
  const perTerm = Math.min(50, Math.max(10, Math.ceil(maxItems / terms.length)));
  const publishedAfter = new Date(`${from}T00:00:00Z`).toISOString();
  const publishedBefore = new Date(`${to}T23:59:59Z`).toISOString();

  const batches = await Promise.all(
    terms.map(async (term) => {
      const query = companyQuery ? `${companyQuery} ${term}` : term;
      const searchUrl =
        `https://www.googleapis.com/youtube/v3/search` +
        `?part=snippet&type=video&maxResults=${perTerm}&order=date` +
        `&publishedAfter=${encodeURIComponent(publishedAfter)}` +
        `&publishedBefore=${encodeURIComponent(publishedBefore)}` +
        `&q=${encodeURIComponent(query)}&key=${key}`;
      const started = Date.now();
      try {
        const sRes = await fetch(searchUrl, { headers: { Accept: "application/json" } });
        if (!sRes.ok) {
          const body = await sRes.text().catch(() => "");
          console.error(`YouTube search [${sRes.status}] "${query}": ${body.slice(0, 300)}`);
          return [] as RawScannedPost[];
        }
        const sJson = (await sRes.json()) as { items?: YTSearchItem[] };
        const ids = (sJson.items ?? [])
          .map((i) => i.id?.videoId)
          .filter((v): v is string => Boolean(v));
        if (ids.length === 0) return [];

        // Fetch stats in one call
        const videosUrl =
          `https://www.googleapis.com/youtube/v3/videos` +
          `?part=snippet,statistics&id=${ids.join(",")}&key=${key}`;
        const vRes = await fetch(videosUrl, { headers: { Accept: "application/json" } });
        if (!vRes.ok) {
          const body = await vRes.text().catch(() => "");
          console.error(`YouTube videos [${vRes.status}]: ${body.slice(0, 300)}`);
          return [] as RawScannedPost[];
        }
        const vJson = (await vRes.json()) as { items?: YTVideoItem[] };
        const items = vJson.items ?? [];
        console.log(
          `YouTube "${query}" -> ${items.length} in ${Date.now() - started}ms`,
        );
        return items.map((v, i) => {
          const views = Number(v.statistics?.viewCount ?? 0);
          const likes = Number(v.statistics?.likeCount ?? 0);
          const comments = Number(v.statistics?.commentCount ?? 0);
          const title = v.snippet?.title ?? "";
          const desc = v.snippet?.description ?? "";
          const text = truncate(`${title}\n${desc}`.trim());
          const ts = v.snippet?.publishedAt
            ? new Date(v.snippet.publishedAt).toISOString()
            : new Date().toISOString();
          return {
            id: `youtube_${v.id ?? i}`,
            product: term,
            source: "youtube",
            author: v.snippet?.channelTitle ?? "unknown",
            text,
            url: v.id ? `https://www.youtube.com/watch?v=${v.id}` : "",
            reach: views || likes + comments * 10,
            engagement: likes + comments,
            ts,
          } as RawScannedPost;
        });
      } catch (e) {
        console.error(`YouTube error "${query}"`, e);
        return [] as RawScannedPost[];
      }
    }),
  );
  return batches.flat();
}

// ---------------- Comments (YouTube + Reddit only — see scanWithAgent) ----------------

type YTCommentThreadItem = {
  id?: string;
  snippet?: {
    topLevelComment?: {
      snippet?: {
        textDisplay?: string;
        textOriginal?: string;
        authorDisplayName?: string;
        likeCount?: number;
        publishedAt?: string;
      };
    };
  };
};

async function fetchYouTubeComments(
  videoId: string,
  videoUrl: string,
  product: string,
  maxComments: number,
): Promise<RawScannedPost[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];
  const url =
    `https://www.googleapis.com/youtube/v3/commentThreads` +
    `?part=snippet&videoId=${videoId}&maxResults=${Math.min(100, Math.max(1, maxComments))}` +
    `&order=relevance&key=${key}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      // 403 just means comments are disabled on this video — not worth logging loudly.
      if (res.status !== 403) {
        const body = await res.text().catch(() => "");
        console.error(`YouTube commentThreads [${res.status}] "${videoId}": ${body.slice(0, 300)}`);
      }
      return [];
    }
    const json = (await res.json()) as { items?: YTCommentThreadItem[] };
    const items = json.items ?? [];
    return items.map((it, i) => {
      const c = it.snippet?.topLevelComment?.snippet;
      const ts = c?.publishedAt ? new Date(c.publishedAt).toISOString() : new Date().toISOString();
      return {
        id: `youtube_comment_${videoId}_${it.id ?? i}`,
        product,
        source: "youtube",
        author: c?.authorDisplayName ?? "unknown",
        text: truncate(String(c?.textOriginal ?? c?.textDisplay ?? "")),
        url: it.id ? `${videoUrl}&lc=${it.id}` : videoUrl,
        reach: 0,
        engagement: Number(c?.likeCount ?? 0),
        ts,
        kind: "comment",
        parentUrl: videoUrl,
      } as RawScannedPost;
    });
  } catch (e) {
    console.error(`YouTube commentThreads error "${videoId}"`, e);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

type RedditCommentNode = {
  kind?: string;
  data?: {
    id?: string;
    author?: string;
    body?: string;
    ups?: number;
    created_utc?: number;
    permalink?: string;
  };
};

type RedditListing = { data?: { children?: RedditCommentNode[] } };

async function fetchRedditComments(
  postUrl: string,
  product: string,
  maxComments: number,
): Promise<RawScannedPost[]> {
  if (!postUrl) return [];
  const limit = Math.min(100, Math.max(1, maxComments));
  const jsonUrl = `${postUrl.replace(/\/+$/, "")}.json?limit=${limit}&sort=top`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(jsonUrl, {
      headers: {
        Accept: "application/json",
        // Reddit rate-limits/blocks requests without a descriptive User-Agent.
        "User-Agent": "watcher-watch-esg-scanner/1.0 (by /u/watcher-watch)",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`Reddit comments [${res.status}] "${postUrl}"`);
      return [];
    }
    const json = (await res.json()) as RedditListing[];
    const children = json?.[1]?.data?.children ?? [];
    return children
      .filter((c) => c.kind === "t1" && c.data?.body)
      .slice(0, limit)
      .map((c) => {
        const d = c.data!;
        const ts = d.created_utc
          ? new Date(d.created_utc * 1000).toISOString()
          : new Date().toISOString();
        return {
          id: `reddit_comment_${d.id}`,
          product,
          source: "reddit",
          author: d.author ? `u/${d.author}` : "anon",
          text: truncate(String(d.body ?? "")),
          url: d.permalink ? `https://www.reddit.com${d.permalink}` : postUrl,
          reach: 0,
          engagement: Number(d.ups ?? 0),
          ts,
          kind: "comment",
          parentUrl: postUrl,
        } as RawScannedPost;
      });
  } catch (e) {
    console.error(`Reddit comments error "${postUrl}"`, e);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------- AI-planned agentic scan ----------------
//
// Same real fetchers as above (fetchSocialCrawl / fetchYouTube) — nothing
// here is generated by the model. An LLM instead does the two jobs a
// mechanical keyword-cross-product scan would otherwise do:
//   1. Plan per-platform search queries from the scan config, instead of
//      blindly cross-producting every product keyword against every platform.
//   2. Judge which of the *real* fetched candidates are actually relevant
//      and assign an ESG category, instead of a regex substring match.
// The model can only "pick" a candidate by its index into the list it was
// shown (json_schema-constrained), so it has no way to fabricate a post,
// author, url, or engagement number — every returned RawScannedPost came
// back from a live API call.

type PlannedQuery = { platform: RealScanPlatform; query: string };

async function planQueries(
  company: string,
  products: string[],
  platforms: RealScanPlatform[],
  esg: string[],
): Promise<PlannedQuery[]> {
  try {
    const content = await chatCompletion(
      "flash",
      [
        {
          role: "system",
          content:
            "You are a social-media research planner for ESG/reputation monitoring. " +
            "Given a company, its products/keywords, the platforms in scope, and the ESG " +
            "categories of interest, propose up to 3 search queries PER PLATFORM that would " +
            "surface real, on-topic posts (not just brand-name spam). Word queries idiomatically " +
            "for each platform (e.g. hashtags for TikTok/Instagram, subreddit-style phrasing for " +
            "Reddit). Only use platforms from the given list.",
        },
        {
          role: "user",
          content: `Company: ${company}\nProducts/keywords: ${products.join(", ")}\nPlatforms: ${platforms.join(", ")}\nESG focus: ${esg.join(", ")}`,
        },
      ],
      {
        type: "json_schema",
        json_schema: {
          name: "queries",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["queries"],
            properties: {
              queries: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["platform", "query"],
                  properties: {
                    platform: { type: "string", enum: platforms },
                    query: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    );
    const parsed = JSON.parse(content) as { queries?: PlannedQuery[] };
    return (parsed.queries ?? []).filter(
      (q) =>
        (platforms as string[]).includes(q.platform) &&
        typeof q.query === "string" &&
        q.query.trim().length > 0,
    );
  } catch (e) {
    console.error("planQueries failed", e);
    return [];
  }
}

async function selectRelevant(
  company: string,
  esg: string[],
  candidates: RawScannedPost[],
  count: number,
): Promise<Array<{ i: number; esg: "environmental" | "social" | "governance" | null }>> {
  if (candidates.length === 0) return [];
  const numbered = candidates
    .map((p, i) => `${i}. [${p.source}] ${truncate(p.text, 300).replace(/\s+/g, " ")}`)
    .join("\n");

  try {
    const content = await chatCompletion(
      "flash",
      [
        {
          role: "system",
          content:
            `You are filtering scanned social posts for relevance to "${company}" and the ESG ` +
            `categories [${esg.join(", ")}]. From the numbered candidates below, pick up to ${count} ` +
            `posts that are genuinely relevant (mention the company/products, or clearly discuss one ` +
            `of the given ESG topics in connection with it) and assign each an ESG category, or null ` +
            `if off-topic. Only reference indices that were given to you — never invent one.`,
        },
        { role: "user", content: numbered },
      ],
      {
        type: "json_schema",
        json_schema: {
          name: "picks",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["picks"],
            properties: {
              picks: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["i", "esg"],
                  properties: {
                    i: { type: "integer" },
                    esg: {
                      type: ["string", "null"],
                      enum: ["environmental", "social", "governance", null],
                    },
                  },
                },
              },
            },
          },
        },
      },
    );
    const parsed = JSON.parse(content) as {
      picks?: Array<{ i: number; esg: "environmental" | "social" | "governance" | null }>;
    };
    // Hard guardrail: silently drop any index the model hallucinated out of range.
    return (parsed.picks ?? []).filter(
      (p) => Number.isInteger(p.i) && p.i >= 0 && p.i < candidates.length,
    );
  } catch (e) {
    console.error("selectRelevant failed", e);
    return [];
  }
}

export const scanWithAgent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ScanInput.parse(d))
  .handler(async ({ data }): Promise<RawScannedPost[]> => {
    const selected = data.platforms.filter(
      (p): p is RealScanPlatform => (REAL_SCAN_PLATFORMS as readonly string[]).includes(p),
    );
    const active: RealScanPlatform[] =
      selected.length > 0 ? selected : (["reddit", "x", "youtube"] as RealScanPlatform[]);
    const companyQ = data.company.trim();

    // 1. AI plans platform-specific search queries from the scan config.
    let planned = await planQueries(companyQ, data.products, active, data.esg);
    if (planned.length === 0) {
      // Planning failed (bad response / gateway error) — fall back to the
      // mechanical company+keyword cross product so the scan still runs.
      planned = active.flatMap((platform) =>
        keywordTerms(data.products).map((term) => ({
          platform,
          query: companyQ ? `${companyQ} ${term}` : term,
        })),
      );
    }

    // 2. Execute the planned queries against the *real* fetchers. Nothing
    // fabricated enters the pipeline from this point on.
    const perQueryFetch = Math.max(10, Math.ceil((data.count * 3) / Math.max(1, planned.length)));
    const fetched = await Promise.all(
      planned.map((q) =>
        q.platform === "youtube"
          ? fetchYouTube("", [q.query], perQueryFetch, data.from, data.to)
          : fetchSocialCrawl(
              q.platform as Exclude<RealScanPlatform, "youtube">,
              "",
              [q.query],
              perQueryFetch,
            ),
      ),
    );

    const fromMs = new Date(`${data.from}T00:00:00Z`).getTime();
    const toMs = new Date(`${data.to}T23:59:59Z`).getTime();
    const seen = new Set<string>();
    const candidates: RawScannedPost[] = [];
    for (const post of fetched.flat()) {
      const key = post.url || post.id;
      if (seen.has(key)) continue;
      const t = new Date(post.ts).getTime();
      if (!Number.isFinite(t) || t < fromMs || t > toMs) continue;
      seen.add(key);
      candidates.push(post);
    }
    candidates.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    // 3. AI judges relevance/ESG fit over the real candidates. It can only
    // select indices it was actually shown, so it cannot invent a post.
    const picks = await selectRelevant(companyQ, data.esg, candidates, data.count);

    const finalPosts =
      picks.length === 0
        ? // Selection failed — fall back to the most recent real candidates
          // rather than returning nothing.
          candidates.slice(0, data.count)
        : picks.slice(0, data.count).map((p) => candidates[p.i]);

    // 4. Fetch comments on the selected posts, additive on top of `count`.
    // Only YouTube (official API) and Reddit (public no-auth endpoint) are
    // supported — SocialCrawl's comment-fetching capability for X/TikTok/
    // Instagram is unknown, so those are skipped rather than guessed at.
    // A comment-fetch failure never blocks returning the posts themselves.
    try {
      const commentBatches = await Promise.all(
        finalPosts.map((post) => {
          if (post.source === "youtube") {
            if (!post.url) return Promise.resolve([]);
            let videoId: string | null = null;
            try {
              videoId = new URL(post.url).searchParams.get("v");
            } catch {
              videoId = null;
            }
            if (!videoId) return Promise.resolve([]);
            return fetchYouTubeComments(videoId, post.url, post.product, 5);
          }
          if (post.source === "reddit") {
            return fetchRedditComments(post.url, post.product, 5);
          }
          return Promise.resolve([]);
        }),
      );
      finalPosts.push(...commentBatches.flat());
    } catch (e) {
      console.error("comment fetching failed", e);
    }

    return finalPosts;
  });
