import { describe, it, expect } from 'vitest';
import { layoutLines, countAmountLines } from '../text-lines';

const it_ = (str: string, x: number, y: number, width = str.length * 5) => ({ str, transform: [10, 0, 0, 10, x, y], width });

describe('layoutLines', () => {
  it('groups items into lines top to bottom', () => {
    const out = layoutLines([it_('Bumper', 0, 700), it_('Door', 0, 680), it_('Qty', 40, 700.5)]);
    expect(out).toBe('Bumper Qty\nDoor');
  });
  it('joins a wide gap with " | "', () => {
    expect(layoutLines([it_('Bumper', 0, 700), it_('2,450.00', 300, 700)])).toBe('Bumper | 2,450.00');
  });
  it('sorts items that arrive out of order', () => {
    expect(layoutLines([it_('B', 300, 680), it_('C', 0, 680), it_('A', 0, 700)])).toBe('A\nC | B');
  });
  it('ignores empty items and returns "" for nothing', () => {
    expect(layoutLines([])).toBe('');
    expect(layoutLines([it_('', 0, 0), it_(' ', 5, 0)])).toBe('');
  });
  it('tolerates items without transform', () => {
    expect(layoutLines([{ str: 'a' } as never, { str: 'b' } as never])).toBe('a b');
  });
});

describe('countAmountLines', () => {
  it('counts lines ending in an amount', () => {
    expect(countAmountLines('Bumper | 1 | 2,450.00\nTotal\n')).toBe(1);
  });
});
