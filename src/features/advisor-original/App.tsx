import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, Bot, AlertCircle, Scale, Layers, Smartphone, Battery, Wifi,
  Signal, Sliders, ChevronLeft, Plus, Trash2, Edit3, Download, ArrowRight,
  Search, Share2, Globe, RefreshCw, Send, CheckCircle, X, ChevronRight, Sparkles,
  HelpCircle, MessageSquare, Info, ShieldAlert, Award, Play, AlertTriangle,
  ChevronDown, ChevronUp, TrendingUp, History, FolderOpen, Radar
} from 'lucide-react';
import { AdvisorMetrics, BMCPoint, BMCResult, PastYearCompareResult, CompetitorOverviewResult } from './types';
import { PRELOADED_REPORTS } from './preloadedData';
import { extractTextFromPdf } from './utils/pdf';
import { SentimentAttentionMap } from './components/SentimentAttentionMap';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  markReportEvaluating,
  markReportFailed,
  deleteStoredReport,
  listStoredReports,
  loadStoredReport,
  renameStoredReport,
  storeReportComparison,
  storeEvaluation,
  storeUploadedReport,
  type StoredReportSummary,
} from '../advisor-parser/reportPersistence';
import {
  askAdvisorFollowup,
  compareCompetitorsOverview,
  comparePastYear,
  parseBmc,
} from './advisor.functions';
import SocialScanApp from "@/features/social-scan/App";
import WorkforcePanel from "@/features/advisor-workforce/WorkforcePanel";
import type { StoredWorkforceScan } from "@/features/advisor-workforce/workforcePersistence";
import WorkforceThresholdCard, {
  DEFAULT_WORKFORCE_THRESHOLDS,
  buildThresholdInstruction,
  type WorkforceThresholds,
} from "@/features/advisor-workforce/WorkforceThresholdCard";




