import type { ClaimData } from '@/types/claim';
import type {
  InsuredReportDraft,
  InsuredReportLanguage,
  InsuredReportPolicyClause,
  InsuredReportLineExplanation,
  InsuredReportStage,
} from '@/types/insured-report';
import { callAIGateway } from './service';
import { buildPolicyAnalysisPrompt, buildLineExplanationPrompt } from './prompts';
import { getIRDAIStandardClauses, getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { computeInsuredFinancialSummary } from '@/lib/calculations/insured-report';

interface GenerateInsuredReportParams {
  claim: ClaimData;
  stage: InsuredReportStage;
  language: InsuredReportLanguage;
  /** Base64 images of policy PDF pages (if available). Empty = use IRDAI fallback. */
  policyImages: string[];
  onProgress?: (message: string) => void;
}

/**
 * Runs the two-pass AI pipeline to generate an InsuredReportDraft.
 * Pass 1: Policy clause extraction (or IRDAI fallback).
 * Pass 2: Per-row plain-language explanations.
 * Financial summary is computed deterministically (no AI).
 */
export async function generateInsuredReport({
  claim,
  stage,
  language,
  policyImages,
  onProgress,
}: GenerateInsuredReportParams): Promise<InsuredReportDraft> {
  const ageMonths = getVehicleAgeMonths(
    claim.vehicle.dateOfRegistration || null,
    claim.vehicle.yearOfManufacture ? Number(claim.vehicle.yearOfManufacture) : null,
    claim.accident.dateAndTime || null,
  );

  // ── Pass 1: Policy Analysis ───────────────────────────────────────────────
  onProgress?.('Analyzing policy document…');
  let policyMappings: InsuredReportPolicyClause[];

  if (policyImages.length > 0) {
    try {
      const prompt = buildPolicyAnalysisPrompt(language);
      const raw = await callAIGateway(prompt, policyImages);
      const parsed = JSON.parse(raw) as { clauses: Omit<InsuredReportPolicyClause, 'source'>[] };
      policyMappings = (parsed.clauses ?? []).map(c => ({ ...c, source: 'policy-pdf' as const }));
    } catch {
      policyMappings = getIRDAIStandardClauses();
    }
  } else {
    policyMappings = getIRDAIStandardClauses();
  }

  // ── Pass 2: Line Item Explanations ────────────────────────────────────────
  onProgress?.('Processing line items…');

  const relevantRows = claim.assessmentRows.filter(
    r => !r.allowed || r.action === 'disallow' || r.isDisposal ||
      ((r.billedAmount ?? 0) > r.assessed) ||
      (r.section === 'parts' && r.allowed && r.estimated > r.assessed)
  );

  const rowInput = relevantRows.map(r => ({
    id: r.id,
    particulars: r.particulars,
    section: r.section,
    estimated: r.estimated,
    assessed: r.assessed,
    billedAmount: r.billedAmount ?? 0,
    allowed: r.allowed,
    action: r.action ?? '',
    remarks: r.remarks ?? '',
    billRemarks: r.billRemarks ?? '',
    isDisposal: r.isDisposal ?? false,
    partType: r.partType,
  }));

  let lineExplanations: InsuredReportLineExplanation[] = [];

  if (rowInput.length > 0) {
    try {
      const prompt = buildLineExplanationPrompt(language, JSON.stringify(rowInput));
      const raw = await callAIGateway(prompt, []);
      const parsed = JSON.parse(raw) as Array<{
        assessmentRowId: string;
        aiExplanation: string;
        deductionCategory: InsuredReportLineExplanation['deductionCategory'];
        isFlagged: boolean;
      }>;
      if (!Array.isArray(parsed)) throw new Error('AI returned non-array for line explanations');

      lineExplanations = parsed.map(item => {
        const sourceRow = claim.assessmentRows.find(r => r.id === item.assessmentRowId);
        return {
          assessmentRowId: item.assessmentRowId,
          partDescription: sourceRow?.particulars ?? item.assessmentRowId,
          surveyorRemarks: sourceRow?.remarks ?? sourceRow?.billRemarks ?? '',
          aiExplanation: item.aiExplanation ?? '',
          deductionCategory: item.deductionCategory ?? 'not-covered',
          surveyorAmount: sourceRow?.assessed ?? 0,
          billedAmount: sourceRow?.billedAmount ?? sourceRow?.estimated ?? 0,
          isFlagged: item.isFlagged ?? false,
        };
      });
    } catch {
      lineExplanations = relevantRows.map(r => ({
        assessmentRowId: r.id,
        partDescription: r.particulars,
        surveyorRemarks: r.remarks ?? '',
        aiExplanation: '',
        deductionCategory: 'not-covered' as const,
        surveyorAmount: r.assessed,
        billedAmount: r.billedAmount ?? r.estimated,
        isFlagged: true,
      }));
    }
  }

  // ── Financial Summary (deterministic, no AI) ─────────────────────────────
  const financialSummary = computeInsuredFinancialSummary(claim, ageMonths);

  return {
    generatedAt: new Date().toISOString(),
    stage,
    language,
    isSurveyorApproved: false,
    financialSummary,
    policyMappings,
    lineExplanations,
  };
}
