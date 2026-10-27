import { useCallback } from 'react';
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
import { extractDocument, smartFixRescan } from '@/lib/ai/processor';
import { stripPageTags, countRows } from '@/lib/ai/row-check';
import { toast } from 'sonner';

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
  const reviewProgress = useExtractionStore(s => (reviewData ? s.jobs[reviewData.key]?.progress ?? '' : ''));

  const startJob              = useExtractionStore(s => s.startJob);
  const setJobProgress        = useExtractionStore(s => s.setProgress);
  const finishJob             = useExtractionStore(s => s.finishJob);
  const failJob               = useExtractionStore(s => s.failJob);
  const cancelJob             = useExtractionStore(s => s.cancelJob);
  const clearJob              = useExtractionStore(s => s.clearJob);
  const rememberFile          = useExtractionStore(s => s.rememberFile);

  const setExtractedData   = useClaimStore(s => s.setExtractedData);
  const applyExtractedData = useClaimStore(s => s.applyExtractedData);
  const aiDocMode          = useProfileStore(s => s.profile.aiDocMode);

  // ─── Smart Fix ───────────────────────────────────────────────────────────────
  // Runs the gap engine on the PENDING review result — the dialog stays open and
  // the rows update in place. Nothing touches the claim until Apply.
  const smartFix = useCallback(async (key: string) => {
    const job = useExtractionStore.getState().jobs[key];
    const result = job?.result;
    const file = useExtractionStore.getState().files[key];
    if (!result) return;
    if (!file) { toast.error('Please re-upload the document to use Smart Fix.'); return; }

    const controller = new AbortController();
    registerAbort(key, controller);
    setJobProgress(key, 'Smart Fix: loading document…');
    try {
      const forceDocMode = (!aiDocMode || aiDocMode === 'auto') ? undefined : aiDocMode;
      const fixed = await smartFixRescan(key, file, result.data, result.findings, msg => setJobProgress(key, msg), controller.signal, forceDocMode);
      // The job may have been replaced (re-scanned, cancelled, re-run) while
      // this Smart Fix was in flight — only land the result on the same job.
      if (useExtractionStore.getState().jobs[key]?.result !== result) return;
      finishJob(key, { ...result, data: fixed.data, findings: fixed.findings, smartFixed: true });   // finishJob also clears progress
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setJobProgress(key, '');
      toast.error(`Smart Fix failed: ${err.message}`);
    } finally {
      clearAbort(key);
    }
  }, [aiDocMode, setJobProgress, finishJob]);

  // ─── Full extraction ─────────────────────────────────────────────────────────
  const triggerExtraction = useCallback(async (key: string, file: File | File[], feedback?: string, previousData?: any, estimateMode?: EstimateApplyMode) => {
    const fileList = Array.isArray(file) ? file : [file];
    if (fileList.length === 0) return;
    // Representative single file for reScan / Smart Fix (which target one document's pages).
    const primary = fileList[fileList.length - 1];

    const originTab = useUIStore.getState().activeTab;
    startJob(key, originTab, estimateMode);
    setJobProgress(key, feedback ? 'Re-scanning with feedback...' : 'Preparing...');
    rememberFile(key, primary);

    const controller = new AbortController();
    registerAbort(key, controller);

    try {
      const forceDocMode = (!aiDocMode || aiDocMode === 'auto') ? undefined : aiDocMode;
      const { data, images, findings, issues } = await extractDocument(
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

      setExtractedData(key, stripPageTags(data));
      finishJob(key, { key, data, file: primary, findings });

      for (const issue of issues) toast.warning(issue, { duration: 12000 });
      const label = key === 'estimate' ? 'Estimate' : key === 'final-bill' ? 'Final Bill' : key.toUpperCase();
      if (key === 'estimate' || key === 'final-bill') {
        const rows = countRows(data);
        const attention = findings.reduce((n, f) => n + (f.kind === 'gap' ? f.srNos.length : 1), 0);
        toast.success(attention ? `${label} read — ${rows} rows, ${attention} need a look` : `${label} read — ${rows} rows`);
      } else {
        toast.success(`${label} extracted successfully!`);
      }
    } catch (err: any) {
      // An abort is a deliberate surveyor action, not a failure — stay silent.
      if (err?.name === 'AbortError') return;
      toast.error(`Extraction failed: ${err.message}`);
      failJob(key, err?.message ?? 'Extraction failed');
    } finally {
      clearAbort(key);
    }
  }, [aiDocMode, setExtractedData, startJob, setJobProgress, finishJob, failJob, rememberFile]);

  // ─── Review dialog helpers ───────────────────────────────────────────────────
  const confirmApply = useCallback(() => {
    if (reviewData) {
      // Read before clearJob — clearing drops the job and the mode with it.
      const mode = useExtractionStore.getState().jobs[reviewData.key]?.estimateMode;
      applyExtractedData(reviewData.key, stripPageTags(reviewData.data), mode);
      clearJob(reviewData.key);
      toast.success('Fields auto-filled!');
    }
  }, [reviewData, applyExtractedData, clearJob]);

  /** Dismisses the review dialog. Distinct from cancelExtraction, which aborts
   *  work in flight — conflating the two is what left the overlay's Cancel
   *  button dead during processing. */
  const cancelReview = useCallback(() => {
    // cancelJob (not clearJob): aborts the registered controller so a
    // Smart Fix still running when the dialog closes is actually cancelled.
    // For a plain finished job it removes it, same as clearJob did.
    if (reviewData) cancelJob(reviewData.key);
  }, [reviewData, cancelJob]);

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
      // Re-reading the SAME document, so the surveyor's supplementary/re-scan
      // answer still holds. Captured before cancelJob, which drops it.
      const mode = useExtractionStore.getState().jobs[key]?.estimateMode;
      // cancelJob (not clearJob): aborts a Smart Fix's controller still
      // registered for this key, so the Enter-key re-scan can't orphan it.
      cancelJob(key);
      triggerExtraction(key, file, feedback, stripPageTags(data), mode);
    }
  }, [reviewData, cancelJob, triggerExtraction]);

  return {
    isProcessing,
    progress,
    reviewData,
    reviewProgress,
    triggerExtraction,
    smartFix,
    confirmApply,
    cancelReview,
    cancelExtraction,
    reScanWithFeedback,
  };
}
