'use client';

import { useEffect, useState } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { calculateAssessmentSummary, calculateBillCheckSummary, getVehicleAgeMonths, buildSerialMap } from '@/lib/calculations';
import { billCheckAssessed, resolveBillSalvage } from '@/lib/reports/bill-check-projection';
import { settleLegacyRefs } from '@/lib/reports/bill-ref';
import { billCheckFlags, reconcileInvoice } from '@/lib/reports/bill-check-flags';
import { salvageBasis } from '@/lib/calculations/salvage';
import { needsReview } from '@/lib/ai/needs-review';

import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { DocumentEvidenceViewer } from '@/components/evidence/DocumentEvidenceViewer';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
import { useEstimateModePrompt } from '@/hooks/useEstimateModePrompt';
import { useBillCheckPrintGate } from '@/hooks/useBillCheckPrintGate';

import { BillCheckHeader } from './bill-check/BillCheckHeader';
import { BillCheckGrid } from './bill-check/BillCheckGrid';
import { isFromBill, rowsLostOnSwitch } from '@/lib/reports/bill-check-mode';
import { ExtraBillItemsPanel } from './bill-check/ExtraBillItemsPanel';
import { BillCheckSummaryPanel } from './bill-check/BillCheckSummaryPanel';
import { BillCheckAttentionBanner } from './bill-check/BillCheckAttentionBanner';
import { fmt } from './bill-check/config';

