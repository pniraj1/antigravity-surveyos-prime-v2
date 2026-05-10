'use client';

import { useAIExtraction } from '@/hooks/useAIExtraction';
import { storeBlobUrl, useEvidenceStore } from '@/components/evidence/DocumentEvidenceViewer';
import { useClaimDriveFiles } from '@/hooks/useClaimDriveFiles';
import { findFileByName, ensureFileInCache } from '@/lib/drive/files';
import { invalidateClaimFileList } from '@/lib/drive/list-cache';
import { replaceFileInDrive } from '@/lib/drive/index';
import { DuplicateUploadDialog } from '@/components/dialogs/DuplicateUploadDialog';
import { HardDriveUpload, CloudOff } from 'lucide-react';
import type { DriveFile } from '@/lib/drive/list-cache';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { ProcessingProgressOverlay } from '@/components/ui/ProcessingProgressOverlay';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { uploadFileToDrive } from '@/lib/drive';
import {
  FileText, Sparkles, Loader2, CheckCircle2, Car, CreditCard,
  FileCheck, Camera, ScrollText, Receipt, Shield, AlertTriangle,
  Upload, Truck, Zap, Database,
} from 'lucide-react';
import { ProviderHealthBadge, ModelSelector, DocModeToggle, ProviderToggle } from '@/components/ai/AIControls';
import { ReconciliationDialog } from './reconciliation/ReconciliationDialog';
import { getConflictFields, getUnanimousFields, ReconciliationField } from '@/lib/ai/reconciliation';
import { toast } from 'sonner';
import { useState, useMemo, useEffect, useRef } from 'react';
import { logger } from '@/lib/utils/logger';



