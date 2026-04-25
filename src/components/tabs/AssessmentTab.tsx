'use client';

import { useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { AssessmentGrid } from '@/components/claim/AssessmentGrid';
import { AssessmentSummary } from '@/components/claim/AssessmentSummary';
import { TotalLossForm } from '@/components/claim/TotalLossForm';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { PanelRightOpen, PanelRightClose, Upload } from 'lucide-react';
import { DocumentEvidenceViewer } from '@/components/evidence/DocumentEvidenceViewer';
import { useAIExtraction, getEvidenceImages } from '@/hooks/useAIExtraction';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { ProcessingProgressOverlay } from '@/components/ui/ProcessingProgressOverlay';
import { useProfileStore } from '@/stores/profile-store';
import { uploadFileToDrive } from '@/lib/drive';
import { AssessmentChatbot } from '@/components/chat/AssessmentChatbot';

export function AssessmentTab() {
  const { currentClaim, setDepreciationType } = useClaimStore();
  const [showEvidence, setShowEvidence] = useState(false);
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview, reScanWithFeedback, hasFile, reScanLatest } = useAIExtraction();
  const { profile } = useProfileStore();

  const handleEstimateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerExtraction('estimate', file);

    if (currentClaim?.id && profile.autoUploadDrive !== false) {
      const label = currentClaim.vehicle?.registrationNumber || currentClaim.id;
      const ext = file.name.split('.').pop() ?? 'bin';
      uploadFileToDrive(currentClaim.id, `estimate.${ext}`, file, label).catch(console.error);
    }
    e.target.value = '';
  };

  const evidenceImages = currentClaim && reviewData ? getEvidenceImages(currentClaim.id, reviewData.key) : [];

  if (!currentClaim) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] p-6 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Assessment</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Build the assessment grid. Calculations apply IMT-23 and GST automatically based on part types.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border">
            <Label htmlFor="dep-type" className="font-semibold text-sm">Policy Depreciation:</Label>
            <select
              id="dep-type"
              value={currentClaim.depreciationType}
              onChange={(e) => setDepreciationType(e.target.value as any)}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary font-bold text-primary"
            >
              <option value="standard">Standard (Age Based)</option>
              <option value="nil">Nil Depreciation</option>
            </select>
          </div>
          
          <div className="relative">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              accept="image/*,application/pdf"
              onChange={handleEstimateUpload}
              disabled={isProcessing}
              title="Upload Estimate"
            />
            <Button variant="outline" className="gap-2 h-12 w-full" tabIndex={-1} disabled={isProcessing}>
              <Upload size={16} />
              Upload Estimate
            </Button>
          </div>

          <Button
            variant={showEvidence ? 'secondary' : 'outline'}
            onClick={() => setShowEvidence(!showEvidence)}
            className={`gap-2 h-12 ${showEvidence ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : ''}`}
          >
            {showEvidence ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            {showEvidence ? 'Hide Evidence' : 'Show Evidence'}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-background rounded-xl border border-border overflow-hidden">
        <PanelGroup orientation="horizontal">
          {/* Main Assessment Content */}
          <Panel defaultSize={showEvidence ? 60 : 100} minSize={30}>
            <div className="h-full overflow-y-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-8 xl:col-span-9">
                  <AssessmentGrid />
                </div>
                <div className="lg:col-span-4 xl:col-span-3">
                  <AssessmentSummary />
                </div>
              </div>
              <div className="mt-8 pb-8">
                <TotalLossForm />
              </div>
            </div>
          </Panel>

          {showEvidence && (
            <>
              {/* Resize Handle */}
              <PanelResizeHandle className="w-2 bg-muted/50 hover:bg-primary/50 transition-colors cursor-col-resize flex flex-col items-center justify-center border-l border-r border-border">
                <div className="h-8 w-1 rounded-full bg-muted-foreground/30" />
              </PanelResizeHandle>

              {/* Evidence Viewer Panel */}
              <Panel defaultSize={40} minSize={20}>
                <div className="h-full bg-card">
                  <DocumentEvidenceViewer embedded={true} />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* AI Review Dialog */}
      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        onReScan={reScanWithFeedback}
        title={reviewData?.key || ''}
        data={reviewData?.data}
        evidenceImages={evidenceImages}
      />

      {/* Persistent progress overlay during PDF extraction */}
      <ProcessingProgressOverlay
        isVisible={isProcessing}
        progress={progress}
        onCancel={cancelReview}
      />

      {/* Floating Chatbot for fixing extraction */}
      <AssessmentChatbot 
        hasFile={hasFile('estimate')}
        isProcessing={isProcessing}
        onSend={(feedback) => reScanLatest('estimate', feedback)}
      />
    </div>
  );
}
