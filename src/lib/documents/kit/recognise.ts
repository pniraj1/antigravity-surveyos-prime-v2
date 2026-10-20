// src/lib/documents/kit/recognise.ts
/**
 * Free, local page recognition: SurveyOS's own knowledge, a PDF's text layer, a file's name.
 * No AI. A page is labelled only when exactly one type fits; an unclear page stays unlabelled.
 */
import type { ClaimDocument, DocType, PageLabel } from '@/types/documents';
import { DOC_TYPE_LABEL } from '@/types/documents';
import { docTypeFromRelPath } from '../naming';

/** Each rule reads the lowercased, whitespace-collapsed text. */
const RULES: Array<[DocType, (t: string) => boolean]> = [
  ['rc', (t) => t.includes('registration certificate') || (t.includes('chassis no') && t.includes('engine no'))],
  ['dl', (t) => t.includes('driving licence') || t.includes('driving license') || (t.includes('licence no') && /\bcov\b/.test(t))],
  ['aadhaar', (t) => t.includes('aadhaar') || t.includes('unique identification authority')
    || (/\b\d{4} \d{4} \d{4}\b/.test(t) && t.includes('government of india'))],
  // \bpan\b: a bare "pan" would match "company".
  ['pan', (t) => t.includes('permanent account number') || (t.includes('income tax department') && /\bpan\b/.test(t))],
  ['invoice', (t) => t.includes('tax invoice') || (t.includes('gstin') && t.includes('invoice no'))],
  ['estimate', (t) => t.includes('estimate') && (t.includes('labour') || t.includes('labor'))],
  ['policy', (t) => t.includes('policy schedule') || t.includes('certificate of insurance') || (t.includes('policy no') && t.includes('idv'))],
  ['cancelledCheque', (t) => t.includes('ifsc') && (t.includes('a/c') || t.includes('account no')) && t.includes('pay')],
  ['fir', (t) => t.includes('first information report')],
  ['claimForm', (t) => t.includes('claim form') && t.includes('signature')],
];

/** The one type the text fits, or null when none or several do. */
export function recogniseText(text: string): DocType | null {
  const t = text.toLowerCase().replace(/\s+/g, ' ');
  const hits = RULES.filter(([, fits]) => fits(t));
  return hits.length === 1 ? hits[0][0] : null;
}

export function recogniseName(relPath: string): DocType | null {
  const type = docTypeFromRelPath(relPath);
  return type === 'other' ? null : type;
}

/**
 * Types SurveyOS itself assigned: its own files, camera photos, and field uploads
 * (saveDocuments names those "<Label>.<ext>", or "<Label> <n>.<ext>" for several at once).
 */
export function knownType(entry: ClaimDocument): DocType | null {
  if (entry.source === 'generated' || entry.source === 'photo') return entry.type;
  if (entry.type === 'other' || entry.source !== 'upload') return null;
  const stem = (entry.relPath.split('/').pop() ?? '').replace(/\.[^.]+$/, '').replace(/ \d+$/, '');
  return stem === DOC_TYPE_LABEL[entry.type] ? entry.type : null;
}

/**
 * Fill the pages that have no label yet; existing labels are never touched.
 * `pageTexts` is one string per page, or null when there is no text layer.
 * Returns the same object when nothing was added.
 */
export function labelEntry(entry: ClaimDocument, pageTexts: string[] | null): ClaimDocument {
  if (entry.mime === 'text/html') return entry; // C1: our own print-time HTML is never a labelled page
  const count = pageTexts?.length ?? entry.pageCount ?? 1;
  const pages: Record<number, PageLabel> = { ...entry.pages };
  const empty = () => Array.from({ length: count }, (_, i) => i + 1).filter((n) => !pages[n]);
  const fill = (label: Omit<PageLabel, 'type'>, type: (n: number) => DocType | null) => {
    for (const n of empty()) {
      const t = type(n);
      if (t) pages[n] = { type: t, ...label };
    }
  };

  const known = knownType(entry);
  if (known) fill({ by: 'known', confirmed: true }, () => known);
  else {
    fill({ by: 'text', confirmed: false }, (n) => recogniseText(pageTexts?.[n - 1] ?? ''));
    const name = recogniseName(entry.relPath);
    const anyText = Object.values(pages).some((p) => p.by === 'text');
    if (name && (count === 1 || !anyText)) fill({ by: 'name', confirmed: false }, () => name);
  }
  return Object.keys(pages).length === Object.keys(entry.pages ?? {}).length ? entry : { ...entry, pages };
}
