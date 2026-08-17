import type { BMCResult, RubricRule } from "../types";

export interface PreloadedReport {
  id: string;
  name: string;
  subtitle: string;
  year: string;
  summaryText: string;
  parsedResult: BMCResult;
}

export const DEFAULT_RUBRIC_RULES: RubricRule[] = [
  {
    id: "CS",
    blockName: "Customer Segments",
    guidelines:
      "Identify distinct groups of people/organizations the organization serves (e.g. HNWI, cross-border families, retail, institutional).",
    keywords: [
      "Retail",
      "Institutional",
      "HNWI",
      "Accredited",
      "Cross-border",
      "SME",
      "Family office",
    ],
  },
  {
    id: "VP",
    blockName: "Value Propositions",
    guidelines: "Identify bundles of products and services that create value for customers.",
    keywords: ["Advisory", "Boutique", "Access", "Portfolio", "Custom", "Solution"],
  },
  {
    id: "CH",
    blockName: "Channels",
    guidelines: "How the company communicates with and reaches its customer segments.",
    keywords: ["Platform", "App", "Mobile", "Portal", "Consult", "Office", "Website"],
  },
  {
    id: "CR",
    blockName: "Customer Relationships",
    guidelines: "Types of relationships established with customer segments.",
    keywords: ["Advisory", "Self-service", "Automated", "Personalized", "Consultations", "Trust"],
  },
  {
    id: "RS",
    blockName: "Revenue Streams",
    guidelines: "How the company makes money (e.g. retainer fees, commissions).",
    keywords: ["Commission", "Fees", "Retainer", "AUM", "Spread", "Brokerage"],
  },
  {
    id: "KR",
    blockName: "Key Resources",
    guidelines: "The most important assets required to make the business model work.",
    keywords: ["Advisors", "IT Infrastructure", "Brand", "Capital", "Licenses"],
  },
  {
    id: "KA",
    blockName: "Key Activities",
    guidelines: "The most important actions the company must take to operate successfully.",
    keywords: ["Trading", "Compliance", "Research", "Underwriting", "Advising", "Customization"],
  },
  {
    id: "KP",
    blockName: "Key Partners",
    guidelines: "The network of suppliers and partners that make the business model work.",
    keywords: ["Banks", "Regulators", "Exchanges", "Custodians", "Scholars"],
  },
  {
    id: "CS_COST",
    blockName: "Cost Structure",
    guidelines: "All costs incurred to operate the business model.",
    keywords: ["Staff costs", "Salaries", "IT expense", "Filing expense", "License fee"],
  },
];

