'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Sparkles, Check, AlertTriangle, Info, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { ReconciliationField, getBestSourceValue } from '@/lib/ai/reconciliation';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { InlineEvidencePanel } from '@/components/evidence/InlineEvidencePanel';

interface ReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflictFields: ReconciliationField[];
  autoFilledFields: ReconciliationField[];
  claimId: string;
}

export function ReconciliationDialog({
  isOpen,
  onClose,
  conflictFields,
  autoFilledFields,
  claimId,
}: ReconciliationDialogProps) {
  const reconcileField = useClaimStore((state) => state.reconcileField);
  const batchReconcile = useClaimStore((state) => state.batchReconcile);
  const [isAutoFilledExpanded, setIsAutoFilledExpanded] = useState(false);
  const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
  const [confirmingRecommended, setConfirmingRecommended] = useState(false);

  const setActiveField = useEvidenceStore((state) => state.setActiveField);

  // No reset effect needed: DocumentsTab mounts this only while open, so all
  // transient state above starts fresh on every open.

  /**
   * Show the clicked source's document and the verbatim text its value came
   * from. Uses setActiveField, NOT openField: openField sets isOpen and would
   * stack the full-screen viewer on top of this modal.
   */
  const showEvidence = (field: ReconciliationField, origin: string) => {
    const source = field.sources.find((s) => s.origin === origin);
    setActiveOrigin(origin);
    setActiveField(claimId, {
      docType: origin,
      fieldKey: field.path,
      contextSnippet: source?.contextSnippet ?? '',
    });
  };

  const totalConflicts = conflictFields.length;

  // Expand auto-filled section by default when no conflicts remain
  const showAutoFilledExpanded = isAutoFilledExpanded || totalConflicts === 0;

  // Build the "Accept Recommended" action list and summary
  const { recommendedActions, recommendedSummary } = useMemo(() => {
    const actions: { path: string; value: string; source: string; category: string }[] = [];
    const grouped: Record<string, { source: string; count: number }> = {};

    for (const field of conflictFields) {
      const category = field.path.split('.')[0];
      const best = getBestSourceValue(field, category);
      if (!best) continue;
      actions.push({ path: field.path, value: best.value, source: best.origin, category });
      if (!grouped[category]) grouped[category] = { source: best.origin.toUpperCase(), count: 0 };
      grouped[category].count++;
    }

    const summary = Object.entries(grouped)
      .map(([, { source, count }]) => `${source}: ${count} field${count !== 1 ? 's' : ''}`)
      .join(' · ');

    return { recommendedActions: actions, recommendedSummary: summary };
  }, [conflictFields]);

  // NOTE: there is deliberately no "accept all from <source>" action. A blanket
  // per-document pick contradicts the Hub's purpose — the AI surfaces a
  // discrepancy precisely because it cannot judge, so each one gets its own
  // answer.

  const handleAcceptRecommended = () => {
    if (recommendedActions.length === 0) return;
    if (!confirmingRecommended) {
      setConfirmingRecommended(true);
      return;
    }
    batchReconcile(
      recommendedActions.map(a => ({ path: a.path, value: a.value, source: a.source })),
    );
    setConfirmingRecommended(false);
    setActiveOrigin(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-7xl shadow-2xl border-primary/20 overflow-hidden flex flex-col max-h-[90vh] bg-white">
        {/* ── Header ── */}
        <CardHeader className="bg-primary/5 border-b border-primary/10 py-6 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary text-2xl font-bold">
                <Sparkles size={24} className="text-primary animate-pulse" />
                Data Reconciliation Hub
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Select the authoritative value for each field from the AI-extracted documents.
              </p>
            </div>
            {totalConflicts > 0 && (
              <div className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-orange-200">
                <AlertTriangle size={14} />
                {totalConflicts} CONFLICTS DETECTED
              </div>
            )}
          </div>
        </CardHeader>

        {/* NEW: flex-row body replacing CardContent */}
        <div className="flex flex-row flex-1 overflow-hidden min-h-0">
          {/* LEFT panel: existing content */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* ── Bulk Accept Bar (only when conflicts exist) ── */}
            {totalConflicts > 0 && (
              <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-orange-50/60 border-b border-orange-100 flex-shrink-0">
                <button
                  onClick={handleAcceptRecommended}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
                >
                  <Zap size={13} />
                  {confirmingRecommended ? 'Confirm — apply to all' : 'Accept Recommended'}
                  {recommendedSummary && (
                    <span className="font-normal opacity-80 ml-1">({recommendedSummary})</span>
                  )}
                </button>

                {confirmingRecommended && (
                  <button
                    onClick={() => setConfirmingRecommended(false)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

            {/* ── Column Headers ── */}
            {totalConflicts > 0 && (
              <div className="grid grid-cols-[1.5fr,1.5fr,3fr] gap-4 px-6 py-4 bg-muted/30 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex-shrink-0">
                <div>Field Name</div>
                <div>Current Value</div>
                <div>Scanned Data (Click to Select)</div>
              </div>
            )}

            {/* Scrollable rows */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* ── Conflict Rows ── */}
              {totalConflicts > 0 ? (
                <div className="divide-y divide-border/50">
                  {conflictFields.map(field => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      onSelect={(val, origin) => reconcileField(field.path, val, origin)}
                      onEvidenceClick={(origin) => showEvidence(field, origin)}
                      activeOrigin={activeOrigin}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <Check size={36} className="text-green-500" />
                  <p className="text-sm font-bold text-green-700">All conflicts resolved</p>
                  <p className="text-xs text-muted-foreground">Review auto-filled fields below if needed.</p>
                </div>
              )}

              {/* ── Auto-filled Section ── */}
              {autoFilledFields.length > 0 && (
                <div className="border-t border-border">
                  <button
                    onClick={() => setIsAutoFilledExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-6 py-3 bg-green-50/50 hover:bg-green-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={13} className="text-green-600" />
                      <span className="text-xs font-bold text-green-800">
                        Auto-filled from documents ({autoFilledFields.length} field{autoFilledFields.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    {showAutoFilledExpanded
                      ? <ChevronUp size={14} className="text-green-600" />
                      : <ChevronDown size={14} className="text-green-600" />}
                  </button>

                  {showAutoFilledExpanded && (
                    <div className="divide-y divide-border/30 bg-green-50/20">
                      {autoFilledFields.map(field => (
                        <AutoFilledRow
                          key={field.id}
                          field={field}
                          onOverride={(val, origin) => reconcileField(field.path, val, origin)}
                          onEvidenceClick={(origin) => showEvidence(field, origin)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: evidence panel — always shown. It renders its own placeholder
              when no document is loaded, rather than vanishing. Session-only by
              design: blob URLs die on refresh and are not persisted. */}
          <div className="w-[480px] flex-shrink-0 border-l border-border flex flex-col overflow-hidden p-3">
            <InlineEvidencePanel claimId={claimId} />
          </div>
        </div>

        {/* ── Footer ── */}
        <CardFooter className="flex justify-between items-center gap-3 bg-muted/30 p-6 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-white/50 px-3 py-2 rounded-lg border border-border">
            <Info size={14} className="text-primary" />
            Selection instantly updates the active claim. Review carefully before closing.
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-bold bg-zinc-900 text-white shadow-xl shadow-zinc-200 hover:bg-zinc-800 transition-all active:scale-95"
          >
            <Check size={18} />
            Finish Reconciliation
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}

function FieldRow({
  field,
  onSelect,
  onEvidenceClick,
  activeOrigin,
}: {
  field: ReconciliationField;
  onSelect: (val: string, origin: string) => void;
  onEvidenceClick: (origin: string) => void;
  activeOrigin: string | null;
}) {
  return (
    <div className="grid grid-cols-[1.5fr,1.5fr,3fr] gap-4 px-6 py-4 items-center transition-colors hover:bg-zinc-50/50 bg-orange-50/20">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-foreground">{field.label}</span>
        <span className="text-[9px] font-extrabold text-orange-600 uppercase flex items-center gap-0.5 mt-0.5">
          <AlertTriangle size={10} /> Discrepancy Found
        </span>
      </div>

      <div className="text-sm font-medium text-muted-foreground truncate italic">
        {field.current || <span className="opacity-30">Not Set</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {field.sources.map((source, i) => {
          const isSelected = field.current === source.value;
          const isActiveEvidence = !isSelected && activeOrigin === source.origin;
          return (
            <button
              key={`${source.origin}-${i}`}
              onClick={() => {
                onSelect(source.value, source.origin);
                onEvidenceClick(source.origin);
              }}
              className={`
                group flex flex-col items-start px-3 py-1.5 rounded-xl border text-left transition-all max-w-[180px]
                ${isSelected
                  ? 'bg-primary border-primary text-primary-foreground shadow-md scale-105 z-10'
                  : isActiveEvidence
                  ? 'bg-primary/5 border-primary/50 text-foreground ring-2 ring-primary/20'
                  : 'bg-white border-border text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-95'}
              `}
            >
              <span className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${isSelected ? 'text-primary-foreground/70' : 'text-primary'}`}>
                {source.label}
              </span>
              <span className="text-xs font-bold truncate w-full">{source.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AutoFilledRow({
  field,
  onOverride,
  onEvidenceClick,
}: {
  field: ReconciliationField;
  onOverride: (val: string, origin: string) => void;
  onEvidenceClick: (origin: string) => void;
}) {
  const filledValue = field.sources[0]?.value ?? '';

  return (
    <div className="grid grid-cols-[1.5fr,1.5fr,3fr] gap-4 px-6 py-3 items-center">
      <span className="text-xs font-semibold text-green-800">{field.label}</span>

      <div className="flex items-center gap-1.5">
        <Check size={11} className="text-green-500 flex-shrink-0" />
        <span className="text-xs font-bold text-green-800 truncate">{filledValue}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {field.sources.map((source, i) => (
          <button
            key={`${source.origin}-${i}`}
            onClick={() => {
              onOverride(source.value, source.origin);
              onEvidenceClick(source.origin);
            }}
            className="flex flex-col items-start px-2.5 py-1 rounded-lg border border-green-200 bg-white text-left hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95 max-w-[160px]"
          >
            <span className="text-[8px] font-bold uppercase tracking-wider text-green-600 mb-0.5">{source.label}</span>
            <span className="text-xs font-bold truncate w-full text-foreground">{source.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
