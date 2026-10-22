'use client';

import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import {
  CheckCircle2, Clock, FileText, ChevronRight, Sparkles,
  Car, CreditCard, Shield, FileCheck, Wrench, Camera,
  ScrollText, Receipt, AlertCircle, Eye,
  PanelRightOpen, PanelRightClose,
} from 'lucide-react';
import { useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { InlineEvidencePanel } from '@/components/evidence/InlineEvidencePanel';
import { EvidencePanelSlot } from '@/components/evidence/EvidencePanelSlot';
import { useEvidencePanel } from '@/hooks/useEvidencePanel';

// ─── Storage key for panel state ─────────────────────────────────────────────
const STORAGE_KEY = 'surveyos-review-evidence-panel';

// ─── Document metadata ────────────────────────────────────────────────────────
const DOC_META: Record<string, { label: string; icon: any; color: string }> = {
  rc:       { label: 'RC Book',          icon: Car,        color: 'var(--color-neutral-900)' },
  dl:       { label: 'Driving Licence',  icon: CreditCard, color: 'var(--color-neutral-600)' },
  policy:   { label: 'Policy Schedule',  icon: Shield,     color: 'var(--color-primary)' },
  claim:    { label: 'Claim Form',       icon: FileCheck,  color: 'var(--color-neutral-600)' },
  estimate: { label: 'Repair Estimate',  icon: Wrench,     color: 'var(--color-status-success)' },
  photos:   { label: 'Damage Photos',    icon: Camera,     color: 'var(--color-status-warning)' },
  permit:   { label: 'Vehicle Permit',   icon: ScrollText, color: 'var(--color-status-warning)' },
  auth:     { label: 'Auth Cert.',       icon: FileText,   color: 'var(--color-neutral-600)' },
  fitness:  { label: 'Fitness Cert.',    icon: Receipt,    color: 'var(--color-status-danger)' },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function ReviewTab() {
  const currentClaim  = useClaimStore(s => s.currentClaim);
  const extractedDocs = currentClaim?.extractedData ?? {};
  const { setActiveTab } = useUIStore();
  const openField = useEvidenceStore(s => s.openField);

  // Panel open/closed + width — persisted in localStorage
  const panel = useEvidencePanel(STORAGE_KEY, 400);
  const { panelOpen, togglePanel, containerRef } = panel;

  if (!currentClaim) return null;

  const claimId     = currentClaim.id;
  const scannedKeys = Object.keys(extractedDocs);
  const allKeys     = Object.keys(DOC_META);
  const pendingKeys = allKeys.filter(k => !scannedKeys.includes(k));

  function handleFieldClick(docType: string, fieldKey: string, data: Record<string, unknown>) {
    const contextKey = `${fieldKey}_context`;
    const contextSnippet = (data[contextKey] as string) ?? '';
    openField(claimId, { docType, fieldKey, contextSnippet });
  }

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ── LEFT: Scrollable content ──────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: 'var(--color-neutral-50)' }}>

        {/* Header */}
        <div
          className="px-8 py-8 lg:px-12"
          style={{
            background: '#EEF2FF',
            borderBottom: '1px solid #C7D2FE',
          }}
        >
          <div className="max-w-4xl mx-auto">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.2em] mb-4 bg-primary/15 text-primary border border-primary/30"
            >
              <Sparkles size={11} />
              AI Extraction Results
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-medium mb-2" style={{ color: 'var(--color-neutral-900)', letterSpacing: '-0.02em' }}>
                  Document Review
                </h1>
                <p className="text-sm" style={{ color: 'var(--color-neutral-600)' }}>
                  Review all AI-extracted data below. <Eye size={12} className="inline" style={{ color: 'var(--color-primary)' }} />{' '}
                  Click any field to view its source in the <strong style={{ color: 'var(--color-primary)' }}>Evidence Panel</strong>.
                </p>
              </div>

              {/* Toggle Evidence Panel button */}
              <button
                onClick={togglePanel}
                title={panelOpen ? 'Hide Evidence Panel' : 'Show Evidence Panel'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                  background: panelOpen ? 'var(--color-primary)' : '#E0E7FF',
                  border: `1px solid ${panelOpen ? 'var(--color-primary)' : '#A5B4FC'}`,
                  color: panelOpen ? 'var(--color-primary-foreground)' : '#3730A3',
                  fontSize: 12, fontWeight: 500, transition: 'all 0.2s',
                }}
              >
                {panelOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                Evidence
              </button>
            </div>

            {/* Summary chips */}
            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'var(--color-status-success-tint)', color: 'var(--color-status-success)' }}
              >
                <CheckCircle2 size={13} />
                {scannedKeys.length} Scanned
              </div>
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-neutral-400)' }}
              >
                <Clock size={13} />
                {pendingKeys.length} Pending
              </div>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="px-6 lg:px-12 py-8 max-w-4xl mx-auto space-y-6">

          {/* No docs yet */}
          {scannedKeys.length === 0 && (
            <div
              className="rounded-2xl p-12 flex flex-col items-center text-center bg-card border border-border"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'var(--color-neutral-100)' }}
              >
                <AlertCircle size={28} style={{ color: 'var(--color-neutral-400)' }} />
              </div>
              <div className="text-base font-medium mb-1 text-foreground">
                No documents scanned yet
              </div>
              <div className="text-sm mb-6 text-muted-foreground">
                Go to the Documents tab and upload your first document for AI extraction.
              </div>
              <button
                onClick={() => setActiveTab('documents')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all bg-primary text-primary-foreground"
                style={{
                  boxShadow: '0 4px 16px color-mix(in srgb, var(--color-primary) 30%, transparent)',
                }}
              >
                <Sparkles size={14} />
                Go to Documents Tab
              </button>
            </div>
          )}

          {/* Scanned Document Cards */}
          {scannedKeys.map(key => {
            const meta = DOC_META[key] ?? { label: key.toUpperCase(), icon: FileText, color: 'var(--color-neutral-600)' };
            const Icon = meta.icon;
            const data = extractedDocs[key] as Record<string, unknown>;
            const fields = typeof data === 'object' && data !== null
              ? Object.entries(data).filter(([k]) => !k.endsWith('_context'))
              : [];

            return (
              <div
                key={key}
                className="rounded-2xl overflow-hidden bg-card border border-border"
                style={{ boxShadow: '0 1px 4px rgba(13,27,42,0.04)' }}
              >
                {/* Card header */}
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{ borderBottom: '1px solid var(--color-neutral-100)', background: 'var(--color-neutral-50)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${meta.color}15`, color: meta.color }}
                  >
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{meta.label}</div>
                    <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                      AI Extracted · click any field to view source
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                    style={{ background: `${meta.color}15`, color: meta.color }}
                  >
                    <CheckCircle2 size={11} />
                    {fields.length} fields
                  </div>
                </div>

                {/* Fields grid */}
                {fields.length > 0 ? (
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {fields
                      .filter(([, v]) => v !== '' && v !== null && v !== undefined)
                      .map(([fieldKey, value]) => {
                        const hasContext = Boolean((data as Record<string, unknown>)[`${fieldKey}_context`]);
                        return (
                          <div
                            key={fieldKey}
                            className="space-y-0.5 rounded-xl p-2 transition-all cursor-pointer group"
                            onClick={() => handleFieldClick(key, fieldKey, data)}
                            title={hasContext ? 'Click to view source in document' : undefined}
                            style={{ border: '1px solid transparent' }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = `${meta.color}08`;
                              e.currentTarget.style.borderColor = `${meta.color}30`;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <div
                              className="text-[9px] font-medium uppercase tracking-[0.2em] flex items-center gap-1 text-muted-foreground"
                            >
                              {fieldKey.replace(/_/g, ' ')}
                              {hasContext && (
                                <Eye size={9} style={{ color: meta.color, opacity: 0.7 }} />
                              )}
                            </div>
                            <div
                              className="text-sm font-medium truncate text-foreground"
                              title={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            >
                              {typeof value === 'object'
                                ? Array.isArray(value)
                                  ? `${value.length} items`
                                  : JSON.stringify(value)
                                : String(value) || '—'}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-6 text-sm text-center text-muted-foreground">
                    No fields extracted — try re-scanning with a clearer image.
                  </div>
                )}
              </div>
            );
          })}

          {/* Pending docs shortcut */}
          {pendingKeys.length > 0 && scannedKeys.length > 0 && (
            <div
              className="rounded-2xl p-5 flex items-center justify-between gap-3 bg-card border border-border"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {pendingKeys.length} documents not yet scanned
                </div>
                <div className="text-xs mt-0.5 text-muted-foreground">
                  {pendingKeys.map(k => DOC_META[k]?.label ?? k).join(', ')}
                </div>
              </div>
              <button
                onClick={() => setActiveTab('documents')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium flex-shrink-0 transition-all"
                style={{ background: 'var(--color-accent)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)/30' }}
              >
                Scan More <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      <EvidencePanelSlot panel={panel}>
        <InlineEvidencePanel claimId={claimId} defaultDocType="claim" />
      </EvidencePanelSlot>
    </div>
  );
}