export const PRELOADED_REPORTS: PreloadedReport[] = [
  {
    id: "alpha-advisory",
    name: "Alpha Advisory Partners",
    subtitle: "FY2026 Strategic Advisory Plan",
    year: "2026",
    summaryText: `EXECUTIVE SUMMARY FOR Singapore Alpha Advisory Group
We are expanding our Singapore wealth segment for FY2026. Our core Customer Segment consists of High-Net-Worth Individuals (HNWI) in Singapore and cross-border families requiring private wealth strategies.

Our Value Proposition is delivering personalized boutique portfolio advisory services paired with direct custom access channels to regional stock markets.

To reach our clients, we rely on automated smart client portals and high-touch relationship managers who set up direct consults in our physical central office.

Our primary Revenue Streams are Asset Management Retainer fees (typically 1.2% AUM annually) and trade-execution brokerage commissions.

A major operability bottleneck is manual information gathering. Our advisors currently spend over 4.5 hours on average reading each prospect's corporate filings. We are targeting an IT infrastructure shift by allocating an estimated $50,000 for AI Automation systems to ingest annual reports and auto-populate wealth blueprints.

Our current Cost Structure consists mainly of High Professional Advisor Salaries ($120,000 avg/annum per advisor, which represents our primary labor overhead) and market data feed licenses. Realizing an AI-assisted parsing loop will optimize advisor productivity rates by up to 25%, allowing advisors to double their client list. We also maintain strategic alliances with prime custodian banks and international scholars who act as key partners.`,
    parsedResult: {
      companyName: "Alpha Advisory Partners",
      reportType: "FY2026 Strategic Advisory Plan",
      parsedAt: new Date().toISOString(),
      isSimulated: true,
      efficiencyMetrics: {
        estimatedHumanHoursSaved: 4.5,
        confidenceScore: 0.95,
        manpowerCostSavedUSD: 225.0,
      },
      blocks: [
        {
          id: "CS",
          name: "Customer Segments",
          keyPoints: [
            {
              point: "Singapore HNWIs",
              description:
                "High-Net-Worth Individuals demanding personalized discrete portfolio handling and local asset tracking.",
              evidenceQuote:
                "Our core Customer Segment consists of High-Net-Worth Individuals (HNWI) in Singapore and cross-border families requiring private wealth strategies.",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Demands absolute continuity in wealth advisory team alignment.",
            },
            {
              point: "Cross-Border Wealth Families",
              description:
                "Families traversing multi-jurisdictional tax boundaries needing custom inheritance rules.",
              evidenceQuote: "cross-border families requiring private wealth strategies.",
              pageNumber: "Page 1",
              riskRating: "Medium",
              riskDescription: "Vulnerable to cross-border capital rule amendments.",
            },
          ],
        },
        {
          id: "VP",
          name: "Value Propositions",
          keyPoints: [
            {
              point: "Boutique Wealth Services",
              description:
                "Individually compiled asset blueprinting far superior to automated generic wirehouses.",
              evidenceQuote:
                "Our Value Proposition is delivering personalized boutique portfolio advisory services paired with direct custom access channels to regional stock markets.",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Heavy reliance on personal consultant talents.",
            },
          ],
        },
        {
          id: "CH",
          name: "Channels",
          keyPoints: [
            {
              point: "Smart Client Portals",
              description: "Direct digital application tracking to view investments at a glance.",
              evidenceQuote:
                "we rely on automated smart client portals and high-touch relationship managers.",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Subject to continuous security and cybersecurity reviews.",
            },
            {
              point: "Physical Central Office",
              description:
                "Professional high-trust office base located in Singapore financial hub for face-to-face closure.",
              evidenceQuote:
                "high-touch relationship managers who set up direct consults in our physical central office.",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Generates high fixed physical leasing overhead.",
            },
          ],
        },
        {
          id: "CR",
          name: "Customer Relationships",
          keyPoints: [
            {
              point: "High-Touch Consultations",
              description:
                "Individually hosted consulting loops supporting customized account goals and close trust.",
              evidenceQuote:
                "we rely on automated smart client portals and high-touch relationship managers who set up direct consults.",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Advisor saturation limits maximum client capacity.",
            },
          ],
        },
        {
          id: "RS",
          name: "Revenue Streams",
          keyPoints: [
            {
              point: "Retainer AUM Fees",
              description:
                "Steady re-calculating annual commissions that hedge market transactions volatility.",
              evidenceQuote:
                "Our primary Revenue Streams are Asset Management Retainer fees (typically 1.2% AUM annually)",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Drops if clients withdraw large balances.",
            },
            {
              point: "Execution Commissions",
              description:
                "Transactional commission inflows matching clients trade execution frequencies.",
              evidenceQuote: "brokerage commissions.",
              pageNumber: "Page 1",
              riskRating: "High",
              riskDescription: "Highly sensitive to macro market volume droughts.",
            },
          ],
        },
        {
          id: "KR",
          name: "Key Resources",
          keyPoints: [
            {
              point: "Elite Accredited Advisors",
              description: "Expert certified wealth counselors holding local MAS standards.",
              evidenceQuote:
                "Our current Cost Structure consists mainly of High Professional Advisor Salaries",
              pageNumber: "Page 1",
              riskRating: "Medium",
              riskDescription: "Risk of advisors moving and pulling client assets.",
            },
          ],
        },
        {
          id: "KA",
          name: "Key Activities",
          keyPoints: [
            {
              point: "Prospect Filing Auditing",
              description: "Spending over 4 hours per filing reading dense financial logs.",
              evidenceQuote:
                "Our advisors currently spend over 4.5 hours on average reading each prospect's corporate filings.",
              pageNumber: "Page 1",
              riskRating: "High",
              riskDescription: "Major productivity bottleneck limiting expansion indices.",
            },
          ],
        },
        {
          id: "KP",
          name: "Key Partners",
          keyPoints: [
            {
              point: "Prime Custodian Banks",
              description:
                "Trusted bank partners storing client assets safely to enable flawless transfers.",
              evidenceQuote:
                "We also maintain strategic alliances with prime custodian banks and international scholars who act as key partners.",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Partner fee restructuring could reduce margins.",
            },
            {
              point: "International Scholars",
              description: "Global scholars advising on cross-border tax code adaptations.",
              evidenceQuote: "international scholars who act as key partners.",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Contractual coordination delays.",
            },
          ],
        },
        {
          id: "CS_COST",
          name: "Cost Structure",
          keyPoints: [
            {
              point: "High Professional Salaries",
              description: "Heavy payroll expenditures covering high base advisor packages.",
              evidenceQuote:
                "Our current Cost Structure consists mainly of High Professional Advisor Salaries ($120,000 avg/annum per advisor, which represents our primary labor overhead)",
              pageNumber: "Page 1",
              riskRating: "High",
              riskDescription: "Puts pressure on company survival in economic downturns.",
            },
          ],
        },
      ],
    },
  },
  {
    id: "beta-wealth",
    name: "Beta Wealth Advisors",
    subtitle: "FY2026 Restructuring Proposal",
    year: "2026",
    summaryText: `EXECUTIVE SUMMARY FOR Singapore Beta Wealth Advisors Group
We are restructuring our wealth consulting framework. Our primary Customer Segment is comprised of Retail Accredited Investors and established Family Offices.

Our Value Proposition is delivering automated portfolio allocation software combined with active tax restructuring strategies.

To reach our clients, we deploy a high-performance web app container alongside direct marketing events in luxury real estate sectors.

Our primary Revenue Streams are platform monthly subscription charges ($450 per corporate seat) and managed discretionary fee spreads of 0.8% annually on balanced plans.

An operational leak is compliance manual audit loops. Compliance staff spend about 1.5 hours on average reading background documents per transaction. We are targeting automation via an IT platform migration requiring a low $15,000 budget.

The Cost Structure includes software cloud hosting contracts (estimated at $12,000/annum) as our main overhead, with a lean advisor base. Strategic integration with certified regional stock exchanges functions as our key partners.`,
    parsedResult: {
      companyName: "Beta Wealth Advisors",
      reportType: "FY2026 Restructuring Proposal",
      parsedAt: new Date().toISOString(),
      isSimulated: true,
      efficiencyMetrics: {
        estimatedHumanHoursSaved: 1.5,
        confidenceScore: 0.88,
        manpowerCostSavedUSD: 75.0,
      },
      blocks: [
        {
          id: "CS",
          name: "Customer Segments",
          keyPoints: [
            {
              point: "Retail Accredited Investors",
              description:
                "Local retail investors seeking automated asset handling with low minimum capital thresholds.",
              evidenceQuote:
                "Our primary Customer Segment is comprised of Retail Accredited Investors",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Subject to sudden churn if market alternatives emerge.",
            },
            {
              point: "Established Family Offices",
              description: "Multi-generational offices requiring custom digital APIs.",
              evidenceQuote: "Retail Accredited Investors and established Family Offices.",
              pageNumber: "Page 1",
              riskRating: "Medium",
              riskDescription: "Requires bespoke security assurances.",
            },
          ],
        },
        {
          id: "VP",
          name: "Value Propositions",
          keyPoints: [
            {
              point: "Automated Portfolio Allocation Software",
              description: "Cloud algorithms resolving investment allocations in under 10 seconds.",
              evidenceQuote:
                "Our Value Proposition is delivering automated portfolio allocation software",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Continuous update costs.",
            },
            {
              point: "Active Tax Rebalancing",
              description: "AI modules suggesting cross-border tax shields to avoid dual taxation.",
              evidenceQuote: "active tax restructuring strategies.",
              pageNumber: "Page 2",
              riskRating: "High",
              riskDescription: "Under strict scrutiny from international financial regulators.",
            },
          ],
        },
        {
          id: "CH",
          name: "Channels",
          keyPoints: [
            {
              point: "High-Performance Web App",
              description: "Dedicated client cloud console supporting rapid portfolio adjustments.",
              evidenceQuote: "we deploy a high-performance web app container",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Subject to hosting uptime dependencies.",
            },
          ],
        },
        {
          id: "CR",
          name: "Customer Relationships",
          keyPoints: [
            {
              point: "Active Digital Self-Service",
              description:
                "Clients operate through our dashboard independently without needing high-paid physical consultants.",
              evidenceQuote: "automated portfolio allocation software",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "Lower customer loyalty compared to direct human relations.",
            },
          ],
        },
        {
          id: "RS",
          name: "Revenue Streams",
          keyPoints: [
            {
              point: "Platform Seat Fees",
              description: "Monthly license seat fees yielding secure recurring SaaS revenues.",
              evidenceQuote: "platform monthly subscription charges ($450 per corporate seat)",
              pageNumber: "Page 4",
              riskRating: "Low",
              riskDescription: "Minimal risk of fluctuations.",
            },
          ],
        },
        {
          id: "KR",
          name: "Key Resources",
          keyPoints: [
            {
              point: "Cloud Hostings & APIs",
              description: "Scalable servers supporting continuous concurrent user processing.",
              evidenceQuote: "software cloud hosting contracts",
              pageNumber: "Page 12",
              riskRating: "Low",
              riskDescription: "Vulnerable to database cloud outages.",
            },
          ],
        },
        {
          id: "KA",
          name: "Key Activities",
          keyPoints: [
            {
              point: "Compliance Manual Audit Loops",
              description:
                "Dedicating hours validating transactions backgrounds against static rule sets.",
              evidenceQuote:
                "Compliance staff spend about 1.5 hours on average reading background documents per transaction.",
              pageNumber: "Page 2",
              riskRating: "Medium",
              riskDescription: "Creates processing lags during audit spikes.",
            },
          ],
        },
        {
          id: "KP",
          name: "Key Partners",
          keyPoints: [
            {
              point: "Regional Stock Exchanges",
              description: "API partners allowing automated trade placement into regional tickers.",
              evidenceQuote: "Strategic integration with certified regional stock exchanges",
              pageNumber: "Page 1",
              riskRating: "Low",
              riskDescription: "System integration errors.",
            },
          ],
        },
        {
          id: "CS_COST",
          name: "Cost Structure",
          keyPoints: [
            {
              point: "Software Cloud Infrastructure",
              description:
                "Cloud storage and compute power subscriptions supporting the core portal.",
              evidenceQuote:
                "Software cloud hosting contracts (estimated at $12,000/annum) as our main overhead",
              pageNumber: "Page 9",
              riskRating: "Low",
              riskDescription: "Predictable, low variable overhead.",
            },
          ],
        },
      ],
    },
  },
];
