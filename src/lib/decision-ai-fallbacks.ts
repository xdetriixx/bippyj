import type {
  DecisionBriefMode,
  DecisionBriefResult,
  DecisionStockContext,
  ImpactBridgeResult,
  PeerComparisonResult,
  PeerQuestion,
  ScenarioIntensity,
  ScenarioResult,
  ScenarioType,
} from "./decision-ai.types";

const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;

export function fallbackImpactBridge(stock: DecisionStockContext): ImpactBridgeResult {
  const emissionsDirection = stock.emissionsChangePct >= 0 ? "declined" : "increased";
  const emissionsMagnitude = Math.abs(stock.emissionsChangePct);
  return {
    items: [
      {
        issue: "Emissions trajectory",
        signal: `Illustrative total emissions ${emissionsDirection} by ${emissionsMagnitude.toFixed(1)}% from FY2021 to FY2025.`,
        financialChannel:
          "Emissions exposure can affect operating costs through energy use, carbon-related charges, compliance work, and capital required for transition activities.",
        timeHorizon: "Medium term",
        evidence: [
          `Latest illustrative emissions: ${stock.latestEmissions.toLocaleString()} tCO₂e.`,
          `Renewable energy share: ${stock.renewableEnergyPct.toFixed(1)}%.`,
        ],
        confidence: "Medium",
        assumptions: [
          "Carbon-related costs apply to a material portion of operations.",
          "The prototype emissions series is directionally representative.",
        ],
      },
      {
        issue: "Workforce continuity",
        signal: `Employee indicator is ${stock.employeeIndicator.toFixed(1)}/5 in the illustrative profile.`,
        financialChannel:
          "Workforce stability may influence recruitment, training, productivity, service continuity, and execution costs.",
        timeHorizon: "Near term",
        evidence: [`Social score: ${stock.social}/100 versus sector ${stock.peerSocial}/100.`],
        confidence: "Low",
        assumptions: ["The employee indicator is a useful proxy for retention and engagement."],
      },
      {
        issue: "Governance oversight",
        signal: `Governance score is ${stock.governance}/100 and board independence is ${stock.boardIndependence}%.`,
        financialChannel:
          "Oversight quality may influence control failures, regulatory response, strategic execution, and access to capital.",
        timeHorizon: "Long term",
        evidence: [`Sector governance benchmark: ${stock.peerGovernance}/100.`],
        confidence: "Medium",
        assumptions: ["The displayed governance measures reflect effective oversight in practice."],
      },
    ],
    limitations: [
      "All ESG and financial values in this bridge are illustrative prototype data.",
      "Geographic exposure, company targets, regulatory coverage, and source-document evidence are missing.",
    ],
  };
}

