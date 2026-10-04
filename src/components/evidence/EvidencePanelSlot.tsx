'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { useEvidencePanel } from '@/hooks/useEvidencePanel';

type Panel = ReturnType<typeof useEvidencePanel>;

/**
 * Renders the evidence viewer for Details / Review: a resizable side column on
 * a laptop, a full-screen overlay with a close button on a phone (a side column
 * would leave the form no width at all).
 */
export function EvidencePanelSlot({ panel, children }: { panel: Panel; children: ReactNode }) {
  if (!panel.panelOpen) return null;

  if (panel.isNarrow) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Evidence</span>
          <button
            type="button"
            onClick={() => panel.setPanelOpen(false)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border"
            aria-label="Close evidence"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        onMouseDown={panel.onMouseDownHandle}
        title="Drag to resize evidence panel"
        className="relative z-10 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center"
      >
        <div className="h-10 w-[3px] rounded-full bg-[var(--color-neutral-400)]/30 transition-colors hover:bg-[var(--color-neutral-400)]/60" />
      </div>
      <div
        style={{ width: panel.panelWidth, minWidth: 280 }}
        className="flex shrink-0 flex-col py-4 pr-4"
      >
        {children}
      </div>
    </>
  );
}
