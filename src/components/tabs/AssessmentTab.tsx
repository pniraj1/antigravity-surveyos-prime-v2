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
import { DocumentEvidenceViewer, storeBlobUrl, useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { useEstimateModePrompt } from '@/hooks/useEstimateModePrompt';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { useProfileStore } from '@/stores/profile-store';
import { uploadFileToDrive } from '@/lib/drive';
import { useSaveToCloudPrompt } from '@/hooks/useSaveToCloudPrompt';
import { FixEstimateDialog } from '@/components/dialogs/FixEstimateDialog';
import { ModelSelector, DocModeToggle, ProviderHealthBadge, ProviderToggle } from '@/components/ai/AIControls';
import { SaveProgressButton } from '@/components/sync/SaveProgressButton';
import { needsReview } from '@/lib/ai/needs-review';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
import type { EstimateApplyMode } from '@/stores/slices/aiDataSlice';
import { saveDocuments } from '@/lib/documents/sink';
import { UsePhoneFiles } from '@/components/documents/UsePhoneFiles';
import type { DocType } from '@/types/documents';

const ESTIMATE_TYPES: readonly DocType[] = ['estimate', 'supplementaryEstimate'];

export function AssessmentTab() {
  const { currentClaim, setDepreciationType } = useClaimStore();
  const [showEvidence, setShowEvidence] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [fixOpen, setFixOpen] = useState(false);
  // Open only when there is something to decide (multi-page PDF); see needsReview.
  const [reviewSheet, setReviewSheet] = useState<{ file: File; mode: EstimateApplyMode; inFolder: boolean } | null>(null);
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview, reScanWithFeedback, smartFix, reviewProgress } = useAIExtraction();
  const { confirmEstimateMode, estimateModeDialog } = useEstimateModePrompt();
  const { profile } = useProfileStore();
  const { confirmSaveToCloud, saveToCloudDialog } = useSaveToCloudPrompt();

  // Everything that happens once the surveyor has decided which file/pages go
  // to the AI: evidence blob, extraction, optional Drive upload.
  const startEstimate = async (file: File, mode: EstimateApplyMode, inFolder: boolean) => {
    // Store blob URL for the Evidence Viewer to display the file natively
    if (currentClaim?.id) {
      storeBlobUrl(currentClaim.id, 'estimate', file);

      // Auto-open evidence panel and focus on estimate
      setShowEvidence(true);
      useEvidenceStore.getState().openField(currentClaim.id, {
        docType: 'estimate',
        fieldKey: '',
        contextSnippet: ''
      });
    }

    triggerExtraction('estimate', file, undefined, undefined, mode);
    if (!inFolder) void saveDocuments('estimate', [{ blob: file, name: file.name }], 'upload');

    if (currentClaim?.id && profile.autoUploadDrive !== false) {
      const claimId = currentClaim.id;
      const label = currentClaim.vehicle?.registrationNumber || claimId;
      const ext = file.name.split('.').pop() ?? 'bin';
      if (await confirmSaveToCloud(file.name)) {
        uploadFileToDrive(claimId, `estimate.${ext}`, file, label).catch(console.error);
      }
    }
  };

  const handleEstimateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processEstimateFile(file);
  };

  /** `inFolder`: the file came from the claim folder (a phone file), so it is not saved there again. */
  const processEstimateFile = async (file: File, inFolder = false) => {
    // Asked BEFORE extraction: a wrong file, or a surveyor who changes their
    // mind, then costs nothing. Resolves straight to 'replace' on an empty
    // sheet — nothing to lose, so nothing to ask.
    const mode = await confirmEstimateMode(file.name);
    if (mode === null) return;

    if (await needsReview([file])) {
      setReviewSheet({ file, mode, inFolder });
      return;
    }
    await startEstimate(file, mode, inFolder);
  };

  const evidenceImages: string[] = [];

  if (!currentClaim) return null;

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] p-6 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      {saveToCloudDialog}
      {estimateModeDialog}
      {reviewSheet && (
        <DocumentReviewSheet
          open
          slotLabel="Estimate"
          files={[reviewSheet.file]}
          onCancel={() => setReviewSheet(null)}
          onConfirm={(_all, forAI) => {
            const { mode, inFolder } = reviewSheet;
            setReviewSheet(null);
            if (forAI[0]) void startEstimate(forAI[0], mode, inFolder);
          }}
        />
      )}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-medium tracking-tight">Assessment</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Build the assessment grid. GST and depreciation apply automatically by part type; tick IMT 23 on a row to apply the endorsement.
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border">
              <Label htmlFor="dep-type" className="font-medium text-sm">Policy Depreciation:</Label>
              <select
                id="dep-type"
                value={currentClaim.depreciationType}
                onChange={(e) => setDepreciationType(e.target.value as any)}
                className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary font-medium text-primary"
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

            <UsePhoneFiles types={ESTIMATE_TYPES} className="h-12" disabled={isProcessing} onPick={(file) => void processEstimateFile(file, true)} />

            {/* An estimate was read when some row carries a source. */}
            {currentClaim.assessmentRows.some((r) => r.source) && (
              <Button variant="outline" className="h-12" disabled={isProcessing} onClick={() => setFixOpen(true)}>
                Fix estimate reading
              </Button>
            )}

            <Button
              variant={showEvidence ? 'secondary' : 'outline'}
              onClick={() => setShowEvidence(!showEvidence)}
              className={`gap-2 h-12 ${showEvidence ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : ''}`}
            >
              {showEvidence ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              {showEvidence ? 'Hide Evidence' : 'Show Evidence'}
            </Button>

            <Button
              variant={showSummary ? 'secondary' : 'outline'}
              onClick={() => setShowSummary(s => !s)}
              className={`gap-2 h-12 ${showSummary ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : ''}`}
            >
              {showSummary ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              {showSummary ? 'Hide Summary' : 'Show Summary'}
            </Button>

            <SaveProgressButton className="h-12" />
          </div>

          {/* AI extraction controls */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border"
          >
            <span className="text-[10px] font-medium mr-1 text-muted-foreground">AI</span>
            <ProviderToggle />
            <DocModeToggle />
            <ModelSelector />
            <ProviderHealthBadge />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-background rounded-xl border border-border overflow-hidden">
        <PanelGroup orientation="horizontal">
          {/* Main Assessment Content */}
          <Panel defaultSize={showEvidence ? 60 : 100} minSize={30}>
            <div className="h-full overflow-y-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className={showSummary ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'}>
                  <AssessmentGrid />
                </div>
                {showSummary && (
                  <div className="lg:col-span-4 xl:col-span-3">
                    <AssessmentSummary />
                  </div>
                )}
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
                  <DocumentEvidenceViewer embedded={true} defaultDocType="estimate" />
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
        findings={reviewData?.findings ?? []}
        onSmartFix={reviewData ? () => smartFix(reviewData.key) : undefined}
        smartFixProgress={reviewProgress}
        smartFixed={reviewData?.smartFixed}
      />

      <FixEstimateDialog open={fixOpen} onClose={() => setFixOpen(false)} />
    </div>
  );
}
