import { describe, it, expect } from 'vitest';
import { EMPTY_PROBES, emptyProviderProbe, DURABLE_FAILURES, isAccuracyStale } from '../probe-types';
import type { AccuracyResult } from '../probe-accuracy';

describe('EMPTY_PROBES', () => {
  it('carries a block for every provider so the panel never reads undefined', () => {
    expect(Object.keys(EMPTY_PROBES.providers).sort()).toEqual(['gemini', 'groq', 'nvidia', 'ollama'].sort());
  });

  it('starts with no models and no error', () => {
    expect(EMPTY_PROBES.providers.nvidia.models).toEqual({});
    expect(EMPTY_PROBES.providers.nvidia.error).toBeNull();
  });

  it('has never been probed', () => {
    expect(EMPTY_PROBES.probedAt).toBe(0);
  });
});

describe('emptyProviderProbe', () => {
  it('returns a fresh object each call, not a shared reference', () => {
    const a = emptyProviderProbe();
    const b = emptyProviderProbe();
    expect(a).not.toBe(b);
    expect(a.models).not.toBe(b.models);
  });
});

describe('DURABLE_FAILURES', () => {
  it('contains only statuses that describe the model itself', () => {
    expect([...DURABLE_FAILURES].sort()).toEqual(['ctx-too-small', 'no-text-input', 'unreachable']);
  });

  it('excludes transient statuses — a timeout must never disable a model', () => {
    // A measured NVIDIA catalogue run produced 5 read timeouts and one HTTP 500
    // on models that are demonstrably alive.
    expect(DURABLE_FAILURES.has('transient')).toBe(false);
    expect(DURABLE_FAILURES.has('error')).toBe(false);
    expect(DURABLE_FAILURES.has('auth-error')).toBe(false);
    expect(DURABLE_FAILURES.has('ok')).toBe(false);
  });
});

function acc(fileName: string): AccuracyResult {
  return {
    modelId: 'm1', verdict: 'exact', extractedTotal: 100, expectedTotal: 100,
    totalDeltaPct: 0, extractedItemCount: 4, expectedItemCount: 4,
    ms: 1, pages: 5, benchmarkFileName: fileName, ranAt: 1, error: null,
  };
}

describe('accuracy on a provider probe', () => {
  it('a fresh provider probe has an empty accuracy map', () => {
    expect(emptyProviderProbe().accuracy).toEqual({});
  });

  it('a result from the current benchmark is not stale', () => {
    expect(isAccuracyStale(acc('estimate.pdf'), 'estimate.pdf')).toBe(false);
  });

  it('a result from a replaced benchmark is stale', () => {
    expect(isAccuracyStale(acc('old.pdf'), 'estimate.pdf')).toBe(true);
  });

  it('any result is stale when no benchmark is set', () => {
    expect(isAccuracyStale(acc('estimate.pdf'), null)).toBe(true);
  });
});
