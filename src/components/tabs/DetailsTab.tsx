'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VehicleDetailsForm } from '@/components/claim/VehicleForm';
import { DriverDetailsForm } from '@/components/claim/DriverForm';
import { PolicyDetailsForm } from '@/components/claim/PolicyForm';
import { AccidentDetailsForm } from '@/components/claim/AccidentForm';
import { useAIExtraction } from '@/hooks/useAIExtraction';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { downloadAsWord } from '@/lib/reports/word-export';
import { footerFromProfile } from '@/lib/reports/print-shell';
import { buildStandardFinalSurveyHTML } from '@/lib/reports/standard-report-builder';
import { calculateAssessmentSummary, getCompulsoryExcess } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { FileText, Sparkles, Download, Loader2, Hash, Wand2, FileSearch, PanelRightOpen, PanelRightClose, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SpotTab } from '@/components/tabs/SpotTab';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { ProcessingProgressOverlay } from '@/components/ui/ProcessingProgressOverlay';

// ─── Inline Evidence Panel ────────────────────────────────────────────────────
// Uses blob URLs stored in the evidence store — no PNG conversion needed.

const DOC_LABELS: Record<string, string> = {
  rc: 'Registration Certificate',
  policy: 'Insurance Policy',
  dl: 'Driving Licence',
  estimate: 'Repair Estimate',
  'final-bill': 'Final Bill',
  permit: 'Permit',
  fitness: 'Fitness Certificate',
  fir: 'FIR / Panchnama',
  claim: 'Claim Form',
  auth: 'Authorisation',
  'lok-challan': 'Lok Challan',
  photos: 'Damage Photos',
};

