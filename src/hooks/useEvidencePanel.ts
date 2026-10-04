'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { isNarrowViewport, NARROW_QUERY } from '@/lib/navigation/viewport';

const MIN_WIDTH = 280;

function subscribeNarrow(onChange: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** Live phone-layout flag; re-renders when the window crosses the breakpoint. */
export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, isNarrowViewport, () => false);
}

/**
 * Open/closed state and drag-to-resize for the inline evidence panel shared by
 * the Details and Review tabs. On a laptop it is a resizable side column whose
 * open state and width persist per tab. On a phone it starts closed, opens as a
 * full-screen overlay (EvidencePanelSlot), opens itself when the surveyor taps
 * a field's evidence, and never overwrites the laptop's saved preference.
 */
export function useEvidencePanel(storageKey: string, defaultWidth: number) {
  const isNarrow = useIsNarrow();
  const [panelOpen, setPanelOpen] = useState(() => {
    if (isNarrowViewport()) return false;
    try { return localStorage.getItem(storageKey + '-open') !== 'false'; } catch { return true; }
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    try { return parseInt(localStorage.getItem(storageKey + '-width') || String(defaultWidth), 10); } catch { return defaultWidth; }
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    if (!isNarrow) {
      try { localStorage.setItem(storageKey + '-open', String(next)); } catch {}
    }
  };

  // A field tapped on a phone should show its evidence, which is otherwise hidden.
  // Only a tap made while this tab is showing counts: `field` is global, so a
  // tap left over from another tab must not pop the overlay open on arrival.
  const field = useEvidenceStore((s) => s.field);
  const seenField = useRef(field);
  useEffect(() => {
    if (field && field !== seenField.current && isNarrowViewport()) setPanelOpen(true);
    seenField.current = field;
  }, [field]);

  const onMouseDownHandle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    const onMove = (me: MouseEvent) => {
      const container = containerRef.current;
      const maxW = container ? container.offsetWidth - 400 : 800;
      setPanelWidth(Math.min(Math.max(startWidth + (startX - me.clientX), MIN_WIDTH), maxW));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  useEffect(() => {
    try { localStorage.setItem(storageKey + '-width', String(panelWidth)); } catch {}
  }, [storageKey, panelWidth]);

  return { isNarrow, panelOpen, setPanelOpen, togglePanel, panelWidth, onMouseDownHandle, containerRef };
}
