'use client';

import { useState } from 'react';
import { VehicleDetailsForm } from '@/components/claim/VehicleForm';
import { CommercialLoadForm } from '@/components/claim/CommercialLoadForm';
import { DriverDetailsForm } from '@/components/claim/DriverForm';
import { PolicyDetailsForm } from '@/components/claim/PolicyForm';
import { AccidentDetailsForm } from '@/components/claim/AccidentForm';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { needsReview } from '@/lib/ai/needs-review';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { downloadAsWord } from '@/lib/reports/word-export';
import { footerFromProfile } from '@/lib/reports/print-shell';
import { buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { FileText, Sparkles, Download, Loader2, Hash, Wand2, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SpotTab } from '@/components/tabs/SpotTab';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { InlineEvidencePanel } from '@/components/evidence/InlineEvidencePanel';
import { EvidencePanelSlot } from '@/components/evidence/EvidencePanelSlot';
import { useEvidencePanel } from '@/hooks/useEvidencePanel';

function EvidenceIconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center px-1.5 py-1 rounded border-none cursor-pointer text-[var(--color-neutral-400)] bg-[var(--color-neutral-100)] transition-colors hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-neutral-900)]"
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STORAGE_KEY_PANEL = 'surveyos-details-evidence-panel';

export function DetailsTab() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const updateClaim = useClaimStore(s => s.updateClaim);
  const updateSpotDetails = useClaimStore(s => s.updateSpotDetails);
  const profile = useProfileStore(s => s.profile);
  const getNextSpotNumber = useProfileStore(s => s.getNextSpotNumber);
  const getNextFinalNumber = useProfileStore(s => s.getNextFinalNumber);
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview } = useAIExtraction();

  // Evidence panel open/closed + width (px) — persisted in localStorage
  const panel = useEvidencePanel(STORAGE_KEY_PANEL, 380);
  const { panelOpen, togglePanel, containerRef } = panel;
  const [reviewSheet, setReviewSheet] = useState<{ key: string; label: string; file: File } | null>(null);

  if (!currentClaim) return null;

  const docSlots = [
    { id: 'rc', label: 'RC Copy' },
    { id: 'dl', label: 'Driving Licence' },
    { id: 'policy', label: 'Policy Schedule' }
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (await needsReview([file])) {
      const label = docSlots.find(s => s.id === key)?.label ?? key.toUpperCase();
      setReviewSheet({ key, label, file });
      return;
    }
    triggerExtraction(key, file);
  };

  const surveyLabel = currentClaim.surveyType === 'spot' ? 'Spot Survey' :
                      currentClaim.surveyType === 'final' ? 'Final Survey' :
                      currentClaim.surveyType === 'valuation' ? 'Valuation / Break-in' : 'Survey';

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT: Form area ─────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}
        className="@container px-4 pt-4 pb-10 md:px-8 md:pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <div className="w-full max-w-[1400px] mx-auto space-y-8">

          {/* Report Number */}
          <div
            className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-[var(--color-neutral-50)] border border-primary/20"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <Hash size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] mb-1 text-primary/70">
                {surveyLabel} Report No.
              </div>
              <input
                value={currentClaim.reportNo || ''}
                onChange={e => {
                  updateClaim({ reportNo: e.target.value });
                  if (currentClaim.surveyType === 'spot') {
                    updateSpotDetails({ reportNo: e.target.value });
                  }
                }}
                onBlur={e => {
                  // Remember the edited format so the next report continues the
                  // surveyor's series (e.g. "spot-257-2026/2027" → "spot-258-…")
                  const v = e.target.value.trim();
                  if (!v) return;
                  useProfileStore.getState().updateProfile(
                    currentClaim.surveyType === 'spot'
                      ? { lastSpotReportNo: v }
                      : { lastFinalReportNo: v }
                  );
                }}
                placeholder="Auto-assigned on creation — edit if needed"
                className="w-full bg-transparent text-lg font-medium tracking-wide focus:outline-none placeholder:font-normal placeholder:text-sm text-foreground caret-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (currentClaim.reportNo && !confirm('Overwrite existing report number?')) return;
                const next = currentClaim.surveyType === 'spot' ? getNextSpotNumber() : getNextFinalNumber();
                updateClaim({ reportNo: next });
                if (currentClaim.surveyType === 'spot') {
                  const today = new Date().toISOString().split('T')[0];
                  updateSpotDetails({
                    reportNo: next,
                    ...(!currentClaim.spotDetails?.reportDate && { reportDate: today }),
                    ...(!currentClaim.spotDetails?.allotmentDate && { allotmentDate: today }),
                  });
                }
                toast.success(`Allocated: ${next}`);
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 bg-primary/20 text-primary"
              title="Auto-allocate next sequential number"
            >
              <Wand2 size={15} />
            </button>
            <div
              className="text-[10px] font-medium px-3 py-1 rounded-full flex-shrink-0 bg-primary/15 text-primary border border-primary/30"
            >
              {currentClaim.reportNo ? 'Assigned' : 'Pending'}
            </div>
          </div>

          {/* Header row */}
          <div className="flex justify-between items-start">
            <div className="mb-4">
              <h2 className="text-2xl font-medium tracking-tight">Claim Details</h2>
              <p className="text-muted-foreground text-sm">
                Core intake information for the claim. All changes save automatically offline.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={togglePanel}
                className="gap-2 shadow-sm"
                title={panelOpen ? 'Hide Evidence Viewer' : 'Show Evidence Viewer'}
              >
                {panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                Evidence
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  downloadAsWord(
                    buildStandardFinalSurveyHTML(currentClaim, profile!),
                    `${currentClaim.vehicle.registrationNumber || 'Claim'}-Final-Survey`,
                    footerFromProfile(profile),
                  );
                }}
                className="gap-2 shadow-sm"
              >
                <Download size={16} />
                Word Report
              </Button>
            </div>
          </div>

          {/* AI Extraction Slots */}
          <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-4">
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
                  <div className="text-sm font-medium text-primary flex items-center gap-1.5 justify-center">
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
              <span className="text-sm font-medium tracking-tight uppercase">{progress || 'Processing Document...'}</span>
            </div>
          )}

          <div className="space-y-6">
            <VehicleDetailsForm />
            <CommercialLoadForm />
            <PolicyDetailsForm />
            {currentClaim.surveyType !== 'valuation' && <DriverDetailsForm />}
            {currentClaim.surveyType !== 'valuation' && <AccidentDetailsForm />}
          </div>

          {currentClaim.surveyType === 'spot' && <SpotTab />}
        </div>
      </div>

      <EvidencePanelSlot panel={panel}>
        <InlineEvidencePanel claimId={currentClaim.id} />
      </EvidencePanelSlot>

      {reviewSheet && (
        <DocumentReviewSheet
          open
          slotLabel={reviewSheet.label}
          files={[reviewSheet.file]}
          onCancel={() => setReviewSheet(null)}
          onConfirm={(_all, forAI) => {
            const { key } = reviewSheet;
            setReviewSheet(null);
            if (forAI[0]) triggerExtraction(key, forAI[0]);
          }}
        />
      )}

      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        title={reviewData?.key || ''}
        data={reviewData?.data}
      />

    </div>
  );
}
