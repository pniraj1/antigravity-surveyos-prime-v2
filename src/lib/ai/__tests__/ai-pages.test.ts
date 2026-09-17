import { describe, it, expect } from 'vitest';
import { resolveAIPages, setAIPages, getAIPages } from '@/lib/ai/ai-pages';

describe('resolveAIPages', () => {
  it('returns every page when there is no selection', () => {
    expect(resolveAIPages(4, undefined)).toEqual([1, 2, 3, 4]);
  });

  it('treats an empty selection as "all pages"', () => {
    expect(resolveAIPages(3, [])).toEqual([1, 2, 3]);
  });

  it('keeps only the selected pages, ascending and de-duplicated', () => {
    expect(resolveAIPages(5, [4, 1, 4])).toEqual([1, 4]);
  });

  it('ignores page numbers outside 1..numPages', () => {
    expect(resolveAIPages(4, [0, 2, 9])).toEqual([2]);
  });

  it('returns nothing when every selected page is out of range', () => {
    expect(resolveAIPages(4, [0, 9])).toEqual([]);
  });
});

describe('setAIPages / getAIPages', () => {
  it('round-trips a selection on the same File object', () => {
    const f = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    setAIPages(f, [2, 3]);
    expect(getAIPages(f)).toEqual([2, 3]);
  });

  it('is undefined for a File that was never tagged', () => {
    const f = new File(['x'], 'b.pdf', { type: 'application/pdf' });
    expect(getAIPages(f)).toBeUndefined();
  });
});
