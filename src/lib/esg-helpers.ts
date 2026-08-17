import type { Stock } from "./cgsi-data";

export type Verdict = "Better than peers" | "Similar to peers" | "Weaker than peers";

export function sectorAverages(sector: Stock["sector"], stocks: Stock[]) {
  const peers = stocks.filter((s) => s.sector === sector);
  const n = peers.length || 1;
  const sum = (k: keyof Stock) =>
    peers.reduce((a, s) => a + (typeof s[k] === "number" ? (s[k] as number) : 0), 0) / n;
  const carbonReduction = (s: Stock) =>
    ((s.carbon[0].total - s.carbon[s.carbon.length - 1].total) / s.carbon[0].total) * 100;
  return {
    esgScore: sum("esgScore"),
    environmental: sum("environmental"),
    social: sum("social"),
    governance: sum("governance"),
    boardIndependence: sum("boardIndependence"),
    carbonReduction: peers.reduce((a, s) => a + carbonReduction(s), 0) / n,
    peerCount: peers.length,
  };
}

export function verdict(value: number, peerAvg: number): Verdict {
  const diff = value - peerAvg;
  if (diff >= 4) return "Better than peers";
  if (diff <= -4) return "Weaker than peers";
  return "Similar to peers";
}

export function carbonReduction(stock: Stock) {
  return (
    ((stock.carbon[0].total - stock.carbon[stock.carbon.length - 1].total) /
      stock.carbon[0].total) *
    100
  );
}

export function dataConfidence(stock: Stock): {
  level: "High" | "Medium" | "Low";
  reasons: string[];
} {
  // Coverage indicator for the illustrative prototype dataset.
  const reasons: string[] = [];
  let score = 0;
  if (stock.exchange === "SGX") {
    score += 2;
    reasons.push("SGX-style sustainability fields represented in the prototype profile");
  }
  if (stock.esgScore >= 75) {
    score += 2;
    reasons.push("Complete overall and pillar-level illustrative ESG scores");
  } else if (stock.esgScore >= 65) {
    score += 1;
    reasons.push("Core illustrative ESG fields are present, with some detail gaps");
  } else {
    reasons.push("Limited ESG detail in the current prototype profile");
  }
  if (stock.boardIndependence >= 80) {
    score += 1;
    reasons.push("Governance and board-independence fields are represented");
  } else {
    reasons.push("Governance detail requires source-document validation");
  }
  if (stock.esgStrength === "Weak") {
    reasons.push("Illustrative sustainability coverage is limited");
  } else {
    score += 1;
    reasons.push("Environmental, social, and governance pillars are all represented");
  }
  const level = score >= 5 ? "High" : score >= 3 ? "Medium" : "Low";
  return { level, reasons };
}

export function redFlags(
  stock: Stock,
): { title: string; body: string; severity: "high" | "medium" }[] {
  const flags: { title: string; body: string; severity: "high" | "medium" }[] = [];
  if (stock.boardIndependence < 75) {
    flags.push({
      title: "Governance concern: board independence",
      body: `Board independence is ${stock.boardIndependence}% in this illustrative profile. Compare it with the displayed sector benchmark and validate it against the latest annual report.`,
      severity: stock.boardIndependence < 65 ? "high" : "medium",
    });
  }
  if (stock.environmental < 60) {
    flags.push({
      title: "Environmental concern: high carbon exposure",
      body: "Environmental score is weak. The company has higher emissions or slower transition to renewables compared with peers.",
      severity: "high",
    });
  }
  if (stock.social < 65) {
    flags.push({
      title: "Social risk: workforce or community concerns",
      body: "Social score is below average. Watch for labour practices, supply-chain ethics, or community-impact issues.",
      severity: "medium",
    });
  }
  if (stock.esgStrength === "Weak") {
    flags.push({
      title: "Overall ESG rating is weak",
      body: "This stock currently scores below peers across multiple ESG pillars. Consider whether the financial upside justifies the ESG risk.",
      severity: "high",
    });
  }
  return flags;
}

