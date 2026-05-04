import type { ClaimData } from '@/types/claim';
import type {
  InsuredReportDraft,
  InsuredReportLanguage,
  InsuredReportPolicyClause,
  InsuredReportLineExplanation,
  InsuredReportStage,
} from '@/types/insured-report';
import { callAIGateway } from './service';
import {
  buildPolicyAnalysisPrompt,
  buildLineExplanationPrompt,
  buildCoveringNarrativePrompt,
  type PolicyContextSummary,
} from './prompts';
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

  // ── Surgical selection: only send rows that actually need explaining ───────
  // We skip rows that are fully approved and have no discrepancy — they don't
  // need an explanation for the insured and avoiding them keeps token usage low.
  const relevantRows = claim.assessmentRows.filter(
    r => !r.allowed || r.action === 'disallow' || r.isDisposal ||
      ((r.billedTaxable ?? r.estimated) > r.assessed) ||
      (r.section === 'parts' && r.allowed && r.estimated > r.assessed)
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

  let lineExplanations: InsuredReportLineExplanation[] = [];

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

      lineExplanations = (parsed as Array<{
        assessmentRowId: string;
        aiExplanation: string;
        deductionCategory: InsuredReportLineExplanation['deductionCategory'];
        isFlagged: boolean;
      }>).map(item => {
        const sourceRow = claim.assessmentRows.find(r => r.id === item.assessmentRowId);
        return {
          assessmentRowId: item.assessmentRowId,
          partDescription: sourceRow?.particulars ?? item.assessmentRowId,
          surveyorRemarks: sourceRow?.remarks ?? sourceRow?.billRemarks ?? '',
          aiExplanation: item.aiExplanation ?? '',
          deductionCategory: item.deductionCategory ?? 'not-covered',
          surveyorAmount: sourceRow?.assessed ?? 0,
          billedAmount: sourceRow?.billedTaxable ?? sourceRow?.estimated ?? 0,
          isFlagged: item.isFlagged ?? false,
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      onProgress?.(`⚠ Line explanations AI failed: ${msg} — items flagged for manual review.`);
      lineExplanations = relevantRows.map(r => ({
        assessmentRowId: r.id,
        partDescription: r.particulars,
        surveyorRemarks: r.remarks ?? '',
        aiExplanation: '',
        deductionCategory: 'not-covered' as const,
        surveyorAmount: r.assessed,
        billedAmount: r.billedTaxable ?? r.estimated,
        isFlagged: true,
      }));
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
