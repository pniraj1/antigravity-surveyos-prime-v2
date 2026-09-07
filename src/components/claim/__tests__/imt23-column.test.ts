import { describe, it, expect } from 'vitest';
import { OPTIONAL_COLUMNS, DEFAULT_VISIBLE, loadVisibility } from '../assessment-grid-config';

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
