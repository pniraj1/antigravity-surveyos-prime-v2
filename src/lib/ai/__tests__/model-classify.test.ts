import { describe, expect, test } from 'vitest';
import { classifyModel, SMALL_DOC_MAX_MS } from '../model-classify';
import type { ProbeResult } from '../probe-types';
import type { AccuracyResult } from '../probe-accuracy';

function probe(o: Partial<ProbeResult> = {}): ProbeResult {
  return {
    id: 'm1', status: 'ok', reason: '', vision: true, imageCap: 1,
    ctxWindow: 128000, msPerPage: 5_000, slow: false,
    source: { vision: 'probe', imageCap: 'probe', ctxWindow: 'probe' },
    probedAt: 1, consecutiveFailures: 0, ...o,
  };
}

function accuracy(o: Partial<AccuracyResult> = {}): AccuracyResult {
  return {
    modelId: 'm1', verdict: 'exact', extractedTotal: 100, expectedTotal: 100,
    totalDeltaPct: 0, extractedItemCount: 4, expectedItemCount: 4,
    ms: 1000, pages: 5, benchmarkFileName: 'e.pdf', ranAt: 1, error: null, ...o,
  };
}

describe('classifyModel', () => {
  test('a fast vision model with no accuracy result is small-docs only', () => {
    expect(classifyModel(probe())).toEqual({ smallDocs: true, largeDocs: false });
  });

  test('a fast accurate vision model is both', () => {
    expect(classifyModel(probe(), accuracy())).toEqual({ smallDocs: true, largeDocs: true });
  });

  test('a close verdict also qualifies for large docs', () => {
    expect(classifyModel(probe(), accuracy({ verdict: 'close' })).largeDocs).toBe(true);
  });

  test('a text-only model that reads estimates is large-docs only', () => {
    // A scanned licence needs vision; a digitally-born estimate does not.
    const r = classifyModel(probe({ vision: false }), accuracy());
    expect(r).toEqual({ smallDocs: false, largeDocs: true });
  });

  test('a slow wrong model is neither', () => {
    // nvidia/nemotron-nano-12b-v2-vl: 27s/page, dropped GST on the amount column.
    const r = classifyModel(probe({ msPerPage: 27_000 }), accuracy({ verdict: 'wrong' }));
    expect(r).toEqual({ smallDocs: false, largeDocs: false });
  });

  test('exactly at the small-doc ceiling still qualifies', () => {
    expect(classifyModel(probe({ msPerPage: SMALL_DOC_MAX_MS })).smallDocs).toBe(true);
  });

  test('one millisecond over the ceiling does not', () => {
    expect(classifyModel(probe({ msPerPage: SMALL_DOC_MAX_MS + 1 })).smallDocs).toBe(false);
  });

  test('a model that exceeded the latency cutoff is not small-docs', () => {
    expect(classifyModel(probe({ msPerPage: null, slow: true })).smallDocs).toBe(false);
  });

  test('a failed accuracy run does not qualify for large docs', () => {
    expect(classifyModel(probe(), accuracy({ verdict: 'failed' })).largeDocs).toBe(false);
  });

  test('a model that failed tier 1 is neither, whatever the accuracy says', () => {
    const r = classifyModel(probe({ status: 'unreachable' }), accuracy());
    expect(r).toEqual({ smallDocs: false, largeDocs: false });
  });
});
