import type { ClaimData } from '@/types/claim';
import type { AssessmentRow } from '@/types';
import { claimSurveyDate } from './survey-date';

/** One past claim's figures for the part the surveyor is checking. */
export interface PartHistoryEntry {
  claimId: string;
  reportNo: string;
  /** YYYY-MM-DD */
  date: string;
  workshop: string;
  particulars: string;
  estimated: number;
  assessed: number;
  disallowed: boolean;
}

// ponytail: small hand-picked list, add abbreviations as surveyors hit misses.
const WORD_ALIASES: Record<string, string> = {
  f: 'front', fr: 'front', frt: 'front', fron: 'front',
  r: 'rear', rr: 'rear',
};
const NOISE_WORDS = new Set(['assy', 'assembly', 'complete', 'comp', 'the', 'of']);

const squash = (s: string | undefined): string => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Word order, case, punctuation and common abbreviations do not change the key. */
export function partNameKey(particulars: string): string {
  return particulars
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => WORD_ALIASES[w] ?? w)
    .filter((w) => !NOISE_WORDS.has(w))
    .sort()
    .join(' ');
}

function samePart(a: AssessmentRow, b: AssessmentRow): boolean {
  const pa = squash(a.partNumber);
  const pb = squash(b.partNumber);
  if (pa && pb) return pa === pb;
  return partNameKey(a.particulars) === partNameKey(b.particulars);
}

function sameModel(a: ClaimData, b: ClaimData): boolean {
  const ma = squash(a.vehicle?.make);
  const mb = squash(b.vehicle?.make);
  if (ma && mb && ma !== mb) return false;
  return squash(a.vehicle?.model) === squash(b.vehicle?.model);
}

/**
 * The surveyor's own past figures for `target` on the same make and model,
 * newest first. Read-only: it never suggests or writes an assessed figure.
 */
export function partHistory(claims: ClaimData[], current: ClaimData, target: AssessmentRow): PartHistoryEntry[] {
  if (!squash(current.vehicle?.model) || !partNameKey(target.particulars ?? '')) return [];

  const entries: PartHistoryEntry[] = [];
  for (const c of claims) {
    if (c.id === current.id || !sameModel(c, current)) continue;
    for (const r of c.assessmentRows ?? []) {
      if (!(r.estimated > 0) || !samePart(r, target)) continue;
      entries.push({
        claimId: c.id,
        reportNo: c.reportNo,
        date: claimSurveyDate(c) || c.reportDate || c.createdAt.slice(0, 10),
        workshop: c.accident?.workshopName ?? '',
        particulars: r.particulars,
        estimated: r.estimated,
        assessed: r.assessed,
        disallowed: !r.allowed,
      });
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