export function fallbackDecisionBrief(
  stock: DecisionStockContext,
  mode: DecisionBriefMode,
): DecisionBriefResult {
  const strongest = [
    ["Environmental", stock.environmental, stock.peerEnvironmental],
    ["Social", stock.social, stock.peerSocial],
    ["Governance", stock.governance, stock.peerGovernance],
  ].sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const revenueChange = ((stock.latestRevenue - stock.priorRevenue) / stock.priorRevenue) * 100;
  if (mode === "30-second") {
    return {
      fitReasons: [
        `ESG is ${stock.esgScore}/100 versus the sector's ${stock.peerEsgScore}/100.`,
        `${strongest[0]} is the strongest pillar at ${strongest[1]}/100.`,
      ],
      risks: [
        `Risk is classified as ${stock.risk}.`,
        `The data is illustrative and is not linked to company reports.`,
      ],
      strongestEsgFactor: {
        factor: String(strongest[0]),
        evidence: `${strongest[1]}/100 versus sector ${strongest[2]}/100.`,
      },
      importantFinancialFactor: {
        factor: "Revenue and margin direction",
        evidence: `Revenue changed ${signed(revenueChange)}; latest margin is ${stock.latestMargin.toFixed(1)}%.`,
      },
      uncertainties: ["Geography, transition targets, and source citations are unavailable."],
      nextAction: `Compare ${stock.ticker} with one ${stock.sector} peer before drawing a conclusion.`,
    };
  }

  if (mode === "beginner") {
    return {
      fitReasons: [
        `The overall ESG score is ${stock.esgScore}/100, compared with the sector benchmark of ${stock.peerEsgScore}/100. A benchmark is the typical score used for comparison.`,
        `${strongest[0]} is the strongest ESG pillar at ${strongest[1]}/100, meaning it is the best-performing environmental, social, or governance category shown.`,
        `The ${stock.risk.toLowerCase()} risk label can help the investor check whether the stock fits the amount of uncertainty they are comfortable with.`,
      ],
      risks: [
        "The figures are illustrative examples rather than verified company disclosures.",
        `The latest margin is ${stock.latestMargin.toFixed(1)}%. Margin is the share of revenue remaining after relevant costs, so higher costs could reduce it.`,
        "Missing location and transition-plan information makes future sustainability exposure harder to judge.",
      ],
      strongestEsgFactor: {
        factor: String(strongest[0]),
        evidence: `${strongest[1]}/100. This is the highest of the three displayed ESG categories.`,
      },
      importantFinancialFactor: {
        factor: "Revenue and margin direction",
        evidence: `Revenue changed ${signed(revenueChange)}. Margin is ${stock.latestMargin.toFixed(1)}%, meaning this percentage of the displayed revenue remains after the relevant costs in the prototype.`,
      },
      uncertainties: [
        "The ESG indicators do not currently include links to source documents.",
        "The dashboard does not show where the company operates or which regulations apply.",
      ],
      nextAction: `Compare ${stock.ticker} with a ${stock.sector} peer, then check the largest difference in a recent company report.`,
    };
  }

  return {
    fitReasons: [
      `Composite ESG is ${stock.esgScore}/100 versus a sector benchmark of ${stock.peerEsgScore}/100, a ${signed(((stock.esgScore - stock.peerEsgScore) / stock.peerEsgScore) * 100)} relative difference that provides initial sector context.`,
      `${strongest[0]} leads the displayed pillars at ${strongest[1]}/100; the corresponding sector benchmarks should be reviewed before treating the raw score as an advantage.`,
      `Revenue changed ${signed(revenueChange)} while the latest margin is ${stock.latestMargin.toFixed(1)}%, providing a financial baseline for assessing whether ESG-related costs could be absorbed.`,
    ],
    risks: [
      "The ESG and financial series are illustrative and cannot establish actual company performance without primary-source validation.",
      `A ${stock.latestMargin.toFixed(1)}% latest margin may be sensitive to operating, compliance, energy, or transition expenditure, although the supplied data cannot quantify that sensitivity.`,
      "Geographic, regulatory, segment-level, and transition-plan data are absent, preventing a materiality assessment of the company's largest sustainability exposures.",
    ],
    strongestEsgFactor: {
      factor: String(strongest[0]),
      evidence: `${strongest[1]}/100 versus the sector benchmark of ${strongest[2]}/100. The gap is evidence from the displayed profile, but it does not prove operational performance without source documents.`,
    },
    importantFinancialFactor: {
      factor: "Revenue and margin direction",
      evidence: `Revenue changed ${signed(revenueChange)} to ${stock.latestRevenue.toLocaleString()} ${stock.financialUnit}, while margin moved from ${stock.priorMargin.toFixed(1)}% to ${stock.latestMargin.toFixed(1)}%. This baseline matters because ESG-related operating or transition costs could affect margin resilience.`,
    },
    uncertainties: [
      "No source-document citations or reporting-boundary details are attached to the ESG indicators.",
      "Scenario exposure cannot be quantified without geographic, regulatory, and business-segment data.",
      "Management targets, implementation costs, and progress against transition plans are not supplied.",
    ],
    nextAction: `Compare ${stock.ticker}'s sector-relative ESG pillars and margin trend with a ${stock.sector} peer, then validate the largest exposure against recent company reports.`,
  };
}

