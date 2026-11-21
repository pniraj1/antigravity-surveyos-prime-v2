// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { NextTabButton } from '../NextTabButton';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { createBlankClaim } from '@/types/claim';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('NextTabButton', () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;
  const render = () => act(() => { root.render(<NextTabButton />); });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useClaimStore.setState({ currentClaim: null });
    useUIStore.setState({ activeTab: 'dashboard' });
  });

  it('final claim on assessment offers Bill Check and navigates', () => {
    useClaimStore.setState({ currentClaim: createBlankClaim('final') });
    useUIStore.setState({ activeTab: 'assessment' });
    render();
    const btn = container.querySelector('button')!;
    expect(btn.textContent).toBe('Next: Bill Check →');
    act(() => btn.click());
    expect(useUIStore.getState().activeTab).toBe('bill-check');
  });

  it('spot claim on details skips hidden tabs to Report Center', () => {
    useClaimStore.setState({ currentClaim: createBlankClaim('spot') });
    useUIStore.setState({ activeTab: 'details' });
    render();
    expect(container.querySelector('button')?.textContent).toBe('Next: Report Center →');
  });

  it('renders nothing on the last tab', () => {
    useClaimStore.setState({ currentClaim: createBlankClaim('final') });
    useUIStore.setState({ activeTab: 'fees' });
    render();
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders nothing on the dashboard', () => {
    useClaimStore.setState({ currentClaim: createBlankClaim('final') });
    useUIStore.setState({ activeTab: 'dashboard' });
    render();
    expect(container.querySelector('button')).toBeNull();
  });
});
