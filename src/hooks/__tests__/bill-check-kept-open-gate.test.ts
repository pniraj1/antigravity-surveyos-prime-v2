import { describe, it, expect } from 'vitest';
import { keptOpenBlock } from '@/hooks/useBillCheckPrintGate';
import type { AssessmentRow } from '@/types/assessment';

const row = (p: string, keptOpen?: boolean) => ({ id: p, particulars: p, allowed: !keptOpen, keptOpen }) as unknown as AssessmentRow;

describe('keptOpenBlock', () => {
  it('blocks when any row is kept open and lists its particulars', () => {
    expect(keptOpenBlock([row('Bumper'), row('Headlamp', true)])).toEqual({ blocked: true, particulars: ['Headlamp'] });
  });
  it('does not block otherwise', () => {
    expect(keptOpenBlock([row('Bumper')])).toEqual({ blocked: false, particulars: [] });
  });
});
