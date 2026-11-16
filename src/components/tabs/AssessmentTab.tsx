'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { PolicyCheckStrip } from '@/components/policy/PolicyCheckStrip';
import { ModelSelector, DocModeToggle, ProviderHealthBadge, ProviderToggle } from '@/components/ai/AIControls';
import { SaveProgressButton } from '@/components/sync/SaveProgressButton';
import { needsReview } from '@/lib/ai/needs-review';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
import type { EstimateApplyMode } from '@/stores/slices/aiDataSlice';
import { saveDocuments } from '@/lib/documents/sink';
import { DocumentKindDialog } from '@/components/dialogs/DocumentKindDialog';
import { assessmentSwitch, assessmentUploadDocType, asksDocumentKind, docTypeForAnswer, otherKind, shouldApplyUndo, uploadModeAfterSwitch } from '@/lib/documents/upload-doc-type';
import { isFromBill } from '@/lib/reports/bill-check-mode';
import { UsePhoneFiles } from '@/components/documents/UsePhoneFiles';
import type { ClaimDocument, DocType } from '@/types/documents';
import { isOnDrive } from '@/lib/scan-import/phone-files';
import { usePrintGate } from '@/hooks/usePrintGate';
import { PrintMenu } from '@/components/tabs/report/PrintMenu';
import { triggerStandardPrint } from '@/lib/reports/standard-report-builder';
import { triggerUIICFinalPrint } from '@/lib/reports/uiic-final-builder';

type Kind = 'estimate' | 'final-bill';
const ESTIMATE_TYPES: readonly DocType[] = ['estimate', 'supplementaryEstimate', 'invoice'];

