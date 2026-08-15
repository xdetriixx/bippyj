import type { Stock } from "./cgsi-data";

export type BehaviorBias = {
  risk: Record<string, number>;
  esg: Record<string, number>;
  sector: Record<string, number>;
  exchange: Record<string, number>;
};

export type DominantPreferences = {
  risk: string | null;
  esg: string | null;
  sector: string | null;
  exchange: string | null;
};

export type AlignmentDimension = {
  key: keyof DominantPreferences;
  label: string;
  target: string | null;
  companyValue: string;
  weight: number;
  matched: boolean;
};

export type PersonalMatchResult = {
  score: number;
  alignmentScore: number | null;
  matchedCount: number;
  availableCount: number;
  dimensions: AlignmentDimension[];
};

const ALIGNMENT_WEIGHTS = {
  risk: 35,
  esg: 30,
  sector: 20,
  exchange: 15,
} as const;

export function getDominantPreferences(bias: BehaviorBias): DominantPreferences {
  const top = (record: Record<string, number>) => {
    let key: string | null = null;
    let max = 0;

    for (const candidate in record) {
      if (record[candidate] > max) {
        max = record[candidate];
        key = candidate;
      }
    }

    return key;
  };

  return {
    risk: top(bias.risk),
    esg: top(bias.esg),
    sector: top(bias.sector),
    exchange: top(bias.exchange),
  };
}

export function calculatePersonalMatch(
  stock: Stock,
  preferences: DominantPreferences,
): PersonalMatchResult {
  const dimensions: AlignmentDimension[] = [
    {
      key: "risk",
      label: "Risk",
      target: preferences.risk,
      companyValue: stock.risk,
      weight: ALIGNMENT_WEIGHTS.risk,
      matched: preferences.risk === stock.risk,
    },
    {
      key: "esg",
      label: "ESG",
      target: preferences.esg,
      companyValue: stock.esgStrength,
      weight: ALIGNMENT_WEIGHTS.esg,
      matched: preferences.esg === stock.esgStrength,
    },
    {
      key: "sector",
      label: "Sector",
      target: preferences.sector,
      companyValue: stock.sector,
      weight: ALIGNMENT_WEIGHTS.sector,
      matched: preferences.sector === stock.sector,
    },
    {
      key: "exchange",
      label: "Exchange",
      target: preferences.exchange,
      companyValue: stock.exchange,
      weight: ALIGNMENT_WEIGHTS.exchange,
      matched: preferences.exchange === stock.exchange,
    },
  ];

  const available = dimensions.filter((dimension) => dimension.target !== null);
  if (available.length === 0) {
    return {
      score: stock.match,
      alignmentScore: null,
      matchedCount: 0,
      availableCount: 0,
      dimensions,
    };
  }

  const availableWeight = available.reduce((total, dimension) => total + dimension.weight, 0);
  const matchedWeight = available.reduce(
    (total, dimension) => total + (dimension.matched ? dimension.weight : 0),
    0,
  );
  const alignmentScore = Math.round((matchedWeight / availableWeight) * 100);
  const score = Math.max(0, Math.min(99, Math.round(stock.match * 0.6 + alignmentScore * 0.4)));

  return {
    score,
    alignmentScore,
    matchedCount: available.filter((dimension) => dimension.matched).length,
    availableCount: available.length,
    dimensions,
  };
}
