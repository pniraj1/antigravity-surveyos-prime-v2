'use client';

import React, { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useClaimStore } from '@/stores/claim-store';
import { isLocalFolderSupported } from '@/lib/storage/claim-folder-store';
import { planNotes, isEmptyNotesPlan, type NotesPlan } from '@/lib/scan-import/notes';
import { readZip } from '@/lib/scan-import/zip';
import { backupOnlyNotes } from '@/lib/scan-import/backup-notes';
import type { NormalizedNotesPayload } from '@/lib/scan-import/normalizer';
import { sameVehicle } from '@/lib/scan-import/manifest';
import { fetchNotesFromScanFolder, type ScanDriveFolderItem } from '@/lib/scan-import/drive-notes';
import { loadDriveIndex, saveDriveIndex } from '@/lib/drive';
import { importScanFiles, type ImportOptions, type ImportResult } from '@/lib/scan-import/import';
import { importFromDrive } from '@/lib/scan-import/drive-source';
import { PhoneFolderPickerDialog } from './PhoneFolderPickerDialog';
import { PhoneNotesDialog } from './PhoneNotesDialog';

export interface FromPhoneButtonProps {
  onNeedsFolder?: () => void;
  onAllowAccess?: () => void;
  className?: string;
  disabled?: boolean;
  initialOpen?: boolean;
  getAction?: (actions: { open: () => void; close: () => void }) => void;
}

interface VehicleMismatchAsk {
  phoneVehicle: string;
  claimVehicle: string;
  onConfirm: () => void;
}

interface ScansVehicleAsk {
  zip: string;
  claim: string;
  resolve: (ok: boolean) => void;
}

type ScanMessage = { kind: 'error' | 'warning' | 'info' | 'success'; text: string };

