'use client';

import { useAIExtraction } from '@/hooks/useAIExtraction';
import { storeFiles } from '@/components/evidence/DocumentEvidenceViewer';
import { AIReviewDialog } from '@/components/dialogs/AIReviewDialog';
import { useClaimStore } from '@/stores/claim-store';
import { saveDocuments } from '@/lib/documents/sink';
import { FIELD_KEY_TO_DOC_TYPE } from '@/types/documents';
import { useProfileStore } from '@/stores/profile-store';
import { uploadWithDuplicateCheck, type DuplicateAction, type ExistingFile } from '@/lib/drive/upload-with-check';
import { DuplicateUploadDialog } from '@/components/dialogs/DuplicateUploadDialog';
import { useSaveToCloudPrompt } from '@/hooks/useSaveToCloudPrompt';
import {
  FileText, Sparkles, Loader2, CheckCircle2, Car, CreditCard,
  FileCheck, ScrollText, Receipt, Shield, AlertTriangle,
  Upload, Truck, Zap, Database, Camera, Smartphone,
} from 'lucide-react';
import { SyncDrivePicker } from '@/components/sync-bridge/SyncDrivePicker';
import { DocumentReviewSheet } from '@/components/documents/DocumentReviewSheet';
import { useClaimDocuments } from '@/lib/documents/useClaimDocuments';
import { FolderLine } from '@/components/documents/FolderLine';
import { PhoneFilesList } from '@/components/documents/PhoneFilesList';
import { BringPhoneScans } from '@/components/documents/BringPhoneScans';
import { readDocument } from '@/lib/documents/folder';
import { phoneFileFor, cardPhoneState } from '@/lib/scan-import/cards';
import type { ClaimDocument } from '@/types/documents';
import { TelegramIcon } from '@/components/icons/TelegramIcon';
import { ProviderHealthBadge, ModelSelector, DocModeToggle, ProviderToggle } from '@/components/ai/AIControls';
import { ReconciliationDialog } from './reconciliation/ReconciliationDialog';
import { getConflictFields, getUnanimousFields, ReconciliationField } from '@/lib/ai/reconciliation';
import { toast } from 'sonner';
import { useState, useMemo, useEffect, useRef } from 'react';



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
    title: 'Workshop',
    description: 'Final garage bill / workshop invoice',
    docs: [
      { id: 'final-bill', label: 'Final Garage Bill', subLabel: 'Final Workshop Invoice',     icon: Receipt,      color: '#0284c7', bg: 'rgba(2,132,199,0.07)',  accept: 'image/*,application/pdf' },
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
  const batchReconcile = useClaimStore(s => s.batchReconcile);
  const setReconciliationConflictCount = useClaimStore(s => s.setReconciliationConflictCount);
  const extractedDocs = currentClaim?.extractedData ?? {};
  const { isProcessing, progress, reviewData, triggerExtraction, confirmApply, cancelReview, reScanWithFeedback } = useAIExtraction();
  const { profile, updateProfile } = useProfileStore();
  const aiProvider = profile.aiProvider ?? 'gemini';
  const [isReconOpen, setIsReconOpen] = useState(false);
  const [folderAsk, setFolderAsk] = useState(0); // bumped when an import needs the folder connect
  const [autoFilledFields, setAutoFilledFields] = useState<ReconciliationField[]>([]);
  const prevClaimIdRef = useRef<string | null>(null);
  const [syncPicker, setSyncPicker] = useState<{ key: string; label: string } | null>(null);
  // Review-and-crop gate shown between file-select and AI send. `phone`: the file came from the claim folder (Scan import).
  const [reviewSheet, setReviewSheet] = useState<{ key: string; label?: string; files: File[]; phone?: boolean } | null>(null);
  const syncConnected = !!profile.syncBridgeToken;
  const { confirmSaveToCloud, saveToCloudDialog } = useSaveToCloudPrompt();
  const [dupeDialog, setDupeDialog] = useState<{
    existing: ExistingFile;
    suffixedName: string;
    resolve: (action: DuplicateAction) => void;
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
      setReviewSheet(null); // a sheet opened for the previous claim must not confirm into this one
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

  const docs = useClaimDocuments();

  if (!currentClaim) return null;
  const evidenceImages: string[] = [];

  // Source-agnostic pipeline: register blobs + trigger AI + optional Drive upload.
  // Used by both local file input (handleFile) and the SurveyOS Sync picker.
  // Handles multi-file slots (e.g. RC front + back).
  const processFiles = (files: File[], key: string, aiFiles?: File[], inFolder = false) => {
    if (files.length === 0) return;

    const docType = FIELD_KEY_TO_DOC_TYPE[key] ?? 'other';
    // An uncropped phone file is already in the claim folder; saving it again would only leave an identical "(old)" copy.
    if (!inFolder) void saveDocuments(docType, files.map((f) => ({ blob: f, name: f.name })), 'upload');

    if (currentClaim?.id) {
      storeFiles(currentClaim.id, key, files);
    }

    // The surveyor picks which files the AI reads (via DocumentReviewSheet);
    // default to all when no explicit selection is given.
    const forAI = aiFiles ?? files;
    if (forAI.length > 0) triggerExtraction(key, forAI);

    if (currentClaim?.id && profile.autoUploadDrive !== false) {
      const claimId = currentClaim.id;
      const label = currentClaim.vehicle?.registrationNumber || claimId;
      confirmSaveToCloud(files.length > 1 ? `${files.length} files` : files[0].name, claimId).then(ok => {
        if (!ok) return;
        files.forEach((file, idx) => {
          const ext = file.name.split('.').pop() ?? 'bin';
          // First file keeps the bare slot name; extras get a _2, _3, … suffix so
          // Drive names never collide within one slot.
          const driveName = idx === 0 ? `${key}.${ext}` : `${key}_${idx + 1}.${ext}`;
          uploadWithDuplicateCheck(
            claimId,
            driveName,
            file,
            label,
            (existing, suffixedName) =>
              new Promise<DuplicateAction>((resolve) => {
                setDupeDialog({ existing, suffixedName, resolve });
              }),
          ).catch(err => {
            console.error('[DocumentsTab] Drive upload failed:', err);
          });
        });
      });
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;
    // Open the review-and-crop gate; processing happens on confirm.
    setReviewSheet({ key, files });
  };

  const openPhoneFile = async (key: string, label: string, phoneDoc: ClaimDocument) => {
    const claimId = currentClaim.id;
    try {
      const file = await readDocument(currentClaim, phoneDoc); // can be slow on Drive for desktop
      if (useClaimStore.getState().currentClaim?.id !== claimId) return; // claim switched meanwhile: never open A's file on B
      setReviewSheet({ key, label, files: [file], phone: true });
    } catch (err) {
      toast.error(`Could not read the phone file ${phoneDoc.relPath} (${err instanceof Error ? err.message : String(err)})`);
    }
  };

  const scannedCount = Object.keys(extractedDocs).length;
  const totalDocs = DOC_GROUPS.reduce((a, g) => a + g.docs.length, 0);

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-neutral-50)]">
      {saveToCloudDialog}

      {/* ── Header ───────────────────────────────────────── */}
      <div
        className="px-8 py-8 lg:px-12"
        style={{
          background: '#EEF2FF',
          borderBottom: '1px solid #C7D2FE',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.2em] mb-4 text-primary"
                style={{ background: 'var(--color-status-warning-tint)', border: '1px solid var(--color-status-warning)' }}
              >
                <Sparkles size={11} className="animate-pulse" />
                AI Vision — Instant Document Reading
              </div>
              <h1 className="text-2xl lg:text-3xl font-medium mb-2 text-[var(--color-neutral-900)]" style={{ letterSpacing: '-0.02em' }}>
                AI Document Scanner
              </h1>
              <p className="text-sm font-medium text-muted-foreground">
                Upload any document — RC, DL, Policy, Estimate. Our AI reads it and auto-fills your claim fields instantly.
              </p>
            </div>

            {/* Provider toggle + model + mode + Sync source */}
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
              className="flex-1 h-1.5 rounded-full overflow-hidden bg-neutral-200"
            >
              <div
                className="h-full rounded-full transition-all duration-500 bg-primary"
                style={{
                  width: `${totalDocs > 0 ? (scannedCount / totalDocs) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs font-medium text-primary" style={{ whiteSpace: 'nowrap' }}>
              {scannedCount} / {totalDocs} scanned
            </span>
          </div>
        </div>
      </div>

      {/* ── Processing Banner ────────────────────────────── */}
      {isProcessing && (
        <div
          className="mx-6 lg:mx-12 mt-6 px-5 py-4 rounded-xl flex items-center gap-3 animate-pulse bg-primary"
          style={{
            boxShadow: '0 4px 20px rgba(212,175,55,0.35)',
          }}
        >
          <Loader2 className="animate-spin flex-shrink-0 text-[var(--color-neutral-900)]" size={18} />
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-neutral-900)]">
              AI Processing
            </div>
            <div className="text-sm font-medium text-[var(--color-neutral-900)]/75">
              {progress || 'Scanning document...'}
            </div>
          </div>
        </div>
      )}

      {/* ── Conflict Alert Banner ─────────────────────────── */}
      {conflicts.length > 0 && !isProcessing && (
        <div
          className="mx-6 lg:mx-12 mt-6 px-6 py-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border bg-[var(--color-status-warning-tint)] border-[var(--color-status-warning)]"
          style={{
            boxShadow: '0 4px 15px var(--color-status-warning)/10',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-status-warning-tint)] flex items-center justify-center text-[var(--color-status-warning)]">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--color-neutral-900)] uppercase tracking-tight">
                Data Discrepancies Detected
              </div>
              <div className="text-xs font-medium text-[var(--color-status-warning)]">
                {conflicts.length} fields have conflicting values across your scanned RC, Policy, or DL.
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsReconOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium bg-[var(--color-status-warning)] text-white hover:bg-[var(--color-status-warning)]/90 transition-all shadow-lg active:scale-95"
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest bg-white border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all active:scale-95"
          >
            <Database size={12} />
            Data Reconciliation Hub
          </button>
        </div>
      )}

      {/* ── Document Groups ──────────────────────────────── */}
      <div className="px-6 lg:px-12 py-8 max-w-5xl mx-auto space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FolderLine supported={docs.supported} folder={docs.folder} onConnect={docs.connect} onReconnect={docs.reconnect} connectRequest={folderAsk} />
          {/* Import needs a claim folder, which needs the File System Access API. */}
          {docs.supported && <BringPhoneScans onNeedsFolder={() => setFolderAsk((n) => n + 1)} onAllowAccess={docs.reconnect} />}
        </div>
        {DOC_GROUPS.map((group) => (
          <div key={group.title}>
            {/* Group header */}
            <div className="flex items-center gap-3 mb-5">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-[0.15em] text-[var(--color-neutral-900)]">
                  {group.title}
                </h2>
                <p className="text-xs mt-0.5 text-[var(--color-neutral-400)]">{group.description}</p>
              </div>
              <div
                className="flex-1 h-px bg-[var(--color-neutral-200)]"
              />
            </div>

            {/* Doc cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.docs.map((doc) => {
                const Icon = doc.icon;
                const isScanned = !!extractedDocs[doc.id];
                const isActive = isProcessing;
                const phoneDoc = phoneFileFor(currentClaim, doc.id);
                const phoneState = cardPhoneState(phoneDoc, isScanned);

                return (
                  <label
                    key={doc.id}
                    className="relative flex flex-col p-5 rounded-2xl cursor-pointer transition-all group bg-card"
                    style={{
                      border: isScanned
                        ? `1px solid ${doc.color}40`
                        : '1px solid var(--color-neutral-200)',
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
                        e.currentTarget.style.borderColor = isScanned ? `${doc.color}40` : 'var(--color-neutral-200)';
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

                      <div className="flex items-center gap-2">
                        <label
                          className="md:hidden relative z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-neutral-200)] bg-card"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Photograph ${doc.label}`}
                          title={`Photograph ${doc.label}`}
                        >
                          <Camera size={18} />
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => handleFile(e, doc.id)}
                            disabled={isActive}
                          />
                        </label>

                        {syncConnected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSyncPicker({ key: doc.id, label: doc.label });
                            }}
                            className="relative z-20 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 transition-transform hover:scale-110"
                            title={`Pull ${doc.label} from SurveyOS Sync`}
                            aria-label={`Pull ${doc.label} from SurveyOS Sync`}
                          >
                            <TelegramIcon size={16} />
                            <span className="text-[8px] font-medium leading-none text-[#229ED9]">OS Sync</span>
                          </button>
                        )}

                        {isScanned ? (
                          <div
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
                            style={{ background: `${doc.color}15`, color: doc.color }}
                          >
                            <CheckCircle2 size={11} />
                            Scanned
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-[var(--color-neutral-100)] text-[var(--color-neutral-400)]"
                          >
                            <Upload size={11} />
                            Upload
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Label */}
                    <div className="text-[13px] font-medium text-[var(--color-neutral-900)]">
                      {doc.label}
                    </div>
                    <div className="text-[11px] mt-0.5 mb-3 text-[var(--color-neutral-400)]">
                      {doc.subLabel}
                    </div>

                    {/* CTA — a phone file waiting to be read takes the line; it must not open the upload input */}
                    {phoneDoc && phoneState ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void openPhoneFile(doc.id, doc.label, phoneDoc);
                        }}
                        disabled={isActive}
                        className="relative z-20 flex items-center gap-2 text-[11px] font-medium mt-auto text-left text-primary hover:underline"
                      >
                        <Smartphone size={11} />
                        {phoneState === 'fresh' ? 'From phone — click to read' : 'New phone file — click to read'}
                      </button>
                    ) : (
                      <div
                        className="flex items-center gap-2 text-[11px] font-medium mt-auto"
                        style={{ color: isScanned ? doc.color : 'var(--color-neutral-400)' }}
                      >
                        <Sparkles size={11} />
                        {isScanned ? 'Re-scan to update' : 'Click to scan with AI'}
                      </div>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        <PhoneFilesList onOpen={docs.open} />

        {/* ── Help Note ───────────────────────────────────── */}
        <div
          className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-status-warning-tint)] border border-[var(--color-status-warning)]/20"
        >
          <AlertTriangle size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--color-neutral-600)]" style={{ lineHeight: 1.6 }}>
            <span className="font-medium">After scanning,</span> a preview dialog will appear showing extracted data.
            Review it and click <span className="font-medium">&ldquo;Apply to Claim&rdquo;</span> to auto-fill the Claim Details tab.
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

      {/* AI Reconciliation Hub — mounted only while open, so its transient UI
          state (active document, pending bulk confirmation) resets naturally on
          close instead of needing a reset effect. */}
      {isReconOpen && (
        <ReconciliationDialog
          isOpen={isReconOpen}
          onClose={() => setIsReconOpen(false)}
          conflictFields={conflicts}
          autoFilledFields={autoFilledFields}
          claimId={currentClaim.id}
        />
      )}


      {/* Duplicate Upload Dialog */}
      {dupeDialog && (
        <DuplicateUploadDialog
          fileName={dupeDialog.existing.name}
          suffixedName={dupeDialog.suffixedName}
          onReplace={() => {
            dupeDialog.resolve('replace');
            setDupeDialog(null);
          }}
          onKeepBoth={() => {
            dupeDialog.resolve('keep-both');
            setDupeDialog(null);
          }}
          onCancel={() => {
            dupeDialog.resolve('cancel');
            setDupeDialog(null);
          }}
        />
      )}

      {/* SurveyOS Sync document picker — slot-scoped (no filename guessing) */}
      <SyncDrivePicker
        open={!!syncPicker}
        onOpenChange={(o) => { if (!o) setSyncPicker(null); }}
        targetSlotLabel={syncPicker?.label}
        onPick={(files) => {
          if (syncPicker) setReviewSheet({ key: syncPicker.key, label: syncPicker.label, files });
        }}
      />

      {/* Review + crop gate — surveyor picks which files feed the AI */}
      {reviewSheet && (
        <DocumentReviewSheet
          open={!!reviewSheet}
          slotLabel={reviewSheet.label}
          files={reviewSheet.files}
          onCancel={() => setReviewSheet(null)}
          onConfirm={(allFiles, filesForAI) => {
            const unchanged = allFiles.every((f) => reviewSheet.files.includes(f));
            processFiles(allFiles, reviewSheet.key, filesForAI, !!reviewSheet.phone && unchanged);
            setReviewSheet(null);
          }}
        />
      )}
    </div>
  );
}
