import { describe, it, expect } from 'vitest';
import { groupPages, planChunks } from '../group-pages';
import type { ModelLimit } from '../page-limits';

const lim = (o: Partial<ModelLimit> = {}): ModelLimit => ({ model: 'm', method: 'text', maxRowsPerCall: 60, maxPagesPerCall: 4, imageScale: 1.5, measuredAt: '2026-10-31', modelVersion: 'm', ...o });

describe('groupPages', () => {
  it('fills a group up to maxRowsPerCall', () => expect(groupPages([1, 2, 3], [30, 30, 30], lim(), null)).toEqual([[1, 2], [3]]));
  it('a null estimate on the first scanned page → its own group', () => expect(groupPages([1, 2], [null, 10], lim(), null)).toEqual([[1], [2]]));
  it('later null uses the running average', () => expect(groupPages([1, 2, 3], [30, 20, null], lim(), null)).toEqual([[1, 2], [3]]));
  it('respects maxPagesPerCall', () => expect(groupPages([1, 2, 3], [1, 1, 1], lim({ maxPagesPerCall: 2 }), null)).toEqual([[1, 2], [3]]));
  it('respects the image cap', () => expect(groupPages([1, 2, 3], [1, 1, 1], lim(), 1)).toEqual([[1], [2], [3]]));
  it('zero expected rows still yields a group', () => expect(groupPages([1], [0], lim(), null)).toEqual([[1]]));
  it('a single page over the limit is its own group', () => expect(groupPages([1, 2], [100, 5], lim(), null)).toEqual([[1], [2]]));
});

describe('planChunks', () => {
  const chunks = [{ method: 'vision' as const, first: 0, last: 1 }, { method: 'vision' as const, first: 2, last: 3 }];
  it('no limit for the model → chunks unchanged', () => {
    expect(planChunks(chunks, 1, 'unknown', [null, null, null, null], { text: 1, vision: 2, imageCap: null }, [])).toEqual(chunks);
  });
  it('re-groups the remaining pages for a known model', () => {
    const table = [lim({ method: 'vision', maxPagesPerCall: 1 })];
    expect(planChunks(chunks, 1, 'm', [null, null, null, null], { text: 1, vision: 2, imageCap: null }, table)).toEqual([
      chunks[0], { method: 'vision', first: 2, last: 2 }, { method: 'vision', first: 3, last: 3 },
    ]);
  });
});
