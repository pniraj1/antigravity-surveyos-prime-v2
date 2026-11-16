import { describe, it, expect } from 'vitest';
import { duplicateParticularsOf, rowTintClass } from '../assessment-grid-config';
import type { AssessmentRow } from '@/types';

const row = (p: Partial<AssessmentRow>) => ({ id: 'x', particulars: '', allowed: true, ...p }) as AssessmentRow;

describe('shared grid helpers', () => {
  it('finds duplicates ignoring case and spacing', () => {
    const d = duplicateParticularsOf([row({ particulars: 'Front  Bumper' }), row({ particulars: 'front bumper' }), row({ particulars: 'Grille' })]);
    expect([...d]).toEqual(['front bumper']);
  });

  it('tints disallowed and duplicate rows the same way in both grids', () => {
    expect(rowTintClass(row({ allowed: false }), false, false)).toContain('bg-muted/40');
    expect(rowTintClass(row({}), true, false)).toContain('bg-orange-500/10');
  });
});
