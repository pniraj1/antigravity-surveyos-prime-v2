// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const m = vi.hoisted(() => ({
  listParserSamples: vi.fn(),
  loadParserSample: vi.fn(),
  deleteParserSample: vi.fn(),
  openSaveTarget: vi.fn(),
  saveToTarget: vi.fn(),
}));
vi.mock('@/lib/ai/parser-sample', () => m);
const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));

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
  toastError.mockReset();
  m.openSaveTarget.mockResolvedValue('fallback');
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
    m.saveToTarget.mockResolvedValue(true);
    await mount();
    await clickDownload();
    expect(m.deleteParserSample).toHaveBeenCalledWith('abcdef123456', 1);
    expect(text()).not.toContain('MH40_INV.pdf');
  });
  it('does not delete when the save is cancelled', async () => {
    m.saveToTarget.mockResolvedValue(false);
    await mount();
    await clickDownload();
    expect(m.saveToTarget).toHaveBeenCalled();
    expect(m.deleteParserSample).not.toHaveBeenCalled();
    expect(text()).toContain('MH40_INV.pdf');
  });
  it('does not load or delete when the picker is cancelled', async () => {
    m.openSaveTarget.mockResolvedValue(null);
    await mount();
    await clickDownload();
    expect(m.loadParserSample).not.toHaveBeenCalled();
    expect(m.deleteParserSample).not.toHaveBeenCalled();
    expect(text()).toContain('MH40_INV.pdf');
  });
  it('keeps the row and toasts when saving fails', async () => {
    m.saveToTarget.mockRejectedValue(new Error('disk full'));
    await mount();
    await clickDownload();
    expect(toastError).toHaveBeenCalledWith('disk full');
    expect(m.deleteParserSample).not.toHaveBeenCalled();
    expect(text()).toContain('MH40_INV.pdf');
  });
  it('keeps the row and toasts when the integrity check rejects', async () => {
    m.loadParserSample.mockRejectedValue(new Error('incomplete'));
    await mount();
    await clickDownload();
    expect(toastError).toHaveBeenCalledWith('incomplete');
    expect(m.saveToTarget).not.toHaveBeenCalled();
    expect(m.deleteParserSample).not.toHaveBeenCalled();
  });
  it('says saved-but-not-deleted when the delete fails', async () => {
    m.saveToTarget.mockResolvedValue(true);
    m.deleteParserSample.mockRejectedValue(new Error('denied'));
    await mount();
    await clickDownload();
    expect(toastError).toHaveBeenCalledWith("Saved, but couldn't delete it from the server.");
    expect(text()).toContain('MH40_INV.pdf');
  });
  it('shows a load error, not the empty state', async () => {
    m.listParserSamples.mockRejectedValue(new Error('nope'));
    await mount();
    expect(toastError).toHaveBeenCalledWith('nope');
    expect(text()).toContain("Couldn't load samples.");
    expect(text()).not.toContain('No unread bills right now.');
  });
  it('shows an empty state', async () => {
    m.listParserSamples.mockResolvedValue([]);
    await mount();
    expect(text()).toContain('No unread bills right now.');
  });
});
