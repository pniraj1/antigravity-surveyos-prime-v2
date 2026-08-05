import { describe, it, expect } from 'vitest';
import { getConflictFields, fingerprintSources } from '../reconciliation';
import { createBlankClaim } from '@/types/claim';
import type { ClaimData } from '@/types';

/** Engine number disagrees between RC and Policy — an OCR S/5 misread. */
const CONFLICTING = {
  rc: { engine_number: '1.5CR08EVXW09578' },
  policy: { engine_number: '1.SCR08EVXW09578' },
};

function claimWith(
  extractedData: Record<string, Record<string, unknown>>,
  decisions?: ClaimData['reconciliationDecisions'],
): ClaimData {
  return {
    ...createBlankClaim(),
    extractedData,
    reconciliationDecisions: decisions,
  } as ClaimData;
}

describe('getConflictFields — decided fields drop out', () => {
  it('reports the conflict when nothing has been decided', () => {
    const conflicts = getConflictFields(claimWith(CONFLICTING));
    expect(conflicts.map((f) => f.path)).toContain('vehicle.engineNumber');
  });

  it('drops the field once the surveyor has decided it', () => {
    const claim = claimWith(CONFLICTING);
    const field = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!;

    const decided = claimWith(CONFLICTING, {
      'vehicle.engineNumber': {
        value: '1.5CR08EVXW09578',
        source: 'rc',
        decidedAt: '2026-08-05T10:00:00.000Z',
        sourcesSeen: field.sourcesFingerprint,
      },
    });

    expect(getConflictFields(decided).map((f) => f.path)).not.toContain('vehicle.engineNumber');
  });

  it('reopens the field when a re-scan changes a source value', () => {
    const claim = claimWith(CONFLICTING);
    const field = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!;

    const decision = {
      'vehicle.engineNumber': {
        value: '1.5CR08EVXW09578',
        source: 'rc',
        decidedAt: '2026-08-05T10:00:00.000Z',
        sourcesSeen: field.sourcesFingerprint,
      },
    };

    // Policy re-scanned; it now reads something different.
    const rescanned = claimWith(
      { rc: CONFLICTING.rc, policy: { engine_number: '1.5CR08EVXW09999' } },
      decision,
    );

    expect(getConflictFields(rescanned).map((f) => f.path)).toContain('vehicle.engineNumber');
  });

  it('reopens the field when a new document adds a third opinion', () => {
    const claim = claimWith(CONFLICTING);
    const field = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!;

    const withThird = claimWith(
      { ...CONFLICTING, fitness: { engine_number: '1.5CR08EVXW09578' } },
      {
        'vehicle.engineNumber': {
          value: '1.5CR08EVXW09578',
          source: 'rc',
          decidedAt: '2026-08-05T10:00:00.000Z',
          sourcesSeen: field.sourcesFingerprint,
        },
      },
    );

    expect(getConflictFields(withThird).map((f) => f.path)).toContain('vehicle.engineNumber');
  });
});

describe('source context snippets', () => {
  it('carries the verbatim text each value was read from', () => {
    const claim = claimWith({
      rc: {
        engine_number: '1.5CR08EVXW09578',
        engine_number_context: 'Engine No: 1.5CR08EVXW09578 Chassis No: MAT4',
      },
      policy: { engine_number: '1.SCR08EVXW09578' },
    });

    const field = getConflictFields(claim).find((f) => f.path === 'vehicle.engineNumber')!;
    const rc = field.sources.find((s) => s.origin === 'rc')!;
    const policy = field.sources.find((s) => s.origin === 'policy')!;

    expect(rc.contextSnippet).toBe('Engine No: 1.5CR08EVXW09578 Chassis No: MAT4');
    expect(policy.contextSnippet).toBe('');
  });
});

describe('fingerprintSources', () => {
  it('is stable regardless of source order', () => {
    const a = fingerprintSources([
      { origin: 'rc', value: 'ABC' },
      { origin: 'policy', value: 'XYZ' },
    ]);
    const b = fingerprintSources([
      { origin: 'policy', value: 'XYZ' },
      { origin: 'rc', value: 'ABC' },
    ]);
    expect(a).toBe(b);
  });

  it('ignores formatting differences the matcher already ignores', () => {
    const a = fingerprintSources([{ origin: 'rc', value: 'MH-12-AB-1234' }]);
    const b = fingerprintSources([{ origin: 'rc', value: 'MH12AB1234' }]);
    expect(a).toBe(b);
  });

  it('changes when a value changes', () => {
    const a = fingerprintSources([{ origin: 'rc', value: 'ABC' }]);
    const b = fingerprintSources([{ origin: 'rc', value: 'ABD' }]);
    expect(a).not.toBe(b);
  });
});
