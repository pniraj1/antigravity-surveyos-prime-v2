// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const m = vi.hoisted(() => ({
  listParserSamples: vi.fn(),
  loadParserSample: vi.fn(),
  deleteParserSample: vi.fn(),
  saveBlob: vi.fn(),
}));
vi.mock('@/lib/ai/parser-sample', () => m);
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { ParserSamplesCard } from '../ParserSamplesCard';

const DAY = 86_400_000;
const sample = {
  id: 'abcdef123456', uid: 'u', docType: 'estimate', fileName: 'MH40_INV.pdf',
  reason: 'no header line found', pages: 13, size: 204_800, chunks: 1,
  createdAt: { toDate: () => new Date() }, expireAt: { toMillis: () => Date.now() + 10 * DAY - 1000 },
};

let container: HTMLDivElement;
let root: Root;

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const mount = async () => { await act(async () => { root.render(<ParserSamplesCard />); }); await flush(); };
const text = () => container.textContent ?? '';
const clickDownload = async () => {
  const btn = Array.from(container.querySelectorAll('button')).find(b => /download/i.test(b.textContent ?? ''))!;
  await act(async () => { btn.click(); });
  await flush();
};

beforeEach(() => {
  Object.values(m).forEach(f => f.mockReset());
  m.listParserSamples.mockResolvedValue([sample]);
  m.loadParserSample.mockResolvedValue(new Blob(['x']));
  m.deleteParserSample.mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('ParserSamplesCard', () => {
  it('lists samples with reason, pages and days left', async () => {
    await mount();
    for (const t of ['MH40_INV.pdf', '13 pages', 'no header line', '10 days left']) expect(text()).toContain(t);
  });
  it('deletes after a confirmed save and drops the row', async () => {
    m.saveBlob.mockResolvedValue(true);
    await mount();
    await clickDownload();
    expect(m.deleteParserSample).toHaveBeenCalledWith('abcdef123456', 1);
    expect(text()).not.toContain('MH40_INV.pdf');
  });
  it('does not delete when the save is cancelled', async () => {
    m.saveBlob.mockResolvedValue(false);
    await mount();
    await clickDownload();
    expect(m.saveBlob).toHaveBeenCalled();
    expect(m.deleteParserSample).not.toHaveBeenCalled();
    expect(text()).toContain('MH40_INV.pdf');
  });
  it('shows an empty state', async () => {
    m.listParserSamples.mockResolvedValue([]);
    await mount();
    expect(text()).toContain('No unread bills right now.');
  });
});