export function AssessmentTab() {
  const { currentClaim, setPolicyCheck } = useClaimStore();
  const [showEvidence, setShowEvidence] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [fixOpen, setFixOpen] = useState(false);
  // Open only when there is something to decide (multi-page PDF); see needsReview.
  const [reviewSheet, setReviewSheet] = useState<{ file: File; mode: EstimateApplyMode; phone?: ClaimDocument; answer: Kind | null } | null>(null);
  const [kindAsk, setKindAsk] = useState<{ resolve: (k: Kind | null) => void } | null>(null);
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview, reScanWithFeedback, smartFix, reviewProgress } = useAIExtraction();
  const { confirmEstimateMode, estimateModeDialog } = useEstimateModePrompt();
  const { profile } = useProfileStore();
  const { confirmSaveToCloud } = useSaveToCloudPrompt();
  const { gate, gateDialog } = usePrintGate();
  // Read at click time: the gate's dialog may have just saved the policy answers.
  const latestClaim = () => useClaimStore.getState().currentClaim!;

  // Everything that happens once the surveyor has decided which file/pages go
  // to the AI: evidence blob, extraction, optional Drive upload.
  // `answer`: the Estimate / Final bill choice, when this upload was asked it.
  const startEstimate = async (file: File, mode: EstimateApplyMode, answer: Kind | null, phone?: ClaimDocument) => {
    const claim = useClaimStore.getState().currentClaim;
    const claimId = claim?.id;
    // Store blob URL for the Evidence Viewer to display the file natively
    if (claimId) {
      storeBlobUrl(claimId, 'estimate', file);

      // Auto-open evidence panel and focus on estimate
      setShowEvidence(true);
      useEvidenceStore.getState().openField(claimId, {
        docType: 'estimate',
        fieldKey: '',
        contextSnippet: ''
      });
    }

    triggerExtraction('estimate', file, undefined, undefined, mode);
    const docType = answer ? docTypeForAnswer(answer) : assessmentUploadDocType(claim);
    // A claim with rows switches through the store action (clears what the old mode held).
    const sw = answer && claim ? assessmentSwitch(claim, answer) : null;
    // The old document's header is not the new one's: leave bill no./date/total blank.
    if (sw) useClaimStore.getState().setBillCheckUpload(sw.upload, { copyHeader: false });
    else if (answer && claimId && !claim?.assessmentRows.length) {
      toast(answer === 'final-bill' ? 'Read as the final bill — the claim is made from the bill.' : 'Read as the estimate.', {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => {
            if (!shouldApplyUndo(useClaimStore.getState().currentClaim?.id, claimId)) return;
            useClaimStore.getState().updateBillCheck({ baseDocument: otherKind(answer) });
            toast.info('Changed. Re-upload the document if it was filed under the wrong name.');
          },
        },
      });
      useClaimStore.getState().updateBillCheck({ baseDocument: answer });
    }
    if (!phone) void saveDocuments(docType, [{ blob: file, name: file.name }], 'upload', claimId);

    // A phone file moved from Scan's Drive folder is already on Drive: never a second copy.
    if (claimId && profile.autoUploadDrive !== false && !isOnDrive(phone)) {
      const label = claim?.vehicle?.registrationNumber || claimId;
      const ext = file.name.split('.').pop() ?? 'bin';
      if (await confirmSaveToCloud(file.name)) {
        uploadFileToDrive(claimId, `${docType}.${ext}`, file, label).catch(console.error);
      }
    }
  };

  const handleEstimateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processEstimateFile(file);
  };

  /** `phone`: the file came from the claim folder (a phone file), so it is not saved there again. */
  const processEstimateFile = async (file: File, phone?: ClaimDocument) => {
    // The question only collects the answer; it is recorded when reading starts,
    // so cancelling anything below leaves the next upload asking again.
    let answer: Kind | null = null;
    let switching = false;
    if (asksDocumentKind(useClaimStore.getState().currentClaim)) {
      answer = await new Promise<Kind | null>((resolve) => setKindAsk({ resolve }));
      setKindAsk(null);
      if (answer === null) return;
      // Switching a claim that already has rows loses figures: confirm before anything starts.
      const claim = useClaimStore.getState().currentClaim;
      const prompt = claim ? assessmentSwitch(claim, answer)?.prompt : null;
      if (prompt && !window.confirm(prompt)) return;
      switching = !!prompt;
    }
    // Asked BEFORE extraction: a wrong file, or a surveyor who changes their
    // mind, then costs nothing. Resolves straight to 'replace' on an empty
    // sheet — nothing to lose, so nothing to ask. A switch always replaces (F3).
    const mode = await uploadModeAfterSwitch(switching, () => confirmEstimateMode(file.name));
    if (mode === null) return;

    if (await needsReview([file])) {
      setReviewSheet({ file, mode, phone, answer });
      return;
    }
    await startEstimate(file, mode, answer, phone);
  };

  const evidenceImages: string[] = [];

  if (!currentClaim) return null;

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] p-3 lg:p-4 max-w-[1700px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      {estimateModeDialog}
      {kindAsk && <DocumentKindDialog current={currentClaim.billCheck?.baseDocument ? (isFromBill(currentClaim) ? 'final-bill' : 'estimate') : undefined} onChoose={(k) => kindAsk.resolve(k)} onCancel={() => kindAsk.resolve(null)} />}
      {gateDialog}
      {reviewSheet && (
        <DocumentReviewSheet
          open
          slotLabel="Estimate"
          files={[reviewSheet.file]}
          onCancel={() => setReviewSheet(null)}
          onConfirm={(_all, forAI) => {
            const { mode, phone, answer } = reviewSheet;
            setReviewSheet(null);
            if (forAI[0]) void startEstimate(forAI[0], mode, answer, phone);
          }}
        />
      )}

      {/* Lean Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5 shrink-0 bg-card border border-border px-3 py-2 rounded-xl shadow-xs">
        {/* Left side: Title, Policy Dep dropdown, Policy Check badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Assessment</h2>

          <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-md px-2 py-1">
            <span className="font-medium text-foreground">Depreciation:</span>
            <select
              id="dep-type"
              value={currentClaim.depreciationType}
              // Through the policy answer, so the dropdown and Policy Check never disagree.
              onChange={(e) => setPolicyCheck({ nilDep: e.target.value === 'nil' ? 'yes' : 'no' })}
              className="h-6 rounded bg-background px-1.5 text-xs font-medium text-primary border border-input focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="standard">Standard (Age Based)</option>
              <option value="nil">Nil Depreciation</option>
            </select>
          </div>

          <PolicyCheckStrip autoOpen />
        </div>

        {/* Right side: AI controls & Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI extraction controls in a tight compact pill */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/40 border border-border/60 text-xs">
            <span className="text-[10px] font-medium mr-0.5 text-muted-foreground">AI</span>
            <ProviderToggle />
            <DocModeToggle />
            <ModelSelector />
            <ProviderHealthBadge />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                accept="image/*,application/pdf"
                onChange={handleEstimateUpload}
                disabled={isProcessing}
                title="Upload Document"
              />
              <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2.5 text-xs" tabIndex={-1} disabled={isProcessing}>
                <Upload size={14} />
                Upload Document
              </Button>
            </div>

            <UsePhoneFiles types={ESTIMATE_TYPES} className="h-8 px-2.5 text-xs" disabled={isProcessing} onPick={(file, doc) => void processEstimateFile(file, doc)} />

            {/* An estimate was read when some row carries a source. */}
            {currentClaim.assessmentRows.some((r) => r.source) && (
              <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" disabled={isProcessing} onClick={() => setFixOpen(true)}>
                Fix reading
              </Button>
            )}

            <Button
              variant={showEvidence ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowEvidence(!showEvidence)}
              className={`gap-1.5 h-8 px-2.5 text-xs ${showEvidence ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : ''}`}
            >
              {showEvidence ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              {showEvidence ? 'Hide Evidence' : 'Show Evidence'}
            </Button>

            <Button
              variant={showSummary ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowSummary(s => !s)}
              className={`gap-1.5 h-8 px-2.5 text-xs ${showSummary ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30' : ''}`}
            >
              {showSummary ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              {showSummary ? 'Hide Summary' : 'Show Summary'}
            </Button>

            <SaveProgressButton className="h-8 px-2.5 text-xs" />
            {/* Same checks as Report Center: estimate floor, policy check, UIIC repair dates. */}
            <PrintMenu
              disabled={isProcessing}
              options={[
                { label: 'Final survey report', onSelect: () => gate('final', () => triggerStandardPrint(latestClaim(), profile)) },
                { label: 'UIIC final report', onSelect: () => gate('uiic-final', () => triggerUIICFinalPrint(latestClaim(), profile)) },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-background rounded-xl border border-border overflow-hidden">
        <PanelGroup orientation="horizontal">
          {/* Main Assessment Content */}
          <Panel defaultSize={showEvidence ? 60 : 100} minSize={30}>
            {/*
              Grid and summary each scroll on their own, at full height. The grid's
              rows scroll inside the card (see AssessmentGrid), so its toolbar and
              column headings stay in view however long the estimate is.
            */}
            <div className="h-full flex gap-4 p-4">
              <div className="flex-1 min-w-0 h-full">
                <AssessmentGrid footer={<div className="mt-8 pb-8"><TotalLossForm /></div>} />
              </div>
              {showSummary && (
                <div className="w-[300px] xl:w-[340px] shrink-0 h-full">
                  <AssessmentSummary />
                </div>
              )}
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
        source={reviewData?.source}
      />

      <FixEstimateDialog open={fixOpen} onClose={() => setFixOpen(false)} />
    </div>
  );
}