/** The toast for an import result, or null when none is needed. Pure, so it can be tested. */
export function scanResultMessage(r: ImportResult, fromDrive = false): ScanMessage | null {
  if (r.status === 'needs-folder' || r.status === 'needs-permission') {
    const folder = r.status === 'needs-folder';
    if (r.notes) {
      return {
        kind: 'info',
        text: folder
          ? 'Documents and photos were not saved: link the claim folder on the Documents tab (desktop Chrome).'
          : 'Documents and photos were not saved: click Allow access on the folder line on the Documents tab.',
      };
    }
    return {
      kind: 'error',
      text: folder
        ? 'Connect the claim folder first, then bring the phone scans again.'
        : 'Click Allow access on the folder line, then bring the phone scans again.',
    };
  }
  if (r.status === 'claim-changed') {
    return { kind: 'warning', text: `Another claim was opened, so the import stopped. Added ${r.added}.` };
  }
  if (r.status === 'done') {
    if (fromDrive && r.added === 0 && !r.failed) {
      return { kind: 'info', text: `Phone scans on Drive: nothing new${r.contactsFilled ? `, ${r.contactsFilled} contacts filled` : ''}` };
    }
    return { kind: 'success', text: `Added ${r.added}, skipped ${r.skipped}${r.failed ? `, ${r.failed} failed` : ''}${r.contactsFilled ? `, ${r.contactsFilled} contacts filled` : ''}` };
  }
  return null;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function FromPhoneButton({
  onNeedsFolder,
  onAllowAccess,
  className = '',
  disabled = false,
  initialOpen = false,
  getAction,
}: FromPhoneButtonProps) {
  const scansFileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);

  // Direct PhoneFolderPickerDialog state
  const [folderPickerOpen, setFolderPickerOpen] = useState(initialOpen);

  // Notes review state
  const [plannedNotes, setPlannedNotes] = useState<{ plan: NotesPlan; claimId: string } | null>(null);
  const [notesVehicleAsk, setNotesVehicleAsk] = useState<VehicleMismatchAsk | null>(null);

  // Scans import asks
  const [scansVehicleAsk, setScansVehicleAsk] = useState<ScansVehicleAsk | null>(null);
  const [scansRelinkAsk, setScansRelinkAsk] = useState<{ resolve: (ok: boolean) => void } | null>(null);

  const currentClaim = useClaimStore((s) => s.currentClaim);
  const claimVehicle = currentClaim?.vehicle?.registrationNumber ?? '';
  const localFolderSupported = isLocalFolderSupported();
  const isDisabled = disabled || !currentClaim || busy;

  // Handle Phone Notes logic
  const processNotesPayload = useCallback((normalized: NormalizedNotesPayload, scanClaimId?: string) => {
    const claim = useClaimStore.getState().currentClaim;
    if (!claim) {
      toast.error('Open a claim first before importing phone notes.');
      return;
    }
    const currentVeh = claim.vehicle?.registrationNumber || '';
    const phoneVeh = normalized.vehicle || '';

    const proceedWithNotes = () => {
      const plan = planNotes(claim, normalized, claim.scanImport?.decided);
      if (isEmptyNotesPlan(plan)) {
        toast.info('Phone notes: nothing new to import.');
        return;
      }
      if (scanClaimId && claim.scanClaimId !== scanClaimId) {
        useClaimStore.getState().updateClaim({ scanClaimId });
      }
      setPlannedNotes({ plan, claimId: claim.id });
    };

    if (phoneVeh && currentVeh && !sameVehicle(phoneVeh, currentVeh)) {
      setNotesVehicleAsk({
        phoneVehicle: phoneVeh,
        claimVehicle: currentVeh,
        onConfirm: () => {
          setNotesVehicleAsk(null);
          proceedWithNotes();
        },
      });
      return;
    }

    proceedWithNotes();
  }, []);

  const answerScansVehicle = (ok: boolean) => {
    scansVehicleAsk?.resolve(ok);
    setScansVehicleAsk(null);
  };

  const answerScansRelink = (ok: boolean) => {
    scansRelinkAsk?.resolve(ok);
    setScansRelinkAsk(null);
  };

  const showNotesFromScanZip = (raw: unknown, claimId: string | undefined) => {
    const claim = useClaimStore.getState().currentClaim;
    if (!raw || !claim || claim.id !== claimId) return;
    const plan = planNotes(claim, raw, claim.scanImport?.decided);
    if (isEmptyNotesPlan(plan)) toast.info('Phone notes: nothing new');
    else setPlannedNotes({ plan, claimId: claim.id });
  };

  const scanAsks: ImportOptions = {
    confirmVehicle: (zip, claim) => new Promise((resolve) => setScansVehicleAsk({ zip, claim, resolve })),
    confirmRelink: () => new Promise((resolve) => setScansRelinkAsk({ resolve })),
  };

  const reportScans = (
    r: ImportResult,
    claimId: string | undefined,
    fromDrive = false,
    alreadyHandledNotes = false
  ) => {
    const m = scanResultMessage(r, fromDrive);
    if (m) {
      if (r.status === 'needs-permission') {
        toast[m.kind](m.text, { action: onAllowAccess ? { label: 'Allow access', onClick: onAllowAccess } : undefined });
      } else {
        toast[m.kind](m.text);
      }
    }
    if (r.status === 'needs-folder' && !r.notes) onNeedsFolder?.();
    if (!alreadyHandledNotes && (r.status === 'done' || r.status === 'needs-folder' || r.status === 'needs-permission')) {
      showNotesFromScanZip(r.notes, claimId);
    }
  };

  // Unified folder selection handler
  const handleSelectFolder = async (folder: ScanDriveFolderItem) => {
    setFolderPickerOpen(false);
    setBusy(true);
    const claim = useClaimStore.getState().currentClaim;
    if (!claim) {
      setBusy(false);
      toast.error('Open a claim first before bringing items from phone.');
      return;
    }

    try {
      // 1. Link the claim to the Drive folder
      useClaimStore.getState().updateClaim({
        gDriveFolderId: folder.id,
        scanClaimId: folder.scanClaimId || claim.scanClaimId,
      });

      // 2. Update localStorage and saveDriveIndex
      try {
        localStorage.setItem(`surveyos_drive_folder_${claim.id}`, folder.id);
      } catch {}

      loadDriveIndex()
        .then((index) => {
          if (index[claim.id] !== folder.id) {
            index[claim.id] = folder.id;
            return saveDriveIndex(index);
          }
        })
        .catch(() => {});

      toast.success(`Linked claim to Drive folder: ${folder.name}`);

      // 3. Checks and loads notes if present via fetchNotesFromScanFolder
      let notesFound = false;
      try {
        const normalized = await fetchNotesFromScanFolder(folder.id);
        if (normalized) {
          notesFound = true;
          processNotesPayload(normalized, folder.scanClaimId);
        }
      } catch (notesErr) {
        console.warn('Could not read notes from folder:', notesErr);
      }

      // 4. If local folder is supported, triggers importFromDrive(scanAsks, folder.id) to import photos and documents
      if (localFolderSupported) {
        if (useClaimStore.getState().currentClaim?.id !== claim.id) {
          toast.warning('Claim changed during import. Please select the folder again.');
          return;
        }
        try {
          const { result, moveFailed, mismatched } = await importFromDrive(scanAsks, folder.id);
          reportScans(result, claim.id, true, notesFound);

          if (mismatched.length) {
            toast.warning(
              `Not imported yet (still uploading from phone?): ${mismatched.join(', ')}. Try again shortly.`,
              { duration: 8000 }
            );
          }
          if (result.status === 'done' && result.kept?.length) {
            toast.warning(result.kept.join('. '), { duration: 8000 });
          }
          if (moveFailed) {
            toast.warning(
              "Saved. Some files couldn't be moved on Drive — tap From Phone again later.",
              { duration: 8000 }
            );
          }
        } catch (scanErr) {
          toast.error(msg(scanErr));
        }
      } else if (!notesFound) {
        toast.info('No notes or documents found in this Drive folder.');
      }
    } catch (err) {
      toast.error(msg(err));
    } finally {
      setBusy(false);
    }
  };

  const runScansZipBlob = async (blob: Blob) => {
    setBusy(true);
    const claimId = useClaimStore.getState().currentClaim?.id;
    try {
      const files = await readZip(blob);
      const notes = await backupOnlyNotes(files);
      if (notes) {
        toast.info('This zip has notes only — no documents or photos.');
        processNotesPayload(notes);
      } else {
        reportScans(await importScanFiles(files, scanAsks), claimId, false, false);
      }
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleScansFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void runScansZipBlob(f);
  };

  const handleOpen = () => {
    if (!currentClaim) {
      toast.error('Open a claim first before bringing items from phone.');
      return;
    }
    setFolderPickerOpen(true);
  };

  // Expose action callbacks for unit tests
  if (getAction) {
    getAction({
      open: handleOpen,
      close: () => setFolderPickerOpen(false),
    });
  }

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={handleOpen}
        title={!currentClaim ? 'Open a claim first before bringing items from phone' : 'From Phone'}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-card border border-border text-foreground hover:border-primary/40 hover:text-primary transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-sm min-h-[38px]"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin text-primary" />
        ) : (
          <Smartphone size={14} className="text-primary" />
        )}
        <span>From Phone</span>
      </button>

      {/* Hidden file input */}
      <input
        ref={scansFileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleScansFileInput}
      />

      {/* Direct PhoneFolderPickerDialog */}
      <PhoneFolderPickerDialog
        isOpen={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        onSelectFolder={handleSelectFolder}
        onPickComputerFile={() => scansFileRef.current?.click()}
        currentVehicle={claimVehicle}
      />

      {/* Phone Notes Vehicle Mismatch Confirmation */}
      {notesVehicleAsk && (
        <Dialog open onOpenChange={(open) => { if (!open) setNotesVehicleAsk(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-amber-600 dark:text-amber-500">
                Different Vehicle Number
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                The phone notes are for vehicle <span className="font-mono font-semibold text-foreground">{notesVehicleAsk.phoneVehicle}</span>, but the current claim is <span className="font-mono font-semibold text-foreground">{notesVehicleAsk.claimVehicle || '(none)'}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
              Please verify before applying to avoid mixing records across different vehicles.
            </div>
            <DialogFooter className="gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNotesVehicleAsk(null)}
                className="min-h-[44px] rounded-xl border border-border px-4 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={notesVehicleAsk.onConfirm}
                className="min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 text-xs font-semibold uppercase tracking-wider"
              >
                Import Anyway
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Notes Review & Apply Dialog */}
      {plannedNotes && (
        <PhoneNotesDialog
          plan={plannedNotes.plan}
          claimId={plannedNotes.claimId}
          onClose={() => setPlannedNotes(null)}
        />
      )}

      {/* Scans - Relink claim confirmation */}
      {scansRelinkAsk && (
        <Dialog open onOpenChange={(open) => { if (!open) answerScansRelink(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Different claim on the phone</DialogTitle>
              <DialogDescription>
                These phone scans are from a different claim on the phone. Import them and link this claim to it?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <button
                type="button"
                onClick={() => answerScansRelink(false)}
                className="min-h-[44px] rounded-md border border-border px-4 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => answerScansRelink(true)}
                className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Import and link
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Scans - Vehicle mismatch confirmation */}
      {scansVehicleAsk && (
        <Dialog open onOpenChange={(open) => { if (!open) answerScansVehicle(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Different vehicle number</DialogTitle>
              <DialogDescription>
                The phone scans are for <span className="font-mono">{scansVehicleAsk.zip || '(none)'}</span>, but this claim is{' '}
                <span className="font-mono">{scansVehicleAsk.claim || '(none)'}</span>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <button
                type="button"
                onClick={() => answerScansVehicle(false)}
                className="min-h-[44px] rounded-md border border-border px-4 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => answerScansVehicle(true)}
                className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Import anyway
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
