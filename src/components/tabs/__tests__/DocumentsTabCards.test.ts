import { describe, it, expect } from 'vitest';
import { DOC_GROUPS } from '../DocumentsTab';

describe('Documents tab cards', () => {
  it('has no Final Garage Bill card or empty group (bills are read in Assessment or Bill Check)', () => {
    expect(DOC_GROUPS.flatMap((g) => g.docs).map((d) => d.id)).not.toContain('final-bill');
    expect(DOC_GROUPS.every((g) => g.docs.length > 0)).toBe(true);
  });
});
