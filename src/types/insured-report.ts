// ═══════════════════════════════════════════════════════════
// INSURED CLAIM SUMMARY — CORE TYPES
// Premium AI-generated PDF explaining insurance deductions
// to the vehicle owner in plain language.
// ═══════════════════════════════════════════════════════════

export type InsuredReportStage = 'preliminary' | 'final';
export type InsuredReportLanguage = 'english' | 'hindi' | 'marathi';

export type DeductionCategory =
  | 'depreciation'
  | 'consumable'
  | 'negotiated'
  | 'not-covered'
  | 'previous-damage'
  | 'safe'
  | 'salvage';

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
}
