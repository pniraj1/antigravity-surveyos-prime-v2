import type { ClaimData } from '@/types/claim';
import type {
  InsuredReportDraft,
  InsuredReportLanguage,
  InsuredReportPolicyClause,
  InsuredReportLineExplanation,
  InsuredReportStage,
  PolicyAnalysisResult,
  AssessmentAnalysisResult,
  SurveyorAnswers,
} from '@/types/insured-report';
import type { DeductionCategory } from '@/lib/constants/deduction-categories';
import { callAIGateway } from './service';
import {
  buildPolicyAnalysisPrompt,
  buildLineExplanationPrompt,
  buildCoveringNarrativePrompt,
  type PolicyContextSummary,
} from './prompts';
import { getIRDAIStandardClauses, getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { computeInsuredFinancialSummary } from '@/lib/calculations/insured-report';

// ─── Gate: returns rows that block report generation ─────────────────────────
// Rules: block when the deduction reason CANNOT be inferred from data alone.
// 1. Disallowed rows with no remarks — surveyor must document why.
// 2. ZeroDep policy + parts reduced with no remarks — cannot assume depreciation.
// Always call this BEFORE generateInsuredReport. If length > 0, show the gate UI.
export function getBlockingRows(
  claim: ClaimData,
  zeroDep: boolean,
): Array<{ id: string; particulars: string; billed: number; assessed: number; reason: string }> {
  return (claim.assessmentRows ?? []).filter(row => {
    const hasRemark = (row.remarks ?? '').trim().length > 0;
    if (hasRemark) return false; // A remark always satisfies the gate
    const billed = row.billedTaxable ?? row.estimated;
    // Rule 1: explicitly disallowed with no explanation
    if (!row.allowed || row.action === 'disallow') return true;
    // Rule 2: zeroDep policy — a parts reduction cannot be depreciation
    if (zeroDep && row.section === 'parts' && row.assessed < billed) return true;
    return false;
  }).map(row => ({
    id: row.id,
    particulars: row.particulars,
    billed: row.billedTaxable ?? row.estimated,
    assessed: row.assessed,
    reason: (!row.allowed || row.action === 'disallow')
      ? 'Item disallowed — reason not documented'
      : 'Zero-Dep policy: parts reduction reason not documented',
  }));
}

// ─── Pre-classifier: deterministic explanations for unambiguous rows ──────────
// These rows do NOT need the AI — the category and explanation are certain.
// Returning them here removes them from the AI call, reducing token usage.
export function buildPreClassifiedExplanations(
  claim: ClaimData,
  zeroDep: boolean,
): InsuredReportLineExplanation[] {
  const results: InsuredReportLineExplanation[] = [];
  for (const row of claim.assessmentRows ?? []) {
    const billed = row.billedTaxable ?? row.estimated;
    const delta = Math.abs(billed - row.assessed);

    // Surveyor-tagged row: use tag category verbatim — skip AI entirely
    if (row.deductionCategory) {
      results.push({
        assessmentRowId: row.id,
        partDescription: row.particulars,
        surveyorRemarks: row.remarks ?? '',
        aiExplanation: row.remarks?.trim()
          ? row.remarks
          : `Surveyor classified this item as: ${row.deductionCategory}.`,
        deductionCategory: row.deductionCategory,
        surveyorAmount: row.assessed,
        billedAmount: billed,
        isFlagged: false,
      });
      continue;
    }

    // Standard depreciation: allowed parts with a reduction, no manual override, not disposal
    // Pre-classified deterministically — never sent to AI, never shown in Line Items
    if (
      row.section === 'parts' &&
      row.allowed &&
      row.action !== 'disallow' &&
      !row.depOverride &&
      !row.isDisposal &&
      delta > 0
    ) {
      results.push({
        assessmentRowId: row.id,
        partDescription: row.particulars,
        surveyorRemarks: row.remarks ?? '',
        aiExplanation: '', // blank — Financial tab breakdown handles this, not Line Items
        deductionCategory: 'depreciation' as DeductionCategory,
        surveyorAmount: row.assessed,
        billedAmount: billed,
        isFlagged: false,
      });
      continue;
    }

    // Safe: allowed, no meaningful adjustment
    if (row.allowed && delta < 1) {
      results.push({
        assessmentRowId: row.id,
        partDescription: row.particulars,
        surveyorRemarks: row.remarks ?? '',
        aiExplanation: 'This item was inspected and found safe — no replacement or adjustment was required.',
        deductionCategory: 'safe' as DeductionCategory,
        surveyorAmount: row.assessed,
        billedAmount: billed,
        isFlagged: false,
      });
      continue;
    }

    // Disposal / salvage: marked explicitly
    if (row.isDisposal) {
      results.push({
        assessmentRowId: row.id,
        partDescription: row.particulars,
        surveyorRemarks: row.remarks ?? '',
        aiExplanation:
          `${row.particulars} was replaced. The salvage / scrap value of the old part ` +
          `(₹${row.assessed.toLocaleString('en-IN')}) has been deducted from the payable amount.`,
        deductionCategory: 'salvage' as DeductionCategory,
        surveyorAmount: row.assessed,
        billedAmount: billed,
        isFlagged: false,
      });
      continue;
    }
  }
  return results;
}

// ─── Honest fallback: for rows the AI still flags ─────────────────────────────
// Never leave aiExplanation blank. Reference actual ₹ amounts so the insured
// understands exactly what was adjusted, even without a documented reason.
function buildHonestFallback(row: InsuredReportLineExplanation): string {
  const billed = row.billedAmount.toLocaleString('en-IN');
  const assessed = row.surveyorAmount.toLocaleString('en-IN');
  if (row.surveyorAmount === row.billedAmount) {
    return `${row.partDescription} was assessed and no adjustment was required.`;
  }
  return (
    `The surveyor assessed "${row.partDescription}" at ₹${assessed} against the workshop ` +
    `bill of ₹${billed}. The specific reason for this adjustment was not documented in the ` +
    `survey notes — please contact your surveyor for a detailed explanation.`
  );
}

// ─── Stage 1: Policy Analysis ─────────────────────────────────────────────────
export async function runPolicyAnalysis({
  claim,
  language,
  policyImages,
  onProgress,
}: {
  claim: ClaimData;
  language: InsuredReportLanguage;
  policyImages: string[];
  onProgress?: (msg: string) => void;
}): Promise<PolicyAnalysisResult> {
  onProgress?.('Analysing policy document…');
  let policyMappings: InsuredReportPolicyClause[];

  if (policyImages.length > 0) {
    try {
      const prompt = buildPolicyAnalysisPrompt(language);
      const raw = await callAIGateway(prompt, policyImages);
      const parsed = JSON.parse(raw) as { clauses: Omit<InsuredReportPolicyClause, 'source'>[] };
      policyMappings = (parsed.clauses ?? []).map(c => ({ ...c, source: 'policy-pdf' as const }));
      if (policyMappings.length === 0) policyMappings = getIRDAIStandardClauses();
    } catch {
      onProgress?.('Policy AI unavailable — using IRDAI standard clauses.');
      policyMappings = getIRDAIStandardClauses();
    }
  } else {
    policyMappings = getIRDAIStandardClauses();
  }

  const policyContext = derivePolicyContext(policyMappings, claim);

  return {
    completedAt: new Date().toISOString(),
    clauses: policyMappings,
    source: policyImages.length > 0 ? 'policy-pdf' : 'irdai-standard',
    policyContext,
  };
}

// ─── Stage 2: Assessment Analysis ────────────────────────────────────────────
export async function runAssessmentAnalysis({
  claim,
  language,
  policyAnalysis,
  onProgress,
}: {
  claim: ClaimData;
  language: InsuredReportLanguage;
  policyAnalysis: PolicyAnalysisResult;
  onProgress?: (msg: string) => void;
}): Promise<AssessmentAnalysisResult> {
  onProgress?.('Processing line items…');

  const { policyContext } = policyAnalysis;
  const preClassified = buildPreClassifiedExplanations(claim, policyContext.zeroDep);
  const preClassifiedIds = new Set(preClassified.map(e => e.assessmentRowId));

  const relevantRows = (claim.assessmentRows ?? []).filter(
    r =>
      !preClassifiedIds.has(r.id) &&
      (!r.allowed || r.action === 'disallow' || (r.billedTaxable ?? r.estimated) > r.assessed),
  );

  const accidentContext = [claim.accident?.causeOfAccident, claim.accident?.placeOfAccident]
    .filter(Boolean)
    .join(', ');

  const rowInput = relevantRows.map(r => ({
    id: r.id,
    particulars: r.particulars,
    section: r.section,
    estimated: r.estimated,
    assessed: r.assessed,
    billedAmount: r.billedTaxable ?? r.estimated,
    allowed: r.allowed,
    action: r.action ?? '',
    remarks: r.remarks ?? '',
    billRemarks: r.billRemarks ?? '',
    isDisposal: r.isDisposal ?? false,
    partType: r.partType,
  }));

  let lineExplanations: InsuredReportLineExplanation[] = [...preClassified];

  if (rowInput.length > 0) {
    try {
      const prompt = buildLineExplanationPrompt(
        language,
        JSON.stringify(rowInput),
        policyContext,
        accidentContext || undefined,
      );
      const raw = await callAIGateway(prompt, []);
      let parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) && Array.isArray(parsed?.items)) parsed = parsed.items;
      if (!Array.isArray(parsed)) throw new Error(`Unexpected AI format: ${typeof parsed}`);

      const aiExplanations = (
        parsed as Array<{
          assessmentRowId: string;
          aiExplanation: string;
          deductionCategory: InsuredReportLineExplanation['deductionCategory'];
          isFlagged: boolean;
        }>
      ).map(item => {
        const sourceRow = (claim.assessmentRows ?? []).find(r => r.id === item.assessmentRowId);
        const mapped: InsuredReportLineExplanation = {
          assessmentRowId: item.assessmentRowId,
          partDescription: sourceRow?.particulars ?? item.assessmentRowId,
          surveyorRemarks: sourceRow?.remarks ?? sourceRow?.billRemarks ?? '',
          aiExplanation: item.aiExplanation ?? '',
          deductionCategory: (item.deductionCategory ?? 'not-covered') as DeductionCategory,
          surveyorAmount: sourceRow?.assessed ?? 0,
          billedAmount: sourceRow?.billedTaxable ?? sourceRow?.estimated ?? 0,
          isFlagged: item.isFlagged ?? false,
        };
        if (!mapped.aiExplanation || mapped.isFlagged) mapped.aiExplanation = buildHonestFallback(mapped);
        return mapped;
      });
      lineExplanations = [...lineExplanations, ...aiExplanations];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onProgress?.(`⚠ Line explanations AI failed: ${msg}`);
      lineExplanations = [
        ...lineExplanations,
        ...relevantRows.map(r => {
          const billed = r.billedTaxable ?? r.estimated;
          const stub: InsuredReportLineExplanation = {
            assessmentRowId: r.id,
            partDescription: r.particulars,
            surveyorRemarks: r.remarks ?? '',
            aiExplanation: '',
            deductionCategory: 'not-covered' as DeductionCategory,
            surveyorAmount: r.assessed,
            billedAmount: billed,
            isFlagged: true,
          };
          return { ...stub, aiExplanation: buildHonestFallback(stub) };
        }),
      ];
    }
  }

  return {
    completedAt: new Date().toISOString(),
    lineExplanations,
    hasFlaggedRows: lineExplanations.some(e => e.isFlagged),
  };
}

