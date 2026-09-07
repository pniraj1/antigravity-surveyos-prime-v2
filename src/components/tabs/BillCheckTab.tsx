'use client';

import { useState, useMemo } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Printer, FileText } from 'lucide-react';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { calculateAssessmentSummary, calculateBillCheckSummary, getVehicleAgeMonths, buildSerialMap } from '@/lib/calculations';
import { triggerUIICBillCheckPrint, buildUIICBillCheckHTML } from '@/lib/reports/uiic-final-builder';
import { buildStandardFinalSurveyHTML, triggerStandardPrint } from '@/lib/reports/standard-report-builder';
import { rowsNeedingRemark, billCheckAssessed, resolveBillSalvage } from '@/lib/reports/bill-check-projection';
import { billCheckFlags, reconcileInvoice } from '@/lib/reports/bill-check-flags';
import { salvageBasis } from '@/lib/calculations/salvage';

import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { PendingRowsDialog } from '@/components/dialogs/PendingRowsDialog';
import { MissingRemarkDialog } from '@/components/dialogs/MissingRemarkDialog';
import { ReportPreviewPanel } from '@/components/shared/ReportPreviewPanel';
import { footerFromProfile } from '@/lib/reports/print-shell';
import { DocumentEvidenceViewer } from '@/components/evidence/DocumentEvidenceViewer';

import { BillCheckHeader } from './bill-check/BillCheckHeader';
import { BillCheckUploadPanel } from './bill-check/BillCheckUploadPanel';
import { BillCheckGrid } from './bill-check/BillCheckGrid';
import { ExtraBillItemsPanel } from './bill-check/ExtraBillItemsPanel';
import { BillCheckSummaryPanel } from './bill-check/BillCheckSummaryPanel';
import { BillCheckAttentionBanner } from './bill-check/BillCheckAttentionBanner';
import { fmt } from './bill-check/config';

