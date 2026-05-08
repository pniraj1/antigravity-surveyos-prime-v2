'use client';

import { useState, useMemo } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { Printer, FileText } from 'lucide-react';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { calculateAssessmentSummary, calculateBillCheckSummary, getVehicleAgeMonths } from '@/lib/calculations';
import { triggerUIICBillCheckPrint, buildUIICBillCheckHTML } from '@/lib/reports/uiic-final-builder';

import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { ProcessingProgressOverlay } from '@/components/ui/ProcessingProgressOverlay';
import { ReportPreviewPanel } from '@/components/shared/ReportPreviewPanel';
import { DocumentEvidenceViewer } from '@/components/evidence/DocumentEvidenceViewer';

import { BillCheckHeader } from './bill-check/BillCheckHeader';
import { BillCheckUploadPanel } from './bill-check/BillCheckUploadPanel';
import { BillCheckGrid } from './bill-check/BillCheckGrid';
import { ExtraBillItemsPanel } from './bill-check/ExtraBillItemsPanel';
import { BillCheckSummaryPanel } from './bill-check/BillCheckSummaryPanel';
import { fmt } from './bill-check/config';

function BillCheckPreview({ claim, profile }: { claim: any; profile: any }) {
  const html = useMemo(() => {
    try { return buildUIICBillCheckHTML(claim, profile); } catch { return ''; }
  }, [claim, profile]);
  return (
    <ReportPreviewPanel
      html={html}
      title="Bill Check Report — Live Preview"
      printLabel="Power Print"
      onPrint={() => triggerUIICBillCheckPrint(claim, profile)}
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
  const updateBillCheck     = useClaimStore(s => s.updateBillCheck);
  const { profile } = useProfileStore();

  const [showEvidence, setShowEvidence] = useState(false);

  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview } = useAIExtraction();

  if (!currentClaim) return null;

  const fb = currentClaim.feeBill;
  const bc = currentClaim.billCheck || { billNo: '', billDate: '', billTotal: 0 };
  const allRows = currentClaim.assessmentRows;
  const allowedRows = allRows.filter(r => r.allowed);
  const extraBillItems = currentClaim.extraBillItems || [];

  const ageMonths = getVehicleAgeMonths(
    currentClaim.vehicle.dateOfRegistration,
    currentClaim.vehicle.yearOfManufacture,
    currentClaim.accident.dateAndTime,
  );
  const summary = calculateAssessmentSummary(
    allRows, ageMonths, currentClaim.depreciationType,
    fb?.salvageValue ?? 0, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
  );
  const bcSummary = calculateBillCheckSummary(
    allRows, ageMonths, currentClaim.depreciationType,
    fb?.salvageValue ?? 0, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
  );

  const inBillTotal    = allowedRows.filter(r => r.billStatus === 'in-bill').reduce((s, r) => s + (r.billedAmount || 0), 0);
  const notInBillTotal = allowedRows.filter(r => r.billStatus === 'not-in-bill').reduce((s, r) => s + r.assessed, 0);
  const partialTotal   = allowedRows.filter(r => r.billStatus === 'partial').reduce((s, r) => s + r.assessed - (r.billedAmount || 0), 0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) triggerExtraction('final-bill', file);
    e.target.value = '';
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#F8F9FA' }}>
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

            <BillCheckGrid
              allRows={allRows}
              allowedRows={allowedRows}
              notInBillTotal={notInBillTotal}
              updateAssessmentRow={updateAssessmentRow}
              deleteAssessmentRow={deleteAssessmentRow}
              deleteAssessmentRows={deleteAssessmentRows}
              claimId={currentClaim.id}
              fmt={fmt}
            />

            <ExtraBillItemsPanel
              extraBillItems={extraBillItems}
              onDelete={deleteExtraBillItem}
              onClearAll={clearExtraBillItems}
              fmt={fmt}
            />

            <BillCheckSummaryPanel
              summary={summary}
              bcSummary={bcSummary}
              inBillTotal={inBillTotal}
              notInBillTotal={notInBillTotal}
              partialTotal={partialTotal}
              fmt={fmt}
            />

            {/* Power Print */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
                <div className="text-sm font-black" style={{ color: '#0D1B2A' }}>Download Bill Check Report</div>
                <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
                  Generates a UIIC-compliant Bill Check Report — only allowed items, original serial numbers
                </div>
              </div>
              <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1 text-xs leading-relaxed" style={{ color: '#4A4E69' }}>
                  <strong>How Bill Check works:</strong> The Final Survey logs what was <em>allowed</em>.
                  Once repairs are done, the workshop submits a final bill. This report verifies every
                  allowed item appears in the bill — flagging missing or mismatched amounts. Only allowed
                  items appear in this report; disallowed items are excluded.
                </div>
                <button
                  id="btn-print-bill-check"
                  onClick={() => currentClaim && triggerUIICBillCheckPrint(currentClaim, profile)}
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)', color: '#F8F9FA', boxShadow: '0 4px 14px rgba(13,27,42,0.3)' }}
                >
                  <Printer size={16} />
                  Power Print — Bill Check Report
                </button>
              </div>
            </div>

            {/* Info note */}
            <div
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              <FileText size={16} style={{ color: '#D4AF37', flexShrink: 0, marginTop: 1 }} />
              <div className="text-xs" style={{ color: '#4A4E69', lineHeight: 1.6 }}>
                <strong>Note:</strong> The Bill Check Report will open in a new tab. Use your browser&apos;s print dialog
                (Ctrl+P / ⌘P) to save as PDF. Ensure &quot;Background graphics&quot; is enabled in print settings for
                full colour output.
              </div>
            </div>

            <BillCheckPreview claim={currentClaim} profile={profile} />
          </div>
        </Panel>

        {showEvidence && (
          <>
            <PanelResizeHandle className="w-1.5 bg-slate-200 hover:bg-blue-400 transition-colors cursor-col-resize relative">
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-300" />
            </PanelResizeHandle>
            <Panel defaultSize={40} minSize={25} className="h-full border-l bg-white">
              <DocumentEvidenceViewer embedded={true} />
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
      <ProcessingProgressOverlay isVisible={isProcessing} progress={progress} onCancel={cancelReview} />
    </div>
  );
}
