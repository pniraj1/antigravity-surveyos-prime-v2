import { describe, it, expect } from 'vitest';
import type { ClaimDocument, PageLabel } from '@/types/documents';
import { fingerprintOf, reconcileEntry, reconcileKnown } from '../kit/fingerprint';

const label: PageLabel = { type: 'rc', by: 'surveyor', confirmed: true };
const entry = (over: Partial<ClaimDocument> = {}): ClaimDocument => ({
  id: 'd1', type: 'rc', relPath: 'RC Book.pdf', mime: 'application/pdf', size: 100,
  addedAt: '2026-01-01T00:00:00.000Z', source: 'upload', devices: ['PC'], ...over,
});

describe('fingerprint', () => {
  it('reconcile: first sight stores fingerprint', () => {
    const fp = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const { entry: out, reset } = reconcileEntry(entry({ pages: { 1: label } }), fp, 'PC');
    expect(reset).toBe(false);
    expect(out.fingerprints).toEqual({ PC: { size: 100, lastModified: 5, pageCount: 3 } });
    expect(out.pages).toBeDefined();
  });

  it('reconcile: equal is unchanged', () => {
    const fp = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const e = entry({ fingerprints: { PC: fp }, pageCount: 3, pages: { 1: label } });
    const { entry: out, reset } = reconcileEntry(e, { ...fp }, 'PC');
    expect(reset).toBe(false);
    expect(out).toBe(e);
  });

  it('reconcile: lastModified change resets labels', () => {
    const fp = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const e = entry({ fingerprints: { PC: fp }, pageCount: 3, pages: { 1: label } });
    const next = fingerprintOf({ size: 100, lastModified: 6 }, 3);
    const { entry: out, reset } = reconcileEntry(e, next, 'PC');
    expect(reset).toBe(true);
    expect(out.pages).toBeUndefined();
    expect(out.fingerprints?.PC).toEqual(next);
    expect(out.pageCount).toBe(3);
  });

  it('reconcile: pageCount 0 is unknown, not a change', () => {
    const fp = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const e = entry({ fingerprints: { PC: fp }, pageCount: 3, pages: { 1: label } });
    const { entry: out, reset } = reconcileEntry(e, fingerprintOf({ size: 100, lastModified: 5 }, 0), 'PC');
    expect(reset).toBe(false);
    expect(out.pages).toBeDefined();
    expect(out).toBe(e); // the known page count is not overwritten by "unknown"
  });

  it("reconcile: another device's fingerprint with different mtime but same size keeps labels", () => {
    const other = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const e = entry({ fingerprints: { Office: other }, pages: { 1: label } });
    const mine = fingerprintOf({ size: 100, lastModified: 99 }, 3);
    const { entry: out, reset } = reconcileEntry(e, mine, 'PC');
    expect(reset).toBe(false);
    expect(out.pages).toBeDefined();
    expect(out.fingerprints).toEqual({ Office: other, PC: mine });
  });

  it("reconcile: another device's fingerprint with different size resets labels", () => {
    const other = fingerprintOf({ size: 100, lastModified: 5 }, 3);
    const e = entry({ fingerprints: { Office: other }, pages: { 1: label } });
    const mine = fingerprintOf({ size: 250, lastModified: 99 }, 3);
    const { entry: out, reset } = reconcileEntry(e, mine, 'PC');
    expect(reset).toBe(true);
    expect(out.pages).toBeUndefined();
    expect(out.fingerprints).toEqual({ Office: other, PC: mine });
  });
});

describe('reconcileKnown', () => {
  const file = { size: 100, lastModified: 5 };

  it('changed is true on first sight, then false once stored', () => {
    const first = reconcileKnown([entry({ mime: 'image/png', relPath: 'RC.png' })], file, 'PC');
    expect(first.changed).toBe(true);
    expect(first.reset).toBe(false);
    const again = reconcileKnown(first.entries, file, 'PC');
    expect(again.changed).toBe(false);
    expect(again.entries[0]).toBe(first.entries[0]);
  });

  it('changed and reset when the file was replaced', () => {
    const stored = reconcileKnown([entry({ pages: { 1: label } })], file, 'PC').entries;
    const r = reconcileKnown(stored, { size: 100, lastModified: 6 }, 'PC');
    expect(r.changed).toBe(true);
    expect(r.reset).toBe(true);
    expect(r.entries[0].pages).toBeUndefined();
  });

  it('uses 1 page for non-PDFs and the known count for PDFs', () => {
    const img = reconcileKnown([entry({ mime: 'image/jpeg', relPath: 'RC.jpg' })], file, 'PC').entries[0];
    expect(img.fingerprints?.PC.pageCount).toBe(1);
    const pdf = reconcileKnown([entry({ pageCount: 4 })], file, 'PC').entries[0];
    expect(pdf.fingerprints?.PC.pageCount).toBe(4);
    const unknown = reconcileKnown([entry()], file, 'PC').entries[0];
    expect(unknown.fingerprints?.PC.pageCount).toBe(0);
  });
});
