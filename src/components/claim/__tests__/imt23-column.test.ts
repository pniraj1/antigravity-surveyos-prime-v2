import { describe, it, expect } from 'vitest';
import { OPTIONAL_COLUMNS, DEFAULT_VISIBLE, loadVisibility, imt23ColumnShown, insertRowAt } from '../assessment-grid-config';

describe('IMT-23 column configuration', () => {
  it('is offered in the column picker', () => {
    const col = OPTIONAL_COLUMNS.find(c => c.key === 'imt23');
    expect(col).toBeDefined();
    expect(col!.label).toBe('IMT 23');
  });

  it('is visible by default and can be hidden', () => {
    expect(DEFAULT_VISIBLE.imt23).toBe(true);
    expect(loadVisibility().imt23).toBe(true);
  });
});

describe('imt23ColumnShown', () => {
  const row = (imt23?: boolean) => ({ imt23 } as { imt23?: boolean });

  it('hides the column when the policy has no IMT 23 and no row uses it', () => {
    expect(imt23ColumnShown(true, 'no', [row(), row(false)])).toBe(false);
    expect(imt23ColumnShown(true, 'na', [])).toBe(false);
  });

  it('keeps it while any row is ticked, so a tick is never hidden', () => {
    expect(imt23ColumnShown(true, 'no', [row(true)])).toBe(true);
  });

  it('follows the column picker when the policy has IMT 23 or is unanswered', () => {
    expect(imt23ColumnShown(true, 'yes', [])).toBe(true);
    expect(imt23ColumnShown(true, undefined, [])).toBe(true);
    expect(imt23ColumnShown(false, 'yes', [])).toBe(false);
  });
});

describe('insertRowAt', () => {
  it('puts a deleted row back where it was', () => {
    expect(insertRowAt(['a', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });
  it('appends when the old index is past the end', () => {
    expect(insertRowAt(['a'], 'z', 5)).toEqual(['a', 'z']);
  });
});
