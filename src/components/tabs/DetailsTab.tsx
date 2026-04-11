'use client';

import { VehicleDetailsForm } from '@/components/claim/VehicleForm';
import { DriverDetailsForm } from '@/components/claim/DriverForm';
import { PolicyDetailsForm } from '@/components/claim/PolicyForm';
import { AccidentDetailsForm } from '@/components/claim/AccidentForm';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { useClaimStore } from '@/stores/claim-store';
import { generateWordReport } from '@/lib/reports/word-builder';
import { FileText, Sparkles, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SpotTab } from '@/components/tabs/SpotTab';

export function DetailsTab() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview } = useAIExtraction();

  if (!currentClaim) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (file) triggerExtraction(key, file);
  };

  const docSlots = [
    { id: 'rc', label: 'RC Copy' },
    { id: 'dl', label: 'Driving Licence' },
    { id: 'policy', label: 'Policy Schedule' }
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-start">
        <div className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight">Claim Details</h2>
          <p className="text-muted-foreground text-sm">
            Core intake information for the claim. All changes save automatically offline.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => generateWordReport(currentClaim, null)}
          className="gap-2 shadow-sm"
        >
          <Download size={16} />
          Word Report
        </Button>
      </div>

      {/* AI Extraction Slots */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {docSlots.map(slot => (
          <div key={slot.id} className="relative p-6 rounded-2xl border border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all flex flex-col items-center justify-center gap-3 group">
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer z-10" 
              onChange={(e) => handleFileChange(e, slot.id)}
              accept="image/*,application/pdf"
            />
            <div className="p-3 rounded-full bg-white shadow-sm text-primary group-hover:scale-110 transition-transform">
              {isProcessing ? <Loader2 className="animate-spin" size={24} /> : <FileText size={24} />}
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-primary flex items-center gap-1.5 justify-center">
                <Sparkles size={14} className="animate-pulse" />
                Scan {slot.label}
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">Click to upload and auto-fill</p>
            </div>
          </div>
        ))}
      </div>

      {isProcessing && (
        <div className="p-4 rounded-xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 flex items-center gap-3 animate-in zoom-in-95">
          <Loader2 className="animate-spin text-white" size={18} />
          <span className="text-sm font-bold tracking-tight uppercase">{progress || 'Processing Document...'}</span>
        </div>
      )}

      <div className="space-y-6">
        <VehicleDetailsForm />
        <PolicyDetailsForm />
        <DriverDetailsForm />
        <AccidentDetailsForm />
      </div>

      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        title={reviewData?.key || ''}
        data={reviewData?.data}
      />

      {currentClaim.surveyType === 'spot' && <SpotTab />}
    </div>
  );
}
