/**
 * Types for Business Model Canvas AI Parser
 */

export interface BMCPoint {
  point: string;
  description: string;
  evidenceQuote: string;
  pageNumber: string;
  riskRating: 'Low' | 'Medium' | 'High';
  riskDescription: string;
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
  riskTier: 'Low Risk' | 'Medium Risk' | 'High Risk';
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
  fixedCostIntensity: number;
  feeIncomePercent: number;
  crossBorderRevenueGrowth: number;
  staffCostsPercentOfRevenue: number;
  staffCostsGrowthRate: number;
  revenueGrowthRate: number;
  scalabilityRiskAlert: string;
  scalabilityRiskRating: 'LOW' | 'MEDIUM' | 'HIGH';
  transparencySentimentScore: number;
  transparencySentimentLabel: string;
  transparencySentimentInsight: string;
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

export interface PastYearComparePoint {
  point: string;
  description: string;
  evidenceQuote?: string;
  sourceUrl?: string;
}

export interface PastYearCompareBlock {
  id: string;
  name: string;
  varianceRating: 'Low' | 'Medium' | 'High';
  changeNotes: string;
  pastYearKeyPoints: PastYearComparePoint[];
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
    itSpendGrowth: number;
    rentCostGrowth: number;
    infraDeltaStatus: 'OPPORTUNITY' | 'RISK' | 'STABLE';
    infrastructureDeltaVerdict: string;
    lastYearPromise: string;
    thisYearResult: string;
    sayDoConsistencyScore: number;
    managementCredibilityRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    sayDoVerdict: string;
  };
  blocks: PastYearCompareBlock[];
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

