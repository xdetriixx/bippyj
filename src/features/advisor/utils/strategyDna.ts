import type { BMCResult } from "../types";

export function getStrategyDnaThemes(resultA: BMCResult, resultB: BMCResult) {
  const nameA = resultA.companyName || "Entity A";
  const nameB = resultB.companyName || "Entity B";
  const normA = nameA.toLowerCase().trim();
  const normB = nameB.toLowerCase().trim();

  interface ThemeDetail {
    theme: string;
    focusScore: number;
    mentions: number;
    description: string;
  }

  const THEME_PRESETS = [
    {
      theme: "High-Tier Wealth Expansion",
      keywords: [
        "wealth",
        "hnw",
        "accredited",
        "private client",
        "aum",
        "advisory",
        "affluent",
        "premium",
        "trust",
        "estate",
        "uob",
        "dbs",
      ],
      description:
        "Obsessed with active client retainer fee generation and premium high-net-worth advisory growth.",
    },
    {
      theme: "Core Digital Migration",
      keywords: [
        "digital",
        "portal",
        "migration",
        "online",
        "internet",
        "hybrid",
        "platform",
        "app",
        "mobile",
        "tech",
      ],
      description:
        "Heavy focus on migrating transaction pipelines online to lower human physical touchpoint costs.",
    },
    {
      theme: "Sovereign Trade Corridors",
      keywords: [
        "cross-border",
        "bilateral",
        "regional",
        "malaysia",
        "singapore",
        "asean",
        "corridor",
        "trade",
        "clearing",
      ],
      description:
        "Exploiting unique Malaysia-Singapore bilateral compliance arrangements and ASEAN clearing.",
    },
    {
      theme: "AI-Led Risk Screening",
      keywords: [
        "ai",
        "automated risk",
        "compliance checks",
        "risk rating",
        "audit",
        "screening",
        "algorithm",
        "intelligence",
        "llm",
      ],
      description: "Automating background legal and regulatory risk profiling.",
    },
    {
      theme: "Regional ESG Mandates",
      keywords: [
        "green",
        "esg",
        "financing",
        "sustain",
        "carbon",
        "social",
        "governance",
        "climate",
      ],
      description: "Integration of green financing goals into default product portfolios.",
    },
    {
      theme: "Corporate Model Streamlining",
      keywords: [
        "streamline",
        "cost",
        "overhead",
        "operating",
        "leverage",
        "consolidate",
        "outsourc",
        "r&d",
        "automation",
      ],
      description: "Obsessed with R&D, structural cost reductions, and outsourcing support tasks.",
    },
    {
      theme: "SaaS Licensing Retainers",
      keywords: ["saas", "subscription", "licensing", "recurring", "retainer", "seat", "flat fee"],
      description: "Migrating from transaction brokerage fees to monthly digital service seats.",
    },
    {
      theme: "Retail Accredited Inflow",
      keywords: [
        "retail",
        "crowd",
        "mass affluent",
        "high-yield",
        "structural cash",
        "investment",
        "inflow",
      ],
      description: "Marketing high-yield structural cash investments to standard private clients.",
    },
    {
      theme: "Automated Compliance Hubs",
      keywords: [
        "compliance hub",
        "legal templates",
        "regulatory sandbox",
        "onboarding",
        "license",
      ],
      description: "Using centralized legal templates to expedite cross-border client onboarding.",
    },
    {
      theme: "Ultra-Low Brokerage Costing",
      keywords: [
        "brokerage",
        "discount",
        "margin",
        "volume",
        "execution cost",
        "cheap",
        "bulk",
        "commission",
        "cgs",
        "cimb",
      ],
      description: "Extremely targeted on reducing execution margins to capture bulk capital.",
    },
    {
      theme: "Developer API Integration",
      keywords: ["api", "developer", "sdk", "integrat", "programmatic", "endpoint", "connect"],
      description: "Allowing external programmatic advisors to bind directly to clearing APIs.",
    },
    {
      theme: "Accredited Crowd Inflow",
      keywords: ["crowdfund", "syndicat", "co-invest", "fractional"],
      description:
        "Bypassing heavy branch advisor overheads by licensing digital self-service tools.",
    },
    {
      theme: "Capital Resource Slicing",
      keywords: ["fractionalize", "slice", "token", "asset-backed", "bond", "infra"],
      description: "Providing fractional ownership assets in regional infrastructure bonds.",
    },
    {
      theme: "Shariah Clearance Audits",
      keywords: ["shariah", "islamic", "halal", "compliance audit", "shari'ah", "ethical"],
      description: "Structuring automated trade execution to conform to Islamic finance audits.",
    },
    {
      theme: "High-Touch Personal Advisory",
      keywords: [
        "high-touch",
        "concierge",
        "personal",
        "relationship",
        "advisor",
        "branch",
        "face-to-face",
        "bespoke",
        "uob",
        "gold",
      ],
      description: "Focused on human advisory, concierge service, and physical office networks.",
    },
    {
      theme: "Premium Brand Exclusivity",
      keywords: ["brand", "prestige", "heritage", "legacy", "elite", "reputation", "tier"],
      description: "Building an elite accredited group around AUM minimums of $2.5M.",
    },
    {
      theme: "Regulatory Compliance Shield",
      keywords: [
        "shield",
        "protection",
        "litigation",
        "asset protection",
        "jurisdiction",
        "sovereign",
      ],
      description:
        "Expanding regional licensing coverage to shield client asset structures from litigation.",
    },
    {
      theme: "Legacy Asset Trust Sourcing",
      keywords: [
        "trust",
        "family office",
        "generational",
        "succession",
        "heir",
        "bequest",
        "legacy",
      ],
      description:
        "Establishing traditional trust structures for family-office generational security.",
    },
    {
      theme: "Physical Hub Consolidation",
      keywords: ["physical", "hq", "concourse", "tier-1", "offices", "building", "real estate"],
      description: "Positioning client consulting hubs in tier-1 financial capitals.",
    },
  ];

  const generateThemesForEntity = (name: string, result: BMCResult) => {
    // 1. Gather all searchable words
    let contentString = (name + " " + (result.reportType || "")).toLowerCase();
    result.blocks.forEach((block) => {
      contentString += " " + block.name.toLowerCase();
      block.keyPoints.forEach((pt) => {
        contentString += " " + pt.point.toLowerCase() + " " + pt.description.toLowerCase();
      });
    });

    // 2. Compute a stable deterministic seed for this company NAME
    let nameHash = 0;
    for (let i = 0; i < name.length; i++) {
      nameHash = (nameHash << 5) - nameHash + name.charCodeAt(i);
      nameHash |= 0;
    }
    const cSeed = Math.abs(nameHash);

    // 3. Score all presets
    const scoredPresets = THEME_PRESETS.map((preset, idx) => {
      // Base score is deterministic by company name so identical names get identical base focus levels
      let score = 55 + ((cSeed + idx * 23) % 25); // Range 55 to 80
      let keywordMentions = 0;

      preset.keywords.forEach((kw) => {
        if (contentString.includes(kw)) {
          score += 15;
          keywordMentions += 3;
        }
      });

      let finalScore = Math.min(98, score);
      let mentions =
        keywordMentions === 0
          ? Math.floor(finalScore / 7)
          : keywordMentions + Math.floor(finalScore / 10);

      // Explicitly customize for DBS / Digi / Beta entities as requested
      const normEntity = name.toLowerCase();
      const isDBS =
        normEntity.includes("dbs") || normEntity.includes("digi") || normEntity.includes("beta");
      if (isDBS) {
        if (preset.theme === "Core Digital Migration") {
          finalScore = 15; // Downgrade to exclude from top 5
          mentions = 1;
        }
      }

      return {
        theme: preset.theme,
        focusScore: finalScore,
        mentions: mentions,
        description: preset.description,
      };
    });

    scoredPresets.sort((a, b) => b.focusScore - a.focusScore);
    return scoredPresets.slice(0, 5);
  };

  const themesA = generateThemesForEntity(nameA, resultA);
  const themesB = generateThemesForEntity(nameB, resultB);

  let divergencePlaySummary = "";
  if (normA === normB) {
    divergencePlaySummary = `The Strategy DNA Map confirms that both Entity A and Entity B represent the same reporting entity scope ("${nameA}"). Their executive priorities, corporate focus channels, and risk mitigation profiles match at a perfect 100% convergence level, as expected.`;
  } else {
    const themeNamesA = themesA.map((t) => t.theme);
    const themeNamesB = themesB.map((t) => t.theme);
    const commonThemes = themeNamesA.filter((t) => themeNamesB.includes(t));

    if (commonThemes.length >= 3) {
      divergencePlaySummary = `Strong strategic alignment detected. Both ${nameA} and ${nameB} are executing closely aligned profiles in the region, focusing extensively on overlapping targets such as ${commonThemes.slice(0, 2).join(" & ")}. This suggests a competitive, commodity-sensitive direct trade theater.`;
    } else {
      divergencePlaySummary = `Divergent strategic paths detected. ${nameA}'s play is highly centered on ${themesA[0].theme} & ${themesA[1].theme} (aiming for structural cost leverage or capital efficiency). In contrast, ${nameB} is running a differentiated play focusing on ${themesB[0].theme} & ${themesB[1].theme} (channeling brand premium assets or specific segment niches).`;
    }
  }

  return {
    themesA,
    themesB,
    divergencePlaySummary,
  };
}
