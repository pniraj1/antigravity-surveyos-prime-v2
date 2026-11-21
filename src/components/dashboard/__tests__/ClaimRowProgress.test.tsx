// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import * as ReactDOMClient from 'react-dom/client';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const applyToClaims = vi.fn(async () => 1);
vi.mock('@/lib/claims/dispatch', async (orig) => ({
  ...(await orig<typeof import('@/lib/claims/dispatch')>()),
  applyToClaims: (...a: unknown[]) => (applyToClaims as any)(...a),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...a: unknown[]) => toastError(...a) } }));

import { ClaimRowProgress } from '../ClaimRowProgress';
import type { ClaimsListItem } from '../ClaimRowProgress';

const base = {
  id: 'c1',
  isCompleted: false,
  progress: { label: 'Waiting: Final report', done: 3, total: 6, since: '2026-11-05', nextTab: null },
} as unknown as ClaimsListItem;

describe('ClaimRowProgress', () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  const rowClick = vi.fn();

  const render = (claim: ClaimsListItem, readOnly = false) =>
    act(() => {
      root.render(
        <div onClick={rowClick}>
          <ClaimRowProgress claim={claim} readOnly={readOnly} />
        </div>,
      );
    });

  beforeEach(() => {
    applyToClaims.mockReset();
    applyToClaims.mockResolvedValue(1);
    toastError.mockClear();
    rowClick.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows Waiting label and since date', () => {
    render(base);
    expect(container.textContent).toContain('Waiting: Final report');
    expect(container.textContent).toContain('since');
    expect(container.textContent).toContain('3 of 6');
  });

  it('shows Done when completed', () => {
    render({ ...base, isCompleted: true });
    expect(container.textContent).toContain('Done');
  });

  it('changing the date saves withCourieredAt for that id', async () => {
    render(base);
    const input = container.querySelector('input[type="date"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, '2026-11-20');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(applyToClaims).toHaveBeenCalledTimes(1);
    const [ids, fn] = applyToClaims.mock.calls[0] as unknown as [string[], (c: any) => any];
    expect(ids).toEqual(['c1']);
    expect(fn({ id: 'c1' }).courieredAt).toBe('2026-11-20');
  });

  it('clicking the date input or checkbox does not propagate to the row', () => {
    render(base);
    act(() => {
      (container.querySelector('input[type="date"]') as HTMLElement).click();
      (container.querySelector('input[type="checkbox"]') as HTMLElement).click();
    });
    expect(rowClick).not.toHaveBeenCalled();
  });

  it('readOnly hides the inputs', () => {
    render(base, true);
    expect(container.querySelector('input')).toBeNull();
  });

  const type = async (el: HTMLInputElement, v: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, el.type === 'checkbox' ? 'checked' : 'value')!.set!;
    await act(async () => {
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const dateInput = () => container.querySelector('input[type="date"]') as HTMLInputElement;

  it('typing a partial year does not save', async () => {
    render(base);
    await type(dateInput(), '0002-11-20');
    await type(dateInput(), '0020-11-20');
    expect(applyToClaims).not.toHaveBeenCalled();
  });

  it('a full date saves once, and blur does not save it again', async () => {
    render(base);
    await type(dateInput(), '2026-11-20');
    await act(async () => { dateInput().dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(applyToClaims).toHaveBeenCalledTimes(1);
  });

  it('a rejected save shows the toast and reverts', async () => {
    applyToClaims.mockRejectedValue(new Error('x'));
    render({ ...base, courieredAt: '2026-11-01' } as ClaimsListItem);
    await type(dateInput(), '2026-11-20');
    expect(toastError).toHaveBeenCalledWith("Couldn't save the courier date — try again.");
    expect(dateInput().value).toBe('2026-11-01');
  });

  it('checkbox save calls withPortalUploaded', async () => {
    render(base);
    await act(async () => { (container.querySelector('input[type="checkbox"]') as HTMLElement).click(); });
    const [ids, fn] = applyToClaims.mock.calls[0] as unknown as [string[], (c: any) => any];
    expect(ids).toEqual(['c1']);
    expect(typeof fn({ id: 'c1' }).portalUploadedAt).toBe('string');
  });

  it('a date-only since renders that same day', () => {
    render({ ...base, progress: { ...base.progress!, since: '2026-11-05' } } as ClaimsListItem);
    expect(container.textContent).toMatch(/5 Nov|Nov 5/);
  });
});