// ─── Stage 4: Generate Narrative ──────────────────────────────────────────────
export async function runGenerateNarrative({
  claim,
  stage,
  language,
  policyAnalysis,
  assessmentAnalysis,
  surveyorAnswers,
  onProgress,
}: {
  claim: ClaimData;
  stage: InsuredReportStage;
  language: InsuredReportLanguage;
  policyAnalysis: PolicyAnalysisResult;
  assessmentAnalysis: AssessmentAnalysisResult;
  surveyorAnswers?: SurveyorAnswers;
  onProgress?: (msg: string) => void;
}): Promise<InsuredReportDraft> {
  const ageMonths = getVehicleAgeMonths(
    claim.vehicle.dateOfRegistration || null,
    claim.vehicle.yearOfManufacture ? Number(claim.vehicle.yearOfManufacture) : null,
    claim.accident.dateAndTime || null,
  );

  // Merge AI explanations with surveyor-approved answers from Gap Review
  const mergedExplanations = assessmentAnalysis.lineExplanations.map(e => {
    const answer = surveyorAnswers?.answers.find(a => a.assessmentRowId === e.assessmentRowId);
    if (answer) {
      return {
        ...e,
        aiExplanation: answer.approvedExplanation,
        deductionCategory: answer.deductionCategory,
        isFlagged: false,
      };
    }
    return e;
  });

  const financialSummary = computeInsuredFinancialSummary(claim, ageMonths);

  const consumablesFromAI = mergedExplanations
    .filter(e => e.deductionCategory === 'consumable')
    .reduce((sum, e) => {
      return sum + (e.surveyorAmount === 0 ? e.billedAmount : Math.max(0, e.billedAmount - e.surveyorAmount));
    }, 0);
  if (consumablesFromAI > 0) {
    financialSummary.consumablesTotal = consumablesFromAI;
    financialSummary.notCoveredTotal = Math.max(0, financialSummary.notCoveredTotal - consumablesFromAI);
  }

  onProgress?.('Writing covering narrative…');
  let coveringNarrative: string | undefined;
  let narrativeError: string | undefined;

  try {
    const claimSummary = {
      vehicleNumber: claim.vehicle.registrationNumber || '',
      vehicleMakeModel: [claim.vehicle.make, claim.vehicle.model].filter(Boolean).join(' '),
      insuredName: claim.policy?.insuredName || '',
      dateOfAccident: claim.accident?.dateAndTime || '',
      causeOfAccident: claim.accident?.causeOfAccident || '',
      garageEstimate: financialSummary.garageEstimate,
      insurerPays: financialSummary.insurerPays,
      insuredPays: financialSummary.insuredPays,
      stage,
    };

    const { policyContext } = policyAnalysis;
    const deductionLines: string[] = [];
    if (financialSummary.depreciationTotal > 0)
      deductionLines.push(`Depreciation on parts: ₹${financialSummary.depreciationTotal.toLocaleString('en-IN')}`);
    if (policyContext.compulsoryExcess > 0)
      deductionLines.push(`Compulsory excess: ₹${policyContext.compulsoryExcess.toLocaleString('en-IN')}`);
    if (policyContext.voluntaryExcess > 0)
      deductionLines.push(`Voluntary excess: ₹${policyContext.voluntaryExcess.toLocaleString('en-IN')}`);
    if (financialSummary.consumablesTotal > 0)
      deductionLines.push(`Consumables excluded: ₹${financialSummary.consumablesTotal.toLocaleString('en-IN')}`);
    if (financialSummary.notCoveredTotal > 0)
      deductionLines.push(`Items not covered: ₹${financialSummary.notCoveredTotal.toLocaleString('en-IN')}`);
    if (financialSummary.salvageTotal > 0)
      deductionLines.push(`Disposal/salvage: ₹${financialSummary.salvageTotal.toLocaleString('en-IN')}`);

    const categoryGroups: Record<string, string[]> = {};
    for (const e of mergedExplanations) {
      if (e.deductionCategory === 'depreciation' || e.deductionCategory === 'safe') continue;
      const cat = e.deductionCategory ?? 'other';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(e.partDescription);
    }

    const raw = await callAIGateway(
      buildCoveringNarrativePrompt(language, JSON.stringify(claimSummary), deductionLines, categoryGroups),
      [],
      'text',
    );
    coveringNarrative = raw.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
    if (!coveringNarrative) throw new Error('AI returned empty response for narrative.');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const friendlyReason = msg.toLowerCase().includes('safety')
      ? 'Blocked by safety filter — type manually'
      : msg.toLowerCase().includes('quota')
        ? 'Quota exceeded — try again later'
        : 'AI failed — type manually';
    onProgress?.(`⚠ Narrative: ${friendlyReason}`);
    narrativeError = friendlyReason;
    coveringNarrative = undefined;
  }

  // Exclude depreciation and safe rows from Line Items — Financial tab handles depreciation
  const lineItemsForReport = mergedExplanations.filter(
    e => e.deductionCategory !== 'depreciation' && e.deductionCategory !== 'safe',
  );

  return {
    generatedAt: new Date().toISOString(),
    stage,
    language,
    isSurveyorApproved: false,
    financialSummary,
    policyMappings: policyAnalysis.clauses,
    lineExplanations: lineItemsForReport,
    coveringNarrative,
    narrativeError,
  };
}

