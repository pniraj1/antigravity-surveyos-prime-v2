import { describe, it, expect } from 'vitest';
import type { ClaimDocument, DocType } from '@/types/documents';
import type { BoxState } from '../kit/checklist';
import { neededTypesFirst, nextSelection, pageKey, pageNumbers, selectionByDoc } from '../kit/page-grid';

const ALL: DocType[] = ['rc', 'dl', 'policy', 'pan', 'aadhaar', 'cancelledCheque'];

function box(status: BoxState['status'], accepts: DocType[], missingTypes: DocType[] = []): BoxState {
  return {
    box: { id: accepts[0], label: 'x', mandatory: true, accepts, combine: missingTypes.length ? 'merge' : 'single', formats: ['.pdf'] },
    status, parts: [], missingTypes, reasons: [], alternatives: 0,
  };
}

describe('neededTypesFirst', () => {
  it('puts missing boxes first, then the rest, without duplicates', () => {
    const states = [box('ready', ['rc']), box('missing', ['dl', 'rcBack']), box('missing', ['policy', 'pan'], ['aadhaar', 'policy'])];
    const { needed, rest } = neededTypesFirst(states, ALL);
    expect(needed).toEqual(['dl', 'aadhaar', 'policy']);
    expect(rest).toEqual(['rc', 'pan', 'cancelledCheque']);
  });

  it('a merge box lists only its missing parts, not accepts[0] when that is present', () => {
    expect(neededTypesFirst([box('missing', ['policy', 'aadhaar'], ['aadhaar'])], ALL).needed).toEqual(['aadhaar']);
  });

  it('has nothing needed when no box is missing', () => {
    const { needed, rest } = neededTypesFirst([box('check', ['rc']), box('empty', ['dl'])], ALL);
    expect(needed).toEqual([]);
    expect(rest).toEqual(ALL);
  });
});

describe('nextSelection', () => {
  const order = ['a:1', 'a:2', 'a:3', 'b:1', 'b:2'];

  it('click toggles one page and moves the anchor', () => {
    const r = nextSelection(order, new Set(), null, 'a:2', false);
    expect([...r.selected]).toEqual(['a:2']);
    expect(r.anchor).toBe('a:2');
    expect([...nextSelection(order, r.selected, r.anchor, 'a:2', false).selected]).toEqual([]);
  });

  it('shift+click selects the range from the anchor, either direction, within one file', () => {
    expect([...nextSelection(order, new Set(['a:1']), 'a:1', 'a:3', true).selected]).toEqual(['a:1', 'a:2', 'a:3']);
    expect([...nextSelection(order, new Set(['b:2']), 'b:2', 'b:1', true).selected].sort()).toEqual(['b:1', 'b:2']);
  });

  it('shift+click on another file is a plain toggle and becomes the anchor', () => {
    const r = nextSelection(order, new Set(['a:2']), 'a:2', 'b:1', true);
    expect([...r.selected]).toEqual(['a:2', 'b:1']);
    expect(r.anchor).toBe('b:1');
    expect([...nextSelection(order, new Set(['a:2', 'b:1']), 'a:2', 'b:1', true).selected]).toEqual(['a:2']);
  });

  it('shift+click with no anchor just selects the page', () => {
    expect([...nextSelection(order, new Set(), null, 'a:3', true).selected]).toEqual(['a:3']);
  });
});

describe('selectionByDoc', () => {
  it('groups selected pages per file in page order and drops keys that are gone', () => {
    const sel = new Set([pageKey('b', 2), pageKey('a', 3), pageKey('a', 1), pageKey('gone', 1)]);
    expect(selectionByDoc(['a:1', 'a:2', 'a:3', 'b:1', 'b:2'], sel)).toEqual([['a', [1, 3]], ['b', [2]]]);
  });
});

describe('pageNumbers', () => {
  const file = (relPath: string, mime: string, over: Partial<ClaimDocument> = {}): ClaimDocument =>
    ({ id: 'd', type: 'rc', relPath, mime, size: 1, addedAt: '', source: 'upload', devices: [], ...over });

  it('lists every PDF page, one tile for an image, none yet for a PDF not read', () => {
    expect(pageNumbers(file('a.pdf', 'application/pdf', { pageCount: 3 }))).toEqual([1, 2, 3]);
    expect(pageNumbers(file('a.jpg', 'image/jpeg'))).toEqual([1]);
    expect(pageNumbers(file('a.pdf', 'application/pdf'))).toEqual([]);
  });

  it('gives whole files (Word, Excel, print-time HTML) no pages', () => {
    expect(pageNumbers(file('a.xlsx', 'application/vnd.ms-excel'))).toBeNull();
    expect(pageNumbers(file('Report.pdf', 'text/html'))).toBeNull();
  });
});
