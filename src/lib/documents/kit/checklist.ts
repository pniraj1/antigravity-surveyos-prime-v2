/**
 * Which of a portal recipe's upload boxes the claim's labelled pages can fill.
 * Pure: reads the index, never the files. Only confirmed labels make a box Ready.
 */
import type { ClaimData } from '@/types/claim';
import type { ClaimDocument, DocType } from '@/types/documents';
import { DOC_TYPE_LABEL } from '@/types/documents';
import { claimDocuments, onThisDevice } from '../index-ops';
import type { IdentityResult } from './identity';
import type { Recipe, RecipeBox } from './recipes';

export type BoxStatus = 'ready' | 'check' | 'missing' | 'empty' | 'notNeeded';

export interface BoxState {
  box: RecipeBox;
  status: BoxStatus;
  parts: Array<{ docId: string; pages: number[] }>;
  missingTypes: DocType[];
  reasons: string[];
  /** Other files that could have filled a single box. */
  alternatives: number;
}

export interface ChecklistOpts {
  device: string;
  identity: Record<string, Record<number, IdentityResult>>;
}

interface Part { doc: ClaimDocument; pages: number[]; type: DocType }

const extOf = (d: ClaimDocument): string => /\.[^./\\]+$/.exec(d.relPath)?.[0].toLowerCase() ?? '';
const isWordOrExcel = (d: ClaimDocument): boolean => ['.docx', '.xlsx'].includes(extOf(d));
const isHtml = (d: ClaimDocument): boolean => d.mime.includes('text/html');

function pagesOfType(d: ClaimDocument, type: DocType): number[] {
  return Object.entries(d.pages ?? {})
    .filter(([, label]) => label.type === type)
    .map(([n]) => Number(n))
    .sort((a, b) => a - b);
}

const newestFirst = (a: Part, b: Part): number => b.doc.addedAt.localeCompare(a.doc.addedAt);

/** Files that match `type` but carry no page labels: Word/Excel (whole file) and the HTML stand-in report. */
function wholeFiles(docs: ClaimDocument[], type: DocType): { word: Part[]; html: Part[] } {
  const same = docs.filter((d) => d.type === type && !d.pages);
  return {
    word: same.filter(isWordOrExcel).map((doc) => ({ doc, pages: [], type })),
    html: same.filter(isHtml).map((doc) => ({ doc, pages: [], type })),
  };
}

export function checklist(recipe: Recipe, claim: ClaimData, opts: ChecklistOpts): BoxState[] {
  const docs = claimDocuments(claim).filter((d) => onThisDevice(d, opts.device));
  const skipped = new Set(claim.notNeededBoxes?.[`${recipe.portal}-${recipe.flow}`] ?? []);

  return recipe.boxes.map((box) => {
    if (skipped.has(box.id)) return { box, status: 'notNeeded', parts: [], missingTypes: [], reasons: [], alternatives: 0 };
    return box.combine === 'merge' ? mergeBox(box, docs, opts) : singleBox(box, docs, opts);
  });
}

function singleBox(box: RecipeBox, docs: ClaimDocument[], opts: ChecklistOpts): BoxState {
  const real: Part[] = [];
  const html: Part[] = [];
  for (const doc of docs) {
    const pages = box.accepts.flatMap((t) => pagesOfType(doc, t));
    if (pages.length) real.push({ doc, pages, type: doc.type });
  }
  for (const t of box.accepts) {
    const w = wholeFiles(docs, t);
    real.push(...w.word.filter((p) => box.formats.includes(extOf(p.doc))));
    html.push(...w.html);
  }
  real.sort(newestFirst);
  html.sort(newestFirst);
  const chosen = real[0] ?? html[0];
  return finish(box, chosen ? [chosen] : [], [], [], Math.max(real.length - 1, 0), opts);
}

function mergeBox(box: RecipeBox, docs: ClaimDocument[], opts: ChecklistOpts): BoxState {
  const picks: Part[] = [];
  const dropped: string[] = [];
  for (const type of box.accepts) {
    const real: Part[] = docs.map((doc) => ({ doc, pages: pagesOfType(doc, type), type })).filter((p) => p.pages.length);
    const w = wholeFiles(docs, type);
    for (const p of w.word) dropped.push(`${p.doc.relPath} can't be merged (Word/Excel).`);
    const best = [...real].sort(newestFirst)[0] ?? [...w.html].sort(newestFirst)[0];
    if (best) picks.push(best);
  }
  const missingTypes = (box.mergeMandatory ?? []).filter((t) => !picks.some((p) => p.type === t));
  return finish(box, picks, missingTypes, dropped, 0, opts);
}

function finish(box: RecipeBox, picks: Part[], missingTypes: DocType[], dropped: string[], alternatives: number, opts: ChecklistOpts): BoxState {
  const reasons = [...dropped];
  const add = (r: string): void => { if (!reasons.includes(r)) reasons.push(r); };
  const parts = picks.map((p) => ({ docId: p.doc.id, pages: p.pages }));
  let status: BoxStatus;

  if (!picks.length) status = box.mandatory ? 'missing' : 'empty';
  else if (missingTypes.length) status = 'missing';
  else {
    for (const p of picks) {
      if (isHtml(p.doc) && !p.pages.length) add('File the PDF of this report.');
      for (const n of p.pages) {
        const label = p.doc.pages?.[n];
        if (!label) continue;
        const name = DOC_TYPE_LABEL[label.type];
        if (!label.confirmed) add(`${name} is a guess. Confirm it in Pages.`);
        if (opts.identity[p.doc.id]?.[n]?.status === 'mismatch' && !label.overrideAt) add(`${name} doesn't match this claim.`);
      }
    }
    status = reasons.length ? 'check' : 'ready';
  }
  // A mandatory merge with nothing at all still names what to ask for.
  const missing = !picks.length && box.combine === 'merge' ? [...(box.mergeMandatory ?? [])] : missingTypes;
  return { box, status, parts, missingTypes: missing, reasons, alternatives };
}

/** What to ask for to fill a missing box: a merge box's missing parts, else the box's main type. */
export const missingTypesOf = (s: BoxState): DocType[] =>
  s.box.combine === 'merge' && s.missingTypes.length ? s.missingTypes : [s.box.accepts[0]];

/** A message the surveyor sends the insured. '' when nothing is missing. */
export function missingMessage(claim: ClaimData, states: BoxState[]): string {
  const types: DocType[] = [];
  for (const s of states) {
    if (s.status !== 'missing') continue;
    for (const t of missingTypesOf(s)) if (!types.includes(t)) types.push(t);
  }
  if (!types.length) return '';
  const items = types.map((t) => DOC_TYPE_LABEL[t]).join(', ');
  return `Claim ${claim.policy.claimNumber} (${claim.vehicle.registrationNumber}): please send the following documents: ${items}.`;
}
