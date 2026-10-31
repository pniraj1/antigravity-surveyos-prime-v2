import { describe, it, expect } from 'vitest';
import { pageRuns, chunkRuns, profilePages, isGarbageText } from '../page-runs';

const rich = 'Rs 1,200 spare part amount '.repeat(10);

describe('pageRuns', () => {
  it('text,text,vision,text → three runs', () => {
    expect(pageRuns(['text', 'text', 'vision', 'text'])).toEqual([
      { method: 'text', pages: [0, 1] },
      { method: 'vision', pages: [2] },
      { method: 'text', pages: [3] },
    ]);
  });
  it("force 'vision' → one run", () => {
    expect(pageRuns(['text', 'vision', 'text'], 'vision')).toEqual([{ method: 'vision', pages: [0, 1, 2] }]);
  });
  it('empty → no runs', () => expect(pageRuns([])).toEqual([]));
  it('garbage page stays vision', () => {
    const garbage = '\u0001\u0002\u0003\u0004§¤¶'.repeat(40);
    expect(pageRuns(profilePages([garbage]).pages.map(p => p.mode))).toEqual([{ method: 'vision', pages: [0] }]);
  });
});

describe('chunkRuns', () => {
  it('chunks never cross a run; text and vision sizes apply per run', () => {
    const runs = pageRuns(['text', 'text', 'text', 'vision', 'vision', 'vision']);
    expect(chunkRuns(runs, 2, 2)).toEqual([
      { method: 'text', first: 0, last: 1 }, { method: 'text', first: 2, last: 2 },
      { method: 'vision', first: 3, last: 4 }, { method: 'vision', first: 5, last: 5 },
    ]);
    expect(chunkRuns(runs, 1, 2).filter(c => c.method === 'text')).toHaveLength(3);
  });
});

describe('isGarbageText', () => {
  it('newlines count as printable', () => {
    expect(isGarbageText('ab\n'.repeat(40))).toBe(false);
  });
  it('rich text page is text mode', () => {
    expect(profilePages([rich]).pages[0].mode).toBe('text');
  });
});