export function BillCheckTab() {
  const currentClaim        = useClaimStore(s => s.currentClaim);
  const updateAssessmentRow = useClaimStore(s => s.updateAssessmentRow);
  const deleteAssessmentRow = useClaimStore(s => s.deleteAssessmentRow);
  const deleteAssessmentRows = useClaimStore(s => s.deleteAssessmentRows);
  const deleteExtraBillItem = useClaimStore(s => s.deleteExtraBillItem);
  const clearExtraBillItems = useClaimStore(s => s.clearExtraBillItems);
  const linkExtraBillItem   = useClaimStore(s => s.linkExtraBillItem);
  const promoteExtraBillItem = useClaimStore(s => s.promoteExtraBillItem);
  const updateBillCheck     = useClaimStore(s => s.updateBillCheck);
  const updateFeeBill       = useClaimStore(s => s.updateFeeBill);
  const setBillCheckUpload  = useClaimStore(s => s.setBillCheckUpload);
  const { profile } = useProfileStore();

  const [showEvidence, setShowEvidence] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [reviewFile, setReviewFile] = useState<{ file: File; mode: 'replace' | 'continue' } | null>(null);

  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview, smartFix, reviewProgress } = useAIExtraction();
  const { confirmBillMode, estimateModeDialog } = useEstimateModePrompt();
  const { requestPrint, dialogs: printDialogs } = useBillCheckPrintGate();

  // Once per claim: refs saved by the old word matcher between two different
  // part numbers stop counting as sure; status-less refs become the surveyor's.
  const claimId = currentClaim?.id;
  useEffect(() => {
    const rows = useClaimStore.getState().currentClaim?.assessmentRows;
    if (!rows) return;
    for (const { id, updates } of settleLegacyRefs(rows)) updateAssessmentRow(id, updates);
  }, [claimId, updateAssessmentRow]);

  if (!currentClaim) return null;

  const upload = isFromBill(currentClaim) ? 'estimate' : 'final-bill';

  const fb = currentClaim.feeBill;
  const bc = currentClaim.billCheck || { billNo: '', billDate: '', billTotal: 0, billCheckDate: '' };
  const allRows = currentClaim.assessmentRows;
  const allowedRows = allRows.filter(r => r.allowed);
  const extraBillItems = currentClaim.extraBillItems || [];
  const serials = buildSerialMap(allRows);

  const ageMonths = getVehicleAgeMonths(
    currentClaim.vehicle.dateOfRegistration,
    currentClaim.vehicle.yearOfManufacture,
    currentClaim.accident.dateAndTime,
  );

  const finalSalvageBasis = salvageBasis(allRows);
  const bcSalvageBasis = salvageBasis(allRows, billCheckAssessed);
  const bcSalvage = resolveBillSalvage(fb, allRows);

  const summary = calculateAssessmentSummary(
    allRows, ageMonths, currentClaim.depreciationType,
    bcSalvage, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
    currentClaim, fb?.towingCharges ?? 0
  );
  const bcSummary = calculateBillCheckSummary(
    allRows, ageMonths, currentClaim.depreciationType,
    bcSalvage, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
    currentClaim, fb?.towingCharges ?? 0
  );

  const inBillTotal    = allowedRows.filter(r => r.billStatus === 'in-bill').reduce((s, r) => s + (r.billedAmount || 0), 0);
  const notInBillTotal = allowedRows.filter(r => r.billStatus === 'not-in-bill').reduce((s, r) => s + r.assessed, 0);
  const partialTotal   = allowedRows.reduce((s, r) => s + Math.max(0, r.assessed - billCheckAssessed(r)), 0);

  const flags = billCheckFlags(allRows);
  const reconciliation = reconcileInvoice(allRows, bc.billTotal ?? 0);

  const confirmAllBelow = () => {
    flags.filter(f => f.kind === 'billed-below')
      .forEach(f => updateAssessmentRow(f.rowId, { billVerified: true }));
  };

  const keepAllAbove = () => {
    flags.filter(f => f.kind === 'billed-above')
      .forEach(f => updateAssessmentRow(f.rowId, { billVerified: true }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void processBillFile(file);
  };

  const processBillFile = async (file: File) => {
    const mode = await confirmBillMode(file.name, upload === 'estimate' ? 'estimate' : 'bill');
    if (!mode) return;
    if (await needsReview([file])) setReviewFile({ file, mode });
    else triggerExtraction('final-bill', file, undefined, undefined, mode);
  };

  const handleUploadChange = (kind: 'final-bill' | 'estimate') => {
    const losing = rowsLostOnSwitch(currentClaim, kind);
    if (losing > 0 || extraBillItems.length > 0) {
      const ok = window.confirm(kind === 'final-bill'
        ? `Switch to Final bill? The estimate numbers and billed amounts on ${losing} items will be cleared, because a final bill will now be read for them.`
        : `Switch to Estimate? The bill item numbers and billed amounts on ${losing} items will be replaced by the bill's own figures, and the bill lines read so far will be cleared.`);
      if (!ok) return;
    }
    setBillCheckUpload(kind);
  };

  const isInvoiceVerified =
    Boolean(bc.billNo?.trim()) &&
    Boolean(bc.billDate?.trim()) &&
    Boolean(bc.billTotal && bc.billTotal > 0) &&
    bc.verifiedBySurveyor === true;

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)] p-3 lg:p-4 max-w-[1700px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
      {estimateModeDialog}
      {printDialogs}

      {/* Lean Header Toolbar */}
      <BillCheckHeader
        showEvidence={showEvidence}
        onToggleEvidence={() => setShowEvidence(v => !v)}
        showSummary={showSummary}
        onToggleSummary={() => setShowSummary(v => !v)}
        bcSummary={bcSummary}
        claimId={currentClaim.id}
        fmt={fmt}
        isProcessing={isProcessing}
        isInvoiceVerified={isInvoiceVerified}
        onFileUpload={handleFileUpload}
        onPhoneFile={processBillFile}
        upload={upload}
        onUploadChange={handleUploadChange}
        onPrint={requestPrint}
      />

      {/* Split Workspace */}
      <div className="flex-1 min-h-0 bg-background rounded-xl border border-border overflow-hidden">
        <PanelGroup orientation="horizontal">
          {/* Main Bill Check Content */}
          <Panel defaultSize={showEvidence ? 60 : 100} minSize={30}>
            <div className="h-full overflow-y-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className={showSummary ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'}>
                  <BillCheckAttentionBanner
                    flags={flags}
                    reconciliation={reconciliation}
                    onConfirmAllBelow={confirmAllBelow}
                    onKeepAllAbove={keepAllAbove}
                  />

                  <div className="mt-4">
                    <BillCheckGrid
                      allRows={allRows}
                      allowedRows={allowedRows}
                      summary={summary}
                      serials={serials}
                      updateAssessmentRow={updateAssessmentRow}
                      deleteAssessmentRow={deleteAssessmentRow}
                      deleteAssessmentRows={deleteAssessmentRows}
                      claimId={currentClaim.id}
                      fmt={fmt}
                      ageMonths={ageMonths}
                      claim={currentClaim}
                    />
                  </div>

                  <div className="mt-6">
                    <ExtraBillItemsPanel
                      extraBillItems={extraBillItems}
                      assessmentRows={allRows}
                      onDelete={deleteExtraBillItem}
                      onClearAll={clearExtraBillItems}
                      onLink={linkExtraBillItem}
                      onPromote={promoteExtraBillItem}
                      canPromote={!isFromBill(currentClaim)}
                      fmt={fmt}
                    />
                  </div>
                </div>

                {showSummary && (
                  <div className="lg:col-span-4 xl:col-span-3">
                    <BillCheckSummaryPanel
                      bc={bc}
                      onBillCheckChange={updateBillCheck}
                      summary={summary}
                      bcSummary={bcSummary}
                      inBillTotal={inBillTotal}
                      notInBillTotal={notInBillTotal}
                      partialTotal={partialTotal}
                      fmt={fmt}
                      salvageValue={bcSalvage}
                      salvageBasis={bcSalvageBasis}
                      salvageNote={
                        fb?.billSalvage === undefined && finalSalvageBasis !== bcSalvageBasis
                          ? `Carried from final report and rescaled: ${fmt(finalSalvageBasis)} → ${fmt(bcSalvageBasis)}.`
                          : undefined
                      }
                      onSalvageChange={v => updateFeeBill({ billSalvage: v })}
                      onNavigateToReports={() => useUIStore.getState().setActiveTab('reports')}
                    />
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {showEvidence && (
            <>
              <PanelResizeHandle className="w-2 bg-muted/50 hover:bg-primary/50 transition-colors cursor-col-resize flex flex-col items-center justify-center border-l border-r border-border">
                <div className="h-8 w-1 rounded-full bg-muted-foreground/30" />
              </PanelResizeHandle>
              <Panel defaultSize={40} minSize={20}>
                <div className="h-full bg-card">
                  <DocumentEvidenceViewer embedded={true} defaultDocType="final-bill" />
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {reviewFile && (
        <DocumentReviewSheet
          open
          slotLabel={upload === 'estimate' ? 'Estimate' : 'Final Bill'}
          files={[reviewFile.file]}
          onCancel={() => setReviewFile(null)}
          onConfirm={(_all, forAI) => {
            const { mode } = reviewFile;
            setReviewFile(null);
            if (forAI[0]) triggerExtraction('final-bill', forAI[0], undefined, undefined, mode);
          }}
        />
      )}

      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        title={reviewData?.key || ''}
        data={reviewData?.data}
        findings={reviewData?.findings ?? []}
        onSmartFix={reviewData ? () => smartFix(reviewData.key) : undefined}
        smartFixProgress={reviewProgress}
        smartFixed={reviewData?.smartFixed}
        source={reviewData?.source}
      />
    </div>
  );
}
