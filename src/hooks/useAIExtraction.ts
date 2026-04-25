import { useState, useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { extractDocument } from '@/lib/ai/processor';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { toast } from 'sonner';

// ─── Session-storage helpers for Evidence Viewer ─────────────────────────────
/** Save base64 page images for a doc key in sessionStorage. */
export function saveEvidenceImages(claimId: string, docKey: string, images: string[]) {
  try {
    sessionStorage.setItem(`evidence_${claimId}_${docKey}`, JSON.stringify(images));
  } catch {
    // sessionStorage can be full on very large PDFs — fail silently
  }
}

/** Retrieve base64 page images for a doc key from sessionStorage. */
export function getEvidenceImages(claimId: string, docKey: string): string[] {
  try {
    const raw = sessionStorage.getItem(`evidence_${claimId}_${docKey}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useAIExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [reviewData, setReviewData] = useState<{ key: string; data: any; file: File } | null>(null);
  const [lastFiles, setLastFiles] = useState<Record<string, File>>({});
  
  const setExtractedData = useClaimStore(s => s.setExtractedData);
  const applyExtractedData = useClaimStore(s => s.applyExtractedData);
  const currentClaim = useClaimStore(s => s.currentClaim);

  const triggerExtraction = useCallback(async (key: string, file: File, feedback?: string, previousData?: any) => {
    setIsProcessing(true);
    setProgress(feedback ? 'Re-scanning with feedback...' : 'Preparing...');
    setLastFiles(prev => ({ ...prev, [key]: file }));
    
    try {
      const { data, images } = await extractDocument(key, file, (msg) => {
        setProgress(msg);
      }, feedback, previousData);
      
      // Persist source images so Evidence Viewer can display them (session-only)
      if (currentClaim?.id && images.length > 0) {
        saveEvidenceImages(currentClaim.id, key, images);
        useEvidenceStore.getState().bumpImageVersion();
      }

      // Store extracted JSON in claim cache
      setExtractedData(key, data);
      
      // Open review dialog
      setReviewData({ key, data, file });
      
      if (key === 'estimate' || key === 'final-bill') {
        const p = data.spare_parts?.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0) || 0;
        const l = data.labour_items?.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0) || 0;
        const pt = data.painting_items?.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0) || 0;
        const gst = Number(data.gst_amount) || 0;
        
        const calculatedTotal = p + l + pt + gst;
        const documentTotal = Number(data.total_amount) || 0;
        
        if (documentTotal > 0 && Math.abs(calculatedTotal - documentTotal) > 5) {
          toast.warning(
            `Mismatch Detected: Sum of items (₹${calculatedTotal.toFixed(2)}) doesn't match document total (₹${documentTotal.toFixed(2)}). Please review carefully.`, 
            { duration: 10000 }
          );
        } else {
          toast.success(`${key.toUpperCase()} extracted successfully and totals match!`);
        }
      } else {
        toast.success(`${key.toUpperCase()} extracted successfully!`);
      }
    } catch (err: any) {
      toast.error(`Extraction failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  }, [setExtractedData, currentClaim?.id]);

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
      // Optional: hide dialog immediately while processing
      setReviewData(null);
    }
  }, [reviewData, triggerExtraction]);

  const reScanLatest = useCallback((key: string, feedback: string) => {
    const file = lastFiles[key];
    const prevData = currentClaim?.extractedData?.[key];
    if (file) {
      triggerExtraction(key, file, feedback, prevData);
    } else {
      toast.error(`No previous ${key} document found to re-scan. Please upload it again.`);
    }
  }, [lastFiles, currentClaim?.extractedData, triggerExtraction]);

  return {
    isProcessing,
    progress,
    reviewData,
    triggerExtraction,
    confirmApply,
    cancelReview,
    reScanWithFeedback,
    reScanLatest,
    hasFile: (key: string) => !!lastFiles[key]
  };
}