function InlineEvidencePanel({ claimId }: { claimId: string }) {
  const { field, blobUrls } = useEvidenceStore();

  // Determine which document to show: active field's doc or first available
  let effectiveDocType = field?.docType;
  if (!effectiveDocType) {
    for (const type of ['rc', 'policy', 'dl', 'estimate']) {
      if (blobUrls[`${claimId}_${type}`]) {
        effectiveDocType = type;
        break;
      }
    }
  }

  const docLabel = effectiveDocType ? (DOC_LABELS[effectiveDocType] ?? effectiveDocType.toUpperCase()) : '';
  const blobEntry = effectiveDocType ? blobUrls[`${claimId}_${effectiveDocType}`]?.[0] : undefined;
  const isPdf = blobEntry?.mimeType === 'application/pdf';

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-border bg-[var(--color-neutral-50)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-[var(--color-neutral-50)] border-b border-border">
        <div className="flex items-center gap-2">
          <FileSearch size={16} className="text-primary" />
          <div>
            <div className="text-xs font-medium text-foreground">Evidence Viewer</div>
            {docLabel && <div className="text-[10px] text-primary mt-0.5">{docLabel}</div>}
          </div>
        </div>
        {blobEntry && (
          <a
            href={blobEntry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary underline hover:opacity-80"
          >
            Open in new tab
          </a>
        )}
      </div>

      {/* Context snippet */}
      {field?.contextSnippet && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg shrink-0 bg-[var(--color-status-warning-tint)] border border-[var(--color-status-warning)]/30">
          <div className="text-[10px] font-medium tracking-wide text-[var(--color-status-warning)] mb-1">Extracted from document</div>
          <div className="text-[11px] leading-relaxed font-mono text-[var(--color-neutral-900)]">{field.contextSnippet}</div>
        </div>
      )}

      {/* Document viewer */}
      <div className={`flex-1 overflow-hidden ${blobEntry ? '' : 'p-3'}`}>
        {blobEntry ? (
          isPdf ? (
            <iframe
              src={blobEntry.url}
              className="w-full h-full border-none block"
              title={docLabel}
            />
          ) : (
            <div className="h-full overflow-auto p-3">
              <img
                src={blobEntry.url}
                alt={`${docLabel} source document`}
                className="w-full block rounded-md shadow-lg"
              />
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-center text-[var(--color-neutral-400)] p-5">
            <div>
              <FileSearch size={36} className="opacity-30 mb-3 mx-auto" />
              <p className="text-xs m-0">
                {field
                  ? 'Upload the document to view it here.'
                  : 'Scan a document (RC / Policy / DL)\nto see the source here.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border shrink-0 flex items-center gap-1.5">
        <ChevronRight size={12} className="text-[var(--color-neutral-400)]" />
        <span className="text-[10px] text-[var(--color-neutral-400)]">Upload a document above to populate this panel</span>
      </div>
    </div>
  );
}

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
  const [panelOpen, setPanelOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY_PANEL + '-open') !== 'false'; } catch { return true; }
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    try { return parseInt(localStorage.getItem(STORAGE_KEY_PANEL + '-width') || '380', 10); } catch { return 380; }
  });

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(panelWidth);
  const containerRef = useRef<HTMLDivElement>(null);

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    try { localStorage.setItem(STORAGE_KEY_PANEL + '-open', String(next)); } catch {}
  };

  // ── Drag-to-resize ──────────────────────────────────────────────────────────
  const onMouseDownHandle = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;

    const onMove = (me: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - me.clientX; // dragging left = wider panel
      const container = containerRef.current;
      const maxW = container ? container.offsetWidth - 400 : 800;
      const newW = Math.min(Math.max(dragStartWidth.current + delta, 280), maxW);
      setPanelWidth(newW);
    };

    const onUp = () => {
      isDragging.current = false;
      // persist
      try { localStorage.setItem(STORAGE_KEY_PANEL + '-width', String(panelWidth)); } catch {}
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  // persist width on change (deferred)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_PANEL + '-width', String(panelWidth)); } catch {}
  }, [panelWidth]);

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

  const surveyLabel = currentClaim.surveyType === 'spot' ? 'Spot Survey' :
                      currentClaim.surveyType === 'final' ? 'Final Survey' :
                      currentClaim.surveyType === 'valuation' ? 'Valuation / Break-in' : 'Survey';

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT: Form area ─────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 32px 40px' }}
        className="@container animate-in fade-in slide-in-from-bottom-2 duration-300"
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
                  const fb = currentClaim.feeBill;
                  const summary = calculateAssessmentSummary(
                    currentClaim.assessmentRows || [],
                    getVehicleAgeMonths(
                      currentClaim.vehicle?.dateOfRegistration || null,
                      currentClaim.vehicle?.yearOfManufacture ? Number(currentClaim.vehicle.yearOfManufacture) : null,
                      currentClaim.accident?.dateAndTime || null,
                    ),
                    currentClaim.depreciationType || 'Standard',
                    fb?.salvageValue || 0,
                    getCompulsoryExcess(fb),
                    fb?.voluntaryExcess || 0,
                  );
                  downloadAsWord(
                    buildStandardFinalSurveyHTML(currentClaim, summary, profile!),
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
            <PolicyDetailsForm />
            {currentClaim.surveyType !== 'valuation' && <DriverDetailsForm />}
            {currentClaim.surveyType !== 'valuation' && <AccidentDetailsForm />}
          </div>

          {currentClaim.surveyType === 'spot' && <SpotTab />}
        </div>
      </div>

      {/* ── DRAG HANDLE ─────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div
          onMouseDown={onMouseDownHandle}
          style={{
            width: 6,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'transparent',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Drag to resize evidence panel"
        >
          {/* Visual handle indicator */}
          <div className="w-[3px] h-10 rounded-full bg-[var(--color-neutral-400)]/30 hover:bg-[var(--color-neutral-400)]/60 transition-colors" />
        </div>
      )}

      {/* ── RIGHT: Inline Evidence Viewer ───────────────────────────────────── */}
      {panelOpen && (
        <div
          style={{
            width: panelWidth,
            flexShrink: 0,
            padding: '16px 16px 16px 0',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 280,
          }}
        >
          <InlineEvidencePanel claimId={currentClaim.id} />
        </div>
      )}

      <AIReviewDialog
        isOpen={!!reviewData}
        onClose={cancelReview}
        onConfirm={confirmApply}
        title={reviewData?.key || ''}
        data={reviewData?.data}
      />

      <ProcessingProgressOverlay
        isVisible={isProcessing}
        progress={progress}
        onCancel={cancelReview}
      />
    </div>
  );
}
