// ═══════════════════════════════════════════════════════════
// INSURED CLAIM SUMMARY — CORE TYPES
// Premium AI-generated PDF explaining insurance deductions
// to the vehicle owner in plain language.
// ═══════════════════════════════════════════════════════════

// DeductionCategory is the single source of truth — defined in constants.
// Imported locally for use inside this file; re-exported for external consumers.
import type { DeductionCategory } from '@/lib/constants/deduction-categories';
export type { DeductionCategory };

export type InsuredReportStage = 'preliminary' | 'final';
export type InsuredReportLanguage = 'english' | 'hindi' | 'marathi';

export type PolicyClauseType =
  | 'excess'
  | 'depreciation'
  | 'consumables-exclusion'
  | 'specific-exclusion'
  | 'ncb'
  | 'salvage';

export interface InsuredReportSettings {
  enabled: boolean;
  allowedLanguages: InsuredReportLanguage[];
  defaultLanguage: InsuredReportLanguage;
  enabledStages: InsuredReportStage[];
}

export interface InsuredReportPolicyClause {
  clauseType: PolicyClauseType;
  clauseTitle: string;
  policyText: string;
  plainLanguage: string;
  source: 'policy-pdf' | 'irdai-standard';
}

export interface InsuredReportLineExplanation {
  assessmentRowId: string;
  partDescription: string;
  surveyorRemarks: string;
  aiExplanation: string;
  deductionCategory: DeductionCategory;
  surveyorAmount: number;
  billedAmount: number;
  isFlagged: boolean;
}

export interface InsuredReportFinancialSummary {
  garageEstimate: number;
  negotiatedSavings: number;
  depreciationTotal: number;
  excessTotal: number;
  consumablesTotal: number;
  notCoveredTotal: number;
  salvageTotal: number;
  insurerPays: number;
  insuredPays: number;
}

export interface InsuredReportDraft {
  generatedAt: string;
  stage: InsuredReportStage;
  language: InsuredReportLanguage;
  isSurveyorApproved: boolean;
  financialSummary: InsuredReportFinancialSummary;
  policyMappings: InsuredReportPolicyClause[];
  lineExplanations: InsuredReportLineExplanation[];
  /**
   * Pass 3: AI-generated professional covering letter addressed to the insured.
   * Three paragraphs: context → deductions explained → settlement amount.
   * Surveyors can edit before approving.
   */
  coveringNarrative?: string;
  /**
   * If Pass 3 (narrative) failed, this contains the specific error message
   * (e.g. "Safety filter blocked", "Quota exceeded") so the UI can surface it.
   */
  narrativeError?: string;
}
