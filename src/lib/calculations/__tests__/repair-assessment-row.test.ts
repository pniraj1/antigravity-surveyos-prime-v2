import { describe, it, expect } from 'vitest';
import { createAssessmentRow, repairAssessmentRow } from '../assessment';
import type { AssessmentRow } from '@/types';

// The Bill Check tab crashed on one claim with
// "Cannot read properties of undefined (reading 'toLocaleString')".
// A persisted row carried `assessed: undefined`; `fmt()` reads it as a
// guaranteed number. These lock both the origin and the repair.

const row = (over: Partial<AssessmentRow>) =>
  ({ id: 'r1', section: 'parts', particulars: 'Bonnet', allowed: true, ...over }) as AssessmentRow;

describe('createAssessmentRow', () => {
  it('keeps its numeric defaults when an override is explicitly undefined', () => {
    // The spread trap: a present-but-undefined key used to win over the default.
    const r = createAssessmentRow('parts', { assessed: undefined, estimated: undefined });
    expect(r.assessed).toBe(0);
    expect(r.estimated).toBe(0);
  });

  it('still applies real overrides', () => {
    const r = createAssessmentRow('parts', { assessed: 5600, estimated: 8000 });
    expect(r.assessed).toBe(5600);
    expect(r.estimated).toBe(8000);
  });
});

describe('repairAssessmentRow', () => {
  it('makes an undefined assessed safe to format', () => {
    const r = repairAssessmentRow(row({ estimated: 34450, assessed: undefined }));
    expect(() => r.assessed.toLocaleString('en-IN')).not.toThrow();
  });

  it('falls back to estimated on an allowed row, matching the allow-toggle', () => {
    const r = repairAssessmentRow(row({ estimated: 34450, assessed: undefined, allowed: true }));
    expect(r.assessed).toBe(34450);
  });

  it('lands a not-allowed row at zero', () => {
    const r = repairAssessmentRow(row({ estimated: 34450, assessed: undefined, allowed: false }));
    expect(r.assessed).toBe(0);
  });

  it('repairs NaN, which would otherwise render as "NaN" and poison subtotals', () => {
    const r = repairAssessmentRow(row({ estimated: NaN, assessed: NaN, gst: NaN }));
    expect(r.estimated).toBe(0);
    expect(r.assessed).toBe(0);
    expect(r.gst).toBe(18);
  });

  it('leaves a healthy row untouched', () => {
    const r = repairAssessmentRow(row({ estimated: 8000, assessed: 5600, gst: 28 }));
    expect(r).toMatchObject({ estimated: 8000, assessed: 5600, gst: 28 });
  });

  it('does not treat a legitimate zero as missing', () => {
    const r = repairAssessmentRow(row({ estimated: 12000, assessed: 0, allowed: true }));
    expect(r.assessed).toBe(0);
  });
});
