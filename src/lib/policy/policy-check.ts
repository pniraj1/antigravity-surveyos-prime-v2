import type { ClaimData, PolicyAiRead, PolicyCheck, YesNo } from '@/types/claim';

const yesNo = (v: unknown): YesNo | undefined => {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'yes' || s === 'no' ? s : undefined;
};

const amount = (v: unknown): number | undefined => {
  // drop leading non-digits first: the "." in "Rs. 1,000" must not become a decimal point
  const n = Number(String(v ?? '').replace(/^\D+/, '').replace(/[^\d.]/g, ''));
  return n > 0 ? n : undefined; // 0 and NaN both fail `> 0`
};

/** Reads the policy-extraction JSON into suggestions. Unknown/blank values are omitted. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePolicyAddOns(data: any): PolicyAiRead {
  const read: PolicyAiRead = {
    nilDep: yesNo(data?.nil_depreciation),
    imt23: yesNo(data?.imt23),
    consumables: yesNo(data?.consumables_cover),
    compulsoryExcess: amount(data?.compulsory_excess),
    voluntaryExcess: amount(data?.voluntary_excess),
  };
  return Object.fromEntries(Object.entries(read).filter(([, v]) => v !== undefined)) as PolicyAiRead;
}

/**
 * Stores the AI read and drops any surveyor answer the AI now contradicts, so a
 * re-read of a different policy forces the surveyor to answer again.
 */
export function mergePolicyAiRead(
  check: PolicyCheck | undefined,
  ai: PolicyAiRead,
  excess: { compulsory: number; voluntary: number },
): PolicyCheck {
  const { nilDep, imt23, consumables, excessConfirmed } = check ?? {};
  const clash = (answer: string | undefined, suggested: YesNo | undefined) =>
    suggested !== undefined && answer !== undefined && answer !== suggested;
  const excessClash =
    (ai.compulsoryExcess !== undefined && ai.compulsoryExcess !== excess.compulsory) ||
    (ai.voluntaryExcess !== undefined && ai.voluntaryExcess !== excess.voluntary);
  const next: PolicyCheck = { aiRead: ai };
  if (nilDep && !clash(nilDep, ai.nilDep)) next.nilDep = nilDep;
  // 'na' (not applicable) is compatible with the AI seeing no IMT 23
  if (imt23 && !(imt23 === 'na' ? ai.imt23 === 'yes' : clash(imt23, ai.imt23))) next.imt23 = imt23;
  if (consumables && !clash(consumables, ai.consumables)) next.consumables = consumables;
  if (excessConfirmed && !excessClash) next.excessConfirmed = excessConfirmed;
  return next;
}

export interface PolicyCheckStatus {
  answered: number;
  total: 4;
  complete: boolean;
  warnings: string[];
}

export function policyCheckStatus(claim: ClaimData): PolicyCheckStatus {
  const pc = claim.policyCheck ?? {};
  const answered = [pc.nilDep, pc.imt23, pc.consumables, pc.excessConfirmed].filter(Boolean).length;
  const ticked = (claim.assessmentRows ?? []).filter(r => r.allowed && r.imt23).length;
  const warnings: string[] = [];
  if (pc.imt23 === 'no' && ticked > 0) warnings.push(`${ticked} rows ticked IMT 23 — policy has no IMT 23`);
  if (pc.imt23 === 'yes' && ticked === 0) warnings.push('Policy has IMT 23 — no rows ticked yet');
  if (pc.consumables === 'no') warnings.push('Consumables not payable — check consumable rows');
  return { answered, total: 4, complete: answered === 4, warnings };
}
