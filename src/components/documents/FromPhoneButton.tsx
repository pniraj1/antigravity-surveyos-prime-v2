'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ChevronDown,
  Cloud,
  CloudDownload,
  FileText,
  FolderArchive,
  Laptop,
  Loader2,
  Smartphone,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { isLocalFolderSupported } from '@/lib/storage/claim-folder-store';
import { planNotes, isEmptyNotesPlan, type NotesPlan } from '@/lib/scan-import/notes';
import { readZip } from '@/lib/scan-import/zip';
import { normalizeScanNotes, type NormalizedNotesPayload } from '@/lib/scan-import/normalizer';
import { sameVehicle } from '@/lib/scan-import/manifest';
import { fetchNotesFromScanFolder, type ScanDriveFolderItem } from '@/lib/scan-import/drive-notes';
import { loadDriveIndex, saveDriveIndex, linkGoogleDrive } from '@/lib/drive';
import { importScanZip, type ImportOptions, type ImportResult } from '@/lib/scan-import/import';
import { importFromDrive } from '@/lib/scan-import/drive-source';
import { pickDriveZip, DriveDownloadError } from '@/lib/scan-import/picker';
import { PhoneFolderPickerDialog } from './PhoneFolderPickerDialog';
import { PhoneNotesDialog } from './PhoneNotesDialog';

export interface FromPhoneButtonProps {
  onNeedsFolder?: () => void;
  onAllowAccess?: () => void;
  className?: string;
  disabled?: boolean;
  initialOpen?: boolean;
  getAction?: (actions: {
    toggleMenu: () => void;
    openNotes: () => void;
    openScans: () => void;
    closeMenu: () => void;
  }) => void;
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

interface ScansFolderAsk {
  folders: Array<{ id: string; name: string }>;
  resolve: (id: string | null) => void;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const notesFileRef = useRef<HTMLInputElement>(null);
  const scansFileRef = useRef<HTMLInputElement>(null);

  const [menuOpen, setMenuOpen] = useState(initialOpen);
  const [busy, setBusy] = useState(false);

  // Notes state
  const [notesPickerOpen, setNotesPickerOpen] = useState(false);
  const [plannedNotes, setPlannedNotes] = useState<{ plan: NotesPlan; claimId: string } | null>(null);
  const [notesVehicleAsk, setNotesVehicleAsk] = useState<VehicleMismatchAsk | null>(null);

  // Scans state
  const [scansSourceDialogOpen, setScansSourceDialogOpen] = useState(false);
  const [scansFolderAsk, setScansFolderAsk] = useState<ScansFolderAsk | null>(null);
  const [scansVehicleAsk, setScansVehicleAsk] = useState<ScansVehicleAsk | null>(null);
  const [scansRelinkAsk, setScansRelinkAsk] = useState<{ resolve: (ok: boolean) => void } | null>(null);

  const currentClaim = useClaimStore((s) => s.currentClaim);
  const driveConnected = useUIStore((s) => s.isDriveConnected);
  const claimVehicle = currentClaim?.vehicle?.registrationNumber ?? '';
  const localFolderSupported = isLocalFolderSupported();
  const isDisabled = disabled || !currentClaim || busy;

  // Click-outside and keyboard Escape listener
  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

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

  const handleSelectDriveFolderForNotes = async (folder: ScanDriveFolderItem) => {
    setNotesPickerOpen(false);
    setBusy(true);
    try {
      const normalized = await fetchNotesFromScanFolder(folder.id);
      if (!normalized) {
        toast.error('No notes file (_surveyos-backup.json or _surveyos-scan.json) found in this Drive folder.');
        return;
      }
      const claim = useClaimStore.getState().currentClaim;
      if (claim) {
        useClaimStore.getState().updateClaim({
          gDriveFolderId: folder.id,
          scanClaimId: folder.scanClaimId || claim.scanClaimId,
        });
        localStorage.setItem(`surveyos_drive_folder_${claim.id}`, folder.id);
        toast.success(`Linked claim to Drive folder: ${folder.name}`);
        loadDriveIndex().then((index) => {
          if (index[claim.id] !== folder.id) {
            index[claim.id] = folder.id;
            return saveDriveIndex(index);
          }
        }).catch(() => {});
      }
      processNotesPayload(normalized, folder.scanClaimId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to read notes from Google Drive folder.');
    } finally {
      setBusy(false);
    }
  };

  const handleNotesFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const zipMap = await readZip(file);
      let rawText: string | null = null;
      for (const [path, blob] of zipMap) {
        if (path.endsWith('_surveyos-scan.json') || path.endsWith('_surveyos-backup.json')) {
          rawText = await blob.text();
          break;
        }
      }
      if (!rawText) {
        throw new Error('This zip does not contain a SurveyOS Scan notes or backup file.');
      }
      const normalized = normalizeScanNotes(rawText);
      if (!normalized) {
        throw new Error('Could not parse notes from this zip file.');
      }
      processNotesPayload(normalized);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read zip file.');
    } finally {
      setBusy(false);
    }
  };

