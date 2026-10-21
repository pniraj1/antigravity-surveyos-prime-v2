import { describe, it, expect } from 'vitest';
import type { ClaimDocument } from '@/types/documents';
import type { BoxState } from '../kit/checklist';
import { canBuild, canTick, countsLine, droppedReviews, formatPages, formatSize, identityMarks, sourceLine } from '../kit/panel';

const state = (status: BoxState['status'], mandatory = true, parts: BoxState['parts'] = []): BoxState => ({
  box: { id: status + mandatory, label: 'x', mandatory, accepts: ['rc'], combine: 'single', formats: ['.pdf'] },
  status, parts, missingTypes: [], reasons: [], alternatives: 0,
});

describe('formatPages', () => {
  it('collapses consecutive pages and keeps gaps', () => {
    expect(formatPages([3, 4])).toBe('p3–4');
    expect(formatPages([7, 3, 4, 5])).toBe('p3–5, 7');
    expect(formatPages([1, 3])).toBe('p1, 3');
    expect(formatPages([2])).toBe('p2');
    expect(formatPages([])).toBe('');
  });
});

describe('sourceLine', () => {
  const docs = { a: { relPath: 'Documents.pdf' }, b: { relPath: 'RC.jpg' } } as unknown as Record<string, ClaimDocument>;
  it('names each file with its pages; whole files have none', () => {
    expect(sourceLine([{ docId: 'a', pages: [3, 4] }, { docId: 'b', pages: [] }], docs)).toBe('Documents.pdf p3–4, RC.jpg');
    expect(sourceLine([{ docId: 'gone', pages: [1] }], docs)).toBe('');
  });
});

describe('countsLine', () => {
  it('counts ready of the boxes that matter; skips not-needed and empty optional', () => {
    const s = [state('ready'), state('ready', false), state('missing'), state('check'), state('notNeeded'), state('empty', false)];
    expect(countsLine(s)).toBe('2 of 4 ready · 1 missing · 1 to check');
  });
});

describe('canBuild', () => {
  const part = [{ docId: 'a', pages: [1] }];
  it('needs something to build and no mandatory box missing', () => {
    expect(canBuild([state('ready', true, part)])).toBe(true);
    expect(canBuild([state('ready', true, part), state('missing')])).toBe(false);
    expect(canBuild([state('ready', true, part), state('missing', false)])).toBe(true);
    expect(canBuild([state('check', true, part)])).toBe(true);
    expect(canBuild([state('notNeeded')])).toBe(false);
  });
});

describe('formatSize', () => {
  it('uses KB under a megabyte, MB above', () => {
    expect(formatSize(500)).toBe('1 KB');
    expect(formatSize(150 * 1024)).toBe('150 KB');
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('identityMarks', () => {
  it('counts the identity results of the pages a box uses', () => {
    const s = state('ready', true, [{ docId: 'a', pages: [1, 2, 3] }]);
    const identity = { a: { 1: { status: 'match' as const }, 2: { status: 'mismatch' as const }, 3: { status: 'cantCheck' as const } } };
    expect(identityMarks(s, identity)).toEqual({ match: 1, mismatch: 1, cantCheck: 1 });
    expect(identityMarks(state('ready', true, [{ docId: 'z', pages: [1] }]), identity)).toEqual({ match: 0, mismatch: 0, cantCheck: 1 });
  });
});

describe('droppedReviews', () => {
  it('lists boxes that were reviewed before and are not now', () => {
    const boxes = { a: { reviewedAt: 't' }, b: {}, c: {} };
    expect(droppedReviews(['a', 'b'], boxes)).toEqual(['b']);
    expect(droppedReviews([], boxes)).toEqual([]);
    expect(droppedReviews(['gone'], boxes)).toEqual([]);
  });
});

describe('canTick', () => {
  const ok = { built: true, entry: {}, state: state('ready'), setMatchesRecipe: true };
  it('only a fresh, ready, built-this-session box of the current flow can be ticked', () => {
    expect(canTick(ok)).toBe(true);
    expect(canTick({ ...ok, entry: { stale: true } })).toBe(false);
    expect(canTick({ ...ok, state: state('check') })).toBe(false);
    expect(canTick({ ...ok, state: state('missing') })).toBe(false);
    expect(canTick({ ...ok, state: state('notNeeded') })).toBe(false);
    expect(canTick({ ...ok, state: undefined })).toBe(false);
    expect(canTick({ ...ok, setMatchesRecipe: false })).toBe(false);
    expect(canTick({ ...ok, built: false })).toBe(false);
  });
});
