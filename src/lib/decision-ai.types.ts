export type DecisionBriefMode = "30-second" | "beginner" | "detailed";
export type ConfidenceLevel = "Low" | "Medium" | "High";
export type TimeHorizon = "Near term" | "Medium term" | "Long term";
export type ScenarioIntensity = "Moderate" | "Elevated" | "Severe";

export type ScenarioType =
  | "Higher carbon pricing"
  | "Stricter emissions regulation"
  | "Increased renewable-energy adoption"
  | "Supply-chain disruption"
  | "New AI-governance requirements";

export type PeerQuestion =
  | "Overall ESG differences"
  | "Stronger governance"
  | "Climate transition credibility"
  | "Evidence quality"
  | "Largest ESG-related financial exposure";

export type DecisionStockContext = {
  ticker: string;
  name: string;
  sector: string;
  risk: string;
  esgStrength: string;
  esgScore: number;
  environmental: number;
  social: number;
  governance: number;
  peerEsgScore: number;
  peerEnvironmental: number;
  peerSocial: number;
  peerGovernance: number;
  boardIndependence: number;
  employeeIndicator: number;
  emissionsChangePct: number;
  latestEmissions: number;
  renewableEnergyPct: number;
  latestRevenue: number;
  latestNetIncome: number;
  latestMargin: number;
  priorRevenue: number;
  priorMargin: number;
  financialUnit: string;
  dataMode: "illustrative prototype";
  reportingPeriod: "FY2025 / latest illustrative quarter";
};

export type ImpactBridgeResult = {
  items: Array<{
    issue: string;
    signal: string;
    financialChannel: string;
    timeHorizon: TimeHorizon;
    evidence: string[];
    confidence: ConfidenceLevel;
    assumptions: string[];
  }>;
  limitations: string[];
};

export type DecisionBriefResult = {
  fitReasons: string[];
  risks: string[];
  strongestEsgFactor: { factor: string; evidence: string };
  importantFinancialFactor: { factor: string; evidence: string };
  uncertainties: string[];
  nextAction: string;
};

export type PeerComparisonResult = {
  directAnswer: string;
  companyAssessments: Array<{
    ticker: string;
    rank: number | null;
    verdict: string;
    rationale: string;
    caveat: string;
  }>;
  comparableFacts: Array<{
    metric: string;
    values: Array<{ ticker: string; value: string }>;
    interpretation: string;
  }>;
  importantDifferences: string[];
  financialRelevance: Array<{
    ticker: string;
    esgSignal: string;
    possibleFinancialEffect: string;
  }>;
  evidenceQuality: Array<{
    ticker: string;
    level: ConfidenceLevel;
    reason: string;
  }>;
  missingData: string[];
  sectorCaveat: string;
  nextStep: string;
  conclusion: string;
};

export type ScenarioResult = {
  summary: string;
  affectedMetrics: Array<{
    metric: string;
    direction: "Upward pressure" | "Downward pressure" | "Mixed";
    impactRange: "Low" | "Low to moderate" | "Moderate" | "Moderate to high" | "High";
    rationale: string;
  }>;
  assumptions: string[];
  uncertainties: string[];
  confidence: ConfidenceLevel;
};
