'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Sparkles, Check, AlertTriangle, Info, ChevronDown, ChevronUp, Zap, FileText } from 'lucide-react';
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
  const [activeFieldPath, setActiveFieldPath] = useState<string | null>(null);
  const [activeOrigin, setActiveOrigin] = useState<string | null>(null);
  const [confirmingRecommended, setConfirmingRecommended] = useState(false);

  const setActiveField = useEvidenceStore((state) => state.setActiveField);

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
      page: source?.page,
      fileIndex: source?.fileIndex,
    });
  };

  const totalConflicts = conflictFields.length;
  const pendingFields = useMemo(() => conflictFields.filter(f => !f.isDecided), [conflictFields]);
  const pendingCount = pendingFields.length;
  const resolvedCount = totalConflicts - pendingCount;

  // Auto-focus the first pending conflict field (or first field) on mount
  useEffect(() => {
    if (conflictFields.length > 0) {
      const currentActive = conflictFields.find(f => f.path === activeFieldPath);
      if (!currentActive) {
        const target = conflictFields.find(f => !f.isDecided) ?? conflictFields[0];
        if (target) {
          setActiveFieldPath(target.path);
          const initialOrigin = target.sources.find(s => s.value === target.current)?.origin || target.sources[0]?.origin;
          if (initialOrigin) {
            showEvidence(target, initialOrigin);
          }
        }
      }
    }
  }, [conflictFields, activeFieldPath]);

  // Active field for the comparison header in the evidence panel
  const activeField = useMemo(() => {
    if (!activeFieldPath) return conflictFields[0] || null;
    return conflictFields.find(f => f.path === activeFieldPath) || conflictFields[0] || null;
  }, [conflictFields, activeFieldPath]);

  // Expand auto-filled section by default when no conflicts remain
  const showAutoFilledExpanded = isAutoFilledExpanded || totalConflicts === 0;

  // Build the "Accept Recommended" action list for pending conflicts only
  const { recommendedActions, recommendedSummary } = useMemo(() => {
    const actions: { path: string; value: string; source: string; category: string }[] = [];
    const grouped: Record<string, { source: string; count: number }> = {};

    for (const field of pendingFields) {
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
  }, [pendingFields]);

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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <Card className="w-full max-w-7xl shadow-2xl border-primary/20 overflow-hidden flex flex-col max-h-[92vh] bg-white">
        {/* ── Header ── */}
        <CardHeader className="bg-primary/5 border-b border-primary/10 py-5 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2 text-primary text-2xl font-bold">
                <Sparkles size={24} className="text-primary animate-pulse" />
                Data Reconciliation Hub
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Compare conflicting document values. Click an option to inspect its evidence and select it.
              </p>
            </div>
            {totalConflicts > 0 && (
              pendingCount > 0 ? (
                <div className="bg-orange-100 text-orange-800 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-orange-200">
                  <AlertTriangle size={14} className="text-orange-600" />
                  {pendingCount} PENDING ({resolvedCount} RESOLVED)
                </div>
              ) : (
                <div className="bg-emerald-100 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-200">
                  <Check size={14} className="text-emerald-600" />
                  ALL {totalConflicts} CONFLICTS RESOLVED
                </div>
              )
            )}
          </div>
        </CardHeader>

        {/* ── Body: flex-row split (Left: Field Table, Right: Evidence Viewer) ── */}
        <div className="flex flex-row flex-1 overflow-hidden min-h-0">
          {/* LEFT panel: Conflicts & Auto-filled fields */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* ── Bulk Accept Bar ── */}
            {pendingCount > 0 ? (
              <div className="flex flex-wrap items-center gap-3 px-6 py-2.5 bg-orange-50/60 border-b border-orange-100 flex-shrink-0">
                <button
                  onClick={handleAcceptRecommended}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-black bg-primary text-primary-foreground hover:bg-primary/90 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <Zap size={13} />
                  {confirmingRecommended ? 'Confirm — apply to all pending' : 'Accept Recommended'}
                  {recommendedSummary && (
                    <span className="font-normal opacity-80 ml-1">({recommendedSummary})</span>
                  )}
                </button>

                {confirmingRecommended && (
                  <button
                    onClick={() => setConfirmingRecommended(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
                <span className="text-[11px] text-orange-700 ml-auto font-medium">
                  Click any option to toggle &amp; inspect its document live
                </span>
              </div>
            ) : totalConflicts > 0 ? (
              <div className="flex items-center gap-2 px-6 py-2 bg-emerald-50/70 border-b border-emerald-100 text-xs font-bold text-emerald-800 flex-shrink-0">
                <Check size={14} className="text-emerald-600" />
                All discrepancies have been resolved. Review your choices or click Finish Reconciliation below.
              </div>
            ) : null}

            {/* ── Column Headers ── */}
            {totalConflicts > 0 && (
              <div className="grid grid-cols-[1.4fr,1.3fr,3fr] gap-4 px-6 py-3.5 bg-muted/30 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex-shrink-0">
                <div>Field Name</div>
                <div>Current on Claim</div>
                <div>Document Sources (Click to Inspect &amp; Select)</div>
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
                      isActiveRow={activeFieldPath === field.path}
                      activeOrigin={activeOrigin}
                      onRowFocus={() => setActiveFieldPath(field.path)}
                      onSelect={(val, origin) => {
                        setActiveFieldPath(field.path);
                        reconcileField(field.path, val, origin);
                      }}
                      onEvidenceClick={(origin) => {
                        setActiveFieldPath(field.path);
                        showEvidence(field, origin);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <Check size={36} className="text-green-500" />
                  <p className="text-sm font-bold text-green-700">No discrepancies detected</p>
                  <p className="text-xs text-muted-foreground">All scanned documents agree.</p>
                </div>
              )}

              {/* ── Auto-filled Section ── */}
              {autoFilledFields.length > 0 && (
                <div className="border-t border-border">
                  <button
                    onClick={() => setIsAutoFilledExpanded(v => !v)}
                    className="w-full flex items-center justify-between px-6 py-3 bg-green-50/50 hover:bg-green-50 transition-colors text-left cursor-pointer"
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
                          onOverride={(val, origin) => {
                            setActiveFieldPath(field.path);
                            reconcileField(field.path, val, origin);
                          }}
                          onEvidenceClick={(origin) => {
                            setActiveFieldPath(field.path);
                            showEvidence(field, origin);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT panel: Interactive Evidence Viewer + Document Switcher */}
          <div className="w-[490px] flex-shrink-0 border-l border-border flex flex-col overflow-hidden p-3 bg-zinc-50/40">
            {/* Quick Document Comparison Header for Active Field */}
            {activeField && activeField.sources.length > 1 && (
              <div className="mb-2.5 bg-white rounded-xl p-3 border border-border shadow-xs shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <FileText size={14} className="text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      {activeField.label} Sources
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Click to flip document &amp; select
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {activeField.sources.map((src) => {
                    const isSelected = activeField.current === src.value;
                    const isViewing = activeOrigin === src.origin;
                    return (
                      <button
                        key={src.origin}
                        onClick={() => {
                          reconcileField(activeField.path, src.value, src.origin);
                          showEvidence(activeField, src.origin);
                        }}
                        className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground shadow-xs ring-1 ring-primary'
                            : isViewing
                            ? 'bg-primary/10 border-primary/70 text-foreground ring-2 ring-primary/30'
                            : 'bg-zinc-50 border-border text-foreground hover:border-primary/40 hover:bg-zinc-100/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-primary-foreground/80' : 'text-primary'}`}>
                            {src.label}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5">
                              <Check size={9} /> Selected
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold truncate w-full" title={src.value}>
                          {src.value}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              <InlineEvidencePanel claimId={claimId} />
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <CardFooter className="flex justify-between items-center gap-3 bg-muted/30 p-5 border-t border-border flex-shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-white/60 px-3.5 py-2 rounded-xl border border-border">
            <Info size={14} className="text-primary shrink-0" />
            <span>
              Clicking an option updates the active claim and flips the evidence viewer. Review at your own pace before finishing.
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-bold bg-zinc-900 text-white shadow-lg hover:bg-zinc-800 transition-all active:scale-95 cursor-pointer"
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
  isActiveRow,
  activeOrigin,
  onRowFocus,
  onSelect,
  onEvidenceClick,
}: {
  field: ReconciliationField;
  isActiveRow: boolean;
  activeOrigin: string | null;
  onRowFocus: () => void;
  onSelect: (val: string, origin: string) => void;
  onEvidenceClick: (origin: string) => void;
}) {
  return (
    <div
      onClick={onRowFocus}
      className={`grid grid-cols-[1.4fr,1.3fr,3fr] gap-4 px-6 py-3.5 items-center transition-colors cursor-pointer border-l-4 ${
        isActiveRow
          ? 'bg-primary/[0.04] ring-1 ring-primary/20'
          : 'hover:bg-zinc-50/60'
      } ${
        field.isDecided
          ? 'border-l-emerald-500 bg-emerald-50/15'
          : 'border-l-orange-500 bg-orange-50/20'
      }`}
    >
      <div className="flex flex-col">
        <span className="text-xs font-bold text-foreground">{field.label}</span>
        {field.isDecided ? (
          <span className="text-[9px] font-extrabold text-emerald-700 uppercase flex items-center gap-1 mt-0.5">
            <Check size={10} className="text-emerald-600" /> Resolved
          </span>
        ) : (
          <span className="text-[9px] font-extrabold text-orange-600 uppercase flex items-center gap-1 mt-0.5">
            <AlertTriangle size={10} /> Discrepancy Found
          </span>
        )}
      </div>

      <div className="text-xs font-mono font-medium text-muted-foreground truncate italic">
        {field.current || <span className="opacity-30">Not Set</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {field.sources.map((source, i) => {
          const isSelected = field.current === source.value;
          const isViewing = isActiveRow && activeOrigin === source.origin;
          return (
            <button
              key={`${source.origin}-${i}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(source.value, source.origin);
                onEvidenceClick(source.origin);
              }}
              className={`
                group flex flex-col items-start px-3 py-1.5 rounded-xl border text-left transition-all max-w-[190px] cursor-pointer
                ${isSelected
                  ? 'bg-primary border-primary text-primary-foreground shadow-sm scale-102 z-10'
                  : isViewing
                  ? 'bg-primary/10 border-primary text-foreground ring-2 ring-primary/30'
                  : 'bg-white border-border text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-95'}
              `}
            >
              <div className="flex items-center justify-between w-full mb-0.5">
                <span className={`text-[8px] font-bold uppercase tracking-wider ${isSelected ? 'text-primary-foreground/80' : 'text-primary'}`}>
                  {source.label}
                </span>
                {isSelected && (
                  <Check size={10} className="text-primary-foreground shrink-0 ml-1" />
                )}
              </div>
              <span className="text-xs font-mono font-bold truncate w-full">{source.value}</span>
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
    <div className="grid grid-cols-[1.4fr,1.3fr,3fr] gap-4 px-6 py-3 items-center">
      <span className="text-xs font-semibold text-green-800">{field.label}</span>

      <div className="flex items-center gap-1.5">
        <Check size={11} className="text-green-500 flex-shrink-0" />
        <span className="text-xs font-mono font-bold text-green-800 truncate">{filledValue}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {field.sources.map((source, i) => (
          <button
            key={`${source.origin}-${i}`}
            onClick={() => {
              onOverride(source.value, source.origin);
              onEvidenceClick(source.origin);
            }}
            className="flex flex-col items-start px-2.5 py-1 rounded-lg border border-green-200 bg-white text-left hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95 max-w-[160px] cursor-pointer"
          >
            <span className="text-[8px] font-bold uppercase tracking-wider text-green-600 mb-0.5">{source.label}</span>
            <span className="text-xs font-mono font-bold truncate w-full text-foreground">{source.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
