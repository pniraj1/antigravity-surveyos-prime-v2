import { useState, useCallback } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { extractDocument } from '@/lib/ai/processor';
import { toast } from 'sonner';

export function useAIExtraction() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [reviewData, setReviewData] = useState<{ key: string; data: any } | null>(null);
  
  const setExtractedData = useClaimStore(s => s.setExtractedData);
  const applyExtractedData = useClaimStore(s => s.applyExtractedData);

  const triggerExtraction = useCallback(async (key: string, file: File) => {
    setIsProcessing(true);
    setProgress('Preparing...');
    
    try {
      const data = await extractDocument(key, file, (msg) => {
        setProgress(msg);
      });
      
      // Store in raw cache first
      setExtractedData(key, data);
      
      // Open review dialog
      setReviewData({ key, data });
      
      toast.success(`${key.toUpperCase()} extracted successfully!`);
    } catch (err: any) {
      toast.error(`Extraction failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  }, [setExtractedData]);

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

  return {
    isProcessing,
    progress,
    reviewData,
    triggerExtraction,
    confirmApply,
    cancelReview
  };
}