function BillCheckPreview({ claim, profile, format, onPrint }: { claim: any; profile: any; format: 'standard' | 'uiic'; onPrint: () => void }) {
  const { html, error } = useMemo(() => {
    try {
      return {
        html: format === 'uiic'
          ? buildUIICBillCheckHTML(claim, profile)
          : buildStandardFinalSurveyHTML(claim, profile, 'bill-check'),
        error: null as string | null,
      };
    } catch (e: unknown) {
      // A blank preview used to be indistinguishable from an empty claim.
      return { html: '', error: e instanceof Error ? e.message : 'Report could not be built' };
    }
  }, [claim, profile, format]);

  if (error) {
    return (
      <div className="rounded-2xl p-6 bg-status-danger/10 border border-status-danger text-sm text-status-danger">
        <strong>Bill Check preview failed to build.</strong>
        <div className="text-xs mt-1 font-mono">{error}</div>
      </div>
    );
  }

  return (
    <ReportPreviewPanel
      html={html}
      title={`${format === 'uiic' ? 'UIIC' : 'Standard'} Bill Check Report — Live Preview`}
      printLabel="Power Print"
      onPrint={onPrint}
      wordFilename={`${claim?.vehicle?.registrationNumber || 'Claim'}-${format === 'uiic' ? 'UIIC' : 'Standard'}-Bill-Check`}
      footerLeft={footerFromProfile(profile)}
    />
  );
}

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
  const { profile } = useProfileStore();

  const [showEvidence, setShowEvidence] = useState(false);
  const [format, setFormat] = useState<'standard' | 'uiic'>('standard');
  const [pendingGate, setPendingGate] = useState(false);
  const [remarkWarning, setRemarkWarning] = useState(false);
  const [flagGate, setFlagGate] = useState(false);

  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview } = useAIExtraction();

  if (!currentClaim) return null;

  const fb = currentClaim.feeBill;
  const bc = currentClaim.billCheck || { billNo: '', billDate: '', billTotal: 0 };
  const allRows = currentClaim.assessmentRows;
  const allowedRows = allRows.filter(r => r.allowed);
  const extraBillItems = currentClaim.extraBillItems || [];
  // Same numbering the two PDFs use, so what is verified here is what is read there.
  const serials = buildSerialMap(allRows);

  const ageMonths = getVehicleAgeMonths(
    currentClaim.vehicle.dateOfRegistration,
    currentClaim.vehicle.yearOfManufacture,
    currentClaim.accident.dateAndTime,
  );
  // Both summaries on this tab describe the bill check, so both get the
  // bill-check salvage. feeBill.salvageValue is never written from here.
  const finalSalvageBasis = salvageBasis(allRows);
  const bcSalvageBasis = salvageBasis(allRows, billCheckAssessed);
  const bcSalvage = resolveBillSalvage(fb, allRows);

  const summary = calculateAssessmentSummary(
    allRows, ageMonths, currentClaim.depreciationType,
    bcSalvage, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
    currentClaim,
  );
  const bcSummary = calculateBillCheckSummary(
    allRows, ageMonths, currentClaim.depreciationType,
    bcSalvage, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
    currentClaim,
  );

  const inBillTotal    = allowedRows.filter(r => r.billStatus === 'in-bill').reduce((s, r) => s + (r.billedAmount || 0), 0);
  const notInBillTotal = allowedRows.filter(r => r.billStatus === 'not-in-bill').reduce((s, r) => s + r.assessed, 0);
  // What the cap took off: the gap between what was assessed and what this
  // document actually claims. Used to read a `partial` status that changed no
  // arithmetic anywhere, so the tile sat at zero on claims with real variance.
  const partialTotal   = allowedRows.reduce((s, r) => s + Math.max(0, r.assessed - billCheckAssessed(r)), 0);

  const flags = billCheckFlags(allRows);
  const reconciliation = reconcileInvoice(allRows, bc.billTotal ?? 0);

  const confirmAllBelow = () => {
    flags.filter(f => f.kind === 'billed-below')
      .forEach(f => updateAssessmentRow(f.rowId, { billVerified: true }));
  };
  // Keeps the assessment: verified, with no allowance written, so the claim
  // stays where the surveyor put it at final survey.
  const keepAllAbove = () => {
    flags.filter(f => f.kind === 'billed-above')
      .forEach(f => updateAssessmentRow(f.rowId, { billVerified: true }));
  };
  const blockingFlags = flags.filter(f => f.blocking);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) triggerExtraction('final-bill', file);
    e.target.value = '';
  };

  // A bill check is not issued while the bill is pending — pending means the
  // workshop gave no figure for that item, so PENDING must never reach the PDF.
  const pendingRows = allowedRows.filter(r => !r.billStatus || r.billStatus === 'pending');
  // A missing remark never changes a number, so it warns rather than blocks.
  const remarkRows = rowsNeedingRemark(allowedRows);

  const doPrint = () => {
    if (format === 'uiic') triggerUIICBillCheckPrint(currentClaim, profile);
    else triggerStandardPrint(currentClaim, profile, 'bill-check');
  };

  const handlePrint = () => {
    if (pendingRows.length > 0) { setPendingGate(true); return; }
    // A row whose bill and assessment disagree has not been looked at. The cap
    // has already moved the money on the billed-below rows, so printing here
    // would issue figures nobody verified.
    if (blockingFlags.length > 0) { setFlagGate(true); return; }
    if (remarkRows.length > 0) { setRemarkWarning(true); return; }
    doPrint();
  };

  const resolveAllPending = () => {
    pendingRows.forEach(r =>
      updateAssessmentRow(r.id, { billStatus: 'not-in-bill', billedTaxable: 0, billedAmount: 0 }),
    );
    setPendingGate(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-card">
      <BillCheckHeader
        showEvidence={showEvidence}
        onToggleEvidence={() => setShowEvidence(v => !v)}
        bcSummary={bcSummary}
        claimId={currentClaim.id}
        fmt={fmt}
      />

      <PanelGroup orientation="horizontal" className="flex-1 overflow-hidden">
        <Panel defaultSize={60} minSize={30} className="h-full overflow-y-auto">
          <div className="px-6 lg:px-12 py-8 space-y-8">
            <BillCheckUploadPanel
              bc={bc}
              onBillCheckChange={updateBillCheck}
              isProcessing={isProcessing}
              progress={progress}
              onFileUpload={handleFileUpload}
            />

            <BillCheckAttentionBanner
              flags={flags}
              reconciliation={reconciliation}
              onConfirmAllBelow={confirmAllBelow}
              onKeepAllAbove={keepAllAbove}
            />

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
              depreciationType={currentClaim.depreciationType}
              claim={currentClaim}
            />

            <ExtraBillItemsPanel
              extraBillItems={extraBillItems}
              assessmentRows={allRows}
              onDelete={deleteExtraBillItem}
              onClearAll={clearExtraBillItems}
              onLink={linkExtraBillItem}
              onPromote={promoteExtraBillItem}
              fmt={fmt}
            />

            <BillCheckSummaryPanel
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
                  ? `Carried from the final report and rescaled — metal allowed went ${fmt(finalSalvageBasis)} → ${fmt(bcSalvageBasis)}. Type a figure to set your own.`
                  : undefined
              }
              onSalvageChange={v => updateFeeBill({ billSalvage: v })}
            />

            {/* Power Print */}
            <div className="rounded-2xl overflow-hidden bg-white border border-border">
              <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-foreground">Download Bill Check Report</div>
                  <div className="text-xs mt-0.5 text-muted-foreground">
                    Only allowed items, original serial numbers
                  </div>
                </div>
                <div className="flex gap-1 p-1 rounded-xl bg-neutral-50">
                  {(['standard', 'uiic'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: format === f ? 'var(--color-card, #FFFFFF)' : 'transparent',
                        color: format === f ? 'var(--color-primary)' : 'var(--color-neutral-400)',
                        boxShadow: format === f ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                      }}
                    >
                      {f === 'uiic' ? 'UIIC' : 'Standard'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1 text-xs leading-relaxed text-foreground">
                  <strong>How Bill Check works:</strong> The Final Survey logs what was <em>allowed</em>.
                  Once repairs are done, the workshop submits a final bill. This report verifies every
                  allowed item appears in the bill — flagging missing or mismatched amounts. Only allowed
                  items appear in this report; disallowed items are excluded.
                </div>
                <button
                  id="btn-print-bill-check"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
                  style={{ boxShadow: '0 4px 14px rgba(13,27,42,0.3)' }}
                >
                  <Printer size={16} />
                  Power Print — {format === 'uiic' ? 'UIIC' : 'Standard'} Bill Check
                </button>
              </div>
            </div>

            {/* Info note */}
            <div
              className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20"
            >
              <FileText size={16} className="text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs text-foreground" style={{ lineHeight: 1.6 }}>
                <strong>Note:</strong> The Bill Check Report will open in a new tab. Use your browser&apos;s print dialog
                (Ctrl+P / ⌘P) to save as PDF. Ensure &quot;Background graphics&quot; is enabled in print settings for
                full colour output.
              </div>
            </div>

            <BillCheckPreview claim={currentClaim} profile={profile} format={format} onPrint={handlePrint} />
          </div>
        </Panel>

        {showEvidence && (
          <>
            <PanelResizeHandle className="w-1.5 bg-neutral-200 hover:bg-primary transition-colors cursor-col-resize relative">
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-neutral-300" />
            </PanelResizeHandle>
            <Panel defaultSize={40} minSize={25} className="h-full border-l bg-white">
              {/* Every openField call from Bill Check targets 'final-bill'; naming
                  it here means the upload control also works before the surveyor
                  has clicked a row. */}
              <DocumentEvidenceViewer embedded={true} defaultDocType="final-bill" />
            </Panel>
          </>
        )}
      </PanelGroup>

      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        title={reviewData?.key || ''}
        data={reviewData?.data}
      />

      {pendingGate && (
        <PendingRowsDialog
          rows={pendingRows}
          onResolveAll={resolveAllPending}
          onCancel={() => setPendingGate(false)}
        />
      )}

      {flagGate && (
        <PendingRowsDialog
          rows={allRows.filter(r => blockingFlags.some(f => f.rowId === r.id))}
          title={`${blockingFlags.length} item${blockingFlags.length === 1 ? '' : 's'} not yet checked against the bill`}
          body="The bill and your assessment disagree on these. Look at each before issuing — the claim has already been capped where the workshop billed less."
          resolveLabel="Confirm all"
          onResolveAll={() => {
            blockingFlags.forEach(f => updateAssessmentRow(f.rowId, { billVerified: true }));
            setFlagGate(false);
          }}
          onCancel={() => setFlagGate(false)}
        />
      )}

      {remarkWarning && (
        <MissingRemarkDialog
          rows={remarkRows}
          onPrintAnyway={() => { setRemarkWarning(false); doPrint(); }}
          onCancel={() => setRemarkWarning(false)}
        />
      )}
    </div>
  );
}
