// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import * as ReactDOMClient from 'react-dom/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const applyToClaims = vi.fn(async (..._a: unknown[]) => 2);
vi.mock('@/lib/claims/dispatch', async (orig) => ({
  ...(await orig<typeof import('@/lib/claims/dispatch')>()),
  applyToClaims: (...a: unknown[]) => applyToClaims(...a),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }));

import { CourierBatchBar } from '../CourierBatchBar';

describe('CourierBatchBar', () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  const onDone = vi.fn();
  const render = (ids: string[]) => act(() => { root.render(<CourierBatchBar ids={ids} onDone={onDone} />); });
  const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

  beforeEach(() => {
    applyToClaims.mockReset();
    applyToClaims.mockResolvedValue(2);
    toastSuccess.mockClear();
    toastError.mockClear();
    onDone.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('hidden with no ids', () => {
    render([]);
    expect(container.innerHTML).toBe('');
  });

  it('defaults the date to today (local)', () => {
    render(['a', 'b']);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(container.textContent).toContain('2 selected');
    expect((container.querySelector('input[type=date]') as HTMLInputElement).value).toBe(today);
  });

  it('Mark couriered applies the date to all ids and clears selection', async () => {
    render(['a', 'b']);
    const input = container.querySelector('input[type=date]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setter.call(input, '2026-11-20'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    act(() => { (container.querySelector('button') as HTMLButtonElement).click(); });
    await flush();
    expect(applyToClaims).toHaveBeenCalledTimes(1);
    expect(applyToClaims.mock.calls[0][0]).toEqual(['a', 'b']);
    const out = (applyToClaims.mock.calls[0][1] as (c: any) => any)({ id: 'a' });
    expect(out.courieredAt).toBe('2026-11-20');
    expect(toastSuccess).toHaveBeenCalledWith('2 claims marked couriered on 2026-11-20');
    expect(onDone).toHaveBeenCalled();
  });

  it('disables Mark couriered when the date is invalid', () => {
    render(['a']);
    const input = container.querySelector('input[type=date]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setter.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps selection and shows an error on failure', async () => {
    applyToClaims.mockRejectedValue(new Error('x'));
    render(['a']);
    act(() => { (container.querySelector('button') as HTMLButtonElement).click(); });
    await flush();
    expect(toastError).toHaveBeenCalledWith("Couldn't mark the claims couriered — try again.");
    expect(onDone).not.toHaveBeenCalled();
  });
});
