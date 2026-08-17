import type { Stock } from "./cgsi-data";
import { carbonReduction, sectorAverages } from "./esg-helpers";
import type { DecisionStockContext } from "./decision-ai.types";

export function toDecisionStockContext(stock: Stock, stocks: Stock[]): DecisionStockContext {
  const peer = sectorAverages(stock.sector, stocks);
  const latestFinancial = stock.financial[stock.financial.length - 1];
  const priorFinancial = stock.financial[stock.financial.length - 2];
  const latestCarbon = stock.carbon[stock.carbon.length - 1];
  const latestEnergy = stock.energy[stock.energy.length - 1];

  return {
    ticker: stock.ticker,
    name: stock.name,
    sector: stock.sector,
    risk: stock.risk,
    esgStrength: stock.esgStrength,
    esgScore: stock.esgScore,
    environmental: stock.environmental,
    social: stock.social,
    governance: stock.governance,
    peerEsgScore: Number(peer.esgScore.toFixed(1)),
    peerEnvironmental: Number(peer.environmental.toFixed(1)),
    peerSocial: Number(peer.social.toFixed(1)),
    peerGovernance: Number(peer.governance.toFixed(1)),
    boardIndependence: stock.boardIndependence,
    employeeIndicator: stock.employeeSat,
    emissionsChangePct: Number(carbonReduction(stock).toFixed(1)),
    latestEmissions: latestCarbon.total,
    renewableEnergyPct: latestEnergy.renewable,
    latestRevenue: latestFinancial.revenue,
    latestNetIncome: latestFinancial.netIncome,
    latestMargin: latestFinancial.margin,
    priorRevenue: priorFinancial.revenue,
    priorMargin: priorFinancial.margin,
    financialUnit: stock.exchange === "SGX" ? "SGD millions" : "USD millions",
    dataMode: "illustrative prototype",
    reportingPeriod: "FY2025 / latest illustrative quarter",
  };
}
