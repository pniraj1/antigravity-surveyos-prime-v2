import { useState, useCallback, useEffect, useRef } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { extractDocument, rescanTargetPages, applyTargetedUpdate } from '@/lib/ai/processor';
import { getAllExtractionProgress } from '@/lib/ai/extraction-cache';
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

export function useAIExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [reviewData, setReviewData] = useState<{ key: string; data: any; file: File } | null>(null);
  const [lastFiles, setLastFiles] = useState<Record<string, File>>({});
  const [inProgressDocs, setInProgressDocs] = useState<Array<{ docType: string; completedPages: number; totalPages: number }>>([]);

  // Context saved after an extraction that produced discrepancies.
  // Used by triggerTargetedRescan to know which pages / what to fix.
  const [discrepancyCtx, setDiscrepancyCtx] = useState<{
    key: string;
    totalPages: number;
    discrepancies: string[];
  } | null>(null);

  // Stable ref so the toast action onClick always calls the latest version.
  const targetedRescanRef = useRef<() => void>(() => {});

  const setExtractedData  = useClaimStore(s => s.setExtractedData);
  const applyExtractedData = useClaimStore(s => s.applyExtractedData);
  const currentClaim      = useClaimStore(s => s.currentClaim);
  const aiDocMode         = useProfileStore(s => s.profile.aiDocMode);

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

  useEffect(() => {
    getAllExtractionProgress().then(entries => {
      if (entries.length > 0) {
        setInProgressDocs(entries.map(e => ({
          docType: e.docType,
          completedPages: e.completedPages.length,
          totalPages: e.totalPages,
        })));
      }
    });
  }, []);

  // ─── Targeted (Smart Fix) rescan ────────────────────────────────────────────
  const triggerTargetedRescan = useCallback(async () => {
    if (!discrepancyCtx) return;
    const { key, totalPages, discrepancies } = discrepancyCtx;
    const file = lastFiles[key];
    if (!file) {
      toast.error('Please re-upload the document to use Smart Fix.');
      return;
    }

    setIsProcessing(true);
    setProgress('Smart Fix: scanning summary pages...');

    try {
      const pageIndices = targetPageIndices(totalPages);
      const focusHint   = buildFocusHint(discrepancies);

      const { partialData, discrepancies: remaining } = await rescanTargetPages(
        key, file, pageIndices, focusHint, setProgress,
      );

      // Merge corrected partial data into the existing extraction
      const existing = (currentClaim?.extractedData as any)?.[key] ?? {};
      const merged   = applyTargetedUpdate(existing, partialData);
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
      setDiscrepancyCtx(null);
    } catch (err: any) {
      toast.error(`Smart Fix failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  }, [discrepancyCtx, lastFiles, currentClaim, setExtractedData]);

  // Keep the ref in sync so the toast action always has the latest closure
  useEffect(() => {
    targetedRescanRef.current = triggerTargetedRescan;
  }, [triggerTargetedRescan]);

  // ─── Full extraction ─────────────────────────────────────────────────────────
  const triggerExtraction = useCallback(async (key: string, file: File, feedback?: string, previousData?: any) => {
    setIsProcessing(true);
    setProgress(feedback ? 'Re-scanning with feedback...' : 'Preparing...');
    setLastFiles(prev => ({ ...prev, [key]: file }));
    setLastFileNames(prev => ({ ...prev, [key]: file.name }));

    try {
      const forceDocMode = (!aiDocMode || aiDocMode === 'auto') ? undefined : aiDocMode;
      const { data, images, discrepancies } = await extractDocument(key, file, (msg) => {
        setProgress(msg);
      }, feedback, previousData, forceDocMode);

      setExtractedData(key, data);
      setInProgressDocs(prev => prev.filter(d => d.docType !== key));
      setReviewData({ key, data, file });

      if (discrepancies && discrepancies.length > 0) {
        // Save context for the Smart Fix button
        setDiscrepancyCtx({ key, totalPages: images.length, discrepancies });

        const lines = discrepancies.map(d => `• ${d}`).join('\n');
        toast.warning(
          `⚠ Amount mismatch detected — verify manually or use Smart Fix:\n\n${lines}\n\nSmart Fix rescans only the summary pages (faster & cheaper).`,
          {
            duration: 20000,
            style: { whiteSpace: 'pre-line' },
            action: {
              label: '⚡ Smart Fix',
              onClick: () => targetedRescanRef.current(),
            },
          },
        );
      } else {
        toast.success(`${key === 'estimate' ? 'Estimate' : key === 'final-bill' ? 'Final Bill' : key.toUpperCase()} extracted successfully!`);
      }
    } catch (err: any) {
      toast.error(`Extraction failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  }, [setExtractedData, setLastFileNames, currentClaim?.id]);

  // ─── Review dialog helpers ───────────────────────────────────────────────────
  const confirmApply = useCallback(() => {
    if (reviewData) {
      applyExtractedData(reviewData.key, reviewData.data);
      setReviewData(null);
      toast.success('Fields auto-filled!');
    }
  }, [reviewData, applyExtractedData]);

  const cancelReview = useCallback(() => {
    setReviewData(null);
  }, []);

  const reScanWithFeedback = useCallback((feedback: string) => {
    if (reviewData) {
      triggerExtraction(reviewData.key, reviewData.file, feedback, reviewData.data);
      setReviewData(null);
    }
  }, [reviewData, triggerExtraction]);

  const reScanLatest = useCallback((key: string, feedback: string) => {
    const file = lastFiles[key];
    const prevData = currentClaim?.extractedData?.[key];
    if (file) {
      triggerExtraction(key, file, feedback, prevData);
    } else if (lastFileNames[key]) {
      toast.error(`Please re-upload the ${key} document — the previous file is no longer available after the page was refreshed.`);
    } else {
      toast.error(`No previous ${key} document found to re-scan. Please upload it again.`);
    }
  }, [lastFiles, lastFileNames, currentClaim?.extractedData, triggerExtraction]);

  return {
    isProcessing,
    progress,
    reviewData,
    inProgressDocs,
    triggerExtraction,
    triggerTargetedRescan,
    confirmApply,
    cancelReview,
    reScanWithFeedback,
    reScanLatest,
    hasFile: (key: string) => !!lastFiles[key] || !!lastFileNames[key],
  };
}
