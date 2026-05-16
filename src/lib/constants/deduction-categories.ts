// ═══════════════════════════════════════════════════════════
// DEDUCTION CATEGORIES — Single source of truth
// Used by: types, AI prompts, gate validation, and UI labels.
// Add new categories HERE and all consumers auto-update.
// ═══════════════════════════════════════════════════════════

export const DEDUCTION_CATEGORIES = [
  'approved',
  'safe',
  'depreciation',
  'salvage',
  'negotiated',
  'consumable',
  'not-covered',
  'previous-damage',
  'partial-repair',
  'wear-and-tear',
  'overpricing',
] as const;

export type DeductionCategory = typeof DEDUCTION_CATEGORIES[number];

// ─── Self-explaining: gate NEVER blocks ─────────────────────────────────────
// These categories can be fully inferred from the structured data in the row.
// No surveyor remark is needed to generate a meaningful explanation.
export const SELF_EXPLAINING_CATEGORIES: DeductionCategory[] = [
  'approved',     // assessed ≈ billedAmount, allowed, dep=0 — fully approved, no deduction
  'safe',         // item found undamaged by surveyor — not replaced
  'depreciation', // zeroDep=false, parts section — IRDAI formula applies
  'salvage',      // isDisposal=true — old part scrap value deducted
  'negotiated',   // labour/paint where billed > assessed — rate negotiation
  'consumable',   // item name matched consumable keywords — IRDAI standard exclusion
];

// ─── Requires a remark: gate BLOCKS if remarks is empty ──────────────────────
// These categories involve a surveyor judgment call that cannot be inferred
// from numbers alone. The specific reason must be documented.
export const REMARK_REQUIRED_CATEGORIES: DeductionCategory[] = [
  'not-covered',    // Which policy clause? Engine protect? Flood? Specific exclusion?
  'previous-damage',// Pre-existing damage — only the physical inspection can reveal this
  'partial-repair', // Repair assessed instead of replace — surveyor's visual judgment
  'wear-and-tear',  // Degraded due to age/use unrelated to accident — must be noted
  'overpricing',    // OEM billed, OES assessed — surveyor's parts sourcing judgment
];

// ─── UI labels ───────────────────────────────────────────────────────────────
// Used in: InsuredReportTab line-items badge, AssessmentGrid row tag, AI prompt.
export const CATEGORY_LABELS: Record<DeductionCategory, string> = {
  approved:         'Approved in full — assessed at full billed amount, no deduction',
  safe:             'No damage found — item not required / not replaced',
  depreciation:     'Depreciation applied (IRDAI schedule)',
  salvage:          'Salvage value of replaced part deducted',
  negotiated:       'Labour / paint rate negotiated to market standard',
  consumable:       'Consumable item — excluded under standard policy',
  'not-covered':    'Not payable under policy terms',
  'previous-damage':'Pre-existing damage — not from this accident',
  'partial-repair': 'Repair assessed over replacement',
  'wear-and-tear':  'Wear and tear / mechanical condition — not accident damage',
  overpricing:      'Part assessed at OES / market rate (OEM rate not applicable)',
};

// ─── Short badge labels (for compact UI display) ─────────────────────────────
export const CATEGORY_BADGE_LABELS: Record<DeductionCategory, string> = {
  approved:         'Approved in Full',
  safe:             'No Damage',
  depreciation:     'Depreciation',
  salvage:          'Salvage',
  negotiated:       'Negotiated',
  consumable:       'Consumable',
  'not-covered':    'Not Covered',
  'previous-damage':'Prev. Damage',
  'partial-repair': 'Partial Repair',
  'wear-and-tear':  'Wear & Tear',
  overpricing:      'Overpricing',
};

// ─── Badge colours ────────────────────────────────────────────────────────────
export const CATEGORY_BADGE_COLOURS: Record<DeductionCategory, { bg: string; text: string }> = {
  approved:         { bg: '#DCFCE7', text: '#166534' },  // green — fully approved
  safe:             { bg: '#F0FDF4', text: '#15803D' },  // lighter green — no damage found
  depreciation:     { bg: '#FEF9C3', text: '#854D0E' },
  salvage:          { bg: '#E0E7FF', text: '#3730A3' },
  negotiated:       { bg: '#FEF3C7', text: '#92400E' },
  consumable:       { bg: '#F3F4F6', text: '#374151' },
  'not-covered':    { bg: '#FEE2E2', text: '#991B1B' },
  'previous-damage':{ bg: '#FEE2E2', text: '#991B1B' },
  'partial-repair': { bg: '#FFEDD5', text: '#9A3412' },
  'wear-and-tear':  { bg: '#FFEDD5', text: '#9A3412' },
  overpricing:      { bg: '#FDF4FF', text: '#6B21A8' },
};