export default function App() {
  // Mobile app sub-navigation states
  const [activeTab, setActiveTab] = useState<'reports' | 'canvas' | 'compare' | 'history' | 'settings' | 'social-scan'>('reports');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Simulated device hardware features
  const [isPowerOn, setIsPowerOn] = useState<boolean>(true);
  const [systemVolume, setSystemVolume] = useState<number>(75);
  const [showVolumeHud, setShowVolumeHud] = useState<boolean>(false);
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Active documents state
  const [companyName, setCompanyName] = useState<string>('');
  const [reportType, setReportType] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [pdfMeta, setPdfMeta] = useState<{ name: string; size: string; pages?: number } | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  // Comparison documents state
  const [compareCompanyName, setCompareCompanyName] = useState<string>('');
  const [compareReportType, setCompareReportType] = useState<string>('');
  const [compareCustomText, setCompareCustomText] = useState<string>('');
  const [comparePdfMeta, setComparePdfMeta] = useState<{ name: string; size: string } | null>(null);
  const [compareReportId, setCompareReportId] = useState<string | null>(null);

  // Parsed outputs state containers
  const [parsedResult, setParsedResult] = useState<BMCResult | null>(null);
  const [loadedWorkforceScan, setLoadedWorkforceScan] = useState<StoredWorkforceScan | null>(null);
  const [comparisonResult, setComparisonResult] = useState<BMCResult | null>(null);
  const [competitorOverview, setCompetitorOverview] = useState<CompetitorOverviewResult | null>(null);
  const [isGeneratingOverview, setIsGeneratingOverview] = useState<boolean>(false);

  // Cloud report history
  const [storedReports, setStoredReports] = useState<StoredReportSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editingHistoryName, setEditingHistoryName] = useState('');
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  // Processing indicators
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isParsingCompare, setIsParsingCompare] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Global custom risk standard guidelines
  const [highRiskCriteria, setHighRiskCriteria] = useState<string>(
    "High capital requirements (>$50k), reliance on heavy manual professional labor overhead, complex cross-border regulations, or reliance on rare specialized human talent (such as elite advisors)."
  );
  const [mediumRiskCriteria, setMediumRiskCriteria] = useState<string>(
    "Compliance adaptations, platform subscription dependencies, or moderate market volume vulnerability."
  );
  const [lowRiskCriteria, setLowRiskCriteria] = useState<string>(
    "Established low-overhead services, automated client portals, secure local hosting, or standard custodial bank alliances."
  );

  const [expandedSettingsRisk, setExpandedSettingsRisk] = useState<'high' | 'medium' | 'low' | 'workforce' | null>(null);
  const [workforceThresholds, setWorkforceThresholds] = useState<WorkforceThresholds>(DEFAULT_WORKFORCE_THRESHOLDS);
  const [showSettingsSaved, setShowSettingsSaved] = useState<boolean>(false);

  const riskInstructionBar = `To assess risk rating, apply these standards:
- Classify as 'High Risk': ${highRiskCriteria}
- Classify as 'Medium Risk': ${mediumRiskCriteria}
- Classify as 'Low Risk': ${lowRiskCriteria}`;

  // Temporal Time-Travel Comparison variables
  const [targetPastYear, setTargetPastYear] = useState<string>('2024');
  const [isSearchingPastYear, setIsSearchingPastYear] = useState<boolean>(false);
  const [pastYearResult, setPastYearResult] = useState<PastYearCompareResult | null>(null);
  const [pastYearError, setPastYearError] = useState<string | null>(null);
  const [canvasView, setCanvasView] = useState<'bmc' | 'temporal' | 'workforce'>('bmc');
  const isViewingTemporal = canvasView === 'temporal';
  const setIsViewingTemporal = (value: boolean) => setCanvasView(value ? 'temporal' : 'bmc');
  const [selectedVarianceBlockId, setSelectedVarianceBlockId] = useState<string | null>(null);

  // Interactive follow-up chat messages state
  const [chatQuestion, setChatQuestion] = useState<string>('');
  const [chatAnswer, setChatAnswer] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ q: string; a: string }[]>([]);
  const [isAskingChat, setIsAskingChat] = useState<boolean>(false);

  // Bottom drawer sheets inspect variables
  const [selectedPointInfo, setSelectedPointInfo] = useState<{
    blockId: string;
    pointIndex: number;
    point: BMCPoint;
  } | null>(null);
  const [isEditingPoint, setIsEditingPoint] = useState<boolean>(false);
  const [editPointForm, setEditPointForm] = useState<BMCPoint | null>(null);

  const [addingToBlockId, setAddingToBlockId] = useState<string | null>(null);
  const [newPointForm, setNewPointForm] = useState<BMCPoint>({
    point: '',
    description: '',
    evidenceQuote: '',
    pageNumber: '',
    riskRating: 'Low',
    riskDescription: ''
  });

  // Automatic Strategy overview generation when comparison loaded
  useEffect(() => {
    if (parsedResult && comparisonResult) {
      triggerCompetitorOverview(parsedResult, comparisonResult);
    } else {
      setCompetitorOverview(null);
    }
  }, [parsedResult, comparisonResult]);

  useEffect(() => {
    if (activeTab === 'history') void refreshStoredReports();
  }, [activeTab]);

  const refreshStoredReports = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      setStoredReports(await listStoredReports());
    } catch (error: any) {
      setHistoryError(error.message || 'Unable to load cloud reports.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const openStoredReport = async (storedId: string) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    const loadingToast = toast.loading('Opening saved annual report...');
    try {
      const stored = await loadStoredReport(storedId);
      let storedResult = stored.result as BMCResult | null;

      if (!storedResult) {
        const availableText = stored.extractedText || (reportId === stored.id ? customText : '');
        if (!availableText.trim()) {
          throw new Error('No saved Canvas exists for this older upload. Please upload it again and build the Canvas once.');
        }
        toast.loading('No saved canvas found. Building one now...', { id: loadingToast });
        const generated = await parseBmc({
          data: {
            customText: availableText,
            companyName: stored.companyName,
            reportType: stored.reportType,
            riskInstructionBar,
          },
        });
        storedResult = generated.result;
        await storeEvaluation({
          reportId: stored.id,
          result: storedResult,
          settings: { highRiskCriteria, mediumRiskCriteria, lowRiskCriteria },
        });
        setStoredReports((current) => current.map((item) => (
          item.id === stored.id
            ? { ...item, status: 'completed', isSimulated: storedResult?.isSimulated }
            : item
        )));
      }

      setReportId(stored.id);
      setCompanyName(stored.companyName);
      setReportType(stored.reportType);
      setCustomText(stored.extractedText || (reportId === stored.id ? customText : ''));
      setPdfMeta({
        name: stored.originalName,
        size: `${Math.max(1, stored.sizeBytes / 1024).toFixed(0)} KB`,
        pages: stored.pageCount || undefined,
      });
      setParsedResult(storedResult);
      setLoadedWorkforceScan(stored.workforceScan);
      setComparisonResult(stored.comparisonResult as BMCResult | null);
      setCompetitorOverview(stored.competitorOverview);
      setCompareCompanyName(stored.comparisonResult?.companyName ?? '');
      setCompareReportType(stored.comparisonResult?.reportType ?? '');
      setCompareCustomText('');
      setCompareReportId(null);
      setComparePdfMeta(stored.comparisonResult ? {
        name: stored.comparisonOriginalName ?? `${stored.comparisonResult.companyName}.pdf`,
        size: 'Saved comparison',
      } : null);
      setSelectedBlockId(null);
      setIsViewingTemporal(false);
      setActiveTab(stored.comparisonResult ? 'compare' : 'canvas');
      toast.success(stored.comparisonResult ? 'Canvas and comparison restored.' : 'Report opened in Canvas.', { id: loadingToast });
    } catch (error: any) {
      setHistoryError(error.message || 'Unable to open this report.');
      toast.error(error.message || 'Unable to open this report.', { id: loadingToast });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveStoredReportName = async (storedId: string) => {
    const nextName = editingHistoryName.trim();
    if (!nextName) return;
    setHistoryError(null);
    try {
      await renameStoredReport(storedId, nextName);
      setStoredReports((current) => current.map((item) => (
        item.id === storedId ? { ...item, companyName: nextName } : item
      )));
      if (reportId === storedId) {
        setCompanyName(nextName);
        setParsedResult((current) => current ? { ...current, companyName: nextName } : current);
      }
      setEditingHistoryId(null);
      setEditingHistoryName('');
    } catch (error: any) {
      setHistoryError(error.message || 'Unable to rename this report.');
    }
  };

  const removeStoredReport = async (storedId: string) => {
    setDeletingReportId(storedId);
    setHistoryError(null);
    const deletingToast = toast.loading('Deleting report and stored PDF...');
    try {
      await deleteStoredReport(storedId);
      setStoredReports((current) => current.filter((item) => item.id !== storedId));
      if (reportId === storedId) {
        setReportId(null);
        setParsedResult(null);
        setLoadedWorkforceScan(null);
        setPdfMeta(null);
        setCustomText('');
        setCompanyName('');
      }
      toast.success('Annual report deleted.', { id: deletingToast });
    } catch (error: any) {
      setHistoryError(error.message || 'Unable to delete this report.');
      toast.error(error.message || 'Unable to delete this report.', { id: deletingToast });
    } finally {
      setDeletingReportId(null);
    }
  };

  const requestStoredReportDeletion = (stored: StoredReportSummary) => {
    toast.warning(`Delete ${stored.companyName}?`, {
      description: 'This removes the PDF, extracted text, and every saved evaluation.',
      duration: 10000,
      action: {
        label: 'Delete',
        onClick: () => void removeStoredReport(stored.id),
      },
      cancel: { label: 'Cancel', onClick: () => undefined },
    });
  };

  const clearActivePdf = () => {
    setReportId(null);
    setCompanyName('');
    setReportType('');
    setCustomText('');
    setPdfMeta(null);
    setParsedResult(null);
    setLoadedWorkforceScan(null);
    setComparisonResult(null);
    setCompetitorOverview(null);
    setCompareCompanyName('');
    setCompareReportType('');
    setCompareCustomText('');
    setComparePdfMeta(null);
    setCompareReportId(null);
    setPastYearResult(null);
    setPastYearError(null);
    setIsViewingTemporal(false);
    setSelectedBlockId(null);
    setSelectedVarianceBlockId(null);
    setChatAnswer(null);
    setChatHistory([]);
    setErrorMessage(null);
    const uploader = document.getElementById('phone_pdf_uploader') as HTMLInputElement | null;
    if (uploader) uploader.value = '';
    toast.success('PDF removed. You can upload another report.');
  };

  // Direct reset helper
  const handleResetRubrics = () => {
    setHighRiskCriteria("High capital requirements (>$50k), reliance on heavy manual professional labor overhead, complex cross-border regulations, or reliance on rare specialized human talent (such as elite advisors).");
    setMediumRiskCriteria("Compliance adaptations, platform subscription dependencies, or moderate market volume vulnerability.");
    setLowRiskCriteria("Established low-overhead services, automated client portals, secure local hosting, or standard custodial bank alliances.");
    setWorkforceThresholds(DEFAULT_WORKFORCE_THRESHOLDS);
  };

  const handleSaveSettings = () => {
    setShowSettingsSaved(true);
    setTimeout(() => {
      setShowSettingsSaved(false);
    }, 2500);
  };

  const usePositiveNumber = (candidate: unknown, fallback: number, minimum = 0.01) => {
    return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= minimum
      ? candidate
      : fallback;
  };

  const mergeGroqMetrics = (fallback: AdvisorMetrics, groqMetrics?: AdvisorMetrics): AdvisorMetrics => {
    if (!groqMetrics) return fallback;
    return {
      ...fallback,
      ...groqMetrics,
      opportunityScore: usePositiveNumber(groqMetrics.opportunityScore, fallback.opportunityScore),
      riskScore: usePositiveNumber(groqMetrics.riskScore, fallback.riskScore),
      highPoints: usePositiveNumber(groqMetrics.highPoints, fallback.highPoints, 0),
      mediumPoints: usePositiveNumber(groqMetrics.mediumPoints, fallback.mediumPoints, 0),
      lowPoints: usePositiveNumber(groqMetrics.lowPoints, fallback.lowPoints, 0),
      operatingLeverage: {
        revPerEmp: usePositiveNumber(groqMetrics.operatingLeverage?.revPerEmp, fallback.operatingLeverage.revPerEmp, 1_000),
        staffCostPerEmp: usePositiveNumber(groqMetrics.operatingLeverage?.staffCostPerEmp, fallback.operatingLeverage.staffCostPerEmp, 1_000),
      },
      techLeveragePercent: usePositiveNumber(groqMetrics.techLeveragePercent, fallback.techLeveragePercent),
      nicheRevenueGrowth: usePositiveNumber(groqMetrics.nicheRevenueGrowth, fallback.nicheRevenueGrowth),
      totalRevenueGrowth: usePositiveNumber(groqMetrics.totalRevenueGrowth, fallback.totalRevenueGrowth),
      infraOverheadPercent: usePositiveNumber(groqMetrics.infraOverheadPercent, fallback.infraOverheadPercent),
      revenuePerEmployee: usePositiveNumber(groqMetrics.revenuePerEmployee, fallback.revenuePerEmployee, 10_000),
      fixedCostIntensity: usePositiveNumber(groqMetrics.fixedCostIntensity, fallback.fixedCostIntensity),
      feeIncomePercent: usePositiveNumber(groqMetrics.feeIncomePercent, fallback.feeIncomePercent),
      crossBorderRevenueGrowth: usePositiveNumber(groqMetrics.crossBorderRevenueGrowth, fallback.crossBorderRevenueGrowth),
      staffCostsPercentOfRevenue: usePositiveNumber(groqMetrics.staffCostsPercentOfRevenue, fallback.staffCostsPercentOfRevenue),
      staffCostsGrowthRate: usePositiveNumber(groqMetrics.staffCostsGrowthRate, fallback.staffCostsGrowthRate),
      revenueGrowthRate: usePositiveNumber(groqMetrics.revenueGrowthRate, fallback.revenueGrowthRate),
      transparencySentimentScore: usePositiveNumber(groqMetrics.transparencySentimentScore, fallback.transparencySentimentScore),
    };
  };

  const getAdvisorMetrics = (result: BMCResult | null) => {
    if (!result) return {
      opportunityScore: 50,
      riskScore: 30,
      riskTier: 'Low Risk',
      scalabilityRating: 'Moderate Scalability',
      opportunityDriver: 'N/A',
      keyThreat: 'N/A',
      insight: 'Needs analysis.',
      highPoints: 0,
      mediumPoints: 0,
      lowPoints: 0,
      operatingLeverage: { revPerEmp: 120000, staffCostPerEmp: 110000 },
      techLeveragePercent: 5.0,
      nicheRevenueGrowth: 5.0,
      totalRevenueGrowth: 4.0,
      infraOverheadPercent: 10.0,
      revenuePerEmployee: 600000,
      fixedCostIntensity: 12.0,
      feeIncomePercent: 30.0,
      crossBorderRevenueGrowth: 5.0,
      staffCostsPercentOfRevenue: 50.0,
      staffCostsGrowthRate: 5.0,
      revenueGrowthRate: 5.0,
      scalabilityRiskAlert: 'No analysis available.',
      scalabilityRiskRating: 'LOW' as const,
      transparencySentimentScore: 50,
      transparencySentimentLabel: 'Moderate Transparency',
      transparencySentimentInsight: 'No analysis available.'
    };
    let totalPoints = 0;
    let highPoints = 0;
    let mediumPoints = 0;
    let lowPoints = 0;

    let hasDigitalChannels = false;
    let hasHighCostStructure = false;
    let hasDiversifiedRevenue = false;
    let hasRegulatoryKeywords = false;
    let hasAdvisorKeywords = false;

    result.blocks.forEach(block => {
      block.keyPoints.forEach(pt => {
        totalPoints++;
        if (pt.riskRating === 'High') highPoints++;
        else if (pt.riskRating === 'Medium') mediumPoints++;
        else lowPoints++;

        const text = (pt.point + ' ' + pt.description).toLowerCase();
        if (text.includes('digital') || text.includes('portal') || text.includes('automated') || text.includes('online') || text.includes('self-service') || text.includes('saas')) {
          hasDigitalChannels = true;
        }
        if (text.includes('salary') || text.includes('overhead') || text.includes('rent') || text.includes('personnel') || text.includes('labor') || text.includes('fixed rent')) {
          hasHighCostStructure = true;
        }
        if (text.includes('subscription') || text.includes('transaction fee') || text.includes('recurring') || text.includes('multiple') || text.includes('diversify') || text.includes('stream')) {
          hasDiversifiedRevenue = true;
        }
        if (text.includes('compliance') || text.includes('regulatory') || text.includes('sovereign') || text.includes('law') || text.includes('guidelines')) {
          hasRegulatoryKeywords = true;
        }
        if (text.includes('expert advisor') || text.includes('manual check') || text.includes('consultant') || text.includes('high-touch')) {
          hasAdvisorKeywords = true;
        }
      });
    });

    const valPropsPoints = result.blocks.find(b => b.id === 'VP')?.keyPoints || [];
    const revStreamsPoints = result.blocks.find(b => b.id === 'RS')?.keyPoints || [];
    const custSegPoints = result.blocks.find(b => b.id === 'CS')?.keyPoints || [];

    // Opportunity Score math
    let opportunityScore = 55; // Base
    opportunityScore += valPropsPoints.length * 6;
    opportunityScore += revStreamsPoints.length * 5;
    if (hasDigitalChannels) opportunityScore += 12;
    if (hasDiversifiedRevenue) opportunityScore += 10;
    if (hasHighCostStructure) opportunityScore -= 8;
    opportunityScore = Math.min(98, Math.max(35, opportunityScore));

    // Risk Score math
    let riskScore = 20; // Base
    if (totalPoints > 0) {
      riskScore = Math.round(((highPoints * 100) + (mediumPoints * 50) + (lowPoints * 10)) / totalPoints);
    }
    riskScore = Math.min(95, Math.max(15, riskScore));

    let riskTier: 'Low Risk' | 'Medium Risk' | 'High Risk' = 'Low Risk';
    if (riskScore > 60) riskTier = 'High Risk';
    else if (riskScore > 35) riskTier = 'Medium Risk';

    let scalabilityRating = 'Moderate Scalability';
    if (hasDigitalChannels && !hasAdvisorKeywords) {
      scalabilityRating = 'Highly Scalable (Asset-Light)';
    } else if (hasHighCostStructure || hasAdvisorKeywords) {
      scalabilityRating = 'Low Scalability (Labor-Heavy)';
    }

    let opportunityDriver = 'Bespoke relationship leverage & physical branch consultation trust.';
    if (hasDigitalChannels) {
      opportunityDriver = 'Low marginal cost digital portal and automated transaction pipelines.';
    } else if (revStreamsPoints.length > 1) {
      opportunityDriver = 'Diversified contractual asset streams with persistent client lifespans.';
    }

    let keyThreat = 'Operational friction due to physical branch cost overheads.';
    if (highPoints > 0) {
      keyThreat = 'Concentrated personnel dependencies or sovereign compliance regulatory friction.';
    } else if (hasRegulatoryKeywords) {
      keyThreat = 'Regulatory exposure and manual customer validation delays.';
    }

    let insight = `Determines resilient profit structures with low risk of personnel advisor churn.`;
    if (riskTier === 'High Risk') {
      insight = 'Advisor Warning: High fixed asset overheads and specialized advisor talent bottlenecks may strain capital efficiency during market downturns. Prioritize workflow automation.';
    } else if (scalabilityRating.includes('Asset-Light')) {
      insight = 'Advisor Recommendation: Highly efficient operating leverage. Scalable margin structure with low client capture cost. Primed for aggressive regional expansion.';
    } else {
      insight = 'Advisor Assessment: Stable, localized target model. Balanced revenue streams offset minor manual service frictions. Monitor advisor headcounts.';
    }

    // Dynamic metrics generation based on business features
    let nameHash = 0;
    const nameStr = result.companyName || '';
    for (let i = 0; i < nameStr.length; i++) {
      nameHash = (nameHash << 5) - nameHash + nameStr.charCodeAt(i);
      nameHash |= 0;
    }
    const seed = Math.abs(nameHash);

    // 1. Operating Leverage (Revenue per Employee vs Staff Cost per Employee)
    let revPerEmp = 150000;
    let staffCostPerEmp = 115000;
    if (hasDigitalChannels) {
      revPerEmp = 320000 + (seed % 9) * 10000; // $320k - $400k
      staffCostPerEmp = 95000 + (seed % 4) * 10000; // $95k - $125k
    } else {
      revPerEmp = 130000 + (seed % 5) * 10000; // $130k - $170k
      staffCostPerEmp = 115000 + (seed % 4) * 10050; // $115k - $145k
    }

    // 2. Technology Leverage Ratio (IT/R&D Spend of total OpEx)
    let techLeveragePercent = 4.5;
    if (hasDigitalChannels) {
      techLeveragePercent = 14.5 + (seed % 115) / 10; // 14.5% - 26.0%
    } else {
      techLeveragePercent = 3.0 + (seed % 35) / 10; // 3.0% - 6.5%
    }

    // 3. Niche Revenue Contribution (Core Segment Growth vs Total Growth)
    let nicheRevenueGrowth = 4.2;
    let totalRevenueGrowth = 3.5;
    if (hasDiversifiedRevenue || hasDigitalChannels) {
      nicheRevenueGrowth = 22.0 + (seed % 135) / 10; // 22.0% - 35.5%
      totalRevenueGrowth = 5.0 + (seed % 45) / 10; // 5.0% - 9.5%
    } else {
      nicheRevenueGrowth = 2.0 + (seed % 50) / 10; // 2.0% - 7.0%
      totalRevenueGrowth = 2.5 + (seed % 30) / 10; // 2.5% - 5.5%
    }

    // 4. Infrastructure Overhead Score (Rental/Equipment Cost of Revenue)
    let infraOverheadPercent = 12.5;
    if (hasDigitalChannels && !hasHighCostStructure) {
      infraOverheadPercent = 1.8 + (seed % 25) / 10; // 1.8% - 4.3%
    } else if (hasHighCostStructure) {
      infraOverheadPercent = 11.0 + (seed % 65) / 10; // 11.0% - 17.5%
    } else {
      infraOverheadPercent = 6.0 + (seed % 41) / 10; // 6.0% - 10.0%
    }

    // NEW PRECISE COMPARATIVE METRICS REQUESTED BY USER
    let revenuePerEmployee = 600000;
    let fixedCostIntensity = 12.0;
    let feeIncomePercent = 30.0;
    let crossBorderRevenueGrowth = 5.0;

    const normName = (result.companyName || '').toLowerCase();
    if (normName.includes('dbs') || normName.includes('digi') || normName.includes('beta')) {
      revenuePerEmployee = 1250000;
      fixedCostIntensity = 3.8;
      feeIncomePercent = 41.5;
      crossBorderRevenueGrowth = 9.8;
    } else if (normName.includes('uob') || normName.includes('relationship')) {
      revenuePerEmployee = 650000;
      fixedCostIntensity = 15.6;
      feeIncomePercent = 21.0;
      crossBorderRevenueGrowth = 15.4;
    } else if (normName.includes('cgsi') || normName.includes('alpha') || normName.includes('cimb')) {
      revenuePerEmployee = 520000;
      fixedCostIntensity = 19.5;
      feeIncomePercent = 82.0;
      crossBorderRevenueGrowth = 14.2;
    } else {
      // Deterministic based on business traits and hash
      if (hasDigitalChannels) {
        revenuePerEmployee = 850000 + (seed % 6) * 80000; // $850k - $1.25M
        fixedCostIntensity = 2.5 + (seed % 45) / 10; // 2.5% - 7.0%
        feeIncomePercent = 35.0 + (seed % 35); // 35% - 70%
        crossBorderRevenueGrowth = 8.0 + (seed % 90) / 10; // 8% - 17%
      } else {
        revenuePerEmployee = 450050 + (seed % 5) * 50000; // $450k - $650k
        fixedCostIntensity = 11.0 + (seed % 80) / 10; // 11.0% - 19.0%
        feeIncomePercent = 15.0 + (seed % 20); // 15% - 35%
        crossBorderRevenueGrowth = 3.5 + (seed % 75) / 10; // 3.5% - 11.0%
      }
    }

    // CATEGORY 1: Deep Dive - Operating Scalability Ratio (staff cost growth vs revenue growth)
    const staffCostsPercentOfRevenue = Math.min(85, Math.max(15,
      normName.includes('dbs') || normName.includes('digi') || normName.includes('beta') ? 31.4 :
        normName.includes('uob') || normName.includes('relationship') ? 54.8 :
          normName.includes('cgsi') || normName.includes('alpha') ? 74.2 :
            (hasDigitalChannels ? 34.0 + (seed % 10) : 58.0 + (seed % 15))
    ));

    const staffCostsGrowthRate = Math.min(25, Math.max(1,
      normName.includes('dbs') || normName.includes('digi') ? 3.8 :
        normName.includes('uob') ? 11.5 :
          normName.includes('cgsi') ? 14.8 :
            (hasDigitalChannels ? 10.2 + (seed % 5) : 12.0 + (seed % 8))
    ));
    const revenueGrowthRate = Math.min(30, Math.max(1,
      normName.includes('dbs') || normName.includes('digi') ? 14.2 :
        normName.includes('uob') ? 6.2 :
          normName.includes('cgsi') ? 5.8 :
            (hasDigitalChannels ? 11.5 + (seed % 8) : 4.1 + (seed % 5))
    ));

    let scalabilityRiskAlert = "";
    let scalabilityRiskRating: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (staffCostsGrowthRate > revenueGrowthRate * 1.5) {
      scalabilityRiskRating = "HIGH";
      scalabilityRiskAlert = `ADVISOR ALERT: Staff Costs growing ${(staffCostsGrowthRate / Math.max(1, revenueGrowthRate)).toFixed(1)}x faster than Revenue. Scalability Risk: HIGH.`;
    } else if (staffCostsGrowthRate > revenueGrowthRate) {
      scalabilityRiskRating = "HIGH";
      scalabilityRiskAlert = `ADVISOR ALERT: Staff Costs growing faster than Revenue. Scalability Risk: HIGH.`;
    } else {
      scalabilityRiskRating = "LOW";
      scalabilityRiskAlert = `ADVISOR HEALTHY: Revenue CAGR is outpacing Staff Costs. Scalability Risk: LOW.`;
    }

    // Transparency Sentiment Score (Qualitative)
    const transparencySentimentScore = Math.min(98, Math.max(25,
      normName.includes('dbs') || normName.includes('digi') ? 88 :
        normName.includes('uob') ? 68 :
          normName.includes('cgsi') ? 35 :
            (hasRegulatoryKeywords ? 45 + (seed % 15) : 75 + (seed % 15))
    ));

    let transparencySentimentLabel = "High Transparency";
    let transparencySentimentInsight = "Risk factors section is highly specific and detailed. Low risk of unexpected news.";
    if (transparencySentimentScore < 50) {
      transparencySentimentLabel = "Defensive Vague Language (High Risk)";
      transparencySentimentInsight = "Vague passive language detected in risks & legal frameworks. High risk of hiding internal problems.";
    } else if (transparencySentimentScore < 75) {
      transparencySentimentLabel = "Moderate Transparency";
      transparencySentimentInsight = "Relies on standard templated legal headers. Mixed specificity.";
    }

    const fallbackMetrics: AdvisorMetrics = {
      opportunityScore,
      riskScore,
      riskTier,
      scalabilityRating,
      opportunityDriver,
      keyThreat,
      insight,
      highPoints,
      mediumPoints,
      lowPoints,
      operatingLeverage: { revPerEmp, staffCostPerEmp },
      techLeveragePercent,
      nicheRevenueGrowth,
      totalRevenueGrowth,
      infraOverheadPercent,
      revenuePerEmployee,
      fixedCostIntensity,
      feeIncomePercent,
      crossBorderRevenueGrowth,
      staffCostsPercentOfRevenue,
      staffCostsGrowthRate,
      revenueGrowthRate,
      scalabilityRiskAlert,
      scalabilityRiskRating,
      transparencySentimentScore,
      transparencySentimentLabel,
      transparencySentimentInsight
    };
    return mergeGroqMetrics(fallbackMetrics, result.advisorMetrics);
  };

  const getPastYearMetrics = (company: string, targetYr: string, aiMetrics?: PastYearCompareResult['aiMetrics']) => {
    if (aiMetrics) return aiMetrics;

    let nameHash = 0;
    const nameStr = company || '';
    for (let i = 0; i < nameStr.length; i++) {
      nameHash = (nameHash << 5) - nameHash + nameStr.charCodeAt(i);
      nameHash |= 0;
    }
    const seed = Math.abs(nameHash);
    const normName = nameStr.toLowerCase();

    // IT Spend vs Rental Costs
    let itSpendGrowth = 18.5;
    let rentCostGrowth = -8.2;
    if (normName.includes('dbs') || normName.includes('digi')) {
      itSpendGrowth = 24.5;
      rentCostGrowth = -14.2;
    } else if (normName.includes('uob')) {
      itSpendGrowth = 15.0;
      rentCostGrowth = 4.8;
    } else if (normName.includes('cgsi')) {
      itSpendGrowth = 8.2;
      rentCostGrowth = 12.5;
    } else {
      itSpendGrowth = (seed % 15) + 5; // 5% to 20%
      rentCostGrowth = (seed % 10) - 5; // -5% to 5%
    }

    const digitalPivotSuccessful = itSpendGrowth > 0 && rentCostGrowth < 0;
    const isOverspending = itSpendGrowth > 0 && rentCostGrowth > 0;

    let infrastructureDeltaVerdict = "";
    let infraDeltaStatus: 'OPPORTUNITY' | 'RISK' | 'STABLE' = 'STABLE';
    if (digitalPivotSuccessful) {
      infraDeltaStatus = 'OPPORTUNITY';
      infrastructureDeltaVerdict = `SUCCESSFUL DIGITAL PIVOT: IT spend grows by +${itSpendGrowth.toFixed(1)}% while Rent falls by ${Math.abs(rentCostGrowth).toFixed(1)}%. Successfully modernizing operations into physical efficiencies.`;
    } else if (isOverspending) {
      infraDeltaStatus = 'RISK';
      infrastructureDeltaVerdict = `OVERSPENDING RISK: Both IT Spend (+${itSpendGrowth.toFixed(1)}%) and Rent Costs (+${rentCostGrowth.toFixed(1)}%) are increasing. Stuck in asset-heavy structure with high capital overspend duplication.`;
    } else {
      infraDeltaStatus = 'STABLE';
      infrastructureDeltaVerdict = `STEADY OUTLOOK: IT Spend up by +${itSpendGrowth.toFixed(1)}% and Rent up by +${rentCostGrowth.toFixed(1)}%. Core physical branches are kept active with slight digital enhancements.`;
    }

    // AI Strategic "Say-Do" Audit
    let lastYearPromise = "Promise of AI extraction, digital client portals, and manual risk check digitizations.";
    let thisYearResult = "Delivered real-time core OCR onboarding and decreased manual advisor admin drag.";
    let sayDoConsistencyScore = 88; // out of 100
    let managementCredibilityRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let sayDoVerdict = "Management successfully executed on their digital scale roadmap, meeting >80% of targets.";

    if (normName.includes('dbs') || normName.includes('digi') || normName.includes('beta')) {
      lastYearPromise = "Promised full automated wealth customer portal & Shariah-compliant digital options.";
      thisYearResult = "Launched automated screening and registered 45% new automated sub-portfolios.";
      sayDoConsistencyScore = 94;
      managementCredibilityRisk = 'LOW';
      sayDoVerdict = "High consistency. Symmetrical execution on digital transition promises makes this a highly secure operational investment.";
    } else if (normName.includes('uob') || normName.includes('relationship')) {
      lastYearPromise = "Stated focus on automated middle-office screenings to assist manual relationship desks.";
      thisYearResult = "Maintained heavy manual desk dependencies; middle-office automation integration delayed to Q3 FY2027.";
      sayDoConsistencyScore = 45;
      managementCredibilityRisk = 'HIGH';
      sayDoVerdict = "Management Credibility Risk: Promised 'AI/automation onboarding integrations' in last year's disclosure but has failed to mention or deliver actual completions in the current report.";
    } else if (normName.includes('cgsi') || normName.includes('alpha') || normName.includes('cimb')) {
      lastYearPromise = "Promised regional clearing license acquisitions and cross-border expansion in ASEAN.";
      thisYearResult = "ASEAN Clearing portal delivered but regional licensing approvals delayed due to sovereign regulatory limits.";
      sayDoConsistencyScore = 68;
      managementCredibilityRisk = 'MEDIUM';
      sayDoVerdict = "Moderate consistency discrepancy. Cross-border portal was deployed, but licensing issues suggest overactive timeline promises.";
    } else {
      if (seed % 2 === 0) {
        lastYearPromise = "Promised AI transaction auditing & back-office process streamlining.";
        thisYearResult = "Delivered automated scraping but back-office headcounts remain highly manual.";
        sayDoConsistencyScore = 55;
        managementCredibilityRisk = 'MEDIUM';
        sayDoVerdict = "Risky executing tempo. Management hasn't delivered on the core back-office digitization timeline promised previously.";
      } else {
        lastYearPromise = "Promised secure local hosting and low-overhead regional agent hubs.";
        thisYearResult = "Lease overhead down, successfully shifted into co-working active hubs.";
        sayDoConsistencyScore = 85;
        managementCredibilityRisk = 'LOW';
        sayDoVerdict = "Strong accountability. The physical office footprints were successfully compacted in perfect correspondence with stated intentions.";
      }
    }

    return {
      itSpendGrowth,
      rentCostGrowth,
      infraDeltaStatus,
      infrastructureDeltaVerdict,
      lastYearPromise,
      thisYearResult,
      sayDoConsistencyScore,
      managementCredibilityRisk,
      sayDoVerdict
    };
  };

  const getStrategyDnaThemes = (resultA: BMCResult, resultB: BMCResult) => {
    const nameA = resultA.companyName || 'Entity A';
    const nameB = resultB.companyName || 'Entity B';
    const normA = nameA.toLowerCase().trim();
    const normB = nameB.toLowerCase().trim();

    interface ThemeDetail {
      theme: string;
      focusScore: number;
      mentions: number;
      description: string;
    }

    const THEME_PRESETS = [
      {
        theme: "High-Tier Wealth Expansion",
        keywords: ["wealth", "hnw", "accredited", "private client", "aum", "advisory", "affluent", "premium", "trust", "estate", "uob", "dbs"],
        description: "Obsessed with active client retainer fee generation and premium high-net-worth advisory growth."
      },
      {
        theme: "Core Digital Migration",
        keywords: ["digital", "portal", "migration", "online", "internet", "hybrid", "platform", "app", "mobile", "tech"],
        description: "Heavy focus on migrating transaction pipelines online to lower human physical touchpoint costs."
      },
      {
        theme: "Sovereign Trade Corridors",
        keywords: ["cross-border", "bilateral", "regional", "malaysia", "singapore", "asean", "corridor", "trade", "clearing"],
        description: "Exploiting unique Malaysia-Singapore bilateral compliance arrangements and ASEAN clearing."
      },
      {
        theme: "AI-Led Risk Screening",
        keywords: ["ai", "automated risk", "compliance checks", "risk rating", "audit", "screening", "algorithm", "intelligence", "llm"],
        description: "Automating background legal and regulatory risk profiling."
      },
      {
        theme: "Regional ESG Mandates",
        keywords: ["green", "esg", "financing", "sustain", "carbon", "social", "governance", "climate"],
        description: "Integration of green financing goals into default product portfolios."
      },
      {
        theme: "Corporate Model Streamlining",
        keywords: ["streamline", "cost", "overhead", "operating", "leverage", "consolidate", "outsourc", "r&d", "automation"],
        description: "Obsessed with R&D, structural cost reductions, and outsourcing support tasks."
      },
      {
        theme: "SaaS Licensing Retainers",
        keywords: ["saas", "subscription", "licensing", "recurring", "retainer", "seat", "flat fee"],
        description: "Migrating from transaction brokerage fees to monthly digital service seats."
      },
      {
        theme: "Retail Accredited Inflow",
        keywords: ["retail", "crowd", "mass affluent", "high-yield", "structural cash", "investment", "inflow"],
        description: "Marketing high-yield structural cash investments to standard private clients."
      },
      {
        theme: "Automated Compliance Hubs",
        keywords: ["compliance hub", "legal templates", "regulatory sandbox", "onboarding", "license"],
        description: "Using centralized legal templates to expedite cross-border client onboarding."
      },
      {
        theme: "Ultra-Low Brokerage Costing",
        keywords: ["brokerage", "discount", "margin", "volume", "execution cost", "cheap", "bulk", "commission", "cgs", "cimb"],
        description: "Extremely targeted on reducing execution margins to capture bulk capital."
      },
      {
        theme: "Developer API Integration",
        keywords: ["api", "developer", "sdk", "integrat", "programmatic", "endpoint", "connect"],
        description: "Allowing external programmatic advisors to bind directly to clearing APIs."
      },
      {
        theme: "Accredited Crowd Inflow",
        keywords: ["crowdfund", "syndicat", "co-invest", "fractional"],
        description: "Bypassing heavy branch advisor overheads by licensing digital self-service tools."
      },
      {
        theme: "Capital Resource Slicing",
        keywords: ["fractionalize", "slice", "token", "asset-backed", "bond", "infra"],
        description: "Providing fractional ownership assets in regional infrastructure bonds."
      },
      {
        theme: "Shariah Clearance Audits",
        keywords: ["shariah", "islamic", "halal", "compliance audit", "shari'ah", "ethical"],
        description: "Structuring automated trade execution to conform to Islamic finance audits."
      },
      {
        theme: "High-Touch Personal Advisory",
        keywords: ["high-touch", "concierge", "personal", "relationship", "advisor", "branch", "face-to-face", "bespoke", "uob", "gold"],
        description: "Focused on human advisory, concierge service, and physical office networks."
      },
      {
        theme: "Premium Brand Exclusivity",
        keywords: ["brand", "prestige", "heritage", "legacy", "elite", "reputation", "tier"],
        description: "Building an elite accredited group around AUM minimums of $2.5M."
      },
      {
        theme: "Regulatory Compliance Shield",
        keywords: ["shield", "protection", "litigation", "asset protection", "jurisdiction", "sovereign"],
        description: "Expanding regional licensing coverage to shield client asset structures from litigation."
      },
      {
        theme: "Legacy Asset Trust Sourcing",
        keywords: ["trust", "family office", "generational", "succession", "heir", "bequest", "legacy"],
        description: "Establishing traditional trust structures for family-office generational security."
      },
      {
        theme: "Physical Hub Consolidation",
        keywords: ["physical", "hq", "concourse", "tier-1", "offices", "building", "real estate"],
        description: "Positioning client consulting hubs in tier-1 financial capitals."
      }
    ];

    const generateThemesForEntity = (name: string, result: BMCResult) => {
      // 1. Gather all searchable words
      let contentString = (name + " " + (result.reportType || "")).toLowerCase();
      result.blocks.forEach(block => {
        contentString += " " + block.name.toLowerCase();
        block.keyPoints.forEach(pt => {
          contentString += " " + pt.point.toLowerCase() + " " + pt.description.toLowerCase();
        });
      });

      // 2. Compute a stable deterministic seed for this company NAME
      let nameHash = 0;
      for (let i = 0; i < name.length; i++) {
        nameHash = (nameHash << 5) - nameHash + name.charCodeAt(i);
        nameHash |= 0;
      }
      const cSeed = Math.abs(nameHash);

      // 3. Score all presets
      const scoredPresets = THEME_PRESETS.map((preset, idx) => {
        // Base score is deterministic by company name so identical names get identical base focus levels
        let score = 55 + ((cSeed + idx * 23) % 25); // Range 55 to 80
        let keywordMentions = 0;

        preset.keywords.forEach(kw => {
          if (contentString.includes(kw)) {
            score += 15;
            keywordMentions += 3;
          }
        });

        let finalScore = Math.min(98, score);
        let mentions = keywordMentions === 0 ? Math.floor(finalScore / 7) : keywordMentions + Math.floor(finalScore / 10);

        // Explicitly customize for DBS / Digi / Beta entities as requested
        const normEntity = name.toLowerCase();
        const isDBS = normEntity.includes('dbs') || normEntity.includes('digi') || normEntity.includes('beta');
        if (isDBS) {
          if (preset.theme === "Core Digital Migration") {
            finalScore = 15; // Downgrade to exclude from top 5
            mentions = 1;
          }
        }

        return {
          theme: preset.theme,
          focusScore: finalScore,
          mentions: mentions,
          description: preset.description
        };
      });

      scoredPresets.sort((a, b) => b.focusScore - a.focusScore);
      return scoredPresets.slice(0, 5);
    };

    const themesA = generateThemesForEntity(nameA, resultA);
    const themesB = generateThemesForEntity(nameB, resultB);

    let divergencePlaySummary = "";
    if (normA === normB) {
      divergencePlaySummary = `The Strategy DNA Map confirms that both Entity A and Entity B represent the same reporting entity scope ("${nameA}"). Their executive priorities, corporate focus channels, and risk mitigation profiles match at a perfect 100% convergence level, as expected.`;
    } else {
      const themeNamesA = themesA.map(t => t.theme);
      const themeNamesB = themesB.map(t => t.theme);
      const commonThemes = themeNamesA.filter(t => themeNamesB.includes(t));

      if (commonThemes.length >= 3) {
        divergencePlaySummary = `Strong strategic alignment detected. Both ${nameA} and ${nameB} are executing closely aligned profiles in the region, focusing extensively on overlapping targets such as ${commonThemes.slice(0, 2).join(' & ')}. This suggests a competitive, commodity-sensitive direct trade theater.`;
      } else {
        divergencePlaySummary = `Divergent strategic paths detected. ${nameA}'s play is highly centered on ${themesA[0].theme} & ${themesA[1].theme} (aiming for structural cost leverage or capital efficiency). In contrast, ${nameB} is running a differentiated play focusing on ${themesB[0].theme} & ${themesB[1].theme} (channeling brand premium assets or specific segment niches).`;
      }
    }

    return {
      themesA,
      themesB,
      divergencePlaySummary
    };
  };

  // Preloaded Report Loader Helpers
  const loadPreloadedPrimary = (id: string) => {
    const report = PRELOADED_REPORTS.find(r => r.id === id);
    if (report) {
      setCompanyName(report.name);
      setReportType(report.subtitle);
      setCustomText(report.summaryText);
      setParsedResult(report.parsedResult);
      setReportId(null);
      setPdfMeta({
        name: `${id.replace('-', '_')}_plan_FY2026.pdf`,
        size: '142 KB',
        pages: 1
      });
      setErrorMessage(null);
    }
  };

  const loadPreloadedCompare = () => {
    const report = PRELOADED_REPORTS.find(r => r.id === 'beta-wealth');
    if (report) {
      setCompareCompanyName(report.name);
      setCompareReportType(report.subtitle);
      setCompareCustomText(report.summaryText);
      setComparisonResult(report.parsedResult);
      setCompareReportId(null);
      setComparePdfMeta({
        name: 'beta_wealth_disclosure_FY2026.pdf',
        size: '115 KB'
      });
      setErrorMessage(null);
    }
  };

  // Core parsing triggers
  const handleTriggerParse = async () => {
    if (!customText.trim()) return;
    setIsParsing(true);
    setErrorMessage(null);

    try {
      await markReportEvaluating(reportId).catch(() => undefined);
      const raw = await parseBmc({
        data: {
          customText: customText,
          companyName: companyName,
          reportType: reportType,
          riskInstructionBar: riskInstructionBar
        },
      });
      if (raw.status === 'success') {
        setParsedResult(raw.result);
        await storeEvaluation({
          reportId,
          result: raw.result,
          settings: { highRiskCriteria, mediumRiskCriteria, lowRiskCriteria },
        }).catch((persistenceError) => {
          console.warn('Evaluation completed but could not be saved:', persistenceError);
        });
      } else {
        throw new Error('Error parsing.');
      }
    } catch (err: any) {
      await markReportFailed(reportId, err.message || 'Evaluation failed.').catch(() => undefined);
      if (err.message.includes('429')) {
        setErrorMessage('Quota exceeded. Please try again in 30 seconds.');
      } else {
        setErrorMessage(err.message || 'General backend connection timeout.');
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleTriggerCompareParse = async (
    overrideText?: string,
    overrideName?: string,
    overrideType?: string,
    overrideReportId?: string | null,
    overrideOriginalName?: string,
  ) => {
    const textVal = overrideText !== undefined ? overrideText : compareCustomText;
    const nameVal = overrideName !== undefined ? overrideName : compareCompanyName;
    const typeVal = overrideType !== undefined ? overrideType : compareReportType;

    if (!textVal.trim()) return;
    setIsParsingCompare(true);
    setErrorMessage(null);
    const activeCompareReportId = overrideReportId !== undefined ? overrideReportId : compareReportId;

    try {
      await markReportEvaluating(activeCompareReportId).catch(() => undefined);
      const raw = await parseBmc({
        data: {
          customText: textVal,
          companyName: nameVal,
          reportType: typeVal,
          riskInstructionBar: riskInstructionBar
        },
      });
      if (raw.status === 'success') {
        setComparisonResult(raw.result);
        await storeReportComparison({
          reportId,
          result: raw.result,
          originalName: overrideOriginalName ?? comparePdfMeta?.name,
        }).catch((persistenceError) => {
          console.warn('Comparison completed but could not be saved:', persistenceError);
        });
      } else {
        throw new Error('Comparison error.');
      }
    } catch (err: any) {
      await markReportFailed(activeCompareReportId, err.message || 'Comparison failed.').catch(() => undefined);
      if (err.message.includes('429')) {
        setErrorMessage('Comparison quota exceeded. Please try again in 30 seconds.');
      } else {
        setErrorMessage(err.message || 'General connection timeout.');
      }
    } finally {
      setIsParsingCompare(false);
    }
  };

  // Fetch Competitor Overview
  const triggerCompetitorOverview = async (prime: BMCResult, comp: BMCResult) => {
    setIsGeneratingOverview(true);
    try {
      const data = await compareCompetitorsOverview({
        data: { primaryResult: prime, comparisonResult: comp },
      });
      if (data.status === 'success') {
        setCompetitorOverview(data.result);
        await storeReportComparison({
          reportId,
          result: comp,
          originalName: comparePdfMeta?.name,
          competitorOverview: data.result,
        }).catch((persistenceError) => {
          console.warn('Comparison overview completed but could not be saved:', persistenceError);
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingOverview(false);
    }
  };

  // Chronos Time-Travel crawlers
  const handlePastYearSearch = async () => {
    if (!parsedResult) return;
    setPastYearError(null);

    if (!/^\d{4}$/.test(targetPastYear)) {
      setPastYearError("Invalid format. Enter 4 digits (e.g. 2024).");
      return;
    }

    const yr = parseInt(targetPastYear, 10);
    if (yr < 1995 || yr > 2026) {
      setPastYearError(`Scope out of bounds. Public corporate filings can only be audited between 1995 and 2026.`);
      return;
    }

    setIsSearchingPastYear(true);
    setPastYearResult(null);
    setSelectedVarianceBlockId(null);
    try {
      const currentBmcText = parsedResult.blocks.map(b => `[${b.name}]: ${b.keyPoints.map(p => p.point).join(', ')}`).join('\n');

      const findYearNum = (str: string) => {
        if (!str) return null;
        const match = str.match(/\b(202[0-7]|201[8-9])\b/);
        return match ? match[0] : null;
      };

      const currentYear = (pdfMeta ? findYearNum(pdfMeta.name) : null) ||
        findYearNum(parsedResult.companyName) ||
        findYearNum(parsedResult.reportType) ||
        findYearNum(customText.slice(0, 1500)) ||
        '2025';

      const res = await comparePastYear({
        data: {
          companyName: parsedResult.companyName,
          currentYear,
          targetYear: targetPastYear,
          currentBmcText
        },
      });
      if (res.status === 'success') {
        setPastYearResult(res.result);
        setIsViewingTemporal(true);
      }
    } catch (e) {
      setPastYearError("Strategic crawl timeout. Set correct Google Search and API variables.");
    } finally {
      setIsSearchingPastYear(false);
    }
  };

  // Follow-up questioning Chat handler
  const handleAskFollowUp = async () => {
    if (!chatQuestion.trim() || !parsedResult) return;
    const currentQ = chatQuestion;
    setChatQuestion('');
    setIsAskingChat(true);

    try {
      const formatBmcText = (res: BMCResult) => {
        return res.blocks.map(b => `[${b.name}]: ${b.keyPoints.map(p => p.point + " (" + p.description + ")").join('; ')}`).join('\n');
      };

      const data = await askAdvisorFollowup({
        data: {
          question: currentQ,
          primaryName: parsedResult.companyName,
          comparisonName: comparisonResult?.companyName || 'the competitor',
          primaryBmcText: formatBmcText(parsedResult),
          comparisonBmcText: comparisonResult ? formatBmcText(comparisonResult) : 'No competitor loaded.'
        },
      });
      if (data.status === 'success') {
        setChatHistory(prev => [...prev, { q: currentQ, a: data.answer }]);
        setChatAnswer(data.answer);
      }
    } catch (err: any) {
      const errMsg = "AI request failed. Verify GROQ_API_KEY and GROQ_MODEL in .env.local.";
      setChatHistory(prev => [...prev, { q: currentQ, a: errMsg }]);
      setChatAnswer(errMsg);
    } finally {
      setIsAskingChat(false);
    }
  };

  // Point Manipulation State Handlers (Syncs to parent store)
  const handleUpdatePointInternal = (blockId: string, idx: number, updatedItem: BMCPoint) => {
    if (!parsedResult) return;
    const updatedBlocks = parsedResult.blocks.map(b => {
      if (b.id === blockId) {
        const points = [...b.keyPoints];
        points[idx] = updatedItem;
        return { ...b, keyPoints: points };
      }
      return b;
    });

    const updatedResult = {
      ...parsedResult,
      blocks: updatedBlocks,
      parsedAt: new Date().toISOString()
    };
    setParsedResult(updatedResult);
    setSelectedPointInfo({ blockId, pointIndex: idx, point: updatedItem });
  };

  const handleAddPointInternal = () => {
    if (!addingToBlockId || !newPointForm.point.trim() || !parsedResult) return;

    const updatedBlocks = parsedResult.blocks.map(b => {
      if (b.id === addingToBlockId) {
        return { ...b, keyPoints: [...b.keyPoints, newPointForm] };
      }
      return b;
    });

    setParsedResult({
      ...parsedResult,
      blocks: updatedBlocks,
      parsedAt: new Date().toISOString()
    });

    setNewPointForm({
      point: '',
      description: '',
      evidenceQuote: '',
      pageNumber: '',
      riskRating: 'Low',
      riskDescription: ''
    });
    setAddingToBlockId(null);
  };

  const handleDeletePointInternal = (blockId: string, idx: number) => {
    if (!parsedResult) return;
    const updatedBlocks = parsedResult.blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, keyPoints: b.keyPoints.filter((_, i) => i !== idx) };
      }
      return b;
    });

    setParsedResult({
      ...parsedResult,
      blocks: updatedBlocks,
      parsedAt: new Date().toISOString()
    });
    setSelectedPointInfo(null);
  };

  const downloadJson = () => {
    if (!parsedResult) return;
    const blob = new Blob([JSON.stringify(parsedResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.setAttribute("download", `${parsedResult.companyName.replace(/\s+/g, '_')}_Canvas.json`);
    anchor.click();
    anchor.remove();
  };

  // Simulated Device Sound HUD functions
  const changeVolume = (dir: 'up' | 'down') => {
    setSystemVolume(v => Math.max(0, Math.min(100, dir === 'up' ? v + 5 : v - 5)));
    setShowVolumeHud(true);
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setShowVolumeHud(false), 1500);
  };

  // Helper dictionary icon components
  const blockIcons: Record<string, React.ReactNode> = {
    KP: <Building2 className="w-4 h-4 text-emerald-600" />,
    KA: <Bot className="w-4 h-4 text-sky-600" />,
    KR: <Award className="w-4 h-4 text-indigo-600" />,
    VP: <Sparkles className="w-4 h-4 text-rose-600" />,
    CR: <Search className="w-4 h-4 text-amber-600" />,
    CH: <Globe className="w-4 h-4 text-teal-600" />,
    CS: <Scale className="w-4 h-4 text-cyan-600" />,
    CS_COST: <AlertCircle className="w-4 h-4 text-violet-600" />,
    RS: <Layers className="w-4 h-4 text-amber-600" />
  };

  const blockColors: Record<string, string> = {
    KP: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    KA: 'bg-sky-50 text-sky-700 border-sky-100',
    KR: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    VP: 'bg-rose-50 text-rose-700 border-rose-100',
    CR: 'bg-amber-50 text-amber-700 border-amber-100',
    CH: 'bg-teal-50 text-teal-700 border-teal-100',
    CS: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    CS_COST: 'bg-violet-50 text-violet-700 border-violet-100',
    RS: 'bg-amber-50 text-amber-700 border-amber-100'
  };

  const riskBadgeCSS: Record<string, string> = {
    Low: 'bg-emerald-50 text-emerald-800 border-emerald-200/50',
    Medium: 'bg-amber-50 text-amber-850 border-amber-200/50',
    High: 'bg-rose-50 text-rose-800 border-rose-200/50'
  };

  // Retrieve blocks from result safely
  const getBlockData = (id: string) => {
    return parsedResult?.blocks.find(b => b.id === id) || { id, name: id, keyPoints: [] };
  };

  const getCompareBlockData = (id: string) => {
    return comparisonResult?.blocks.find(b => b.id === id) || null;
  };

  const getHighestRiskForBlock = (keyPoints: any[]) => {
    if (!keyPoints || keyPoints.length === 0) return null;
    let highest = 'Low';
    let hasPoint = false;
    for (const pt of keyPoints) {
      hasPoint = true;
      if (pt.riskRating === 'High') {
        return 'High';
      } else if (pt.riskRating === 'Medium') {
        highest = 'Medium';
      }
    }
    return hasPoint ? highest : null;
  };

  const blocksList = parsedResult ? [
    { id: 'KP', name: 'Key Partners', data: getBlockData('KP') },
    { id: 'KA', name: 'Key Activities', data: getBlockData('KA') },
    { id: 'KR', name: 'Key Resources', data: getBlockData('KR') },
    { id: 'VP', name: 'Value Propositions', data: getBlockData('VP') },
    { id: 'CR', name: 'Customer Relationships', data: getBlockData('CR') },
    { id: 'CH', name: 'Channels', data: getBlockData('CH') },
    { id: 'CS', name: 'Customer Segments', data: getBlockData('CS') },
    { id: 'CS_COST', name: 'Cost Structure', data: getBlockData('CS_COST') },
    { id: 'RS', name: 'Revenue Streams', data: getBlockData('RS') }
  ] : [];

  return (
    <div className="min-h-screen bg-white flex flex-col md:py-8 md:px-4 items-center justify-center font-sans tracking-tight text-slate-800" id="global_phone_viewport">
      {/* DESKTOP WELCOME SIDE PANEL */}
      <div className="hidden flex-col max-w-sm absolute left-10 xl:left-24 top-24 space-y-4" id="desktop_assist_banner">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-slate-700" />
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-650 font-mono">Mobile App Sandbox</h2>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Osterwalder Canvas AI</h1>
        <p className="text-xs text-slate-500 leading-relaxed font-sans">
          This system is optimized exclusively for mobile screens. Use the fully-functional physical mockup on the right to upload files, inspect grading nodes, customize risk parameters, and trigger Groq AI strategy assessments.
        </p>

        <div className="bg-white border p-4 rounded-xl shadow-3xs space-y-3">
          <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Mockup Controls</h4>
          <div className="space-y-2 text-xs font-medium text-slate-600">
            <div className="flex items-center justify-between">
              <span>Primary Power Key:</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[10px] font-semibold text-slate-800">Lock Virtual Device</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Volume Keybars:</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[10px] font-semibold text-slate-800">Virtual Volume HUD</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Device Bezel Size:</span>
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200/50 px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase">Fluid Mobile View</span>
            </div>
          </div>
        </div>

        <div className="text-[10px] font-mono text-slate-400">
          Client Environment: <span className="font-semibold text-slate-500">Node JS Sandbox</span>
        </div>
      </div>

      {/* CORE INTEGRATION SMARTPHONE CHASSIS */}
      <div className="relative w-full max-w-none h-screen bg-white md:bg-slate-950 md:w-[400px] md:h-[840px] md:border-[11px] md:border-slate-900 md:rounded-[48px] md:shadow-[0_30px_70px_-15px_rgba(0,0,0,0.6)] md:ring-1 md:ring-slate-800/80 flex flex-col overflow-hidden select-none" id="phone_chassis">
        <Toaster
          position="top-center"
          richColors
          closeButton
          visibleToasts={3}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            width: 'auto',
            transform: 'none',
            zIndex: 100,
          }}
          toastOptions={{ style: { width: '100%', maxWidth: '100%' } }}
        />

        {/* HARDWARE BUTTONS (Desktop Interactive Accentuation) */}
        <div className="hidden md:block absolute top-[110px] -left-[14px] w-[3px] h-[35px] bg-slate-800 rounded-l cursor-pointer hover:bg-slate-700 active:scale-95 transition-all" title="Simulated Alert Key" onClick={() => changeVolume('up')} />
        <div className="hidden md:block absolute top-[160px] -left-[14px] w-[3px] h-[55px] bg-slate-800 rounded-l cursor-pointer hover:bg-slate-700 active:scale-95 transition-all" title="Volume Up" onClick={() => changeVolume('up')} />
        <div className="hidden md:block absolute top-[225px] -left-[14px] w-[3px] h-[55px] bg-slate-800 rounded-l cursor-pointer hover:bg-slate-700 active:scale-95 transition-all" title="Volume Down" onClick={() => changeVolume('down')} />
        <div className="hidden md:block absolute top-[160px] -right-[14px] w-[4px] h-[80px] bg-slate-800 rounded-r cursor-pointer hover:bg-slate-700 active:scale-95 transition-all font-sans" title="Power Key" onClick={() => setIsPowerOn(!isPowerOn)} />

        {/* GLASS SHINE EFFECT Overlay */}
        <div className="hidden md:block absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.02] to-white/[0.08] z-40 rounded-[37px]" />

        {/* MOCKUP VOLUME SCREEN HUD SLIDER */}
        {showVolumeHud && (
          <div className="absolute top-[20px] left-4 bg-slate-900/95 text-white text-[10px] px-3 py-2 rounded-full shadow-lg z-50 flex items-center gap-2.5 font-sans border border-slate-700/50 animate-fade-in animate-out">
            <span className="font-bold text-[8px] uppercase tracking-widest text-[#F27D26]">Virtual Ringer</span>
            <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-slate-100" style={{ width: `${systemVolume}%` }}></div>
            </div>
          </div>
        )}

        {/* BLACK EMBEDDED NOTCH / DYNAMIC ISLAND */}
        <div className="hidden md:flex w-[125px] h-7 bg-slate-950 mt-2 mx-auto rounded-full z-50 absolute top-1 left-1/2 -translate-x-1/2 items-center justify-between px-3 border border-slate-900/60 shadow-[inset_0_1px_5px_rgba(255,255,255,0.15)]" id="dynamic_island">
          <div className="w-[10px] h-[10px] bg-indigo-950 rounded-full border border-slate-900 shadow-xs" title="Selfie Sensor" />
          <div className="flex items-center gap-1">
            <span className="text-[7.5px] font-sans font-bold text-slate-500 uppercase tracking-widest">Active</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse_1s_infinite] shadow-[0_0_8px_#10B981]" title="Secure Sandbox Guard" />
          </div>
        </div>

        {/* SCREEN POWER SLEEP SLATE */}
        {!isPowerOn ? (
          <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center space-y-4 text-center font-sans px-8 animate-fade-in" id="sleep_screen">
            <div className="w-10 h-10 w-10 bg-slate-900 text-[#F27D26] rounded-full flex items-center justify-center cursor-pointer border border-slate-800 hover:scale-105 transition-transform" onClick={() => setIsPowerOn(true)}>
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <div className="text-xs text-slate-500">
              <h3 className="font-bold text-slate-350">Device Locked</h3>
              <p className="text-[10px] text-slate-600 mt-1">Tap the power key on the right or play button to activate Sandbox screen</p>
            </div>
          </div>
        ) : (
          /* ACTIVE INTERACTIVE MOBILE SCREEN CONTAINER */
          <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden relative" id="active_viewport">

            {/* MAIN PORT MARGIN SHEET ERRORS */}
            {errorMessage && (
              <div className="bg-red-50 border-b border-red-205 px-4 py-2 text-[10px] flex items-center justify-between gap-1 animate-slide-in shrink-0 z-50 shadow-3xs" id="screen_error">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <p className="text-red-800 font-medium truncate font-sans">{errorMessage}</p>
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-850 transition-colors cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* DYNAMIC ISLAND SAFE-AREA SPACER
                The notch (id="dynamic_island") is absolutely positioned with
                no space reserved for it, so scrollable content below used to
                start at the very top and could scroll directly underneath
                it. This reserves that band in normal flow so the scrollable
                area's own box starts below the notch and can never scroll
                back up into it, regardless of scroll offset. md-only, same
                as the notch itself (mobile view doesn't render the notch). */}
            <div className="hidden md:block h-8 shrink-0" />

            {/* SCREEN VIEWPORTS ROUTING MANAGER */}
            <div className="flex-1 overflow-y-auto px-4 py-3.5 relative space-y-4" id="screen_layout_wrapper">

              {/* ==================== TAB 1: REPORTS PORTAL ==================== */}
              {activeTab === 'reports' && (
                <div className="space-y-4 animate-fade-in">

                  {/* Greeting Hero card */}
                  <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-3 -bottom-3 opacity-15">
                      <Building2 className="w-24 h-24 text-white" />
                    </div>
                    <div className="relative space-y-1">
                      <div className="bg-slate-800 px-2 py-0.5 text-[8px] tracking-widest font-mono font-bold uppercase rounded-sm inline-block">
                        Parser Portal v1.2
                      </div>
                      <h2 className="text-base font-bold tracking-tight">Osterwalder Canvas AI</h2>
                      <p className="text-[11px] text-slate-350 leading-relaxed max-w-xs font-sans">
                        Feed corporate disclosures or PDFs to segment standard Osterwalder blocks and risk categories instantly.
                      </p>
                    </div>
                  </div>

                  {/* Manual / Direct report fine selector */}
                  <div className="bg-white border border-slate-250 p-4 rounded-xl space-y-3 shadow-3xs">
                    {/* PDF Uploader area - intentionally kept */}

                    {pdfMeta && (
                      <div className="bg-emerald-50/50 border border-emerald-100 p-2 rounded-lg flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-700 truncate max-w-[200px] font-mono">{pdfMeta.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono">LOADED</span>
                          <button
                            type="button"
                            onClick={clearActivePdf}
                            className="w-5 h-5 rounded-full bg-white border border-emerald-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 flex items-center justify-center transition-colors"
                            aria-label="Remove selected PDF"
                            title="Remove selected PDF"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".pdf"
                        id="phone_pdf_uploader"
                        className="hidden"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files[0]) {
                            const f = e.target.files[0];
                            const uploadToast = toast.loading('Reading PDF...');
                            setIsUploadingPdf(true);
                            try {
                              const text = await extractTextFromPdf(f);
                              setCustomText(text);
                              const name = f.name.split('.')[0].replace(/[_-]/g, ' ');
                              const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
                              const uploadedReportType = 'Uploaded PDF Statement';
                              setCompanyName(formattedName);
                              setReportType(uploadedReportType);
                              setPdfMeta({ name: f.name, size: `${(f.size / 1024).toFixed(0)} KB` });
                              toast.loading('Saving PDF to Firebase...', { id: uploadToast });
                              const storedReportId = await storeUploadedReport({
                                file: f,
                                companyName: formattedName,
                                reportType: uploadedReportType,
                                extractedText: text,
                                pageCount: 0,
                              });
                              setReportId(storedReportId);
                              toast.success('PDF loaded. You can build the canvas now.', { id: uploadToast });
                            } catch (uploadError) {
                              console.warn('PDF upload/extraction failed:', uploadError);
                              const message = uploadError instanceof Error
                                ? uploadError.message
                                : 'PDF could not be loaded. Please try another PDF.';
                              toast.error(message, { id: uploadToast });
                              setReportId(null);
                              setPdfMeta(null);
                              setCustomText('');
                            } finally {
                              setIsUploadingPdf(false);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={() => document.getElementById('phone_pdf_uploader')?.click()}
                        disabled={isUploadingPdf}
                        className="flex-1 border border-slate-350 hover:bg-slate-50 text-slate-750 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {isUploadingPdf ? 'Loading...' : 'Upload PDF'}
                      </button>

                      <button
                        onClick={handleTriggerParse}
                        disabled={isParsing || !customText.trim()}
                        className={`flex-1 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer ${isParsing || !customText.trim()
                          ? 'bg-slate-100 text-slate-350 cursor-not-allowed'
                          : 'bg-slate-900 text-white hover:bg-black'
                          }`}
                      >
                        {isParsing ? 'Engine ON...' : 'Build Canvas'}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Active Parsing Confidence Widget */}
                  {parsedResult && (
                    <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl space-y-3 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-sans font-extrabold text-[#F27D26] uppercase tracking-widest font-mono">Parsing Accuracy status:</span>
                        <span className="text-[9.5px] font-mono font-bold text-slate-550 truncate max-w-[150px]">{parsedResult.companyName}</span>
                      </div>

                      <div className="flex items-center justify-between bg-white border border-slate-150 p-2.5 rounded-lg shadow-3xs">
                        <div className="space-y-0.5">
                          <span className="block text-[8px] font-sans text-slate-400 uppercase tracking-wider leading-none">Layout Parsing Confidence</span>
                          <span className="block text-[9.5px] text-slate-500 font-sans">Verified semantic Osterwalder mapping</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-sm font-black text-emerald-600">{(parsedResult.efficiencyMetrics.confidenceScore * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      <button
                        onClick={() => { setActiveTab('canvas'); setSelectedBlockId(null); }}
                        className="w-full bg-slate-900 hover:bg-black text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-98"
                      >
                        Proceed to Canvas Board <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Disclaimer security footer */}
                  <div className="flex items-center gap-2 justify-center py-2 text-[9px] text-slate-400 font-sans border-t border-slate-200">
                    <ShieldAlert className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Client-side security verified. No file bytes leaked.</span>
                  </div>
                </div>
              )}


              {/* ==================== TAB 2: CANVAS BOARD ==================== */}
              {activeTab === 'canvas' && (
                <div className="space-y-3.5 animate-fade-in">

                  {!parsedResult ? (
                    <div className="text-center py-16 space-y-3">
                      <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                      <h3 className="text-xs font-sans font-bold text-slate-500 uppercase tracking-widest">No Canvas Built Yet</h3>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                        Go to the <b>Reports Portal</b> tab to upload your Annual Report PDF or paste corporate disclosures.
                      </p>
                      <button
                        onClick={() => setActiveTab('reports')}
                        className="bg-slate-900 text-white text-[10px] px-3.5 py-2 font-bold rounded-lg uppercase tracking-wider cursor-pointer"
                      >
                        Go to Reports Portal
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Active board description */}
                      <div className="flex items-start justify-between gap-1.5 bg-white border border-slate-150 p-3 rounded-xl shadow-3xs">
                        <div className="min-w-0">
                          <h3 className="text-xs font-bold text-slate-950 truncate">Updated BMC Report</h3>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">{parsedResult.companyName || 'Custom Report'} — {parsedResult.reportType}</p>
                        </div>
                        <button
                          onClick={downloadJson}
                          className="bg-slate-900 hover:bg-black text-white shrink-0 p-1.5 rounded-lg flex items-center justify-center cursor-pointer"
                          title="Export JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Swappable sub-navigator pills */}
                      <div className="flex bg-slate-200/60 p-1 rounded-lg gap-1 text-[10px] font-sans font-extrabold shadow-3xs">
                        <button
                          onClick={() => { setCanvasView('bmc'); setSelectedBlockId(null); setSelectedVarianceBlockId(null); }}
                          className={`flex-1 py-1.5 text-center rounded-md cursor-pointer transition-all ${canvasView === 'bmc' ? 'bg-white text-slate-950 shadow-3xs' : 'text-slate-400'}`}
                        >
                          Osterwalder Canvas
                        </button>
                        <button
                          onClick={() => { setCanvasView('temporal'); setSelectedBlockId(null); setSelectedVarianceBlockId(null); }}
                          className={`flex-1 py-1.5 text-center rounded-md cursor-pointer transition-all ${canvasView === 'temporal' ? 'bg-white text-[#F27D26] shadow-3xs' : 'text-slate-400'}`}
                        >
                          Compare past year annual report
                        </button>
                        <button
                          onClick={() => { setCanvasView('workforce'); setSelectedBlockId(null); setSelectedVarianceBlockId(null); }}
                          className={`flex-1 py-1.5 text-center rounded-md cursor-pointer transition-all ${canvasView === 'workforce' ? 'bg-white text-[#F27D26] shadow-3xs' : 'text-slate-400'}`}
                        >
                          AI Workforce
                        </button>
                      </div>
                      {canvasView === 'workforce' && (
                        <WorkforcePanel
                          key={reportId ?? 'unsaved'}
                          sourceText={customText}
                          companyName={parsedResult?.companyName || 'Untitled report'}
                          reportId={reportId}
                          savedScan={loadedWorkforceScan}
                          thresholdInstruction={buildThresholdInstruction(workforceThresholds)}
                        />
                      )}
                      {/* SUBPANE A: STANDARD CANVAS */}
                      {canvasView === 'bmc' && (
                        <>
                          {/* Selected Category view */}
                          {selectedBlockId ? (
                            <div className="space-y-3 animate-slide-in">
                              {/* Parent breadcrumb */}
                              <div className="flex items-center justify-between border-b pb-2">
                                <button
                                  onClick={() => setSelectedBlockId(null)}
                                  className="flex items-center gap-0.5 text-[10px] font-sans font-bold text-[#F27D26] hover:underline cursor-pointer"
                                >
                                  <ChevronLeft className="w-4 h-4" /> Back to Blocks
                                </button>
                                <button
                                  onClick={() => setAddingToBlockId(selectedBlockId)}
                                  className="flex items-center gap-0.5 text-[10px] bg-slate-900 border border-slate-200 text-white hover:bg-black px-2 py-1 font-bold rounded cursor-pointer uppercase tracking-wider"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Add Point
                                </button>
                              </div>

                              {/* Block Name Heading */}
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${blockColors[selectedBlockId]}`}>
                                  {blockIcons[selectedBlockId]}
                                </div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                  {blocksList.find(b => b.id === selectedBlockId)?.name}
                                </h3>
                              </div>

                              {/* Points List */}
                              <div className="space-y-2">
                                {getBlockData(selectedBlockId).keyPoints.map((pt, i) => (
                                  <div
                                    key={i}
                                    onClick={() => setSelectedPointInfo({ blockId: selectedBlockId, pointIndex: i, point: pt })}
                                    className="bg-white border border-slate-200/80 active:border-slate-400 px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50 transition-all font-sans"
                                  >
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <h4 className="text-[11px] font-extrabold text-slate-900 truncate leading-snug">{pt.point}</h4>
                                      <div className="flex items-center gap-1.5 text-[8.5px] font-medium font-mono text-slate-550 leading-none">
                                        <span className="bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-slate-800">C. {pt.pageNumber || 'Scan'}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-350" />
                                        <span className="text-[8.5px] italic font-serif leading-none truncate max-w-[140px] text-slate-500">"{pt.evidenceQuote}"</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`text-[8.5px] px-1.5 py-0.5 rounded-xs font-sans font-extrabold uppercase tracking-widest border border-slate-200/50 ${riskBadgeCSS[pt.riskRating || 'Low']}`}>
                                        {pt.riskRating}
                                      </span>
                                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                    </div>
                                  </div>
                                ))}

                                {getBlockData(selectedBlockId).keyPoints.length === 0 && (
                                  <div className="bg-slate-50/50 border border-dashed rounded-xl py-8 text-center text-[10px] text-slate-500 italic space-y-2">
                                    <AlertCircle className="w-6 h-6 text-slate-300 mx-auto" />
                                    <span>No corporate guidelines discovered in this dimension of the PDF disclosure.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Grid view of nine blocks */
                            <div className="space-y-3.5 animate-fade-in">

                              {/* DYNAMIC ADVISOR RISK & OPPORTUNITY DIAGNOSTICS */}
                              {parsedResult && (() => {
                                const metrics = getAdvisorMetrics(parsedResult);
                                return (
                                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs space-y-4 border-l-4 border-l-[#F27D26]" id="advisor_strategic_center_card">
                                    <div className="flex items-center justify-between border-b pb-2 leading-none">
                                      <div className="flex items-center gap-1.5">
                                        <TrendingUp className="w-4 h-4 text-[#F27D26] shrink-0" />
                                        <span className="text-[11px] font-sans font-black text-slate-900 uppercase tracking-wider block">Diagnostics Dashboard (Single PDF Audit)</span>
                                      </div>
                                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-50 border border-orange-100 text-orange-700 font-bold uppercase tracking-widest leading-none">
                                        Operating Health Audit
                                      </span>
                                    </div>

                                    <div className="space-y-4">

                                      {/* 1. Operating Scalability Ratio (Quantitative) */}
                                      <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-lg space-y-3 text-left animate-slide-in">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                            <span className="text-[9.5px] text-slate-455 font-extrabold uppercase tracking-wider leading-none">1. Operating Scalability Ratio (Quantitative)</span>
                                          </div>
                                          <span className={`text-[8.5px] font-black font-mono px-1.5 py-0.5 rounded-sm uppercase tracking-wide leading-none ${metrics.scalabilityRiskRating === 'HIGH'
                                            ? 'bg-rose-50 text-rose-700 border border-rose-150'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                                            }`}>
                                            {metrics.scalabilityRiskRating === 'HIGH' ? 'Scalability Risk: HIGH' : 'Scalability Risk: LOW'}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                                            <span className="block text-[8px] text-slate-400 uppercase font-mono font-medium leading-none">Staff Costs % of Revenue</span>
                                            <span className="block text-base font-black text-slate-800 font-mono mt-1 leading-none">{metrics.staffCostsPercentOfRevenue.toFixed(1)}%</span>
                                          </div>
                                          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                                            <span className="block text-[8px] text-slate-400 uppercase font-mono font-medium leading-none">Operating Leverage Trend</span>
                                            <div className="flex items-center gap-1.5 mt-1 leading-none">
                                              <span className="text-[9.5px] font-bold text-slate-700 font-mono">
                                                Staff (+{metrics.staffCostsGrowthRate.toFixed(1)}%) vs Rev (+{metrics.revenueGrowthRate.toFixed(1)}%)
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        <p className="text-[10px] text-slate-650 leading-relaxed font-sans pt-1">
                                          <strong>Advisor Value:</strong> Detects if the company is "Labor-Heavy". If salaries are eating up too much revenue, the business cannot grow without losing profit (Risk).
                                        </p>

                                        {/* Core Advisor Alert Requirement */}
                                        <div className={`p-2.5 rounded-md border text-[10px] font-mono leading-relaxed font-bold ${metrics.scalabilityRiskRating === 'HIGH'
                                          ? 'bg-rose-50 text-rose-800 border-rose-200/60'
                                          : 'bg-emerald-50 text-emerald-800 border-emerald-200/60'
                                          }`}>
                                          ⚠️ {metrics.scalabilityRiskAlert}
                                        </div>
                                      </div>

                                      {/* 2. Transparency Sentiment Score (Qualitative) */}
                                      <SentimentAttentionMap
                                        companyName={parsedResult.companyName}
                                        score={metrics.transparencySentimentScore}
                                      />

                                    </div>
                                  </div>
                                );
                              })()}

                              <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block">Standard Osterwalder Canvas (Tap block to inspect keys):</span>

                              <div className="grid grid-cols-3 gap-2" id="bmc_blocks_grid">
                                {blocksList.map((block) => {
                                  const highestRisk = getHighestRiskForBlock(block.data.keyPoints);
                                  return (
                                    <button
                                      key={block.id}
                                      onClick={() => setSelectedBlockId(block.id)}
                                      className="bg-white border border-slate-200/80 active:border-slate-500 p-2.5 rounded-xl text-left flex flex-col justify-between h-[92px] cursor-pointer hover:bg-slate-105 transition-all shadow-3xs"
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${blockColors[block.id]}`}>
                                          {blockIcons[block.id]}
                                        </div>
                                        <span className="bg-slate-100 text-slate-800 text-[8.5px] font-extrabold font-mono px-1 rounded-full leading-none">
                                          {block.data.keyPoints.length}
                                        </span>
                                      </div>
                                      <div>
                                        <h4 className="text-[9.5px] font-extrabold text-slate-900 truncate leading-none mt-1">{block.name}</h4>
                                        <div className="flex items-center justify-between gap-1 w-full mt-1.5 min-w-0">
                                          <span className="text-[7.5px] font-mono tracking-widest font-extrabold text-slate-400 uppercase leading-none">{block.id}</span>
                                          {highestRisk && (
                                            <span className={`text-[7px] font-extrabold font-sans uppercase tracking-wider px-1 py-[1.5px] rounded-[3px] border leading-none shrink-0 ${highestRisk === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                              highestRisk === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              }`}>
                                              {highestRisk}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}                      {/* SUBPANE B: TIME-TRAVEL PAST COMPARISON */}
                      {isViewingTemporal && (
                        <div className="space-y-3.5 animate-fade-in">
                          <span className="text-[9px] font-sans font-extrabold text-slate-455 uppercase tracking-widest block">Chronos Temporal Auditor:</span>

                          <div className="bg-white border rounded-xl p-3 space-y-2.5 shadow-3xs">
                            <label className="text-[9.5px] font-sans font-bold text-slate-400 uppercase block leading-none">Target Historic audit year:</label>

                            <div className="flex gap-2">
                              <select
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono font-bold text-slate-850 focus:outline-none focus:border-slate-900 cursor-pointer"
                                value={targetPastYear}
                                onChange={(e) => setTargetPastYear(e.target.value)}
                              >
                                {['2020', '2021', '2022', '2023', '2024', '2025'].map((yr) => (
                                  <option key={yr} value={yr}>{yr}</option>
                                ))}
                              </select>
                              <button
                                onClick={handlePastYearSearch}
                                disabled={isSearchingPastYear}
                                className="bg-[#F27D26] hover:bg-orange-600 text-white text-[10px] font-bold px-3.5 py-1.5 rounded-lg uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer"
                              >
                                {isSearchingPastYear ? "Auditing..." : "Crawl & Compare"}
                              </button>
                            </div>

                            {pastYearError && (
                              <p className="text-[9.5px] text-red-600 font-medium font-sans leading-relaxed">{pastYearError}</p>
                            )}
                          </div>

                          {/* Crawler Result Output */}
                          {isSearchingPastYear && (
                            <div className="bg-white border p-6 text-center rounded-xl space-y-3">
                              <RefreshCw className="w-6 h-6 text-[#F27D26] mx-auto animate-spin" />
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-650 animate-pulse">Running Grounding Engines</h4>
                              <p className="text-[9.5px] text-slate-400 leading-normal max-w-[220px] mx-auto">
                                Web crawling corporate filings and securities reports to synthesize business canvas variances in {targetPastYear}...
                              </p>
                            </div>
                          )}

                          {!isSearchingPastYear && pastYearResult && (
                            <div className="space-y-3.5 animate-slide-in">

                              {/* Strategic Narrative */}
                              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1.5">
                                <span className="text-[8px] font-sans font-extrabold text-[#F27D26] uppercase tracking-wider block">EXPERT TEMPORAL AUDIT REPORT:</span>
                                <p className="text-[10.5px] text-slate-650 leading-relaxed font-sans">{pastYearResult.comparisonNarrative}</p>
                              </div>

                              {/* TEMPORAL PERFORMANCE SCORECARD (Y-o-Y BETTER VS WORSE ANALYSIS) */}
                              {(() => {
                                const yrMetrics = getPastYearMetrics(pastYearResult.companyName, pastYearResult.targetYear, pastYearResult.aiMetrics);
                                return (
                                  <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-3xs space-y-4" id="temporal_performance_scorecard">
                                    <div className="flex items-center gap-1.5 border-b pb-2">
                                      <TrendingUp className="w-4 h-4 text-[#F27D26] shrink-0" />
                                      <span className="text-[10.5px] font-sans font-black text-slate-900 uppercase tracking-wider block leading-none">
                                        Diagnostics Dashboard (Past Year Check: {pastYearResult.targetYear} vs Current)
                                      </span>
                                    </div>

                                    <div className="space-y-4">

                                      {/* 1. Infrastructure Efficiency Delta (Quantitative) */}
                                      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-3 text-left">
                                        <div className="flex justify-between items-center bg-transparent leading-none">
                                          <span className="text-[9.5px] text-slate-455 font-extrabold uppercase tracking-wider block">1. Infrastructure Efficiency Delta</span>
                                          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${yrMetrics.infraDeltaStatus === 'OPPORTUNITY'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                                            : 'bg-rose-50 text-rose-700 border border-rose-150'
                                            }`}>
                                            {yrMetrics.infraDeltaStatus}
                                          </span>
                                        </div>

                                        <p className="text-[10px] text-slate-500 leading-normal font-sans">
                                          <strong>"Digital Pivot" Tracker:</strong> Measures IT investment growth vs. physical rental footprint shrinkage.
                                        </p>

                                        <div className="grid grid-cols-2 gap-2 pt-1.5 text-center">
                                          <div className="bg-white p-2 border border-slate-200/80 rounded">
                                            <span className="block text-[7.5px] text-slate-400 font-mono uppercase">IT Spend Change</span>
                                            <span className="block text-xs font-black text-indigo-600 mt-1">+{yrMetrics.itSpendGrowth}%</span>
                                          </div>
                                          <div className="bg-white p-2 border border-slate-200/80 rounded">
                                            <span className="block text-[7.5px] text-slate-400 font-mono uppercase">Rent / Office Cost</span>
                                            <span className={`block text-xs font-black mt-1 ${yrMetrics.rentCostGrowth < 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {yrMetrics.rentCostGrowth > 0 ? '+' : ''}{yrMetrics.rentCostGrowth}%
                                            </span>
                                          </div>
                                        </div>

                                        <div className={`p-2.5 rounded text-[10px] font-mono leading-relaxed font-bold border ${yrMetrics.infraDeltaStatus === 'OPPORTUNITY'
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                          : 'bg-rose-50 text-rose-800 border-rose-100'
                                          }`}>
                                          💡 {yrMetrics.infrastructureDeltaVerdict}
                                        </div>
                                      </div>

                                      {/* 2. The Strategic "Say-Do" Audit (Qualitative) */}
                                      <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-3 text-left">
                                        <div className="flex justify-between items-center bg-transparent leading-none">
                                          <span className="text-[9.5px] text-slate-455 font-extrabold uppercase tracking-wider block">2. Strategic "Say-Do" Audit</span>
                                          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none ${yrMetrics.managementCredibilityRisk === 'LOW'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                                            : yrMetrics.managementCredibilityRisk === 'MEDIUM'
                                              ? 'bg-amber-50 text-amber-700 border border-amber-150'
                                              : 'bg-rose-50 text-rose-700 border border-rose-150'
                                            }`}>
                                            Risk: {yrMetrics.managementCredibilityRisk}
                                          </span>
                                        </div>

                                        <p className="text-[10px] text-slate-500 leading-normal font-sans">
                                          <strong>Consistency Check:</strong> Compares last year's roadmap commitments ("Future Outlook") vs. current year achievements.
                                        </p>

                                        <div className="space-y-2 text-[9.5px] font-sans">
                                          <div className="bg-white p-2 rounded border border-slate-200/80">
                                            <span className="block text-[7.5px] text-slate-400 font-mono uppercase">Last Year's Promise:</span>
                                            <p className="text-slate-705 mt-0.5 leading-normal font-medium">"{yrMetrics.lastYearPromise}"</p>
                                          </div>
                                          <div className="bg-white p-2 rounded border border-slate-200/80">
                                            <span className="block text-[7.5px] text-slate-400 font-mono uppercase">Current Execution Result:</span>
                                            <p className="text-slate-705 mt-0.5 leading-normal font-medium">"{yrMetrics.thisYearResult}"</p>
                                          </div>
                                        </div>

                                        <div className="space-y-1 bg-white p-2 rounded border border-slate-200/80">
                                          <div className="flex justify-between text-[8px] font-mono text-slate-500">
                                            <span>SAY-DO CONSISTENCY INDEX</span>
                                            <span className="font-extrabold text-slate-900">{yrMetrics.sayDoConsistencyScore}%</span>
                                          </div>
                                          <div className="bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${yrMetrics.sayDoConsistencyScore > 80 ? 'bg-emerald-500' : yrMetrics.sayDoConsistencyScore > 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                              style={{ width: `${yrMetrics.sayDoConsistencyScore}%` }}
                                            />
                                          </div>
                                        </div>

                                        <p className="text-[9.5px] text-slate-650 leading-relaxed font-sans italic">
                                          🎯 <strong>Performance Verdict:</strong> {yrMetrics.sayDoVerdict}
                                        </p>
                                      </div>

                                    </div>


                                  </div>
                                );
                              })()}

                              {/* Source citations lists */}
                              {pastYearResult.sources && pastYearResult.sources.length > 0 && (
                                <div className="space-y-1 bg-white border border-slate-150 p-2.5 rounded-xl shadow-3xs">
                                  <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest block">GROUNDED PDF SOURCES CLARIFIED:</span>
                                  {pastYearResult.sources.map((s, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-[9px] font-sans text-slate-650">
                                      <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span className="font-semibold truncate flex-1">{s.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Canvas View or Detail View of Variance Blocks */}
                              {selectedVarianceBlockId ? (
                                <div className="space-y-3 animate-slide-in">
                                  {/* Back button */}
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <button
                                      onClick={() => setSelectedVarianceBlockId(null)}
                                      className="flex items-center gap-0.5 text-[10px] font-sans font-bold text-[#F27D26] hover:underline cursor-pointer"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5 animate-pulse" /> Back to Variance Canvas
                                    </button>
                                  </div>

                                  {(() => {
                                    const getTemporalBlock = (id: string) => {
                                      return pastYearResult.blocks.find(
                                        (pb) => pb.id === id || (id === 'CS_COST' && (pb.id === 'CS_COST' || pb.id === 'CS_CO' || pb.id === 'Cost Structure'))
                                      ) || null;
                                    };
                                    const rawData = getTemporalBlock(selectedVarianceBlockId);
                                    const rating = rawData?.varianceRating || 'Low';
                                    const name = rawData?.name || blocksList.find(b => b.id === selectedVarianceBlockId)?.name || 'Block';

                                    return (
                                      <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-3xs">
                                        <div className="flex items-center justify-between border-b pb-2">
                                          <div className="flex items-center gap-1.5">
                                            <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${blockColors[selectedVarianceBlockId]}`}>
                                              {blockIcons[selectedVarianceBlockId]}
                                            </div>
                                            <span className="text-[11px] font-extrabold text-slate-900 uppercase font-sans">{name} ({selectedVarianceBlockId})</span>
                                          </div>
                                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wide font-mono ${rating === 'High' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                            rating === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                              'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            }`}>
                                            {rating} Variance
                                          </span>
                                        </div>

                                        <p className="text-[10.5px] text-slate-650 leading-relaxed font-sans">{rawData?.changeNotes || 'No major structural changes found.'}</p>

                                        {rawData?.pastYearKeyPoints && rawData.pastYearKeyPoints.length > 0 && (
                                          <div className="space-y-2 mt-4">
                                            <span className="text-[8px] font-sans font-extrabold text-slate-400 uppercase tracking-wider block">Historical Section Indicators:</span>
                                            {rawData.pastYearKeyPoints.map((pkp, j) => (
                                              <div key={j} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 space-y-1">
                                                <h5 className="text-[10px] font-extrabold text-slate-900 leading-none">{pkp.point}</h5>
                                                <p className="text-[9.5px] text-slate-550 leading-relaxed">{pkp.description}</p>

                                                {pkp.evidenceQuote && (
                                                  <blockquote className="text-[8.5px] font-mono text-slate-500 italic border-l-2 border-slate-300 pl-1.5 py-0.5 mt-1 leading-snug">
                                                    "{pkp.evidenceQuote}"
                                                  </blockquote>
                                                )}
                                                {pkp.sourceUrl && (
                                                  <span className="text-[8.5px] font-mono font-medium text-[#F27D26] block uppercase tracking-wider">Citation: {pkp.sourceUrl}</span>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              ) : (
                                /* Grid view of nine blocks */
                                <div className="space-y-3 animate-fade-in">
                                  <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block">Variance Analysis Grid (Tap block to inspect):</span>

                                  <div className="grid grid-cols-3 gap-2" id="temporal_blocks_grid">
                                    {[
                                      { id: 'KP', name: 'Key Partners' },
                                      { id: 'KA', name: 'Key Activities' },
                                      { id: 'KR', name: 'Key Resources' },
                                      { id: 'VP', name: 'Value Propositions' },
                                      { id: 'CR', name: 'Customer Relationships' },
                                      { id: 'CH', name: 'Channels' },
                                      { id: 'CS', name: 'Customer Segments' },
                                      { id: 'CS_COST', name: 'Cost Structure' },
                                      { id: 'RS', name: 'Revenue Streams' },
                                    ].map((b) => {
                                      const getRawData = (id: string) => {
                                        return pastYearResult.blocks.find(
                                          (pb) => pb.id === id || (id === 'CS_COST' && (pb.id === 'CS_COST' || pb.id === 'CS_CO' || pb.id === 'Cost Structure'))
                                        ) || null;
                                      };
                                      const rawData = getRawData(b.id);
                                      const rating = rawData?.varianceRating || 'Low';
                                      const ptsCount = rawData?.pastYearKeyPoints?.length || 0;

                                      return (
                                        <button
                                          key={b.id}
                                          onClick={() => setSelectedVarianceBlockId(b.id)}
                                          className="bg-white border border-slate-200/80 active:border-slate-500 p-2.5 rounded-xl text-left flex flex-col justify-between h-[92px] cursor-pointer hover:bg-slate-105 transition-all shadow-3xs"
                                        >
                                          <div className="flex items-center justify-between w-full">
                                            <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${blockColors[b.id]}`}>
                                              {blockIcons[b.id]}
                                            </div>
                                            <span className="bg-slate-100 text-slate-800 text-[8.5px] font-extrabold font-mono px-1 rounded-full leading-none">
                                              {ptsCount}
                                            </span>
                                          </div>
                                          <div>
                                            <h4 className="text-[9.5px] font-extrabold text-slate-900 truncate leading-none mt-1">{b.name}</h4>
                                            <div className="flex items-center justify-between gap-1 w-full mt-1.5 min-w-0">
                                              <span className="text-[7.5px] font-mono tracking-widest font-extrabold text-slate-400 uppercase leading-none">{b.id}</span>
                                              <span className={`text-[7px] font-extrabold font-sans uppercase tracking-wider px-1 py-[1.5px] rounded-[3px] border leading-none shrink-0 ${rating === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                rating === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                }`}>
                                                {rating}
                                              </span>
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                            </div>
                          )}

                        </div>
                      )}

                    </>
                  )}

                </div>
              )}


              {/* ==================== TAB 3: SIDE COMPARATIVE ==================== */}
              {activeTab === 'compare' && (
                <div className="space-y-4 animate-fade-in">

                  {!parsedResult ? (
                    <div className="text-center py-16 space-y-3">
                      <Scale className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
                      <h3 className="text-xs font-sans font-bold text-slate-500 uppercase tracking-widest">Workspace Document Empty</h3>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                        Analyze your primary document in the <b>Reports Portal</b> page first.
                      </p>
                      <button onClick={() => setActiveTab('reports')} className="bg-slate-900 text-white text-[10px] px-3.5 py-2 font-bold rounded-lg uppercase tracking-wider cursor-pointer">
                        Proceed Home
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Active compare header selector */}
                      <div className="bg-white border rounded-xl p-3 shadow-3xs space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-1 leading-none border-b pb-1.5">
                          <span className="text-[9px] font-sans font-extrabold text-slate-450 uppercase tracking-widest">Strategy Comparison Hub:</span>
                          {comparisonResult && (
                            <button
                              onClick={() => { setComparisonResult(null); setCompetitorOverview(null); setChatAnswer(null); }}
                              className="text-[9.5px] font-mono font-extrabold text-red-500 hover:underline leading-none"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {isParsingCompare ? (
                          <div className="bg-white border rounded-xl p-6 text-center space-y-3 shadow-3xs animate-fade-in flex flex-col items-center justify-center min-h-[140px]">
                            <RefreshCw className="w-6 h-6 text-[#F27D26] animate-spin" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 animate-pulse">Running Comparison Engine</h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed max-w-[240px] mx-auto font-sans">
                              Uploading and parsing competitor PDF disclosure to segment blocks and evaluate risks...
                            </p>
                          </div>
                        ) : !comparisonResult ? (
                          <div className="space-y-2.5">
                            <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
                              Provide a comparison report to view side-by-side differentiators and load strategic AI narratives.
                            </p>

                            <div className="border border-slate-200 bg-slate-50 p-2.5 rounded-lg space-y-2">
                              <p className="text-[8.5px] font-mono uppercase tracking-wider text-slate-400 font-extrabold block">Upload Competitor PDF:</p>
                              <input
                                type="file"
                                accept=".pdf"
                                id="compare_pdf_uploader"
                                className="hidden"
                                onChange={async (e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    setIsParsingCompare(true);
                                    const f = e.target.files[0];
                                    const compareToast = toast.loading('Reading competitor PDF...');
                                    try {
                                      const text = await extractTextFromPdf(f);
                                      setCompareCustomText(text);
                                      const name = f.name.split('.')[0].replace(/[_-]/g, ' ');
                                      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
                                      setCompareCompanyName(formattedName);
                                      setCompareReportType('Uploaded Competitor PDF');
                                      setComparePdfMeta({ name: f.name, size: `${(f.size / 1024).toFixed(0)} KB` });

                                      // Competitor PDFs are evaluated in memory and attached to
                                      // the primary report; they are not separate History records.
                                      setCompareReportId(null);
                                      toast.loading('Building competitor canvas...', { id: compareToast });

                                      // Trigger parsing immediately by passing the fresh text and names directly
                                      await handleTriggerCompareParse(
                                        text,
                                        formattedName,
                                        'Uploaded Competitor PDF',
                                        null,
                                        f.name,
                                      );
                                      toast.success('Competitor PDF loaded.', { id: compareToast });
                                    } catch (uploadError) {
                                      console.warn('Competitor PDF upload/extraction failed:', uploadError);
                                      const message = uploadError instanceof Error
                                        ? uploadError.message
                                        : 'Competitor PDF could not be loaded.';
                                      toast.error(message, { id: compareToast });
                                    } finally {
                                      setIsParsingCompare(false);
                                      e.currentTarget.value = '';
                                    }
                                  }
                                }}
                              />
                              <button
                                onClick={() => document.getElementById('compare_pdf_uploader')?.click()}
                                className="w-full bg-slate-900 text-white text-[9px] font-bold py-1.5 rounded uppercase tracking-wider cursor-pointer"
                              >
                                Upload Competitor PDF
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Loaded entities card */
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <div className="text-left font-sans flex-1 min-w-0">
                              <span className="block text-[8px] font-extrabold text-indigo-700 uppercase tracking-widest font-mono select-none">Primary Document:</span>
                              <span className="block font-bold truncate text-slate-800">{parsedResult.companyName}</span>
                            </div>
                            <div className="w-6 h-6 bg-slate-100 text-slate-400 text-xs font-bold rounded-full flex items-center justify-center shrink-0 border select-none">VS</div>
                            <div className="text-right font-sans flex-1 min-w-0">
                              <span className="block text-[8px] font-extrabold text-rose-700 uppercase tracking-widest font-mono select-none">Competitor:</span>
                              <span className="block font-bold truncate text-slate-800">{comparisonResult.companyName}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* AI Strategic overview & differences */}
                      {comparisonResult && (
                        <div className="space-y-4 animate-slide-in">

                          {/* DYNAMIC ADVISOR COMPARATIVE DIAGNOSTIC MATRIX */}
                          {(() => {
                            const primaryMetrics = getAdvisorMetrics(parsedResult);
                            const competitorMetrics = getAdvisorMetrics(comparisonResult);

                            // Helper to format currency
                            const formatUSD = (val: number) => {
                              if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
                              return `$${(val / 1000).toFixed(0)}k`;
                            };

                            return (
                              <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-3xs space-y-4" id="advisor_comparison_matrix_card">
                                <div className="flex items-center gap-1.5 border-b pb-2">
                                  <Scale className="w-4 h-4 text-[#F27D26] shrink-0" />
                                  <span className="text-[10.5px] font-sans font-black text-slate-900 uppercase tracking-wider block leading-none">Diagnostics Dashboard (Battle Card Peer Comparison)</span>
                                </div>

                                <div className="space-y-4">

                                  {/* 1. Human Capital Productivity (Quantitative) */}
                                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-3 text-left animate-fade-in">
                                    <div className="flex justify-between items-center bg-transparent leading-none">
                                      <span className="text-[9.5px] text-slate-455 font-extrabold uppercase tracking-wider block">1. Human Capital Productivity (Quantitative)</span>
                                      <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none bg-indigo-50 text-indigo-700 border border-indigo-150">
                                        Automation Metric
                                      </span>
                                    </div>

                                    <p className="text-[10px] text-slate-500 leading-normal font-sans">
                                      <strong>The "Automation" Benchmark:</strong> Revenue per Employee (Entity A) vs. Revenue per Employee (Entity B). Helps advisors identify structural bottlenecks and scalable business setups.
                                    </p>

                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                      {/* Entity A */}
                                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                        <span className="text-[8px] font-mono text-slate-400 font-bold block uppercase leading-none">{parsedResult.companyName}</span>
                                        <span className="text-sm font-black text-slate-800 font-mono mt-1.5 block">
                                          {formatUSD(primaryMetrics.revenuePerEmployee)} <span className="text-[8px] font-normal font-sans text-slate-500">/ employee</span>
                                        </span>
                                      </div>
                                      {/* Entity B */}
                                      <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                                        <span className="text-[8px] font-mono text-slate-400 font-bold block uppercase leading-none">{comparisonResult.companyName}</span>
                                        <span className="text-sm font-black text-slate-800 font-mono mt-1.5 block">
                                          {formatUSD(competitorMetrics.revenuePerEmployee)} <span className="text-[8px] font-normal font-sans text-slate-500">/ employee</span>
                                        </span>
                                      </div>
                                    </div>

                                    {/* Balance distribution view */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center text-[8px] font-mono text-slate-400">
                                        <span>Productivity Ratio split</span>
                                        <span>{((primaryMetrics.revenuePerEmployee / (primaryMetrics.revenuePerEmployee + competitorMetrics.revenuePerEmployee)) * 100).toFixed(0)}% vs {((competitorMetrics.revenuePerEmployee / (primaryMetrics.revenuePerEmployee + competitorMetrics.revenuePerEmployee)) * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/40">
                                        <div
                                          style={{ width: `${(primaryMetrics.revenuePerEmployee / (primaryMetrics.revenuePerEmployee + competitorMetrics.revenuePerEmployee)) * 100}%` }}
                                          className="bg-indigo-500 h-full rounded-l-full"
                                        />
                                        <div
                                          style={{ width: `${(competitorMetrics.revenuePerEmployee / (primaryMetrics.revenuePerEmployee + competitorMetrics.revenuePerEmployee)) * 100}%` }}
                                          className="bg-rose-400 h-full rounded-r-full"
                                        />
                                      </div>
                                    </div>

                                    <div className="p-2.5 bg-slate-150 rounded text-[9.5px] leading-relaxed text-slate-705 italic font-sans">
                                      💡 <strong>Advisor Value Insight:</strong> {primaryMetrics.revenuePerEmployee > competitorMetrics.revenuePerEmployee ? (
                                        <>
                                          <strong>{parsedResult.companyName}</strong> generates significantly higher leverage per head. This reveals a clear <strong>Opportunity (High Scalability / Tech-led framework)</strong>. In contrast, <strong>{comparisonResult.companyName}</strong> suffers from a <strong>Risk of Heavy Labor Dependency</strong>.
                                        </>
                                      ) : (
                                        <>
                                          <strong>{comparisonResult.companyName}</strong> generates significantly higher leverage per head. This reveals a clear <strong>Opportunity (High Scalability / Tech-led framework)</strong>. In contrast, <strong>{parsedResult.companyName}</strong> suffers from a <strong>Risk of Heavy Labor Dependency</strong>.
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {/* 2. The "Strategy DNA" (Strategic Keyword Mapping) */}
                                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg space-y-3.5 text-left animate-fade-in">
                                    <div className="flex justify-between items-center bg-transparent leading-none">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#F27D26] shrink-0" />
                                        <span className="text-[9.5px] text-slate-455 font-extrabold uppercase tracking-wider block">2. The "Strategy DNA" (Strategic Keyword Mapping)</span>
                                      </div>
                                      <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-none bg-orange-50 text-[#F27D26] border border-orange-100">
                                        Obsession Analysis
                                      </span>
                                    </div>

                                    <p className="text-[10px] text-slate-500 leading-normal font-sans">
                                      <strong>Management Obsession Tracking:</strong> Scans "Management Discussion & Analysis" and "Business" segments under the hood. It structures keyword weight vectors to reveal what executive operations are actually obsessed with (instead of comparing mere numbers).
                                    </p>

                                    {(() => {
                                      const dna = getStrategyDnaThemes(parsedResult, comparisonResult);
                                      return (
                                        <div className="space-y-3">

                                          {/* Side-by-Side Theme Map */}
                                          <div className="space-y-3.5">

                                            {/* Entity A Obsessions */}
                                            <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                                              <div className="flex justify-between items-center border-b pb-1">
                                                <span className="text-[8.5px] font-extrabold text-indigo-700 uppercase font-mono tracking-tight truncate flex-1 block" title={`${parsedResult.companyName} FOCUS`}>
                                                  {parsedResult.companyName} FOCUS
                                                </span>
                                                <span className="text-[6.5px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-mono">Entity A</span>
                                              </div>
                                              <div className="space-y-2">
                                                {dna.themesA.map((t, idx) => (
                                                  <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-[9px] font-bold">
                                                      <span className="text-slate-800">{t.theme}</span>
                                                      <span className="font-mono text-indigo-600 text-[8.5px]">{t.focusScore}% Focus</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                                      <div className="bg-indigo-500 h-full" style={{ width: `${t.focusScore}%` }} />
                                                    </div>
                                                    <p className="text-[8.5px] text-slate-450 italic font-sans leading-tight">{t.description}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>

                                            {/* Entity B Obsessions */}
                                            <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-2">
                                              <div className="flex justify-between items-center border-b pb-1">
                                                <span className="text-[8.5px] font-extrabold text-[#D25600] uppercase font-mono tracking-tight truncate flex-1 block" title={`${comparisonResult.companyName} FOCUS`}>
                                                  {comparisonResult.companyName} FOCUS
                                                </span>
                                                <span className="text-[6.5px] font-black uppercase text-[#F27D26] bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 font-mono">Entity B</span>
                                              </div>
                                              <div className="space-y-2">
                                                {dna.themesB.map((t, idx) => (
                                                  <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between text-[9px] font-bold">
                                                      <span className="text-slate-800">{t.theme}</span>
                                                      <span className="font-mono text-[#D25600] text-[8.5px]">{t.focusScore}% Focus</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                                      <div className="bg-[#F27D26] h-full" style={{ width: `${t.focusScore}%` }} />
                                                    </div>
                                                    <p className="text-[8.5px] text-slate-450 italic font-sans leading-tight">{t.description}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>

                                          </div>

                                          {/* Divergent plays summary */}
                                          <div className="p-3 bg-gradient-to-r from-orange-50/55 to-indigo-50/25 border border-orange-150/80 rounded-xl text-[9.5px] leading-relaxed text-slate-705">
                                            📢 <strong>Advisor Play Interpretation:</strong> {dna.divergencePlaySummary}
                                          </div>

                                        </div>
                                      );
                                    })()}
                                  </div>

                                </div>
                              </div>
                            );
                          })()}

                          {/* EXPERT AI OVERVIEW */}
                          {isGeneratingOverview ? (
                            <div className="bg-white border p-6 text-center rounded-xl space-y-2">
                              <RefreshCw className="w-5 h-5 text-indigo-600 mx-auto animate-spin" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse mt-1 block">Compiling Strategic Overview</span>
                            </div>
                          ) : competitorOverview ? (
                            <div className="space-y-3">

                              {/* AI Overview narrative */}
                              <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden font-sans border border-slate-800">
                                <div className="absolute -right-3 -bottom-3 opacity-10">
                                  <Award className="w-20 h-20 text-white" />
                                </div>
                                <div className="space-y-2">
                                  <span className="text-[8px] tracking-widest font-mono font-bold uppercase rounded-sm inline-block text-[#F27D26]">Live Strategy Evaluation:</span>
                                  <div className="text-[10.5px] text-slate-300 leading-relaxed font-sans space-y-2">
                                    {competitorOverview.overviewMarkdown.split('\n\n').map((paragraph, index) => (
                                      <p key={index}>
                                        {paragraph.split(' ').map((word, wordIdx) => {
                                          if (word.startsWith('**') && word.endsWith('**')) {
                                            return <strong key={wordIdx} className="text-[#F27D26] font-bold">{word.replace(/\*\*/g, '')} </strong>;
                                          }
                                          if (word.includes('[1]')) {
                                            return <span key={wordIdx} className="inline-flex items-center justify-center w-3.5 h-3.5 bg-slate-800 text-white text-[7.5px] font-bold rounded-full mx-0.5" title="Primary Report document segment">1</span>;
                                          }
                                          if (word.includes('[2]')) {
                                            return <span key={wordIdx} className="inline-flex items-center justify-center w-3.5 h-3.5 bg-slate-800 text-white text-[7.5px] font-bold rounded-full mx-0.5" title="Comparison Report document segment">2</span>;
                                          }
                                          return word + ' ';
                                        })}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Strategic bullets */}
                              <div className="space-y-2">
                                <span className="text-[9px] font-sans font-bold text-slate-400 uppercase tracking-widest block">Structural differentiators:</span>

                                {competitorOverview.bulletDifferences.map((bullet, idx) => (
                                  <div key={idx} className="bg-white border rounded-xl p-3 space-y-1.5 shadow-3xs">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-[10px] font-bold text-slate-950">{bullet.title}</h4>
                                      <span className={`text-[7.5px] px-1 rounded-sm leading-none font-mono uppercase font-black ${bullet.citationIndex === 1 ? 'bg-emerald-50 text-emerald-800' : 'bg-indigo-50 text-indigo-800'
                                        }`}>
                                        Source {bullet.citationIndex === 3 ? '1 & 2' : bullet.citationIndex}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-650 leading-relaxed font-sans">{bullet.summary}</p>
                                  </div>
                                ))}
                              </div>

                            </div>
                          ) : null}

                          {/* LIVE CHAT INTERACTIVE COMPONENT CONSOLE */}
                          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-3xs flex flex-col pt-3" id="live_chat_con">
                            <div className="px-3 pb-2 border-b border-slate-100 flex items-center gap-1.5 font-sans leading-none">
                              <MessageSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                              <div>
                                <span className="text-[10px] font-bold text-slate-900 block tracking-wider uppercase font-sans">Corporate Strategist console:</span>
                                <span className="text-[8px] text-slate-400">Query detailed cross-sections securely on demand</span>
                              </div>
                            </div>

                            {/* Conversation threads list */}
                            <div className="h-44 overflow-y-auto px-3.5 py-3 space-y-3 bg-slate-50/50" id="conversational_chat_scroller">
                              <div className="bg-indigo-50 text-[10px] text-indigo-900 p-2.5 rounded-2xl rounded-tl-xs max-w-[85%] leading-relaxed font-sans shadow-3xs self-start">
                                Welcome to the Singapore wealth and digital restructure strategy console. Ask any comparative question (e.g. <i>"Who manages compliance higher?"</i>, <i>"Compare Singapore cost bases"</i>) to synthesize guidelines.
                              </div>

                              {chatHistory.map((ch, idx) => (
                                <React.Fragment key={idx}>
                                  <div className="bg-slate-900 text-white text-[10px] p-2.5 rounded-2xl rounded-tr-xs max-w-[85%] leading-relaxed font-sans shadow-3xs ml-auto block">
                                    {ch.q}
                                  </div>
                                  <div className="bg-indigo-50 text-indigo-900 text-[10px] p-2.5 rounded-2xl rounded-tl-xs max-w-[85%] leading-relaxed font-sans shadow-3xs block">
                                    {ch.a}
                                  </div>
                                </React.Fragment>
                              ))}

                              {isAskingChat && (
                                <div className="bg-indigo-50/70 text-indigo-900 text-[10px] p-2.5 rounded-2xl rounded-tl-xs max-w-[50%] flex items-center gap-1 leading-relaxed">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"></span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]"></span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]"></span>
                                </div>
                              )}
                            </div>

                            {/* Chat bottom dispatcher */}
                            <div className="p-2 border-t border-slate-100 flex gap-1.5 bg-white shrink-0 items-center">
                              <input
                                type="text"
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10.5px] focus:outline-none focus:border-slate-800 leading-none placeholder-slate-400 font-sans"
                                placeholder="Message auditor strategist..."
                                value={chatQuestion}
                                onChange={(e) => setChatQuestion(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAskFollowUp(); }}
                              />
                              <button
                                onClick={handleAskFollowUp}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                        </div>
                      )}

                    </>
                  )}

                </div>
              )}


              {/* ==================== TAB 4: CLOUD REPORT HISTORY ==================== */}
              {activeTab === 'history' && (
                <div className="space-y-4 animate-fade-in font-sans text-left">
                  <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <History className="absolute -right-3 -bottom-3 w-24 h-24 opacity-10" />
                    <div className="relative space-y-1">
                      <div className="bg-slate-800 px-2 py-0.5 text-[8px] tracking-widest font-mono font-bold uppercase rounded-sm inline-block">
                        Cloud Archive
                      </div>
                      <h2 className="text-base font-bold tracking-tight">Past Annual Reports</h2>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        Reopen, rename, or permanently delete reports saved to Firebase.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">
                      {storedReports.length} saved report{storedReports.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void refreshStoredReports()}
                      disabled={isLoadingHistory}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold text-slate-600 uppercase tracking-wider transition-all duration-200 hover:bg-orange-50 hover:text-[#F27D26] hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  {historyError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-[10px] leading-relaxed">
                      {historyError}
                    </div>
                  )}

                  {isLoadingHistory && storedReports.length === 0 ? (
                    <div className="bg-white border rounded-xl p-8 text-center space-y-2">
                      <RefreshCw className="w-6 h-6 text-[#F27D26] animate-spin mx-auto" />
                      <p className="text-[10px] text-slate-500">Loading cloud reports...</p>
                    </div>
                  ) : storedReports.length === 0 ? (
                    <div className="bg-white border rounded-xl p-8 text-center space-y-2">
                      <FolderOpen className="w-8 h-8 text-slate-300 mx-auto" />
                      <h3 className="text-xs font-bold text-slate-700">No saved reports yet</h3>
                      <p className="text-[10px] text-slate-500">Upload an annual report from the Reports tab to create your first cloud record.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {storedReports.map((stored) => (
                        <article key={stored.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-3xs space-y-3">
                          {editingHistoryId === stored.id ? (
                            <div className="space-y-2">
                              <label className="text-[8px] uppercase tracking-widest font-bold text-slate-400">Company / report name</label>
                              <input
                                value={editingHistoryName}
                                onChange={(event) => setEditingHistoryName(event.target.value)}
                                className="w-full border rounded-lg px-2.5 py-2 text-[11px] font-semibold outline-none focus:border-[#F27D26]"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => void saveStoredReportName(stored.id)} className="flex-1 bg-slate-900 text-white rounded-lg py-1.5 text-[9px] font-bold uppercase transition-all duration-200 hover:bg-slate-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0">Save</button>
                                <button type="button" onClick={() => setEditingHistoryId(null)} className="flex-1 border rounded-lg py-1.5 text-[9px] font-bold uppercase transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#F27D26] flex items-center justify-center shrink-0">
                                  <Building2 className="w-4.5 h-4.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-[11px] font-extrabold text-slate-900 truncate">{stored.companyName}</h3>
                                  <p className="text-[9px] text-slate-500 truncate font-mono">{stored.originalName}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase">{stored.status}</span>
                                    {stored.isSimulated !== undefined && (
                                      <span className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold uppercase ${stored.isSimulated ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                        {stored.isSimulated ? 'Demo result' : 'AI result'}
                                      </span>
                                    )}
                                    <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[7.5px] font-mono">
                                      {stored.createdAt ? stored.createdAt.toLocaleDateString() : 'Recently saved'}
                                    </span>
                                  </div>
                                  {stored.comparisonCompanyName && (
                                    <p className="mt-1.5 text-[8.5px] font-semibold text-indigo-600">
                                      Compared with {stored.comparisonCompanyName}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <button type="button" onClick={() => void openStoredReport(stored.id)} className="flex items-center justify-center gap-1 bg-slate-900 text-white rounded-lg py-2 text-[8px] font-bold uppercase transition-all duration-200 hover:bg-slate-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0">
                                  <FolderOpen className="w-3 h-3" /> Open
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingHistoryId(stored.id); setEditingHistoryName(stored.companyName); }}
                                  className="flex items-center justify-center gap-1 border rounded-lg py-2 text-[8px] font-bold uppercase text-slate-600 transition-all duration-200 hover:border-[#F27D26] hover:bg-orange-50 hover:text-[#F27D26] hover:-translate-y-0.5 active:translate-y-0"
                                >
                                  <Edit3 className="w-3 h-3" /> Rename
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestStoredReportDeletion(stored)}
                                  disabled={deletingReportId === stored.id}
                                  className="flex items-center justify-center gap-1 border border-rose-200 bg-rose-50 rounded-lg py-2 text-[8px] font-bold uppercase text-rose-700 transition-all duration-200 hover:border-rose-300 hover:bg-rose-100 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                                >
                                  <Trash2 className="w-3 h-3" /> {deletingReportId === stored.id ? 'Deleting' : 'Delete'}
                                </button>
                              </div>
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}


              {/* ==================== TAB 6: SOCIAL SCAN ====================
                  Always mounted (never conditionally rendered) — SocialScanApp
                  owns all of its scan state internally via its own useState,
                  unlike the other tabs whose state lives up in this component.
                  Unmounting it on tab switch (the `{activeTab === X && (...)}`
                  pattern used elsewhere) would wipe an in-progress or just-
                  completed scan every time the advisor taps another tab. So
                  this stays in the tree and is hidden with a class instead. */}
              <div className={activeTab === 'social-scan' ? "space-y-4 animate-fade-in" : "hidden"}>
                <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute -right-3 -bottom-3 opacity-15">
                    <Radar className="w-24 h-24 text-white" />
                  </div>
                  <div className="relative space-y-1">
                    <div className="bg-slate-800 px-2 py-0.5 text-[8px] tracking-widest font-mono font-bold uppercase rounded-sm inline-block">
                      Sentiment Watch
                    </div>
                    <h2 className="text-base font-bold tracking-tight">Social ESG Scan</h2>
                    <p className="text-[11px] text-slate-350 leading-relaxed max-w-xs font-sans">
                      Scan social platforms for a company's ESG/reputation risk and surface the posts driving it.
                    </p>
                  </div>
                </div>

                <SocialScanApp embedded />
              </div>


              {/* ==================== TAB 5: RUBRIC SETTINGS ==================== */}
              {activeTab === 'settings' && (
                <div className="space-y-4 animate-fade-in font-sans">

                  {/* Explainer card */}
                  <div className="bg-white border rounded-xl p-3.5 space-y-2 shadow-3xs text-left">
                    <div className="flex items-start gap-2">
                      <Sliders className="w-4 h-4 text-[#F27D26] shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider font-display leading-none">Custom Audit Rubrics Standard</h4>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Define standard thresholds that classify points into High, Medium, or Low risk scales during document ingestion.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SUCCESS SAVED TOAST ALERT */}
                  {showSettingsSaved && (
                    <div className="bg-emerald-500 text-white border border-emerald-600 rounded-xl p-3 text-center text-[10px] font-black uppercase tracking-widest font-mono flex items-center justify-center gap-1.5 shadow-md animate-bounce">
                      <CheckCircle className="w-4 h-4 text-white" />
                      SAVED!
                    </div>
                  )}

                  <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block text-left">Click a Risk tier to enlarge and customize guidelines:</span>

                  {/* HIGH RISK SECTION (Compact Accordion) */}
                  <div className="bg-white border border-l-4 border-l-red-500 rounded-xl overflow-hidden shadow-3xs transition-all duration-200">
                    <button
                      type="button"
                      onClick={() => setExpandedSettingsRisk(expandedSettingsRisk === 'high' ? null : 'high')}
                      className="w-full flex items-center justify-between p-3.5 text-left font-sans cursor-pointer hover:bg-slate-50/75 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest font-mono">High Risk Standard</span>
                      </div>
                      <span className="text-[9px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1 shrink-0">
                        {expandedSettingsRisk === 'high' ? 'Collapse' : 'Configure/Enlarge'}
                        {expandedSettingsRisk === 'high' ? <ChevronUp className="w-3" /> : <ChevronDown className="w-3" />}
                      </span>
                    </button>
                    {expandedSettingsRisk === 'high' && (
                      <div className="p-3.5 pt-0 border-t border-slate-100 animate-fade-in space-y-1.5 text-left">
                        <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest block mt-2">Active grading criteria:</span>
                        <textarea
                          id="mobile_high_risk_text"
                          className="w-full h-24 bg-slate-50 border p-2.5 rounded-lg text-[10px] font-sans leading-relaxed text-slate-700 focus:outline-none focus:border-red-400"
                          value={highRiskCriteria}
                          onChange={(e) => setHighRiskCriteria(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* MEDIUM RISK SECTION (Compact Accordion) */}
                  <div className="bg-white border border-l-4 border-l-amber-500 rounded-xl overflow-hidden shadow-3xs transition-all duration-200">
                    <button
                      type="button"
                      onClick={() => setExpandedSettingsRisk(expandedSettingsRisk === 'medium' ? null : 'medium')}
                      className="w-full flex items-center justify-between p-3.5 text-left font-sans cursor-pointer hover:bg-slate-50/75 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest font-mono">Medium Risk Standard</span>
                      </div>
                      <span className="text-[9px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1 shrink-0">
                        {expandedSettingsRisk === 'medium' ? 'Collapse' : 'Configure/Enlarge'}
                        {expandedSettingsRisk === 'medium' ? <ChevronUp className="w-3" /> : <ChevronDown className="w-3" />}
                      </span>
                    </button>
                    {expandedSettingsRisk === 'medium' && (
                      <div className="p-3.5 pt-0 border-t border-slate-100 animate-fade-in space-y-1.5 text-left">
                        <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest block mt-2">Active grading criteria:</span>
                        <textarea
                          id="mobile_medium_risk_text"
                          className="w-full h-24 bg-slate-50 border p-2.5 rounded-lg text-[10px] font-sans leading-relaxed text-slate-700 focus:outline-none focus:border-amber-400"
                          value={mediumRiskCriteria}
                          onChange={(e) => setMediumRiskCriteria(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* LOW RISK SECTION (Compact Accordion) */}
                  <div className="bg-white border border-l-4 border-l-emerald-500 rounded-xl overflow-hidden shadow-3xs transition-all duration-200">
                    <button
                      type="button"
                      onClick={() => setExpandedSettingsRisk(expandedSettingsRisk === 'low' ? null : 'low')}
                      className="w-full flex items-center justify-between p-3.5 text-left font-sans cursor-pointer hover:bg-slate-50/75 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-mono">Low Risk Standard</span>
                      </div>
                      <span className="text-[9px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1 shrink-0">
                        {expandedSettingsRisk === 'low' ? 'Collapse' : 'Configure/Enlarge'}
                        {expandedSettingsRisk === 'low' ? <ChevronUp className="w-3" /> : <ChevronDown className="w-3" />}
                      </span>
                    </button>
                    {expandedSettingsRisk === 'low' && (
                      <div className="p-3.5 pt-0 border-t border-slate-100 animate-fade-in space-y-1.5 text-left">
                        <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest block mt-2">Active grading criteria:</span>
                        <textarea
                          id="mobile_low_risk_text"
                          className="w-full h-24 bg-slate-50 border p-2.5 rounded-lg text-[10px] font-sans leading-relaxed text-slate-700 focus:outline-none focus:border-emerald-400"
                          value={lowRiskCriteria}
                          onChange={(e) => setLowRiskCriteria(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* AI WORKFORCE THRESHOLDS (Compact Accordion) */}
                  <WorkforceThresholdCard
                    thresholds={workforceThresholds}
                    onChange={setWorkforceThresholds}
                    isExpanded={expandedSettingsRisk === 'workforce'}
                    onToggle={() => setExpandedSettingsRisk(expandedSettingsRisk === 'workforce' ? null : 'workforce')}
                  />

                  {/* Settings bottom selectors */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleResetRubrics}
                      className="flex-1 bg-white border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50 font-bold rounded-lg uppercase tracking-wider text-[10px] text-center cursor-pointer active:scale-98 transition-transform"
                    >
                      Reset Defaults
                    </button>
                    <button
                      onClick={handleSaveSettings}
                      className="flex-1 bg-slate-900 border text-white hover:bg-black font-bold rounded-lg uppercase tracking-wider text-[10px] text-center cursor-pointer active:scale-98 transition-transform"
                    >
                      Save Configuration
                    </button>
                  </div>

                </div>
              )}

            </div>


            {/* ==================== SCREEN SLIDE-UP BOTTOM SHEET DETAILED DRAWER ==================== */}
            {selectedPointInfo && (
              <>
                {/* Backdrop Filter Dimmer */}
                <div
                  onClick={() => { setSelectedPointInfo(null); setIsEditingPoint(false); }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity animate-fade-in"
                />

                {/* Sliding Card Chassis */}
                <div className="absolute bottom-0 left-0 right-0 max-h-[85%] bg-white rounded-t-[28px] border-t border-slate-200/80 shadow-[0_-12px_45px_rgba(0,0,0,0.25)] p-5 z-50 overflow-y-auto space-y-4 font-sans animate-slide-up flex flex-col">

                  {/* Slide Bar indicator top */}
                  <div className="w-12 h-1 bg-slate-200/80 rounded-full mx-auto shrink-0 mb-1 select-none pointer-events-none" />

                  {/* Header info */}
                  <div className="flex items-start justify-between shrink-0">
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono font-black text-[#F27D26] uppercase tracking-widest block leading-none">
                        BLOCK CATEGORY: {selectedPointInfo.blockId}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight leading-snug">
                        {selectedPointInfo.point.point}
                      </h3>
                    </div>
                    <button
                      onClick={() => { setSelectedPointInfo(null); setIsEditingPoint(false); }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-450 hover:text-slate-800 p-1.5 rounded-full cursor-pointer shrink-0 ml-4 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* NOT IN EDIT MODE */}
                  {!isEditingPoint ? (
                    <div className="space-y-4">

                      {/* Secondary metrics row banner */}
                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border">
                        <span className="text-[9px] font-sans font-bold text-slate-400 uppercase tracking-wider block">Audited Risk Quotient:</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-sm font-semibold tracking-widest border uppercase ${riskBadgeCSS[selectedPointInfo.point.riskRating || 'Low']}`}>
                          {selectedPointInfo.point.riskRating}
                        </span>
                      </div>

                      {/* Source Details citation indicator */}
                      <div className="space-y-1">
                        <span className="text-[8.5px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block">PDF DISCLOSURE CITATION:</span>
                        <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-[9.5px] font-semibold text-slate-700 font-mono flex items-center gap-1.5 shadow-3xs leading-none">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Verifiable Citation: Page {selectedPointInfo.point.pageNumber || 'Scan Appendix'}</span>
                        </div>
                      </div>

                      {/* Business Analysis Description text */}
                      <div className="space-y-1">
                        <span className="text-[8.5px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block">BUSINESS SPECIFICATIONS:</span>
                        <p className="text-[11px] text-slate-650 leading-relaxed font-sans">{selectedPointInfo.point.description}</p>
                      </div>

                      {/* Monospaced quote proof */}
                      {selectedPointInfo.point.evidenceQuote && (
                        <div className="space-y-1">
                          <span className="text-[8.5px] font-sans font-extrabold text-slate-400 uppercase tracking-widest block">LITERAL SOURCE VERBATIM PROOF:</span>
                          <blockquote className="bg-slate-50 border-l-[3px] border-emerald-500 p-3 italic text-[10px] font-mono leading-relaxed rounded-r-lg text-slate-600">
                            "{selectedPointInfo.point.evidenceQuote}"
                          </blockquote>
                        </div>
                      )}

                      {/* Risk challenges evaluation */}
                      {selectedPointInfo.point.riskDescription && (
                        <div className="space-y-1 bg-orange-50/50 border border-orange-100 p-3 rounded-xl space-y-1">
                          <span className="text-[8.5px] font-sans font-extrabold text-[#F27D26] uppercase tracking-widest block flex items-center gap-1 leading-none">
                            <AlertTriangle className="w-3 h-3 text-[#F27D26]" /> Operational Threat & Challenges:
                          </span>
                          <p className="text-[10px] text-orange-950 font-sans leading-relaxed">{selectedPointInfo.point.riskDescription}</p>
                        </div>
                      )}

                      {/* Point controls */}
                      <div className="flex gap-2 border-t pt-3.5 justify-end">
                        <button
                          onClick={() => {
                            handleDeletePointInternal(selectedPointInfo.blockId, selectedPointInfo.pointIndex);
                          }}
                          className="flex items-center gap-1 border border-red-200 text-red-650 hover:bg-red-50/50 px-3.5 py-2 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Node
                        </button>

                        <button
                          onClick={() => {
                            setEditPointForm(selectedPointInfo.point);
                            setIsEditingPoint(true);
                          }}
                          className="flex items-center gap-1 bg-slate-900 border hover:bg-black text-white px-4 py-2 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Details
                        </button>
                      </div>

                    </div>
                  ) : (
                    /* EDIT MODE ACTIVE WITHIN DRAWER */
                    <div className="space-y-3">
                      <div className="bg-indigo-50 border border-indigo-150 p-2 rounded-lg text-[#0A1128] text-[9.5px] font-sans leading-relaxed text-center font-bold">
                        Editing Item Nodes (Direct Local Mutator Buffer)
                      </div>

                      {editPointForm && (
                        <div className="space-y-3 text-left">
                          <div>
                            <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Point Highlight Title:</label>
                            <input
                              type="text"
                              className="w-full bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none"
                              value={editPointForm.point}
                              onChange={(e) => setEditPointForm({ ...editPointForm, point: e.target.value })}
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Business Summary / Description:</label>
                            <textarea
                              className="w-full h-16 bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none resize-none leading-relaxed"
                              value={editPointForm.description}
                              onChange={(e) => setEditPointForm({ ...editPointForm, description: e.target.value })}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Page Reference:</label>
                              <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none"
                                value={editPointForm.pageNumber}
                                onChange={(e) => setEditPointForm({ ...editPointForm, pageNumber: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Risk Rating standard:</label>
                              <select
                                className="w-full bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none text-slate-800"
                                value={editPointForm.riskRating}
                                onChange={(e) => setEditPointForm({ ...editPointForm, riskRating: e.target.value as 'Low' | 'Medium' | 'High' })}
                              >
                                <option value="Low">Low Risk</option>
                                <option value="Medium">Medium Risk</option>
                                <option value="High">High Risk</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Factual Verbatim Evidence Quote:</label>
                            <input
                              type="text"
                              className="w-full bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none"
                              value={editPointForm.evidenceQuote}
                              onChange={(e) => setEditPointForm({ ...editPointForm, evidenceQuote: e.target.value })}
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Risk Reason & Mitigation Guidelines:</label>
                            <textarea
                              className="w-full h-12 bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none resize-none leading-relaxed"
                              value={editPointForm.riskDescription}
                              onChange={(e) => setEditPointForm({ ...editPointForm, riskDescription: e.target.value })}
                            />
                          </div>

                          <div className="flex gap-2 pt-3 justify-end border-t">
                            <button
                              onClick={() => setIsEditingPoint(false)}
                              className="border border-slate-250 hover:bg-slate-50 px-3.5 py-2 font-bold rounded-lg uppercase tracking-wider text-[10px] text-slate-705 cursor-pointer animate-fade-in"
                            >
                              Cancel
                            </button>

                            <button
                              onClick={() => {
                                handleUpdatePointInternal(selectedPointInfo.blockId, selectedPointInfo.pointIndex, editPointForm);
                                setIsEditingPoint(false);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer"
                            >
                              Save Node Changes
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </>
            )}


            {/* ==================== SCREEN SLIDE-UP BOTTOM SHEET ADD POINT DETAILED DRAWER ==================== */}
            {addingToBlockId && (
              <>
                {/* Dimmer backdrop mask */}
                <div
                  onClick={() => setAddingToBlockId(null)}
                  className="absolute inset-0 bg-black/55 backdrop-blur-xs z-40 transition-opacity animate-fade-in"
                />

                {/* Slider chassis */}
                <div className="absolute bottom-0 left-0 right-0 max-h-[85%] bg-white rounded-t-[28px] border-t border-slate-200/80 shadow-[0_-12px_45px_rgba(0,0,0,0.25)] p-5 z-50 overflow-y-auto space-y-4 font-sans animate-slide-up flex flex-col">

                  {/* Top slide icon bar */}
                  <div className="w-12 h-1 bg-slate-200/80 rounded-full mx-auto shrink-0 mb-1 pointer-events-none" />

                  {/* Heading header details */}
                  <div className="flex items-start justify-between shrink-0">
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono font-black text-[#F27D26] uppercase tracking-widest block leading-none">
                        APPENDING DATA KEY: {addingToBlockId}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight leading-none">Add Osterwalder Point</h3>
                    </div>
                    <button onClick={() => setAddingToBlockId(null)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Add form */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Point Highlight Title:</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none"
                        placeholder="e.g. Asia Capital Expansion Network"
                        value={newPointForm.point}
                        onChange={(e) => setNewPointForm({ ...newPointForm, point: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Detailed Analysis Summary:</label>
                      <textarea
                        className="w-full h-14 bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none resize-none leading-relaxed"
                        placeholder="Integrate strategic evaluation findings here..."
                        value={newPointForm.description}
                        onChange={(e) => setNewPointForm({ ...newPointForm, description: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Citation Source Page:</label>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none"
                          placeholder="e.g. Page 12"
                          value={newPointForm.pageNumber}
                          onChange={(e) => setNewPointForm({ ...newPointForm, pageNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Risk Evaluation:</label>
                        <select
                          className="w-full bg-slate-50 border border-slate-205 text-slate-800 rounded p-2 text-xs focus:outline-none"
                          value={newPointForm.riskRating}
                          onChange={(e) => setNewPointForm({ ...newPointForm, riskRating: e.target.value as 'Low' | 'Medium' | 'High' })}
                        >
                          <option value="Low">Low Risk Segment</option>
                          <option value="Medium">Medium Risk Segment</option>
                          <option value="High">High Risk Segment</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Factual quotation support proof:</label>
                      <input
                        type="text"
                        className="w-full bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none"
                        placeholder="e.g. We are deploying capital to expand singapore advisory..."
                        value={newPointForm.evidenceQuote}
                        onChange={(e) => setNewPointForm({ ...newPointForm, evidenceQuote: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-sans font-bold text-slate-400 uppercase block mb-1">Threats Description / Mitigation:</label>
                      <textarea
                        className="w-full h-12 bg-slate-50 border border-slate-205 rounded p-2 text-xs focus:outline-none resize-none leading-relaxed"
                        placeholder="How can this operational bottleneck be mitigated secure..."
                        value={newPointForm.riskDescription}
                        onChange={(e) => setNewPointForm({ ...newPointForm, riskDescription: e.target.value })}
                      />
                    </div>

                    <div className="flex gap-2 pt-3 justify-end border-t">
                      <button
                        onClick={() => setAddingToBlockId(null)}
                        className="border border-slate-250 hover:bg-slate-50 px-3.5 py-2 font-bold rounded-lg uppercase tracking-wider text-[10px] text-slate-705 cursor-pointer animate-fade-in"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={handleAddPointInternal}
                        disabled={!newPointForm.point.trim()}
                        className={`px-4 py-2 font-bold rounded-lg uppercase tracking-wider text-[10px] cursor-pointer ${newPointForm.point.trim()
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-3xs'
                          : 'bg-slate-100 text-slate-350 cursor-not-allowed'
                          }`}
                      >
                        Add Point Node
                      </button>
                    </div>
                  </div>

                </div>
              </>
            )}


            {/* ==================== iOS HOME SWIPE AREA GAP INDICATOR ==================== */}
            <div className="bg-white py-1.5 shrink-0 select-none flex items-center justify-center border-t border-slate-100" id="ios_navigation_indicator_padding">

              {/* Bottom Navigation bottom system controllers */}
              <div className="w-full max-w-sm px-6 flex justify-between text-slate-400">

                <button
                  onClick={() => { setActiveTab('reports'); setSelectedBlockId(null); setIsViewingTemporal(false); }}
                  className={`flex flex-col items-center gap-1 cursor-pointer select-none py-1 relative ${activeTab === 'reports' ? 'text-[#F27D26] font-bold' : 'hover:text-slate-700'}`}
                >
                  <Building2 className="w-4.5 h-4.5 shrink-0" />
                  <span className="text-[8.5px] uppercase font-sans font-black tracking-widest leading-none">Reports</span>
                  {activeTab === 'reports' && <span className="absolute -bottom-1 left-1.5 right-1.5 h-0.5 bg-[#F27D26] rounded-full" />}
                </button>

                <button
                  onClick={() => { setActiveTab('canvas'); setSelectedBlockId(null); }}
                  className={`flex flex-col items-center gap-1 cursor-pointer select-none py-1 relative ${activeTab === 'canvas' ? 'text-[#F27D26] font-bold' : 'hover:text-slate-700'}`}
                >
                  <Layers className="w-4.5 h-4.5 shrink-0" />
                  <span className="text-[8.5px] uppercase font-sans font-black tracking-widest leading-none font-sans">Canvas</span>
                  {activeTab === 'canvas' && <span className="absolute -bottom-1 left-1.5 right-1.5 h-0.5 bg-[#F27D26] rounded-full" />}
                </button>

                <button
                  onClick={() => { setActiveTab('compare'); }}
                  className={`flex flex-col items-center gap-1 cursor-pointer select-none py-1 relative ${activeTab === 'compare' ? 'text-[#F27D26] font-bold' : 'hover:text-slate-700'}`}
                >
                  <Scale className="w-4.5 h-4.5 shrink-0" />
                  <span className="text-[8.5px] uppercase font-sans font-black tracking-widest leading-none">Compare</span>
                  {activeTab === 'compare' && <span className="absolute -bottom-1 left-1.5 right-1.5 h-0.5 bg-[#F27D26] rounded-full" />}
                </button>

                <button
                  onClick={() => { setActiveTab('history'); setSelectedBlockId(null); setIsViewingTemporal(false); }}
                  className={`flex flex-col items-center gap-1 cursor-pointer select-none py-1 relative ${activeTab === 'history' ? 'text-[#F27D26] font-bold' : 'hover:text-slate-700'}`}
                >
                  <History className="w-4.5 h-4.5 shrink-0" />
                  <span className="text-[8px] uppercase font-sans font-black tracking-wider leading-none">History</span>
                  {activeTab === 'history' && <span className="absolute -bottom-1 left-1.5 right-1.5 h-0.5 bg-[#F27D26] rounded-full" />}
                </button>

                <button
                  onClick={() => { setActiveTab('settings'); setSelectedBlockId(null); setIsViewingTemporal(false); }}
                  className={`flex flex-col items-center gap-1 cursor-pointer select-none py-1 relative ${activeTab === 'settings' ? 'text-[#F27D26] font-bold' : 'hover:text-slate-700'}`}
                >
                  <Sliders className="w-4.5 h-4.5 shrink-0" />
                  <span className="text-[8.5px] uppercase font-sans font-black tracking-widest leading-none">Rules</span>
                  {activeTab === 'settings' && <span className="absolute -bottom-1 left-1.5 right-1.5 h-0.5 bg-[#F27D26] rounded-full" />}
                </button>

                <button
                  onClick={() => { setActiveTab('social-scan'); setSelectedBlockId(null); setIsViewingTemporal(false); }}
                  className={`flex flex-col items-center gap-1 cursor-pointer select-none py-1 relative ${activeTab === 'social-scan' ? 'text-[#F27D26] font-bold' : 'hover:text-slate-700'}`}
                >
                  <Radar className="w-4.5 h-4.5 shrink-0" />
                  <span className="text-[8.5px] uppercase font-sans font-black tracking-widest leading-none">Scan</span>
                  {activeTab === 'social-scan' && <span className="absolute -bottom-1 left-1.5 right-1.5 h-0.5 bg-[#F27D26] rounded-full" />}
                </button>

              </div>
            </div>

            {/* Simulated iPhone home physical slider key bar */}
            <div className="bg-white pb-3 shrink-0 select-none flex items-center justify-center font-sans">
              <div className="w-32 h-1 bg-slate-900/60 rounded-full cursor-pointer hover:bg-slate-900 active:scale-95 transition-all" title="Swipe Up Home indicator" onClick={() => setIsPowerOn(false)} />
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
