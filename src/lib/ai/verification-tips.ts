// ═══════════════════════════════════════════════════════════
// VERIFICATION TIPS
//
// Shown while a document is being read, to turn the wait into verification
// priming rather than dead time.
//
// Deliberately STATIC, not AI-generated: zero latency, zero token cost, and
// it cannot hallucinate professional advice to someone whose signature
// carries statutory liability.
//
// Framing rule — tips say RECORD / NOTE / CONFIRM, never "reject". The
// surveyor documents facts; the insurer decides repudiation. Indian courts
// have held insurers cannot repudiate on technicality alone without proving
// material breach, so wording that drifts into adjudication is wrong twice
// over.
//
// Grounding — every tip comes from one of three places, not invention:
//   1. FIELD_MAPPINGS in reconciliation.ts — any field mapped to two or more
//      documents is one the app already knows can disagree.
//   2. The "CRITICAL" / "do NOT" warnings in prompts.ts — each one marks a
//      failure the model is known to make, so it is exactly what a human
//      should re-check.
//   3. The rule that validity is judged on the ACCIDENT DATE, not today: for
//      a commercial vehicle the fitness certificate, permit, licence,
//      registration and policy must all be valid simultaneously on the date
//      of loss.
// ═══════════════════════════════════════════════════════════

export const VERIFICATION_TIPS: Record<string, string[]> = {
  rc: [
    'Match chassis and engine numbers against the vehicle itself, not just the RC.',
    'Check the RC owner name against the policy insured name — if they differ, ownership may have transferred without the policy.',
    'Note the date of registration; it drives the depreciation slab.',
    'Year of manufacture and year of registration are often different — record both.',
    'Look for a hypothecation / financier entry; it affects who is paid.',
    'Confirm the class of vehicle matches how it was actually being used.',
  ],

  dl: [
    'Check both validity dates against the accident date, not today.',
    'Transport and non-transport validity expire separately — a licence can be valid for one and not the other.',
    'Confirm the licence class actually covers this vehicle category.',
    'Check the badge number yourself; it is often faint or rubbed out on older licences.',
    'Compare the DL holder name with the driver named in the FIR and the claim form.',
    'If this vehicle carries hazardous goods, confirm the endorsement is present and current.',
  ],

  policy: [
    'Confirm the policy period covers the accident date AND time — same-day expiry turns on the hour.',
    'Check you have the CURRENT policy period, not the previous policy’s expiry date sitting next to it.',
    'Note the policy type — a liability-only policy carries no own-damage cover at all.',
    'Check IDV against the vehicle’s age; it caps a total-loss settlement.',
    'Record compulsory and voluntary excess, and whether zero-depreciation applies.',
    'Note the financer / HPA entry if present.',
  ],

  claim: [
    'Cross-check the accident date and time against the FIR.',
    'Confirm the insured name matches the policy and the RC.',
    'Check the driver named here against the DL holder.',
    'Note any third-party involvement; it opens a separate liability head.',
  ],

  fir: [
    'Compare the FIR date with the accident date — a long gap is worth recording.',
    'Check the driver named in the FIR against the DL holder.',
    'Compare the stated cause with the damage you can actually see.',
    'Confirm the place of accident matches the claim form.',
  ],

  fitness: [
    'The fitness certificate must be valid ON the accident date, not merely present.',
    'Form 38 states expiry in prose and may carry several renewal rows — use the latest.',
    'Check GVW and seating capacity against the RC.',
  ],

  permit: [
    'Check permit validity against the accident date.',
    'Confirm the vehicle was on a route the permit covers.',
    'Match the goods category against what was actually being carried.',
    'Compare GVW here with the RC and the fitness certificate.',
  ],

  auth: [
    'Confirm the authorisation matches the vehicle class and the permit.',
    'Check validity against the accident date.',
  ],

  'load-challan': [
    'Match the goods described against the permit category — and against any hazardous endorsement.',
    'Compare the load weight with the registered laden weight; overloading is material.',
    'Check the challan date against the accident date.',
  ],

  estimate: [
    'Count the line items on the last page and compare with what was read — items on later pages are the usual miss.',
    'Confirm the gross total against the figure printed on the bill.',
    'Check the GST rate is the TOTAL (CGST + SGST), not one half of it.',
    'Watch for "Total c/f" or "b/f" carry-forward rows being counted as items.',
    'Check each part is classified metal / plastic / glass correctly — depreciation differs by material.',
    'Confirm parts, labour and painting are split correctly; only parts depreciate.',
    'Note any part already replaced under a prior claim.',
  ],

  'final-bill': [
    'Compare the bill line-by-line against the approved estimate.',
    'Query any part on the bill that was not on the estimate.',
    'Confirm the item count and gross total against the last page.',
    'Check the GST rate is the total, not one component.',
  ],
};

/** Tips for a document key, or an empty list — a key with no entry shows no filler. */
export function tipsFor(key: string): string[] {
  return VERIFICATION_TIPS[key] ?? [];
}