// ─── Document Slot Definitions ──────────────────────────────────────────────
const DOC_GROUPS = [
  {
    title: 'Core Documents',
    description: 'Mandatory for every claim',
    docs: [
      { id: 'rc',      label: 'RC Book',           subLabel: 'Registration Certificate',   icon: Car,          color: '#0D1B2A', bg: 'rgba(13,27,42,0.06)',   accept: 'image/*,application/pdf' },
      { id: 'dl',      label: 'Driving Licence',   subLabel: 'DL / MDL',                   icon: CreditCard,   color: '#1e3a5f', bg: 'rgba(30,58,95,0.07)',   accept: 'image/*,application/pdf' },
      { id: 'policy',  label: 'Policy Schedule',   subLabel: 'Insurance Policy',            icon: Shield,       color: '#D4AF37', bg: 'rgba(212,175,55,0.08)', accept: 'image/*,application/pdf' },
      { id: 'claim',   label: 'Claim Form',        subLabel: 'Intimation / Claim Form',     icon: FileCheck,    color: '#4A4E69', bg: 'rgba(74,78,105,0.07)',  accept: 'image/*,application/pdf' },
      { id: 'fir',     label: 'Police FIR',        subLabel: 'Spot Panchnama / FIR',       icon: ScrollText,   color: '#0D1B2A', bg: 'rgba(13,27,42,0.06)',   accept: 'image/*,application/pdf' },
    ],
  },
  {
    title: 'Workshop & Damage',
    description: 'Estimate and damage evidence',
    docs: [
      { id: 'final-bill', label: 'Final Garage Bill', subLabel: 'Final Workshop Invoice',     icon: Receipt,      color: '#0284c7', bg: 'rgba(2,132,199,0.07)',  accept: 'image/*,application/pdf' },
      { id: 'photos',     label: 'Damage Photos',    subLabel: 'AI damage assessment',        icon: Camera,       color: '#7c3aed', bg: 'rgba(124,58,237,0.07)', accept: 'image/*' },
    ],
  },
  {
    title: 'Commercial Vehicle Only',
    description: 'Required for commercial & goods vehicles',
    docs: [
      { id: 'permit',      label: 'Vehicle Permit',    subLabel: 'Route Permit / NP / NT',  icon: ScrollText,   color: '#b45309', bg: 'rgba(180,83,9,0.07)',   accept: 'image/*,application/pdf' },
      { id: 'auth',        label: 'Auth Certificate',  subLabel: 'Authorisation Cert.',     icon: FileText,     color: '#0369a1', bg: 'rgba(3,105,161,0.07)',  accept: 'image/*,application/pdf' },
      { id: 'fitness',     label: 'Fitness Cert.',     subLabel: 'FC / MVI Certificate',    icon: Receipt,      color: '#be185d', bg: 'rgba(190,24,93,0.07)',  accept: 'image/*,application/pdf' },
    ],
  },
  {
    title: 'Load / Goods Documents',
    description: 'Required when goods were being transported at time of accident',
    docs: [
      { id: 'load-challan', label: 'Load Challan',      subLabel: 'Goods Consignment Note',     icon: Truck,    color: '#16a34a', bg: 'rgba(22,163,74,0.07)',  accept: 'image/*,application/pdf' },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────
export function DocumentsTab() {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const currentClaimId = useClaimStore(s => s.currentClaimId);
  const batchReconcile = useClaimStore(s => s.batchReconcile);
  const setReconciliationConflictCount = useClaimStore(s => s.setReconciliationConflictCount);
  const extractedDocs = currentClaim?.extractedData ?? {};
  const { isProcessing, progress, reviewData, inProgressDocs, triggerExtraction, confirmApply, cancelReview, reScanWithFeedback } = useAIExtraction();
  const { profile, updateProfile } = useProfileStore();
  const aiProvider = profile.aiProvider ?? 'gemini';
  const [isReconOpen, setIsReconOpen] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<ReconciliationField[]>([]);
  const prevClaimIdRef = useRef<string | null>(null);

  const { files: driveFiles, loading: driveLoading, error: driveError, refresh: refreshDriveFiles } =
    useClaimDriveFiles(currentClaimId ?? null);

  const [dupeState, setDupeState] = useState<{
    existing: DriveFile;
    incoming: File;
    docKey: string;
  } | null>(null);

  const conflicts = useMemo(() => {
    if (!currentClaim) return [];
    return getConflictFields(currentClaim);
  }, [currentClaim]);

  // Sync conflict count to store so sidebar can read it
  useEffect(() => {
    setReconciliationConflictCount(conflicts.length);
  }, [conflicts.length, setReconciliationConflictCount]);

  // Reset auto-filled list when switching claims
  useEffect(() => {
    if (currentClaim?.id !== prevClaimIdRef.current) {
      prevClaimIdRef.current = currentClaim?.id ?? null;
      setAutoFilledFields([]);
    }
  }, [currentClaim?.id]);

  // Auto-fill fields where all sources unanimously agree but claim value is unset
  useEffect(() => {
    if (!currentClaim) return;
    const unanimous = getUnanimousFields(currentClaim);
    if (unanimous.length === 0) return;
    const updates = unanimous.map(f => ({ path: f.path, value: f.sources[0].value }));
    batchReconcile(updates);
    setAutoFilledFields(unanimous);
    toast.success(`${unanimous.length} field${unanimous.length === 1 ? '' : 's'} filled automatically from scanned documents.`);
  }, [currentClaim]);

  // Auto-close dialog when all conflicts are resolved
  useEffect(() => {
    if (isReconOpen && conflicts.length === 0) {
      setIsReconOpen(false);
    }
  }, [conflicts.length, isReconOpen]);


  if (!currentClaim) return null;
  const evidenceImages: string[] = [];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Register in evidence store for the viewer
    if (currentClaim?.id) {
      storeBlobUrl(currentClaim.id, key, file);
    }

    // AI extraction (always runs regardless of Drive state)
    triggerExtraction(key, file);

    // Drive upload — check for duplicate first
    if (currentClaim?.id && profile.autoUploadDrive !== false) {
      const label = currentClaim.vehicle?.registrationNumber || currentClaim.id;
      const ext = file.name.split('.').pop() ?? 'bin';
      const driveName = `${key}.${ext}`;

      const existing = await findFileByName(currentClaim.id, driveName).catch(() => null);
      if (existing && !existing.pending) {
        setDupeState({ existing, incoming: file, docKey: key });
        return;
      }

      uploadFileToDrive(currentClaim.id, driveName, file, label)
        .then(() => {
          invalidateClaimFileList(currentClaim.id);
          refreshDriveFiles();
        })
        .catch(err => {
          logger.error('[DocumentsTab] Drive upload failed:', err);
        });
    }
  };

  const handleViewExisting = async () => {
    if (!dupeState || !currentClaim?.id) return;
    const { existing } = dupeState;
    setDupeState(null);
    try {
      const blob = await ensureFileInCache(existing.id, existing.mimeType);
      const file = new File([blob], existing.name, { type: existing.mimeType });
      storeBlobUrl(currentClaim.id, `drive_${existing.id}`, file);
      useEvidenceStore.getState().openField(currentClaim.id, {
        docType: `drive_${existing.id}`,
        fieldKey: 'drive',
        contextSnippet: '',
      });
    } catch {
      toast.error('Could not open file from Drive.');
    }
  };

  const handleUploadAnyway = () => {
    if (!dupeState || !currentClaim?.id) return;
    const { incoming, docKey } = dupeState;
    setDupeState(null);
    const label = currentClaim.vehicle?.registrationNumber || currentClaim.id;
    const ext = incoming.name.split('.').pop() ?? 'bin';
    const suffix = driveFiles.filter(f => f.name.startsWith(docKey)).length + 1;
    const driveName = suffix > 1 ? `${docKey} (${suffix}).${ext}` : `${docKey}.${ext}`;
    uploadFileToDrive(currentClaim.id, driveName, incoming, label)
      .then(() => { invalidateClaimFileList(currentClaim.id); refreshDriveFiles(); })
      .catch(err => logger.error('[DocumentsTab] Drive upload failed:', err));
  };

  const handleReplace = async () => {
    if (!dupeState || !currentClaim?.id) return;
    const { existing, incoming } = dupeState;
    setDupeState(null);
    try {
      await replaceFileInDrive(existing.id, incoming);
      invalidateClaimFileList(currentClaim.id);
      refreshDriveFiles();
      toast.success(`"${existing.name}" replaced in Drive.`, { duration: 2500 });
    } catch {
      toast.error('Could not replace file in Drive.');
    }
  };

  const scannedCount = Object.keys(extractedDocs).length;
  const totalDocs = DOC_GROUPS.reduce((a, g) => a + g.docs.length, 0);

  return (
    <div className="h-full overflow-y-auto" style={{ background: '#F8F9FA' }}>

      {/* ── Header ───────────────────────────────────────── */}
      <div
        className="px-8 py-8 lg:px-12"
        style={{
          background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-4"
                style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
              >
                <Sparkles size={11} className="animate-pulse" />
                AI Vision — Instant Document Reading
              </div>
              <h1 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: '#F8F9FA', letterSpacing: '-0.02em' }}>
                AI Document Scanner
              </h1>
              <p className="text-sm font-medium" style={{ color: 'rgba(232,236,240,0.65)' }}>
                Upload any document — RC, DL, Policy, Estimate. Our AI reads it and auto-fills your claim fields instantly.
              </p>
            </div>

            {/* Provider toggle + model + mode */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <ProviderToggle />
              <div className="flex items-center gap-2">
                <DocModeToggle />
                <ModelSelector />
                <ProviderHealthBadge />
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-4 mt-6">
            <div
              className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${totalDocs > 0 ? (scannedCount / totalDocs) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #D4AF37, #f0d870)',
                }}
              />
            </div>
            <span className="text-xs font-bold" style={{ color: '#D4AF37', whiteSpace: 'nowrap' }}>
              {scannedCount} / {totalDocs} scanned
            </span>
          </div>
        </div>
      </div>

      {/* ── Processing Banner ────────────────────────────── */}
      {isProcessing && (
        <div
          className="mx-6 lg:mx-12 mt-6 px-5 py-4 rounded-xl flex items-center gap-3 animate-pulse"
          style={{
            background: 'linear-gradient(135deg, #D4AF37, #f0d870)',
            boxShadow: '0 4px 20px rgba(212,175,55,0.35)',
          }}
        >
          <Loader2 className="animate-spin flex-shrink-0" size={18} style={{ color: '#0D1B2A' }} />
          <div>
            <div className="text-xs font-black uppercase tracking-wider" style={{ color: '#0D1B2A' }}>
              AI Processing
            </div>
            <div className="text-sm font-semibold" style={{ color: 'rgba(13,27,42,0.75)' }}>
              {progress || 'Scanning document...'}
            </div>
          </div>
        </div>
      )}

      {/* ── Resume Banner ───────────────────────────────────── */}
      {inProgressDocs.length > 0 && (
        <div className="max-w-5xl mx-auto px-8 py-4">
          <div
            className="rounded-lg px-4 py-3 flex items-start gap-3"
            style={{
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
            }}
          >
            <span style={{ fontSize: 16 }}>⚡</span>
            <div>
              <p className="text-sm font-medium" style={{ color: '#ca8a04' }}>
                Interrupted extraction detected
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                {inProgressDocs.map(d => (
                  <span key={d.docType}>
                    <strong>{d.docType}</strong>: {d.completedPages}/{d.totalPages} pages done.{' '}
                  </span>
                ))}
                Re-upload the file to resume from where it stopped.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Conflict Alert Banner ─────────────────────────── */}
      {conflicts.length > 0 && !isProcessing && (
        <div
          className="mx-6 lg:mx-12 mt-6 px-6 py-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border"
          style={{
            background: '#FFF7ED',
            borderColor: '#FFEDD5',
            boxShadow: '0 4px 15px rgba(251,146,60,0.1)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-sm font-black text-orange-900 uppercase tracking-tight">
                Data Discrepancies Detected
              </div>
              <div className="text-xs font-medium text-orange-700/80">
                {conflicts.length} fields have conflicting values across your scanned RC, Policy, or DL.
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsReconOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-orange-600 text-white hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 active:scale-95"
          >
            <Database size={14} />
            OPEN RECONCILIATION HUB
          </button>
        </div>
      )}

      {/* ── Manually Open Hub Hub ────────────────────────────── */}
      {scannedCount > 1 && conflicts.length === 0 && !isProcessing && (
        <div className="mx-6 lg:mx-12 mt-6 flex justify-end">
           <button
            onClick={() => setIsReconOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all active:scale-95"
          >
            <Database size={12} />
            Data Reconciliation Hub
          </button>
        </div>
      )}

      {/* ── Drive Files List ───────────────────────────── */}
      {(driveFiles.length > 0 || driveLoading) && (
        <div className="max-w-5xl mx-auto mb-6 px-6 lg:px-12 pt-6">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(13,27,42,0.1)', background: '#FFFFFF' }}
          >
            <div
              className="px-5 py-3 flex items-center gap-2"
              style={{
                background: 'rgba(13,27,42,0.04)',
                borderBottom: '1px solid rgba(13,27,42,0.07)',
              }}
            >
              <HardDriveUpload size={14} style={{ color: '#0D1B2A' }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0D1B2A' }}>
                Already in Drive
              </span>
              {driveLoading && (
                <span className="text-xs ml-2" style={{ color: '#8D99AE' }}>Loading…</span>
              )}
            </div>
            {!driveLoading && (
              <div className="divide-y" style={{ borderColor: 'rgba(13,27,42,0.06)' }}>
                {driveFiles.map(f => (
                  <button
                    key={f.id}
                    disabled={f.pending}
                    onClick={async () => {
                      if (!currentClaim?.id || f.pending) return;
                      try {
                        const blob = await ensureFileInCache(f.id, f.mimeType);
                        const file = new File([blob], f.name, { type: f.mimeType });
                        storeBlobUrl(currentClaim.id, `drive_${f.id}`, file);
                        useEvidenceStore.getState().openField(currentClaim.id, {
                          docType: `drive_${f.id}`,
                          fieldKey: 'drive',
                          contextSnippet: '',
                        });
                      } catch {
                        toast.error(`Could not open "${f.name}" from Drive.`);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText size={15} style={{ color: '#4A4E69', flexShrink: 0 }} />
                    <span className="text-sm font-medium flex-1" style={{ color: '#0D1B2A' }}>
                      {f.name}
                    </span>
                    {f.pending && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(212,175,55,0.15)', color: '#92731c' }}
                      >
                        Pending sync
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {driveError && (
            <p className="text-xs mt-2 px-1" style={{ color: '#b45309' }}>
              <CloudOff size={12} className="inline mr-1" />
              {driveError}
              <button className="underline ml-2" onClick={refreshDriveFiles}>Retry</button>
            </p>
          )}
        </div>
      )}

      {/* ── Document Groups ──────────────────────────────── */}
      <div className="px-6 lg:px-12 py-8 max-w-5xl mx-auto space-y-10">
        {DOC_GROUPS.map((group) => (
          <div key={group.title}>
            {/* Group header */}
            <div className="flex items-center gap-3 mb-5">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.15em]" style={{ color: '#0D1B2A' }}>
                  {group.title}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>{group.description}</p>
              </div>
              <div
                className="flex-1 h-px"
                style={{ background: '#E2E6EA' }}
              />
            </div>

            {/* Doc cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.docs.map((doc) => {
                const Icon = doc.icon;
                const isScanned = !!extractedDocs[doc.id];
                const isActive = isProcessing;

                return (
                  <label
                    key={doc.id}
                    className="relative flex flex-col p-5 rounded-2xl cursor-pointer transition-all group"
                    style={{
                      background: '#FFFFFF',
                      border: isScanned
                        ? `1px solid ${doc.color}40`
                        : '1px solid #E2E6EA',
                      boxShadow: '0 1px 3px rgba(13,27,42,0.04)',
                      opacity: isActive ? 0.65 : 1,
                      pointerEvents: isActive ? 'none' : 'auto',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(13,27,42,0.09)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = doc.color;
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(13,27,42,0.04)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = isScanned ? `${doc.color}40` : '#E2E6EA';
                      }
                    }}
                  >
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept={doc.accept}
                      onChange={e => handleFile(e, doc.id)}
                      disabled={isActive}
                    />

                    {/* Icon + Status */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ background: isScanned ? `${doc.color}18` : doc.bg, color: doc.color }}
                      >
                        <Icon size={20} />
                      </div>

                      {isScanned ? (
                        <div
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                          style={{ background: `${doc.color}15`, color: doc.color }}
                        >
                          <CheckCircle2 size={11} />
                          Scanned
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                          style={{ background: '#F0F2F5', color: '#8D99AE' }}
                        >
                          <Upload size={11} />
                          Upload
                        </div>
                      )}
                    </div>

                    {/* Label */}
                    <div className="text-[13px] font-bold" style={{ color: '#0D1B2A' }}>
                      {doc.label}
                    </div>
                    <div className="text-[11px] mt-0.5 mb-3" style={{ color: '#8D99AE' }}>
                      {doc.subLabel}
                    </div>

                    {/* CTA */}
                    <div
                      className="flex items-center gap-2 text-[11px] font-bold mt-auto"
                      style={{ color: isScanned ? doc.color : '#8D99AE' }}
                    >
                      <Sparkles size={11} />
                      {isScanned ? 'Re-scan to update' : 'Click to scan with AI'}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Help Note ───────────────────────────────────── */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(212,175,55,0.07)', border: '1px solid rgba(212,175,55,0.2)' }}
        >
          <AlertTriangle size={16} style={{ color: '#D4AF37', flexShrink: 0, marginTop: 1 }} />
          <div className="text-xs" style={{ color: '#4A4E69', lineHeight: 1.6 }}>
            <span className="font-bold">After scanning,</span> a preview dialog will appear showing extracted data.
            Review it and click <span className="font-bold">&ldquo;Apply to Claim&rdquo;</span> to auto-fill the Claim Details tab.
            All data stays on your device — nothing is stored in the cloud.
          </div>
        </div>
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
      />

      {/* AI Reconciliation Hub */}
      <ReconciliationDialog
        isOpen={isReconOpen}
        onClose={() => setIsReconOpen(false)}
        conflictFields={conflicts}
        autoFilledFields={autoFilledFields}
        claimId={currentClaim.id}
      />

      {/* Persistent progress overlay during PDF extraction */}
      <ProcessingProgressOverlay
        isVisible={isProcessing}
        progress={progress}
        onCancel={cancelReview}
      />

      {dupeState && (
        <DuplicateUploadDialog
          existingFile={dupeState.existing}
          incomingFileName={dupeState.incoming.name}
          onViewExisting={handleViewExisting}
          onUploadAnyway={handleUploadAnyway}
          onReplace={handleReplace}
          onClose={() => setDupeState(null)}
        />
      )}
    </div>
  );
}
