'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useExtractionStore } from '@/stores/extraction-store';
import { useUIStore } from '@/stores/ui-store';

const TAB_LABELS: Record<string, string> = {
  documents: 'Documents',
  assessment: 'Assessment',
  details: 'Claim Details',
  'bill-check': 'Bill Check',
};

/**
 * Nudges the surveyor back when an extraction they walked away from finishes.
 *
 * The review payload lives in the store, so the tab owning that document
 * renders its own dialog whenever it is mounted — no dialog hoisting needed.
 * This only supplies the nudge. A modal is deliberately NOT thrown in front of
 * someone typing on a different tab.
 *
 * Mounted once from the Dashboard shell.
 */
export function useExtractionCompletionToast(): void {
  // Jobs already announced, so a re-render cannot re-toast the same one.
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = useExtractionStore.subscribe((state) => {
      const activeTab = useUIStore.getState().activeTab;

      for (const [key, job] of Object.entries(state.jobs)) {
        const id = `${key}:${job.startedAt}`;

        if (job.status !== 'done' || !job.result) continue;
        if (announced.current.has(id)) continue;
        // Still where they started — the tab's own review dialog is already up.
        if (!job.originTab || job.originTab === activeTab) {
          announced.current.add(id);
          continue;
        }

        announced.current.add(id);
        const label = TAB_LABELS[job.originTab] ?? job.originTab;
        toast.success(`${key.toUpperCase()} is ready to review`, {
          description: `Finished while you were away. Open ${label} to apply the fields.`,
          duration: 12_000,
          action: {
            label: 'Review',
            onClick: () => useUIStore.getState().setActiveTab(job.originTab!),
          },
        });
      }

      // Forget jobs that no longer exist, so the set cannot grow unbounded
      // across a long session.
      if (announced.current.size > 50) {
        const live = new Set(
          Object.entries(state.jobs).map(([k, j]) => `${k}:${j.startedAt}`),
        );
        announced.current = new Set([...announced.current].filter(id => live.has(id)));
      }
    });

    return unsubscribe;
  }, []);
}