interface GenerateInsuredReportParams {
  claim: ClaimData;
  stage: InsuredReportStage;
  language: InsuredReportLanguage;
  /** Base64 images of policy PDF pages (if available). Empty = use IRDAI fallback. */
  policyImages: string[];
  onProgress?: (message: string) => void;
}

// ─── Derive a PolicyContextSummary from the extracted clauses ─────────────────
// Converts the clause array from Pass 1 into a structured object that Pass 2 can reason against.
function derivePolicyContext(
  clauses: InsuredReportPolicyClause[],
  claim: ClaimData,
): PolicyContextSummary {
  const clauseText = clauses.map(c => `${c.clauseTitle}: ${c.policyText}`).join(' ').toLowerCase();

  const zeroDep =
    clauseText.includes('zero dep') ||
    clauseText.includes('nil dep') ||
    clauseText.includes('no depreciation') ||
    (claim.policy as any)?.policyType?.toLowerCase().includes('zero dep') ||
    false;

  // Compulsory excess — read from feeBill (the source-of-truth across the app), fall back to IRDAI standard
  const compulsoryExcess =
    claim.feeBill?.compulsoryExcess ??
    (claim.feeBill as any)?.lessExcess ??
    500;

  const voluntaryExcess =
    claim.feeBill?.voluntaryExcess ??
    0;

  const consumablesExcluded = !zeroDep && (
    clauseText.includes('consumable') ||
    clauseText.includes('lubricant') ||
    clauseText.includes('oil') ||
    true // IRDAI default: consumables excluded unless explicitly covered
  );

  const ncbClause = clauses.find(c => c.clauseType === 'ncb');
  const exclusionClauses = clauses
    .filter(c => c.clauseType === 'specific-exclusion')
    .map(c => c.policyText.slice(0, 100));

  return {
    policyType: (claim.policy as any)?.policyType ?? undefined,
    zeroDep,
    compulsoryExcess,
    voluntaryExcess,
    consumablesExcluded,
    ncbImpact: ncbClause?.plainLanguage ?? undefined,
    specificExclusions: exclusionClauses.length > 0 ? exclusionClauses : undefined,
  };
}

