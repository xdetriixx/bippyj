export type RiskRating = "Low" | "Medium" | "High";

export interface BMCPoint {
  point: string;
  description: string;
  evidenceQuote: string;
  pageNumber: string;
  riskRating: RiskRating;
  riskDescription: string;
}

export interface BMCBlock {
  id: string;
  name: string;
  keyPoints: BMCPoint[];
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
  fixedCostIntensity: number;
  feeIncomePercent: number;
  crossBorderRevenueGrowth: number;
  staffCostsPercentOfRevenue: number;
  staffCostsGrowthRate: number;
  revenueGrowthRate: number;
  scalabilityRiskAlert: string;
  scalabilityRiskRating: "LOW" | "MEDIUM" | "HIGH";
  transparencySentimentScore: number;
  transparencySentimentLabel: string;
  transparencySentimentInsight: string;
}

export interface BMCResult {
  blocks: BMCBlock[];
  efficiencyMetrics: {
    estimatedHumanHoursSaved: number;
    confidenceScore: number;
    manpowerCostSavedUSD: number;
  };
  advisorMetrics?: AdvisorMetrics;
  companyName: string;
  reportType: string;
  parsedAt: string;
  isSimulated: boolean;
}

export interface RiskSettings {
  highRiskCriteria: string;
  mediumRiskCriteria: string;
  lowRiskCriteria: string;
}
