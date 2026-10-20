/** Pure helpers behind the Pages view: which types to offer first, and page selection. */
import type { ClaimDocument, DocType } from '@/types/documents';
import type { BoxState } from './checklist';

/** The types the current recipe still needs (missing boxes), then every other type. */
export function neededTypesFirst(states: BoxState[], all: DocType[]): { needed: DocType[]; rest: DocType[] } {
  const needed: DocType[] = [];
  for (const s of states) {
    if (s.status !== 'missing') continue;
    for (const t of [...s.missingTypes, s.box.accepts[0]]) if (!needed.includes(t)) needed.push(t);
  }
  return { needed, rest: all.filter((t) => !needed.includes(t)) };
}

export const pageKey = (docId: string, page: number): string => `${docId}:${page}`;

/**
 * Click toggles one page; Shift+click adds the range from the anchor to the clicked page.
 * `order` is every page on screen, top to bottom.
 */
export function nextSelection(
  order: string[], selected: ReadonlySet<string>, anchor: string | null, clicked: string, shift: boolean,
): { selected: Set<string>; anchor: string } {
  const next = new Set(selected);
  const from = anchor ? order.indexOf(anchor) : -1;
  const to = order.indexOf(clicked);
  if (shift && from >= 0 && to >= 0) {
    for (const k of order.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(k);
  } else if (next.has(clicked)) next.delete(clicked);
  else next.add(clicked);
  return { selected: next, anchor: clicked };
}

/** Selected pages grouped per file, in on-screen order; keys no longer on screen are dropped. */
export function selectionByDoc(order: string[], selected: ReadonlySet<string>): Array<[string, number[]]> {
  const out = new Map<string, number[]>();
  for (const k of order) {
    if (!selected.has(k)) continue;
    const i = k.lastIndexOf(':');
    const id = k.slice(0, i);
    out.set(id, [...(out.get(id) ?? []), Number(k.slice(i + 1))]);
  }
  return [...out];
}

const labelable = (d: ClaimDocument): boolean => /\.(pdf|jpe?g|png)$/i.test(d.relPath) && d.mime !== 'text/html';

/**
 * The page numbers a file shows tiles for: every page of a PDF, one for an image, `null` for a whole file
 * (Word/Excel/print-time HTML) that has no pages to label. A PDF whose page count isn't known yet has none.
 */
export function pageNumbers(d: ClaimDocument): number[] | null {
  if (!labelable(d)) return null;
  const isPdf = /\.pdf$/i.test(d.relPath) || d.mime === 'application/pdf';
  const n = d.pageCount ?? Math.max(0, ...Object.keys(d.pages ?? {}).map(Number));
  return Array.from({ length: n || (isPdf ? 0 : 1) }, (_, i) => i + 1);
}