export const GLOSSARY: { term: string; definition: string }[] = [
  {
    term: "ESG",
    definition:
      "Environmental, Social, and Governance — a framework used to measure how sustainable and ethical a company is.",
  },
  {
    term: "Carbon emissions",
    definition:
      "Greenhouse gases (mainly CO₂) released by a company's operations. Lower is better.",
  },
  {
    term: "Scope 1 emissions",
    definition:
      "Direct emissions from sources the company owns, such as company vehicles or factory chimneys.",
  },
  {
    term: "Scope 2 emissions",
    definition:
      "Indirect emissions from the electricity, steam, heat, or cooling the company buys.",
  },
  {
    term: "Scope 3 emissions",
    definition:
      "All other indirect emissions across the value chain — suppliers, product use, business travel.",
  },
  {
    term: "Renewable energy",
    definition:
      "Power from sources like solar, wind, or hydro that do not run out and produce little carbon.",
  },
  {
    term: "Board independence",
    definition:
      "The percentage of board members who are not employees or insiders. Higher independence usually means better oversight.",
  },
  {
    term: "Governance risk",
    definition:
      "The chance that weak leadership, poor controls, or unethical decisions hurt the company and its investors.",
  },
  {
    term: "Greenwashing",
    definition:
      "When a company makes its products or practices look more environmentally friendly than they really are.",
  },
  {
    term: "Sustainability reporting",
    definition:
      "Public reports a company publishes describing its ESG performance, targets, and progress.",
  },
  {
    term: "Net-zero",
    definition:
      "Reducing emissions as much as possible and balancing the remainder so the net effect on the atmosphere is zero.",
  },
  {
    term: "Match score",
    definition:
      "A personalised 0–100 score showing how well a stock fits your risk, ESG, and sector preferences.",
  },
];

export function simpleExplain(stock: Stock, stocks: Stock[]): string {
  const peer = sectorAverages(stock.sector, stocks);
  const v = verdict(stock.esgScore, peer.esgScore);
  const tone =
    stock.esgStrength === "Strong"
      ? "is doing well"
      : stock.esgStrength === "Average"
        ? "is doing okay"
        : "needs to improve";
  return (
    `In this illustrative profile, ${stock.name} ${tone} on sustainability and business practices. ` +
    `Within the CGSI sample ${stock.sector.toLowerCase()} universe it is ${v.toLowerCase()}. ` +
    `Its risk level is ${stock.risk.toLowerCase()}, meaning prices can ` +
    `${stock.risk === "High" ? "swing a lot day to day" : stock.risk === "Medium" ? "move moderately" : "stay relatively steady"}. ` +
    `For a beginner investor, this usually means ${beginnerGuidance(stock)}.`
  );
}

function beginnerGuidance(stock: Stock): string {
  if (stock.esgStrength === "Strong" && stock.risk === "Low")
    return "the profile appears comparatively stable, but the underlying sources and financial fundamentals still need review";
  if (stock.esgStrength === "Strong" && stock.risk === "Medium")
    return "the ESG profile is strong while the modelled risk remains moderate";
  if (stock.esgStrength === "Strong" && stock.risk === "High")
    return "strong ESG characteristics do not remove the potential for larger price movements";
  if (stock.esgStrength === "Average")
    return "the ESG picture is mixed, so review the pillar scores and materiality signals";
  return "the weaker ESG profile warrants closer review and comparison with the sample peers";
}

export function helpForScore(label: string, value: number, peerAvg: number): string {
  const above = value > peerAvg + 3;
  const below = value < peerAvg - 3;
  if (above)
    return `This ${label} score is strong because the company performs better than the ${Math.round(peerAvg)} sector average — typically driven by clearer disclosures, lower emissions, or stronger oversight.`;
  if (below)
    return `This ${label} score is weak because the company scores below the ${Math.round(peerAvg)} sector average — usually due to gaps in disclosures, higher emissions, or weaker controls.`;
  return `This ${label} score is in line with the ${Math.round(peerAvg)} sector average — neither a clear leader nor a clear laggard among peers.`;
}
