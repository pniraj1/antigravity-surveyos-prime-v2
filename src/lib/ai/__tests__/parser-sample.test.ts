import { describe, it, expect, vi, beforeEach } from 'vitest';

const { commit, set, doc, auth } = vi.hoisted(() => ({
  commit: vi.fn(),
  set: vi.fn(),
  doc: vi.fn((..._a: unknown[]) => ({})),
  auth: { currentUser: { uid: 'u1' } as { uid: string } | null },
}));

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth }));
vi.mock('firebase/firestore', () => ({
  doc,
  writeBatch: () => ({ set, commit }),
  Bytes: { fromUint8Array: (u: Uint8Array) => ({ bytes: u }) },
  Timestamp: { fromDate: (d: Date) => ({ date: d }) },
}));

import { allPagesDigital } from '../parser-first';
import { splitBytes, joinBytes, expiryFrom, sendParserSample, SAMPLES } from '../parser-sample';

const pdf = (n: number) => new File([new Uint8Array(n)], 'a.pdf', { type: 'application/pdf' });
const o = (file: File) => ({ file, docType: 'estimate', reason: 'r', pages: 1 });

beforeEach(() => {
  commit.mockReset().mockResolvedValue(undefined);
  set.mockReset();
  doc.mockClear();
  auth.currentUser = { uid: 'u1' };
});

describe('parser-sample', () => {
  it('splits and joins back unchanged', () => {
    const b = new Uint8Array(2_000_001);
    for (let i = 0; i < b.length; i++) b[i] = i % 251;
    const parts = splitBytes(b);
    expect(parts.map(p => p.length)).toEqual([900_000, 900_000, 200_001]);
    expect(Buffer.compare(joinBytes(parts), b)).toBe(0); // toEqual on 2M items is too slow
  });
  it('expires 15 days later', () => {
    expect(expiryFrom(new Date('2026-11-21T00:00:00Z')).toISOString()).toBe('2026-12-06T00:00:00.000Z');
  });
  it('skips non-pdf and oversized files', async () => {
    await sendParserSample(o(new File(['x'], 'a.png', { type: 'image/png' })));
    await sendParserSample(o(pdf(8_000_001)));
    expect(commit).not.toHaveBeenCalled();
  });
  it('skips when signed out', async () => {
    auth.currentUser = null;
    await sendParserSample(o(pdf(10)));
    expect(commit).not.toHaveBeenCalled();
  });
  it('writes pieces then the sample doc, keyed by sha-256', async () => {
    await sendParserSample(o(pdf(1_000_000)));
    expect(set).toHaveBeenCalledTimes(3);
    const sampleData = set.mock.calls[2][1];
    expect(sampleData).toMatchObject({ chunks: 2, size: 1_000_000, uid: 'u1' });
    expect(Object.keys(sampleData).sort()).toEqual(
      ['chunks', 'createdAt', 'docType', 'expireAt', 'fileName', 'pages', 'reason', 'size', 'uid'],
    );
    expect(set.mock.calls[0][1].expireAt).toBe(sampleData.expireAt);
    expect(set.mock.calls[1][1].expireAt).toBe(sampleData.expireAt);
    expect(set.mock.calls[0][1]).toMatchObject({ i: 0, uid: 'u1' });
    expect(set.mock.calls[1][1]).toMatchObject({ i: 1, uid: 'u1' });
    const sampleCall = doc.mock.calls.find(c => c[1] === SAMPLES && c.length === 3);
    expect(sampleCall?.[2]).toMatch(/^[0-9a-f]{64}$/);
  });
  it('truncates reason to 500 and fileName to 300 chars', async () => {
    await sendParserSample({ file: new File([new Uint8Array(5)], 'n'.repeat(400) + '.pdf', { type: 'application/pdf' }), docType: 'estimate', reason: 'r'.repeat(600), pages: 1 });
    const sampleData = set.mock.calls[1][1];
    expect(sampleData.reason).toHaveLength(500);
    expect(sampleData.fileName).toHaveLength(300);
  });
  it('swallows a rejected write', async () => {
    commit.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(sendParserSample(o(pdf(10)))).resolves.toBeUndefined();
  });
});

describe('allPagesDigital', () => {
  it('is true only when every page is text', () => {
    expect(allPagesDigital(['text', 'text'])).toBe(true);
    expect(allPagesDigital(['text', 'vision'])).toBe(false);
    expect(allPagesDigital(['vision'])).toBe(false);
    expect(allPagesDigital([])).toBe(false);
  });
});