export function fallbackPeerComparison(
  stocks: DecisionStockContext[],
  question: PeerQuestion,
): PeerComparisonResult {
  const sorted = [...stocks].sort(
    (a, b) => b.esgScore - b.peerEsgScore - (a.esgScore - a.peerEsgScore),
  );
  const governanceRanked = [...stocks].sort(
    (a, b) =>
      b.governance - b.peerGovernance - (a.governance - a.peerGovernance) ||
      b.boardIndependence - a.boardIndependence,
  );
  const governanceLeader = governanceRanked[0];
  const climateLeader = [...stocks].sort(
    (a, b) =>
      b.emissionsChangePct - a.emissionsChangePct || b.renewableEnergyPct - a.renewableEnergyPct,
  )[0];
  const focus =
    question === "Stronger governance"
      ? `${governanceLeader.ticker} has the highest displayed governance score.`
      : question === "Climate transition credibility"
        ? `${climateLeader.ticker} has the strongest displayed combination of emissions direction and renewable share, but plan credibility cannot be established without company targets and disclosures.`
        : `${sorted[0].ticker} has the strongest sector-relative composite ESG position in this illustrative comparison.`;
  const ranked =
    question === "Stronger governance"
      ? governanceRanked
      : question === "Climate transition credibility"
        ? [...stocks].sort(
            (a, b) =>
              b.emissionsChangePct - a.emissionsChangePct ||
              b.renewableEnergyPct - a.renewableEnergyPct,
          )
        : question === "Evidence quality"
          ? [...stocks]
          : question === "Largest ESG-related financial exposure"
            ? [...stocks].sort(
                (a, b) =>
                  a.environmental - b.environmental || a.renewableEnergyPct - b.renewableEnergyPct,
              )
            : sorted;
  const directAnswer =
    question === "Evidence quality"
      ? "No company has stronger evidence quality: all profiles use the same illustrative dataset without linked source documents."
      : `${focus} The ranking is based only on the displayed indicators and should be read with the sector caveat below.`;

  return {
    directAnswer,
    companyAssessments: ranked.map((stock, index) => ({
      ticker: stock.ticker,
      rank:
        question === "Evidence quality" || question === "Climate transition credibility"
          ? null
          : index + 1,
      verdict:
        question === "Evidence quality"
          ? "Insufficient evidence to distinguish"
          : question === "Climate transition credibility"
            ? "Proxy signals available; credibility unverified"
            : index === 0
              ? `Strongest displayed position for: ${question}`
              : `Ranked ${index + 1} on displayed indicators`,
      rationale:
        question === "Stronger governance"
          ? `Governance is ${stock.governance}/100 versus its sector benchmark of ${stock.peerGovernance}/100; board independence is ${stock.boardIndependence}%.`
          : question === "Climate transition credibility"
            ? `Emissions reduction is ${stock.emissionsChangePct.toFixed(1)}% and renewable energy is ${stock.renewableEnergyPct.toFixed(1)}%; these are transition signals, not proof of plan credibility.`
            : question === "Largest ESG-related financial exposure"
              ? `Environmental score is ${stock.environmental}/100, renewable energy is ${stock.renewableEnergyPct.toFixed(1)}%, and latest margin is ${stock.latestMargin.toFixed(1)}%.`
              : question === "Evidence quality"
                ? "The profile contains the same prototype fields and reporting period as the other selected companies."
                : `ESG is ${stock.esgScore}/100 versus its sector benchmark of ${stock.peerEsgScore}/100; risk is ${stock.risk}.`,
      caveat:
        "No linked company report, reporting-boundary detail, or independently verified evidence is supplied.",
    })),
    comparableFacts: [
      {
        metric: "ESG score vs sector",
        values: stocks.map((stock) => ({
          ticker: stock.ticker,
          value: `${stock.esgScore}/100 (${stock.esgScore - stock.peerEsgScore >= 0 ? "+" : ""}${(stock.esgScore - stock.peerEsgScore).toFixed(1)} pts vs sector)`,
        })),
        interpretation:
          "Sector-relative gaps provide more context than comparing raw scores across unrelated industries.",
      },
      {
        metric: "Governance",
        values: stocks.map((stock) => ({
          ticker: stock.ticker,
          value: `${stock.governance}/100`,
        })),
        interpretation: `${governanceLeader.ticker} leads on the displayed governance score; effectiveness still requires source validation.`,
      },
      {
        metric: "Emissions reduction FY2021-FY2025",
        values: stocks.map((stock) => ({
          ticker: stock.ticker,
          value: signed(stock.emissionsChangePct),
        })),
        interpretation:
          "Higher positive values indicate a larger reduction in the illustrative series.",
      },
      {
        metric: "Renewable energy",
        values: stocks.map((stock) => ({
          ticker: stock.ticker,
          value: `${stock.renewableEnergyPct.toFixed(1)}%`,
        })),
        interpretation:
          "Renewable share is a useful operating signal but does not establish the credibility of a transition plan.",
      },
    ],
    importantDifferences: [
      focus,
      `The widest ESG-score spread is ${Math.max(...stocks.map((s) => s.esgScore)) - Math.min(...stocks.map((s) => s.esgScore))} points, but the companies operate in different sectors.`,
      `Latest margins range from ${Math.min(...stocks.map((s) => s.latestMargin)).toFixed(1)}% to ${Math.max(...stocks.map((s) => s.latestMargin)).toFixed(1)}%, so similar ESG pressure may have different financial relevance.`,
    ],
    financialRelevance: stocks.map((stock) => ({
      ticker: stock.ticker,
      esgSignal: `${stock.emissionsChangePct.toFixed(1)}% emissions reduction and ${stock.renewableEnergyPct.toFixed(1)}% renewable energy.`,
      possibleFinancialEffect: `Energy, compliance, or transition spending could affect the displayed ${stock.latestMargin.toFixed(1)}% margin, but the supplied data cannot quantify the effect.`,
    })),
    evidenceQuality: stocks.map((stock) => ({
      ticker: stock.ticker,
      level: "Low" as const,
      reason:
        "The profile is complete enough for demonstration but is not linked to source documents.",
    })),
    missingData: [
      "Company transition targets and progress against targets.",
      "Geographic, regulatory, and business-segment exposure.",
      "Source-document citations and reporting-boundary differences.",
    ],
    sectorCaveat:
      "The selected companies operate in different sectors. Raw ESG, emissions, and renewable-energy values should not be treated as directly equivalent; sector-relative performance and business models must be considered.",
    nextStep: `Validate the leading indicator for ${question.toLowerCase()} against each company's latest report and compare it with a same-sector peer.`,
    conclusion: `${focus} This is a neutral comparison of illustrative indicators, not evidence that one security is a better investment.`,
  };
}

