// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { Sidebar } from '../sidebar';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { createBlankClaim, type ClaimData } from '@/types/claim';
import type { ClaimDocument } from '@/types/documents';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/ai/reconciliation', () => ({ getConflictFields: () => [{}, {}] }));

const doc = (type: ClaimDocument['type'], addedAt: string): ClaimDocument => ({
  id: `${type}-1`, type, relPath: `${type}.pdf`, mime: 'application/pdf', size: 1, addedAt, source: 'upload', devices: [],
});

const verified = (c: ClaimData): ClaimData => ({
  ...c,
  documentVerification: Object.fromEntries(
    Object.entries(c.documentVerification).map(([k, v]) => [k, { ...v, status: 'YES' }]),
  ) as ClaimData['documentVerification'],
});

/** Final claim, checklist done, estimate on file, no bill: next step is Bill Check. */
const waitingForBill = (): ClaimData => ({
  ...verified(createBlankClaim('final')),
  documents: { e: doc('estimate', '2026-11-01T10:00:00Z') },
  printedAt: { surveyReport: '2026-11-02T10:00:00Z' },
});

describe('Sidebar claim progress', () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  const render = () => act(() => { root.render(<Sidebar />); });
  const navButton = (label: string) =>
    Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent?.includes(label)) as HTMLElement;

  beforeEach(() => {
    useUIStore.setState({ sidebarCollapsed: false });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useClaimStore.setState({ currentClaim: null });
  });

  it('final claim waiting for bill marks Bill Check as next', () => {
    useClaimStore.setState({ currentClaim: waitingForBill() });
    render();
    expect(navButton('Bill Check').querySelector('[title="Next step"]')).not.toBeNull();
    expect(navButton('Documents').querySelector('[title="Next step"]')).toBeNull();
  });

  it('done tab shows the tick', () => {
    useClaimStore.setState({ currentClaim: waitingForBill() });
    render();
    expect(navButton('Documents').textContent).toContain('✓');
  });

  it('waiting line shows label and count', () => {
    useClaimStore.setState({ currentClaim: waitingForBill() });
    render();
    expect(container.textContent).toMatch(/Waiting: .* · since .* · \d+ of \d+/);
  });

  it('hold note saves trimmed text on blur', () => {
    useClaimStore.setState({ currentClaim: waitingForBill() });
    render();
    const input = container.querySelector('input[aria-label="Why is this claim waiting?"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input, '  wait for bill  ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(useClaimStore.getState().currentClaim?.heldNote).toBe('wait for bill');
  });

  it('conflict count still shows on AI Review', () => {
    useClaimStore.setState({ currentClaim: waitingForBill() });
    render();
    expect(navButton('AI Review').textContent).toContain('2');
  });
});
