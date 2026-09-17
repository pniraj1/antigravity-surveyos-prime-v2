import { describe, it, expect } from 'vitest';
import { needsReview } from '@/lib/ai/needs-review';

const img = (n: string) => new File(['x'], n, { type: 'image/jpeg' });
const pdf = (n: string) => new File(['x'], n, { type: 'application/pdf' });

describe('needsReview', () => {
  it('is false for a single image', async () => {
    expect(await needsReview([img('a.jpg')], async () => 99)).toBe(false);
  });

  it('is false for a single-page PDF', async () => {
    expect(await needsReview([pdf('a.pdf')], async () => 1)).toBe(false);
  });

  it('is true for a multi-page PDF', async () => {
    expect(await needsReview([pdf('a.pdf')], async () => 3)).toBe(true);
  });

  it('is true for more than one file, without probing any PDF', async () => {
    let probed = 0;
    expect(await needsReview([img('a.jpg'), img('b.jpg')], async () => { probed++; return 1; })).toBe(true);
    expect(probed).toBe(0);
  });

  it('is false for an empty list', async () => {
    expect(await needsReview([], async () => 9)).toBe(false);
  });

  it('is false when the PDF cannot be opened (sent whole, as today)', async () => {
    expect(await needsReview([pdf('locked.pdf')], async () => { throw new Error('PasswordException'); })).toBe(false);
  });
});
