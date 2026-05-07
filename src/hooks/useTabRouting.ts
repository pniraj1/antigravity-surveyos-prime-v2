'use client';

import { useEffect, useRef } from 'react';
import { useUIStore, type AppTab } from '@/stores/ui-store';

const VALID_TABS = new Set<string>([
  'dashboard', 'documents', 'review', 'details', 'assessment',
  'reports', 'insured-report', 'bill-check', 'photos', 'fees',
  'reinspection', 'valuation', 'profile', 'learning', 'admin', 'cloud-vault',
]);

function tabFromUrl(): AppTab {
  if (typeof window === 'undefined') return 'dashboard';
  const raw = new URLSearchParams(window.location.search).get('tab') ?? '';
  return VALID_TABS.has(raw) ? (raw as AppTab) : 'dashboard';
}

/**
 * Keeps the browser URL (?tab=…) in sync with the Zustand activeTab state.
 *
 * - On mount:          reads ?tab= from URL → sets store (no pushState, URL already correct)
 * - On tab change:     pushes ?tab= to history so the back button walks tab history
 * - On popstate:       reads URL back into store without re-pushing (prevents double entries)
 *
 * Call once at the top of the Dashboard component.
 */
export function useTabRouting() {
  const { activeTab, setActiveTab } = useUIStore();
  const initialized = useRef(false);
  const fromPopState = useRef(false);

  useEffect(() => {
    // First run: sync URL → store. Skip pushState; URL is already correct.
    if (!initialized.current) {
      initialized.current = true;
      const urlTab = tabFromUrl();
      if (urlTab !== activeTab) {
        setActiveTab(urlTab);
        // The next effect run (caused by setActiveTab) will hit the guard below
        // because the URL already has urlTab, so no duplicate pushState.
      }
      return;
    }

    // Subsequent runs: a tab change happened in the store.
    // If it came from popstate, the URL is already correct — skip pushState.
    if (fromPopState.current) {
      fromPopState.current = false;
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') === activeTab) return; // already in sync
    url.searchParams.set('tab', activeTab);
    window.history.pushState({ tab: activeTab }, '', url.toString());
  }, [activeTab, setActiveTab]);

  // Back / forward button: read URL → store (but don't re-push)
  useEffect(() => {
    const handlePopState = () => {
      fromPopState.current = true;
      setActiveTab(tabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveTab]);
}