  // Handle Phone Scans logic
  const answerScansVehicle = (ok: boolean) => {
    scansVehicleAsk?.resolve(ok);
    setScansVehicleAsk(null);
  };

  const answerScansRelink = (ok: boolean) => {
    scansRelinkAsk?.resolve(ok);
    setScansRelinkAsk(null);
  };

  const answerScansFolder = (id: string | null) => {
    scansFolderAsk?.resolve(id);
    setScansFolderAsk(null);
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

  const reportScans = (r: ImportResult, claimId: string | undefined, fromDrive = false) => {
    if (r.status === 'needs-folder') {
      toast.error('Connect the claim folder first, then bring the phone scans again.');
      onNeedsFolder?.();
    } else if (r.status === 'needs-permission') {
      toast.error('Click Allow access on the folder line, then bring the phone scans again.', {
        action: onAllowAccess ? { label: 'Allow access', onClick: onAllowAccess } : undefined,
      });
    } else if (r.status === 'claim-changed') {
      toast.warning(`Another claim was opened, so the import stopped. Added ${r.added}.`);
    } else if (r.status === 'done') {
      if (fromDrive && r.added === 0 && !r.failed) {
        toast.info(`Phone scans on Drive: nothing new${r.contactsFilled ? `, ${r.contactsFilled} contacts filled` : ''}`);
      } else {
        toast.success(`Added ${r.added}, skipped ${r.skipped}${r.failed ? `, ${r.failed} failed` : ''}${r.contactsFilled ? `, ${r.contactsFilled} contacts filled` : ''}`);
      }
      showNotesFromScanZip(r.notes, claimId);
    }
  };

  const runScansZipBlob = async (blob: Blob) => {
    setBusy(true);
    const claimId = useClaimStore.getState().currentClaim?.id;
    try {
      reportScans(await importScanZip(blob, scanAsks), claimId);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleScansFromDriveFolder = async () => {
    setBusy(true);
    const claimId = useClaimStore.getState().currentClaim?.id;
    try {
      const { result, moveFailed, mismatched } = await importFromDrive({
        ...scanAsks,
        choose: (folders) => new Promise((resolve) => setScansFolderAsk({ folders, resolve })),
      });
      reportScans(result, claimId, true);
      if (mismatched.length) {
        toast.warning(`Not imported yet (still uploading from the phone?): ${mismatched.join(', ')}. Try again shortly.`, { duration: 8000 });
      }
      if (result.status === 'done' && result.kept?.length) {
        toast.warning(result.kept.join('. '), { duration: 8000 });
      }
      if (moveFailed) {
        toast.warning("Saved. Some files couldn't be moved on Drive — tap Import from Drive again later.", { duration: 8000 });
      }
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleScansFromDriveZip = async () => {
    setBusy(true);
    let blob: Blob | null;
    try {
      blob = await pickDriveZip();
    } catch (e) {
      setBusy(false);
      if (e instanceof DriveDownloadError) {
        toast.error(e.message);
        return;
      }
      toast.error(`Google Drive picker unavailable (${msg(e)}). Choose the zip from this computer instead.`);
      scansFileRef.current?.click();
      return;
    }
    if (blob) {
      await runScansZipBlob(blob);
    } else {
      setBusy(false);
    }
  };

  const handleScansFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void runScansZipBlob(f);
  };

  const handleOpenNotes = () => {
    setMenuOpen(false);
    if (!currentClaim) {
      toast.error('Open a claim first before importing phone notes.');
      return;
    }
    setNotesPickerOpen(true);
  };

  const handleOpenScans = () => {
    setMenuOpen(false);
    if (!currentClaim) {
      toast.error('Open a claim first before bringing phone scans.');
      return;
    }
    if (!localFolderSupported) {
      toast.error('Local claim folder access requires Chrome, Edge, or Brave on desktop.');
      return;
    }
    setScansSourceDialogOpen(true);
  };

  // Expose action callbacks for unit tests
  if (getAction) {
    getAction({
      toggleMenu: () => setMenuOpen((o) => !o),
      openNotes: handleOpenNotes,
      openScans: handleOpenScans,
      closeMenu: () => setMenuOpen(false),
    });
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setMenuOpen(false);
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={isDisabled}
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={!currentClaim ? 'Open a claim first before bringing items from phone' : 'From Phone'}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-card border border-border text-foreground hover:border-primary/40 hover:text-primary transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-sm min-h-[38px]"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin text-primary" />
        ) : (
          <Smartphone size={14} className="text-primary" />
        )}
        <span>From Phone</span>
        <ChevronDown
          size={13}
          className={`text-muted-foreground transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Unified Dropdown Menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label="From Phone options"
            className="absolute right-0 top-full mt-1.5 z-50 min-w-[19rem] overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-xl text-xs"
          >
            {/* Option 1: Phone Notes */}
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenNotes}
              className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left text-foreground hover:bg-muted font-medium transition-colors group cursor-pointer"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Phone Notes
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Review field notes recorded on phone & auto-populate details
                </div>
              </div>
            </button>

            {/* Option 2: Phone Scans & Photos */}
            <button
              type="button"
              role="menuitem"
              data-unsupported={!localFolderSupported}
              onClick={handleOpenScans}
              className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left font-medium transition-colors group cursor-pointer ${
                !localFolderSupported
                  ? 'opacity-60 hover:bg-transparent'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <FolderArchive size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Phone Scans & Photos
                  {!localFolderSupported && (
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                      Desktop Chrome Only
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Import scans and photos from phone .zip or Drive folder
                </div>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Hidden file inputs */}
      <input
        ref={notesFileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleNotesFileInput}
      />
      <input
        ref={scansFileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleScansFileInput}
      />

      {/* Dialog 1: PhoneFolderPickerDialog for Phone Notes */}
      <PhoneFolderPickerDialog
        isOpen={notesPickerOpen}
        onClose={() => setNotesPickerOpen(false)}
        onSelectFolder={handleSelectDriveFolderForNotes}
        onPickComputerFile={() => notesFileRef.current?.click()}
        currentVehicle={claimVehicle}
      />

      {/* Dialog 2: Phone Notes Vehicle Mismatch Confirmation */}
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

      {/* Dialog 3: Notes Review & Apply Dialog */}
      {plannedNotes && (
        <PhoneNotesDialog
          plan={plannedNotes.plan}
          claimId={plannedNotes.claimId}
          onClose={() => setPlannedNotes(null)}
        />
      )}

      {/* Dialog 4: Source Selector Dialog for Phone Scans & Photos */}
      {scansSourceDialogOpen && (
        <Dialog open onOpenChange={(open) => { if (!open) setScansSourceDialogOpen(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                <FolderArchive size={18} className="text-primary" />
                Import Phone Scans & Photos
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Bring scanned documents, inspection photos, and files into this claim.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 py-2">
              {driveConnected ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setScansSourceDialogOpen(false);
                      void handleScansFromDriveFolder();
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                        <CloudDownload size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          Sync from Google Drive Folder
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Directly import from phone scan folder in Drive
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScansSourceDialogOpen(false);
                      void handleScansFromDriveZip();
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                        <Cloud size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          Pick .zip from Google Drive
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Select an exported scan archive (.zip) on Drive
                        </div>
                      </div>
                    </div>
                  </button>
                </>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Google Drive is not linked in this session.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await linkGoogleDrive();
                      if (ok) toast.success('Google Drive linked');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4285F4] hover:bg-[#3367D6] text-white text-xs font-medium"
                  >
                    <Cloud size={14} />
                    Link Google Drive
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setScansSourceDialogOpen(false);
                  scansFileRef.current?.click();
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    <Laptop size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      From this Computer (.zip)
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Choose an exported SurveyOS Scan .zip file
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={() => setScansSourceDialogOpen(false)}
                className="min-h-[38px] rounded-xl border border-border px-4 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog 5: Scans - Which phone claim */}
      {scansFolderAsk && (
        <Dialog open onOpenChange={(open) => { if (!open) answerScansFolder(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Which phone claim?</DialogTitle>
              <DialogDescription>
                Several claims on the phone have this vehicle number. Pick the one to import.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-2">
              {scansFolderAsk.folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => answerScansFolder(f.id)}
                    className="min-h-[44px] w-full rounded-md border border-border px-3 text-left text-sm hover:bg-muted"
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <button
                type="button"
                onClick={() => answerScansFolder(null)}
                className="min-h-[44px] rounded-md border border-border px-4 text-sm"
              >
                Cancel
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog 6: Scans - Relink claim confirmation */}
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

      {/* Dialog 7: Scans - Vehicle mismatch confirmation */}
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
