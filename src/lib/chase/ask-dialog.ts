import type { ClaimData } from '@/types';
import { DOC_TYPE_LABEL, DOC_TYPE_TO_TAG, type DocType } from '@/types/documents';
import { defaultRecipient, type ContactRole } from './ask-message';

export interface DialogDoc { key: string; label: string; reason: string | null }
export interface Recipient { role: ContactRole; name: string; phone: string; email: string }

const labelOf = (key: string) => DOC_TYPE_LABEL[key as DocType] ?? key;

/** Scan path: missing and rejected slots. Otherwise every non-photo DocType. */
export function dialogDocs(claim: ClaimData): DialogDoc[] {
  const slots = claim.scanChase?.slotStates;
  if (slots) {
    return Object.entries(slots).flatMap(([key, s]) =>
      s === 'received' ? [] : [{ key, label: labelOf(key), reason: typeof s === 'string' ? null : s.reason }]);
  }
  return (Object.keys(DOC_TYPE_LABEL) as DocType[])
    .filter((t) => !DOC_TYPE_TO_TAG[t])
    .map((t) => ({ key: t, label: DOC_TYPE_LABEL[t], reason: null }));
}

/** Keys ticked for a recipient: only on the Scan path (no slot states = nothing ticked). */
export const preTicked = (claim: ClaimData, role: ContactRole): string[] =>
  claim.scanChase?.slotStates ? dialogDocs(claim).filter((d) => defaultRecipient(d.key as DocType) === role).map((d) => d.key) : [];

/** Prime's own fields win; Scan's contacts fill the rest. */
export function recipients(claim: ClaimData): Recipient[] {
  const c = claim.scanChase?.contacts;
  const t = (s: string | undefined) => (s ?? '').trim();
  return [
    { role: 'insured', name: t(claim.policy?.insuredName) || t(c?.insured?.name), phone: t(claim.policy?.insuredMobile) || t(c?.insured?.phone), email: t(c?.insured?.email) },
    { role: 'garage', name: t(c?.garage?.person) || t(claim.accident?.workshopName) || t(c?.garage?.name), phone: t(claim.accident?.workshopPhone) || t(c?.garage?.phone), email: t(claim.accident?.workshopEmail) || t(c?.garage?.email) },
    { role: 'other', name: t(c?.other?.name), phone: t(c?.other?.phone), email: t(c?.other?.email) },
  ];
}

/** Now as IST ISO-8601, e.g. 2026-11-01T18:30:00+05:30 (Scan's ask-log format). */
export const istNow = (now = Date.now()) => new Date(now + 330 * 60_000).toISOString().slice(0, 19) + '+05:30';