export function fallbackScenario(
  stock: DecisionStockContext,
  scenario: ScenarioType,
  intensity: ScenarioIntensity,
): ScenarioResult {
  const highIntensity = intensity === "Severe";
  const carbonScenario =
    scenario === "Higher carbon pricing" || scenario === "Stricter emissions regulation";
  const metrics: ScenarioResult["affectedMetrics"] = carbonScenario
    ? [
        {
          metric: "Operating expenses",
          direction: "Upward pressure",
          impactRange: highIntensity ? "Moderate to high" : "Low to moderate",
          rationale: `The profile shows ${stock.latestEmissions.toLocaleString()} tCO₂e of latest illustrative emissions and ${stock.renewableEnergyPct.toFixed(1)}% renewable energy.`,
        },
        {
          metric: "Operating margin",
          direction: "Downward pressure",
          impactRange: highIntensity ? "Moderate" : "Low",
          rationale:
            "Higher compliance or energy costs could pressure margin if they cannot be offset or passed through.",
        },
        {
          metric: "Capital expenditure",
          direction: "Upward pressure",
          impactRange: "Moderate",
          rationale: "Transition investment may be needed to reduce exposure over time.",
        },
      ]
    : [
        {
          metric:
            scenario === "Increased renewable-energy adoption"
              ? "Energy costs"
              : "Operating expenses",
          direction: "Mixed",
          impactRange: highIntensity ? "Moderate to high" : "Low to moderate",
          rationale:
            "Implementation costs may rise initially while resilience or efficiency benefits may emerge later.",
        },
        {
          metric: "Operating margin",
          direction: "Mixed",
          impactRange: "Moderate",
          rationale: `The latest illustrative margin is ${stock.latestMargin.toFixed(1)}%; the effect depends on execution cost and operational benefits.`,
        },
        {
          metric: "Capital expenditure",
          direction: "Upward pressure",
          impactRange: highIntensity ? "Moderate to high" : "Moderate",
          rationale: "New systems, controls, suppliers, or infrastructure may require investment.",
        },
      ];

  return {
    summary: `Under the ${intensity.toLowerCase()} ${scenario.toLowerCase()} scenario, ${stock.ticker} could experience ${metrics[0].impactRange.toLowerCase()} financial pressure through the channels below. This is an educational sensitivity analysis, not a forecast.`,
    affectedMetrics: metrics,
    assumptions: [
      "The selected scenario materially affects the company's operations or value chain.",
      "Management does not fully offset costs through pricing, efficiency, insurance, or hedging.",
      "Illustrative ESG indicators are directionally representative.",
    ],
    uncertainties: [
      "Geographic and regulatory exposure is not available.",
      "Company mitigation plans, implementation timing, and cost pass-through are unknown.",
    ],
    confidence: "Low",
  };
}
