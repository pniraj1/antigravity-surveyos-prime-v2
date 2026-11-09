import { describe, it, expect } from 'vitest';
import { OPTIONAL_COLUMNS, DEFAULT_VISIBLE, COL_WIDTHS } from '../bill-check/config';

describe('BillCheck Column Configuration', () => {
  it('includes disposal in optional columns and default visible', () => {
    const keys = OPTIONAL_COLUMNS.map(c => c.key);
    expect(keys).toContain('disposal');
    expect((DEFAULT_VISIBLE as Record<string, boolean>).disposal).toBe(true);
    expect((COL_WIDTHS as Record<string, string>).disposal).toBe('110px');
  });
});