/**
 * Runs the three-pass AI pipeline to generate an InsuredReportDraft.
 *
 * Pass 1: Policy clause extraction (or IRDAI fallback).
 * Pass 2: Per-row plain-language explanations with Chain-of-Thought reasoning
 *         using the live policy context from Pass 1.
 * Pass 3: AI-generated professional covering narrative for the insured.
 *
 * Financial summary is computed deterministically (no AI).
 * Only anomalous rows are sent to the AI (surgical selection) to minimise tokens.
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
  onProgress?.('Analysing policy document…');
  let policyMappings: InsuredReportPolicyClause[];

  if (policyImages.length > 0) {
    try {
      const prompt = buildPolicyAnalysisPrompt(language);
      const raw = await callAIGateway(prompt, policyImages);
      const parsed = JSON.parse(raw) as { clauses: Omit<InsuredReportPolicyClause, 'source'>[] };
      policyMappings = (parsed.clauses ?? []).map(c => ({ ...c, source: 'policy-pdf' as const }));
      if (policyMappings.length === 0) {
        policyMappings = getIRDAIStandardClauses();
      }
    } catch {
      onProgress?.('Policy AI unavailable — using IRDAI standard clauses.');
      policyMappings = getIRDAIStandardClauses();
    }
  } else {
    policyMappings = getIRDAIStandardClauses();
  }

  // Derive structured policy context for Pass 2 CoT reasoning
  const policyContext = derivePolicyContext(policyMappings, claim);

  // ── Pass 2: Line Item Explanations ────────────────────────────────────────
  onProgress?.('Processing line items…');

  // ── Pre-classify deterministic rows (safe, salvage) ─────────────────────
  // These never need AI — category and explanation are 100% certain from data.
  const preClassified = buildPreClassifiedExplanations(claim, policyContext.zeroDep);
  const preClassifiedIds = new Set(preClassified.map(e => e.assessmentRowId));

  // ── Surgical selection: only send rows that actually need explaining ───────
  // Pre-classified rows are excluded — already handled above.
  const relevantRows = (claim.assessmentRows ?? []).filter(
    r => !preClassifiedIds.has(r.id) && (
      !r.allowed || r.action === 'disallow' || r.isDisposal ||
      ((r.billedTaxable ?? r.estimated) > r.assessed) ||
      (r.section === 'parts' && r.allowed && r.estimated > r.assessed)
    )
  );

  const accidentContext = [
    claim.accident?.causeOfAccident,
    claim.accident?.placeOfAccident,
    (claim.spotDetails as any)?.damageSeverity,
  ].filter(Boolean).join(', ');

  const rowInput = relevantRows.map(r => ({
    id: r.id,
    particulars: r.particulars,
    section: r.section,
    estimated: r.estimated,
    assessed: r.assessed,
    billedAmount: r.billedTaxable ?? r.estimated,
    allowed: r.allowed,
    action: r.action ?? '',
    remarks: r.remarks ?? '',
    billRemarks: r.billRemarks ?? '',
    isDisposal: r.isDisposal ?? false,
    partType: r.partType,
  }));

  // Start with pre-classified rows (safe + salvage) — already explained
  let lineExplanations: InsuredReportLineExplanation[] = [...preClassified];

  if (rowInput.length > 0) {
    try {
      const prompt = buildLineExplanationPrompt(
        language,
        JSON.stringify(rowInput),
        policyContext,
        accidentContext || undefined,
      );
      const raw = await callAIGateway(prompt, []);

      let parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) && Array.isArray(parsed?.items)) {
        parsed = parsed.items;
      }
      if (!Array.isArray(parsed)) {
        throw new Error(`AI returned unexpected format (not an array): ${typeof parsed}`);
      }

      const aiExplanations = (parsed as Array<{
        assessmentRowId: string;
        aiExplanation: string;
        deductionCategory: InsuredReportLineExplanation['deductionCategory'];
        isFlagged: boolean;
      }>).map(item => {
        const sourceRow = (claim.assessmentRows ?? []).find(r => r.id === item.assessmentRowId);
        const mapped: InsuredReportLineExplanation = {
          assessmentRowId: item.assessmentRowId,
          partDescription: sourceRow?.particulars ?? item.assessmentRowId,
          surveyorRemarks: sourceRow?.remarks ?? sourceRow?.billRemarks ?? '',
          aiExplanation: item.aiExplanation ?? '',
          deductionCategory: (item.deductionCategory ?? 'not-covered') as DeductionCategory,
          surveyorAmount: sourceRow?.assessed ?? 0,
          billedAmount: sourceRow?.billedTaxable ?? sourceRow?.estimated ?? 0,
          isFlagged: item.isFlagged ?? false,
        };
        // Replace blank aiExplanation with honest fallback (never leave blank)
        if (!mapped.aiExplanation || mapped.isFlagged) {
          mapped.aiExplanation = buildHonestFallback(mapped);
        }
        return mapped;
      });
      lineExplanations = [...lineExplanations, ...aiExplanations];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onProgress?.(`⚠ Line explanations AI failed: ${msg} — generating fallback explanations.`);
      const fallbacks = relevantRows.map(r => {
        const billed = r.billedTaxable ?? r.estimated;
        const explanation = buildHonestFallback({
          assessmentRowId: r.id,
          partDescription: r.particulars,
          surveyorRemarks: r.remarks ?? '',
          aiExplanation: '',
          deductionCategory: 'not-covered' as DeductionCategory,
          surveyorAmount: r.assessed,
          billedAmount: billed,
          isFlagged: true,
        });
        return {
          assessmentRowId: r.id,
          partDescription: r.particulars,
          surveyorRemarks: r.remarks ?? '',
          aiExplanation: explanation,
          deductionCategory: 'not-covered' as DeductionCategory,
          surveyorAmount: r.assessed,
          billedAmount: billed,
          isFlagged: true,
        };
      });
      lineExplanations = [...lineExplanations, ...fallbacks];
    }
  }

  // ── Financial Summary (deterministic, no AI) ─────────────────────────────
  const financialSummary = computeInsuredFinancialSummary(claim, ageMonths);

  // ── Split consumables from notCoveredTotal using AI's deductionCategory ──
  const consumablesFromAI = lineExplanations
    .filter(e => e.deductionCategory === 'consumable')
    .reduce((sum, e) => {
      const amount = e.surveyorAmount === 0 ? e.billedAmount : Math.max(0, e.billedAmount - e.surveyorAmount);
      return sum + amount;
    }, 0);

  if (consumablesFromAI > 0) {
    financialSummary.consumablesTotal = consumablesFromAI;
    financialSummary.notCoveredTotal = Math.max(0, financialSummary.notCoveredTotal - consumablesFromAI);
  }

  // ── Pass 3: Professional Covering Narrative ───────────────────────────────
  onProgress?.('Writing covering narrative…');
  let coveringNarrative: string | undefined;
  let narrativeError: string | undefined;

  try {
    // Build a compact claim summary for the narrative prompt (avoids sending full claim object)
    const claimSummary = {
      vehicleNumber: claim.vehicle.registrationNumber || '',
      vehicleMakeModel: [claim.vehicle.make, claim.vehicle.model].filter(Boolean).join(' '),
      insuredName: claim.policy?.insuredName || (claim as any).insuredName || '',
      dateOfAccident: claim.accident?.dateAndTime || '',
      causeOfAccident: claim.accident?.causeOfAccident || '',
      garageEstimate: financialSummary.garageEstimate,
      insurerPays: financialSummary.insurerPays,
      insuredPays: financialSummary.insuredPays,
      stage,
    };

    // Build deduction summary lines from AI-classified explanations
    const deductionLines: string[] = [];

    if (financialSummary.depreciationTotal > 0)
      deductionLines.push(`Depreciation on parts: ₹${financialSummary.depreciationTotal.toLocaleString('en-IN')}`);
    if (policyContext.compulsoryExcess > 0)
      deductionLines.push(`Compulsory excess: ₹${policyContext.compulsoryExcess.toLocaleString('en-IN')}`);
    if (policyContext.voluntaryExcess > 0)
      deductionLines.push(`Voluntary excess: ₹${policyContext.voluntaryExcess.toLocaleString('en-IN')}`);
    if (financialSummary.consumablesTotal > 0)
      deductionLines.push(`Consumables (oil, sealants, nuts, bolts etc.): ₹${financialSummary.consumablesTotal.toLocaleString('en-IN')} — excluded under standard policy terms`);
    if (financialSummary.notCoveredTotal > 0)
      deductionLines.push(`Items not covered by policy: ₹${financialSummary.notCoveredTotal.toLocaleString('en-IN')}`);
    if (financialSummary.negotiatedSavings > 0)
      deductionLines.push(`Labour/painting rates negotiated with garage: ₹${financialSummary.negotiatedSavings.toLocaleString('en-IN')}`);
    if (financialSummary.salvageTotal > 0)
      deductionLines.push(`Salvage value of replaced parts: ₹${financialSummary.salvageTotal.toLocaleString('en-IN')}`);

    // ── Group ALL line items by deduction category ────────────────────────
    // Replaces the old "3 notable items" slice. The narrative AI now receives
    // every part decision grouped so it can write:
    //   "The following were found safe: Bonnet, Roof…"
    //   "The following consumables were excluded: Engine Oil, Coolant…"
    const categoryGroups: Record<string, string[]> = {};
    for (const e of lineExplanations) {
      const cat = e.deductionCategory ?? 'other';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push(e.partDescription);
    }

    // Also pick up rows the surgical filter skipped (allowed rows with a
    // meaningful surveyor remark like "Safe", "Consumable", "Disposal").
    const REMARK_MAP: Record<string, string> = {
      safe: 'safe', 'no damage': 'safe', 'nd': 'safe', ok: 'safe',
      disposal: 'salvage', salvage: 'salvage', used: 'salvage',
      consumable: 'consumable', consumables: 'consumable',
      disallow: 'not-covered', 'not covered': 'not-covered', 'not payable': 'not-covered',
      'prev damage': 'previous-damage', 'previous damage': 'previous-damage', pd: 'previous-damage',
    };
    for (const row of claim.assessmentRows) {
      const remark = (row.remarks ?? '').toLowerCase().trim();
      const mapped = REMARK_MAP[remark] ?? (row.action === 'disallow' ? 'not-covered' : null);
      if (mapped && !lineExplanations.find(e => e.assessmentRowId === row.id)) {
        if (!categoryGroups[mapped]) categoryGroups[mapped] = [];
        categoryGroups[mapped].push(row.particulars);
      }
    }

    const narrativePrompt = buildCoveringNarrativePrompt(
      language,
      JSON.stringify(claimSummary),
      deductionLines,
      categoryGroups,
    );

    // Pass 3 expects plain prose — use 'text' to bypass json_object mode on Groq/NVIDIA
    // and responseMimeType: application/json on Gemini, which would wrap the letter in JSON.
    const raw = await callAIGateway(narrativePrompt, [], 'text');
    coveringNarrative = raw.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
    if (!coveringNarrative) {
      throw new Error('AI returned an empty response for the narrative.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    // Produce a short, human-readable reason for the UI badge
    const friendlyReason =
      msg.toLowerCase().includes('safety') ? 'Blocked by safety filter — type manually'
      : msg.toLowerCase().includes('quota') ? 'Quota exceeded — try again later'
      : msg.toLowerCase().includes('empty') ? 'AI returned empty response — type manually'
      : msg.toLowerCase().includes('rate') ? 'Rate limited — regenerate in a moment'
      : 'AI failed — type manually';
    onProgress?.(`⚠ Narrative: ${friendlyReason} (${msg})`);
    narrativeError = friendlyReason;
    coveringNarrative = undefined;
  }

  return {
    generatedAt: new Date().toISOString(),
    stage,
    language,
    isSurveyorApproved: false,
    financialSummary,
    policyMappings,
    lineExplanations,
    coveringNarrative,
    narrativeError,
  };
}
