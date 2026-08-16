import { useCallback, useEffect, useRef, useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import {
  useExtractionStore,
  registerAbort,
  clearAbort,
  selectIsProcessing,
  selectActiveProgress,
  selectLatestReview,
} from '@/stores/extraction-store';
import type { EstimateApplyMode } from '@/stores/slices/aiDataSlice';
import { buildEstimateModePrompt } from '@/stores/slices/aiDataSlice';
import { extractDocument, rescanTargetPages, applyTargetedUpdate } from '@/lib/ai/processor';
import { toast } from 'sonner';

// sessionStorage key for persisting lastFiles metadata across page reloads.
const SS_LAST_FILES_KEY = 'ai_extraction_last_file_names';

/** Builds a plain-text focus hint from discrepancy messages for the targeted prompt. */
function buildFocusHint(discrepancies: string[]): string {
  const hints: string[] = [];
  if (discrepancies.some(d => d.includes('Parts')))   hints.push('spare parts list and parts subtotal');
  if (discrepancies.some(d => d.includes('Labour')))  hints.push('labour items and labour subtotal');
  if (discrepancies.some(d => d.includes('Painting'))) hints.push('painting items and painting subtotal');
  if (discrepancies.some(d => d.toLowerCase().includes('gross'))) hints.push('grand total / gross amount');
  return hints.length > 0 ? hints.join(', ') : 'all financial totals and line items';
}

/** Returns 0-based page indices to target for a targeted rescan (last 1-2 pages). */
function targetPageIndices(totalPages: number): number[] {
  if (totalPages <= 1) return [0];
  if (totalPages === 2) return [0, 1];
  // Last 2 pages — where summary/totals almost always live
  return [totalPages - 2, totalPages - 1];
}

/**
 * Drives AI document extraction.
 *
 * State lives in the extraction store, NOT in this hook, because Dashboard
 * remounts the whole tab subtree on every tab change (`key={activeTab}`).
 * When this state was local useState, a tab switch destroyed it and the
 * resolving fetch wrote its result into a dead component instance — the
 * surveyor watched the analysis disappear even though the provider had
 * already been billed. The exported surface is unchanged so no tab needed
 * editing.
 */
export function useAIExtraction() {
  const isProcessing = useExtractionStore(selectIsProcessing);
  const progress     = useExtractionStore(selectActiveProgress);
  const reviewData   = useExtractionStore(selectLatestReview);
  const files        = useExtractionStore(s => s.files);

  const startJob              = useExtractionStore(s => s.startJob);
  const setJobProgress        = useExtractionStore(s => s.setProgress);
  const finishJob             = useExtractionStore(s => s.finishJob);
  const failJob               = useExtractionStore(s => s.failJob);
  const cancelJob             = useExtractionStore(s => s.cancelJob);
  const clearJob              = useExtractionStore(s => s.clearJob);
  const rememberFile          = useExtractionStore(s => s.rememberFile);
  const setDiscrepancyContext = useExtractionStore(s => s.setDiscrepancyContext);

  // Stable ref so the toast action always calls the latest version.
  const targetedRescanRef = useRef<(key: string) => void>(() => {});

  const setExtractedData   = useClaimStore(s => s.setExtractedData);
  const applyExtractedData = useClaimStore(s => s.applyExtractedData);
  const currentClaim       = useClaimStore(s => s.currentClaim);
  const aiDocMode          = useProfileStore(s => s.profile.aiDocMode);

  const [lastFileNames, setLastFileNames] = useState<Record<string, string>>(() => {
    try {
      const raw = sessionStorage.getItem(SS_LAST_FILES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(SS_LAST_FILES_KEY, JSON.stringify(lastFileNames));
    } catch { /* storage quota exceeded — non-fatal */ }
  }, [lastFileNames]);

  // ─── Targeted (Smart Fix) rescan ────────────────────────────────────────────
  // Takes the document key explicitly. Previously it read a single shared
  // discrepancy context, so with two documents reporting mismatches the Smart
  // Fix button rescanned whichever finished last rather than the one the toast
  // belonged to.
  const triggerTargetedRescan = useCallback(async (key: string) => {
    const ctx = useExtractionStore.getState().discrepancies[key];
    if (!ctx) return;
    const { totalPages, discrepancies } = ctx;
    const file = useExtractionStore.getState().files[key];
    if (!file) {
      toast.error('Please re-upload the document to use Smart Fix.');
      return;
    }

    const originTab = useUIStore.getState().activeTab;
    startJob(key, originTab);
    setJobProgress(key, 'Smart Fix: scanning summary pages...');

    try {
      const pageIndices = targetPageIndices(totalPages);
      const focusHint   = buildFocusHint(discrepancies);

      const { partialData, discrepancies: remaining } = await rescanTargetPages(
        key, file, pageIndices, focusHint, (msg: string) => setJobProgress(key, msg),
      );

      // Merge corrected partial data into the existing extraction.
      // A partial-page rescan only sees the targeted pages, so its item arrays
      // are incomplete — replacing the full arrays would wipe items from the
      // unscanned pages. Keep only scalar/total corrections unless every page
      // was rescanned.
      const coveredAllPages = pageIndices.length >= totalPages;
      const safePartial = coveredAllPages || !partialData
        ? partialData
        : Object.fromEntries(Object.entries(partialData).filter(([, v]) => !Array.isArray(v)));
      const existing = (currentClaim?.extractedData as any)?.[key] ?? {};
      const merged   = applyTargetedUpdate(existing, safePartial);
      setExtractedData(key, merged);

      if (remaining.length === 0) {
        toast.success('✅ Smart Fix resolved all discrepancies! Review the updated values.');
      } else {
        const lines = remaining.map(d => `• ${d}`).join('\n');
        toast.warning(
          `⚠ Some discrepancies remain after Smart Fix:\n\n${lines}\n\nPlease verify manually using the Evidence Viewer.`,
          { duration: 15000, style: { whiteSpace: 'pre-line' } },
        );
      }
      setDiscrepancyContext(key, null);
      clearJob(key);
    } catch (err: any) {
      if (err?.name === 'AbortError') { clearJob(key); return; }
      toast.error(`Smart Fix failed: ${err.message}`);
      failJob(key, err?.message ?? 'Smart Fix failed');
      clearJob(key);
    }
  }, [currentClaim, setExtractedData, startJob, setJobProgress, clearJob, failJob, setDiscrepancyContext]);

  // Keep the ref in sync so the toast action always has the latest closure
  useEffect(() => {
    targetedRescanRef.current = triggerTargetedRescan;
  }, [triggerTargetedRescan]);

  // ─── Full extraction ─────────────────────────────────────────────────────────
  const triggerExtraction = useCallback(async (key: string, file: File | File[], feedback?: string, previousData?: any) => {
    const fileList = Array.isArray(file) ? file : [file];
    if (fileList.length === 0) return;
    // Representative single file for reScan / Smart Fix (which target one document's pages).
    const primary = fileList[fileList.length - 1];

    const originTab = useUIStore.getState().activeTab;
    startJob(key, originTab);
    setJobProgress(key, feedback ? 'Re-scanning with feedback...' : 'Preparing...');
    rememberFile(key, primary);
    setLastFileNames(prev => ({ ...prev, [key]: primary.name }));

    const controller = new AbortController();
    registerAbort(key, controller);

    try {
      const forceDocMode = (!aiDocMode || aiDocMode === 'auto') ? undefined : aiDocMode;
      const { data, images, discrepancies } = await extractDocument(
        key,
        fileList,
        (msg: string, pagesDone?: number, pagesTotal?: number) => {
          setJobProgress(key, msg, pagesDone, pagesTotal);
        },
        feedback,
        previousData,
        forceDocMode,
        controller.signal,
      );

      // A cancelled job is removed from the store, and the store's updaters
      // ignore unknown keys — so if the surveyor cancelled while this was in
      // flight, neither of the next two lines takes effect.
      if (!useExtractionStore.getState().jobs[key]) return;

      setExtractedData(key, data);
      finishJob(key, { key, data, file: primary });

      if (discrepancies && discrepancies.length > 0) {
        // Save context for the Smart Fix button
        setDiscrepancyContext(key, { totalPages: images.length, discrepancies });

        const lines = discrepancies.map(d => `• ${d}`).join('\n');
        toast.warning(
          `⚠ Amount mismatch detected — verify manually or use Smart Fix:\n\n${lines}\n\nSmart Fix rescans only the summary pages (faster & cheaper).`,
          {
            duration: 20000,
            style: { whiteSpace: 'pre-line' },
            action: {
              label: '⚡ Smart Fix',
              onClick: () => targetedRescanRef.current(key),
            },
          },
        );
      } else {
        toast.success(`${key === 'estimate' ? 'Estimate' : key === 'final-bill' ? 'Final Bill' : key.toUpperCase()} extracted successfully!`);
      }
    } catch (err: any) {
      // An abort is a deliberate surveyor action, not a failure — stay silent.
      if (err?.name === 'AbortError') return;
      toast.error(`Extraction failed: ${err.message}`);
      failJob(key, err?.message ?? 'Extraction failed');
    } finally {
      clearAbort(key);
    }
  }, [aiDocMode, setExtractedData, startJob, setJobProgress, finishJob, failJob, rememberFile, setDiscrepancyContext]);

  // ─── Review dialog helpers ───────────────────────────────────────────────────
  const confirmApply = useCallback((mode?: EstimateApplyMode) => {
    if (reviewData) {
      applyExtractedData(reviewData.key, reviewData.data, mode);
      clearJob(reviewData.key);
      toast.success('Fields auto-filled!');
    }
  }, [reviewData, applyExtractedData, clearJob]);

  /** Dismisses the review dialog. Distinct from cancelExtraction, which aborts
   *  work in flight — conflating the two is what left the overlay's Cancel
   *  button dead during processing. */
  const cancelReview = useCallback(() => {
    if (reviewData) clearJob(reviewData.key);
  }, [reviewData, clearJob]);

  /** Aborts an in-flight extraction and discards everything it produced. */
  const cancelExtraction = useCallback((key?: string) => {
    if (key) { cancelJob(key); return; }
    const running = Object.entries(useExtractionStore.getState().jobs)
      .filter(([, j]) => j.status === 'processing')
      .sort(([, a], [, b]) => a.startedAt - b.startedAt);
    if (running[0]) cancelJob(running[0][0]);
  }, [cancelJob]);

  const reScanWithFeedback = useCallback((feedback: string) => {
    if (reviewData) {
      const { key, data, file } = reviewData;
      clearJob(key);
      triggerExtraction(key, file, feedback, data);
    }
  }, [reviewData, clearJob, triggerExtraction]);

  const reScanLatest = useCallback((key: string, feedback: string) => {
    const file = useExtractionStore.getState().files[key];
    const prevData = currentClaim?.extractedData?.[key];
    if (file) {
      triggerExtraction(key, file, feedback, prevData);
    } else if (lastFileNames[key]) {
      toast.error(`Please re-upload the ${key} document — the previous file is no longer available after the page was refreshed.`);
    } else {
      toast.error(`No previous ${key} document found to re-scan. Please upload it again.`);
    }
  }, [lastFileNames, currentClaim?.extractedData, triggerExtraction]);

  // Calculate mode prompt for estimate uploads when claim already has estimate rows
  const modePrompt = reviewData
    ? buildEstimateModePrompt(
        reviewData.key,
        currentClaim,
        [
          ...((reviewData.data as any)?.spare_parts || []),
          ...((reviewData.data as any)?.labour_items || []),
          ...((reviewData.data as any)?.painting_items || []),
        ],
      )
    : null;

  return {
    isProcessing,
    progress,
    reviewData,
    triggerExtraction,
    triggerTargetedRescan,
    confirmApply,
    cancelReview,
    cancelExtraction,
    reScanWithFeedback,
    reScanLatest,
    modePrompt,
    hasFile: (key: string) => !!files[key] || !!lastFileNames[key],
  };
}
