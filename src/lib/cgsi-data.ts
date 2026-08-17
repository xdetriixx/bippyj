export type RiskLevel = "Low" | "Medium" | "High";
export type EsgStrength = "Strong" | "Average" | "Weak";

export type Stock = {
  ticker: string;
  name: string;
  exchange: "NASDAQ" | "NYSE" | "SGX";
  sector: "Technology" | "Financials" | "Energy" | "Automotive" | "Industrials";
  price: number;
  change: number;
  esgScore: number;
  esgStrength: EsgStrength;
  environmental: number;
  social: number;
  governance: number;
  risk: RiskLevel;
  match: number;
  trend: number[];
  carbon: {
    period: string;
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
    intensity: number;
  }[];
  energy: { period: string; renewable: number; nonrenewable: number }[];
  boardIndependence: number;
  employeeSat: number;
  esgTrend: { period: string; score: number }[];
  financial: { period: string; revenue: number; netIncome: number; margin: number }[];
  description: string;
  analystNote: string;
  beginnerSummary: {
    environmental: string;
    social: string;
    governance: string;
    meaning: string[];
  };
  riskNote: string;
};

export function esgStrengthOf(score: number): EsgStrength {
  if (score >= 70) return "Strong";
  if (score >= 55) return "Average";
  return "Weak";
}
