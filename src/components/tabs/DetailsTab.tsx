'use client';

import { useState } from 'react';
import { AssignmentForm } from '@/components/claim/AssignmentForm';
import { PolicyDetailsForm } from '@/components/claim/PolicyForm';
import { VehicleDetailsForm } from '@/components/claim/VehicleForm';
import { DriverDetailsForm } from '@/components/claim/DriverForm';
import { PermitForm } from '@/components/claim/PermitForm';
import { AccidentDetailsForm } from '@/components/claim/AccidentForm';
import { AtAccidentForm } from '@/components/claim/AtAccidentForm';
import { SurveyForm } from '@/components/claim/SurveyForm';
import { DocumentChecklist } from '@/components/claim/DocumentChecklist';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { needsReview } from '@/lib/ai/needs-review';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import type { VehicleType } from '@/types';
import { Sparkles, Loader2, Hash, Wand2, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SpotTab } from '@/components/tabs/SpotTab';
import { InlineEvidencePanel } from '@/components/evidence/InlineEvidencePanel';
import { EvidencePanelSlot } from '@/components/evidence/EvidencePanelSlot';
import { useEvidencePanel } from '@/hooks/useEvidencePanel';

const VEHICLE_TYPES: { id: VehicleType; label: string }[] = [
  { id: 'private', label: 'Private' },
  { id: 'comm-goods', label: 'Comm. Goods' },
  { id: 'comm-passenger', label: 'Comm. Passenger' },
];

/** "Scan RC" etc. in a section header: pick a file, AI fills that section. */
function ScanButton({ label, busy, onFile }: { label: string; busy: boolean; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-md border border-primary/30 text-xs font-medium text-primary cursor-pointer hover:bg-primary/5 has-[:disabled]:opacity-50 has-[:disabled]:cursor-wait">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      Scan {label}
      <input type="file" className="sr-only" accept="image/*,application/pdf" disabled={busy} onChange={onFile} />
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const STORAGE_KEY_PANEL = 'surveyos-details-evidence-panel';

export function DetailsTab() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const updateClaim = useClaimStore(s => s.updateClaim);
  const updateSpotDetails = useClaimStore(s => s.updateSpotDetails);
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

  const scan = (id: string) => (
    <ScanButton
      label={docSlots.find(s => s.id === id)?.label ?? id}
      busy={isProcessing}
      onFile={(e) => handleFileChange(e, id)}
    />
  );
  const isValuation = currentClaim.surveyType === 'valuation';

  const surveyLabel =currentClaim.surveyType === 'spot' ? 'Spot Survey' :
                      currentClaim.surveyType === 'final' ? 'Final Survey' :
                      currentClaim.surveyType === 'valuation' ? 'Valuation / Break-in' : 'Survey';

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT: Form area ─────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}
        className="@container px-4 pt-4 pb-10 md:px-8 md:pt-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        <div className="w-full max-w-[1400px] mx-auto space-y-6">

          {/* Header row */}
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">Claim Details</h2>
              <p className="text-muted-foreground text-sm">
                One section per document, dates on the right. Changes save automatically offline.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={togglePanel}
              className="gap-2 shadow-sm shrink-0"
              title={panelOpen ? 'Hide Evidence Viewer' : 'Show Evidence Viewer'}
            >
              {panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              Evidence
            </Button>
          </div>

          {/* Report Number */}
          <div
            className="flex flex-wrap items-center gap-4 px-5 py-4 rounded-2xl bg-[var(--color-neutral-50)] border border-primary/20"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <Hash size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-48">
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

            {/* Chosen in New Claim, but a wrong pick must be undoable: it
                decides which sections (permit, load) show. Switching only
                hides or shows fields; stored values are kept. */}
            <div className="flex items-center gap-2 flex-shrink-0 @2xl:border-l @2xl:pl-4 border-primary/20">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">Vehicle</span>
              <div role="radiogroup" aria-label="Vehicle type" className="inline-flex rounded-lg border border-input overflow-hidden bg-background">
                {VEHICLE_TYPES.map(t => {
                  const active = currentClaim.vehicleType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        if (active) return;
                        updateClaim({ vehicleType: t.id });
                        toast.success(`Vehicle type: ${t.label}`);
                      }}
                      className={`px-2.5 py-1.5 text-xs font-medium border-r border-input last:border-r-0 transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {isProcessing && (
            <div className="sticky top-0 z-10 p-3 rounded-xl bg-primary text-primary-foreground shadow-lg flex items-center gap-3 animate-in zoom-in-95">
              <Loader2 className="animate-spin text-white" size={16} />
              <span className="text-sm font-medium">{progress || 'Processing document...'}</span>
            </div>
          )}

          {/* Option B: one section per source document, in the order the
              papers come off the file. Data paths are unchanged. */}
          <div className="space-y-6">
            <AssignmentForm />
            <PolicyDetailsForm scan={scan('policy')} />
            <VehicleDetailsForm scan={scan('rc')} />
            {!isValuation && <DriverDetailsForm scan={scan('dl')} />}
            <PermitForm />
            {!isValuation && <AccidentDetailsForm />}
            {!isValuation && <AtAccidentForm />}
            <SurveyForm />
            {!isValuation && <DocumentChecklist />}
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
