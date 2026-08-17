/**
 * Types for Business Model Canvas AI Parser
 */

export interface BMCPoint {
  point: string;
  description: string;
  evidenceQuote: string;
  pageNumber: string;
  citationStatus?: "VERIFIED" | "AI_CITED" | "UNRESOLVED" | "MANUAL";
  riskRating: "Low" | "Medium" | "High";
  riskDescription: string;
  sourceTitle?: string;
  sourceUrl?: string;
  evidenceType?: "PDF" | "ONLINE";
}

export interface BMCBlock {
  id: string; // e.g., 'CS', 'VP', 'CH', 'CR', 'RS', 'KR', 'KA', 'KP', 'CS_COST'
  name: string; // e.g., 'Customer Segments'
  keyPoints: BMCPoint[];
}

export interface EfficiencyMetrics {
  estimatedHumanHoursSaved: number;
  confidenceScore: number;
  manpowerCostSavedUSD: number;
}

export interface AdvisorMetrics {
  opportunityScore: number;
  riskScore: number;
  riskTier: "Low Risk" | "Medium Risk" | "High Risk";
  scalabilityRating: string;
  opportunityDriver: string;
  keyThreat: string;
  insight: string;
  highPoints: number;
  mediumPoints: number;
  lowPoints: number;
  operatingLeverage: { revPerEmp: number; staffCostPerEmp: number };
  techLeveragePercent: number;
  nicheRevenueGrowth: number;
  totalRevenueGrowth: number;
  infraOverheadPercent: number;
  revenuePerEmployee: number;
  marketPricePerShare: number | null;
  earningsPerShare: number | null;
  peCurrencyUnit: string;
  priceToEarningsRatio: number | null;
  peAsOfDate: string;
  peEvidence: string;
  peCalculationBasis: string;
  fixedCostIntensity: number;
  feeIncomePercent: number;
  crossBorderRevenueGrowth: number;
  staffCostsPercentOfRevenue: number;
  staffCostsGrowthRate: number;
  revenueGrowthRate: number;
  scalabilityRiskAlert: string;
  scalabilityRiskRating: "LOW" | "MEDIUM" | "HIGH";
  debtComponents: Array<{ label: string; amount: number }>;
  totalDebt: number | null;
  totalShareholdersEquity: number | null;
  debtCurrencyUnit: string;
  debtToEquityRatio: number | null;
  debtToEquityRating: "LOWER" | "MODERATE" | "HIGHER" | "UNAVAILABLE";
  debtToEquityInsight: string;
  debtToEquityEvidence: string;
  debtCalculationBasis: string;
  transparencySentimentScore: number;
  transparencySentimentLabel: string;
  transparencySentimentInsight: string;
  webSources?: MetricWebSource[];
}

export interface MetricWebSource {
  metric:
    | "debtToEquity"
    | "priceToEarnings"
    | "profitGrowth"
    | "capitalAllocation"
    | "businessModelCanvas";
  title: string;
  url: string;
  asOfDate?: string;
}

export interface BMCResult {
  blocks: BMCBlock[];
  efficiencyMetrics: EfficiencyMetrics;
  advisorMetrics?: AdvisorMetrics;
  companyName: string;
  reportType: string;
  parsedAt: string;
  isSimulated: boolean;
}

export interface RubricRule {
  id: string;
  blockName: string;
  guidelines: string;
  keywords: string[];
}

export interface RiskSettings {
  highRiskCriteria: string;
  mediumRiskCriteria: string;
  lowRiskCriteria: string;
}

export interface CapitalAllocationItem {
  label: string;
  amount: number | null;
  evidenceQuote: string;
  pageNumber: string;
  sourceTitle?: string;
  sourceUrl?: string;
}

export interface CapitalAllocationAnalysis {
  periodLabel: string;
  currencyUnit: string;
  sources: CapitalAllocationItem[];
  uses: CapitalAllocationItem[];
  advisorInsight: string;
  verificationNote: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
  snippet?: string;
  domain?: string;
}

export interface PastYearCompareResult {
  companyName: string;
  currentYear: string;
  targetYear: string;
  comparisonNarrative: string;
  aiMetrics?: {
    lastYearPromise: string;
    thisYearResult: string;
    sayDoConsistencyScore: number;
    managementCredibilityRisk: "LOW" | "MEDIUM" | "HIGH";
    sayDoVerdict: string;
    profitMetricLabel: string;
    currentProfit: number | null;
    previousProfit: number | null;
    profitCurrencyUnit: string;
    profitGrowthRate: number | null;
    profitGrowthEvidence: string;
  };
  capitalAllocation: CapitalAllocationAnalysis;
  sources: GroundingSource[];
}

export interface CompetitorOverviewBullet {
  title: string;
  summary: string;
  citationIndex: number;
}

export interface CompetitorOverviewResult {
  overviewMarkdown: string;
  bulletDifferences: CompetitorOverviewBullet[];
  sources: GroundingSource[];
}
