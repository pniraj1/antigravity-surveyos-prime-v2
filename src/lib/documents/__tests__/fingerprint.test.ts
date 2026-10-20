import { describe, it, expect } from 'vitest';
import type { ClaimDocument } from '@/types/documents';
import { fingerprintOf, reconcileEntry } from '../kit/fingerprint';

const entry = (over: Partial<ClaimDocument> = {}): ClaimDocument => ({
  id: 'd1', type: 'rc', relPath: 'RC Book.pdf', mime: 'application/pdf', size: 100,
  addedAt: '2026-01-01T00:00:00.000Z', source: 'upload', devices: ['PC'], ...over,
});

describe('fingerprint', () => {
  it('reconcile: first sight stores fingerprint', () => {
    const fp = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const { entry: out, reset } = reconcileEntry(entry({ pages: { 1: { type: 'rc', by: 'surveyor', confirmed: true } } }), fp);
    expect(reset).toBe(false);
    expect(out.fingerprint).toEqual({ size: 100, lastModified: 5, pageCount: 3 });
    expect(out.pages).toBeDefined();
  });

  it('reconcile: equal is unchanged', () => {
    const fp = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const e = entry({ fingerprint: fp, pageCount: 3, pages: { 1: { type: 'rc', by: 'surveyor', confirmed: true } } });
    const { entry: out, reset } = reconcileEntry(e, { ...fp });
    expect(reset).toBe(false);
    expect(out).toBe(e);
  });

  it('reconcile: lastModified change resets labels', () => {
    const fp = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const e = entry({ fingerprint: fp, pageCount: 3, pages: { 1: { type: 'rc', by: 'surveyor', confirmed: true } } });
    const next = fingerprintOf({ size: 100, lastModified: 6 }, 3);
    const { entry: out, reset } = reconcileEntry(e, next);
    expect(reset).toBe(true);
    expect(out.pages).toBeUndefined();
    expect(out.fingerprint).toEqual(next);
    expect(out.pageCount).toBe(3);
  });

  it('reconcile: pageCount 0 is unknown, not a change', () => {
    const fp = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const e = entry({ fingerprint: fp, pageCount: 3, pages: { 1: { type: 'rc', by: 'surveyor', confirmed: true } } });
    const { entry: out, reset } = reconcileEntry(e, fingerprintOf({ size: 100, lastModified: 5 }, 0));
    expect(reset).toBe(false);
    expect(out.pages).toBeDefined();
  });
});
