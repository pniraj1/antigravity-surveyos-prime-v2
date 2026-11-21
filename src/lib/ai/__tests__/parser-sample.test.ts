import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { commit, set, del, getDocs, doc, auth } = vi.hoisted(() => ({
  commit: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn((..._a: unknown[]) => ({})),
  auth: { currentUser: { uid: 'u1' } as { uid: string } | null },
}));

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth }));
vi.mock('firebase/firestore', () => ({
  doc,
  collection: vi.fn((..._a: unknown[]) => ({})),
  query: vi.fn((..._a: unknown[]) => ({})),
  orderBy: vi.fn((..._a: unknown[]) => ({})),
  getDocs,
  writeBatch: () => ({ set, delete: del, commit }),
  Bytes: { fromUint8Array: (u: Uint8Array) => ({ bytes: u, toUint8Array: () => u }) },
  Timestamp: { fromDate: (d: Date) => ({ date: d }) },
}));

import { allPagesDigital } from '../parser-first';
import {
  splitBytes, joinBytes, expiryFrom, sendParserSample, SAMPLES,
  loadParserSample, deleteParserSample, openSaveTarget, saveToTarget,
} from '../parser-sample';

const pdf = (n: number) => new File([new Uint8Array(n)], 'a.pdf', { type: 'application/pdf' });
const o = (file: File) => ({ file, docType: 'estimate', reason: 'r', pages: 1 });

beforeEach(() => {
  commit.mockReset().mockResolvedValue(undefined);
  set.mockReset();
  del.mockReset();
  getDocs.mockReset();
  doc.mockClear();
  auth.currentUser = { uid: 'u1' };
});

afterEach(() => { vi.unstubAllGlobals(); });

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

const piece = (i: number, ...b: number[]) => ({ data: () => ({ i, data: { toUint8Array: () => new Uint8Array(b) } }) });
const bytesOf = async (blob: Blob) => Array.from(new Uint8Array(await blob.arrayBuffer()));

describe('loadParserSample', () => {
  it('joins pieces in numeric i order, not arrival or string order', async () => {
    const order = [10, 2, 0, 1, 3, 4, 5, 6, 7, 8, 9];
    getDocs.mockResolvedValue({ docs: order.map(i => piece(i, i)) });
    const blob = await loadParserSample('x', 11, 11);
    expect(blob.type).toBe('application/pdf');
    expect(await bytesOf(blob)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it('rejects when a piece is missing', async () => {
    getDocs.mockResolvedValue({ docs: [piece(0, 1, 2)] });
    await expect(loadParserSample('x', 2, 4)).rejects.toThrow(/incomplete/);
  });
  it('rejects when the size differs', async () => {
    getDocs.mockResolvedValue({ docs: [piece(0, 1, 2)] });
    await expect(loadParserSample('x', 1, 3)).rejects.toThrow(/incomplete/);
  });
});

describe('deleteParserSample', () => {
  it('deletes every piece and the sample in one commit', async () => {
    commit.mockResolvedValue(undefined);
    await deleteParserSample('x', 3);
    expect(del).toHaveBeenCalledTimes(4);
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe('save target', () => {
  const win: { showSaveFilePicker?: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn> } = { confirm: vi.fn() };
  const anchor = { click: vi.fn(), remove: vi.fn(), href: '', download: '' };
  const append = vi.fn();
  beforeEach(() => {
    win.showSaveFilePicker = undefined;
    win.confirm.mockReset();
    anchor.click.mockReset(); anchor.remove.mockReset(); append.mockReset();
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: append } });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
  });
  const blob = new Blob(['x']);

  it('picker: true only after close()', async () => {
    const log: string[] = [];
    const handle = { createWritable: async () => ({
      write: async () => { log.push('write'); },
      close: async () => { await Promise.resolve(); log.push('close'); },
    }) };
    win.showSaveFilePicker = vi.fn().mockResolvedValue(handle);
    const t = await openSaveTarget('a.pdf');
    expect(win.showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'a.pdf' }));
    expect(await saveToTarget(t!, blob, 'a.pdf')).toBe(true);
    expect(log).toEqual(['write', 'close']);
  });
  it('picker: AbortError means cancelled (null)', async () => {
    win.showSaveFilePicker = vi.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
    expect(await openSaveTarget('a.pdf')).toBeNull();
  });
  it('picker: other errors reject', async () => {
    win.showSaveFilePicker = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(openSaveTarget('a.pdf')).rejects.toThrow('boom');
  });
  it('picker: a failing write rejects (so nothing is deleted)', async () => {
    const handle = { createWritable: async () => ({ write: async () => { throw new Error('disk'); }, close: vi.fn() }) };
    await expect(saveToTarget(handle, blob, 'a.pdf')).rejects.toThrow('disk');
  });
  it('fallback: attaches the anchor, clicks, and follows confirm', async () => {
    expect(await openSaveTarget('a.pdf')).toBe('fallback');
    win.confirm.mockReturnValue(false);
    expect(await saveToTarget('fallback', blob, 'a.pdf')).toBe(false);
    win.confirm.mockReturnValue(true);
    expect(await saveToTarget('fallback', blob, 'a.pdf')).toBe(true);
    expect(append).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledTimes(2);
    expect(anchor.remove).toHaveBeenCalledTimes(2);
  });
});
