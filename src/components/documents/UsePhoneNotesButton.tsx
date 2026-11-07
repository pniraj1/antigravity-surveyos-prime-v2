'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Cloud, Laptop, Loader2, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useClaimStore } from '@/stores/claim-store';
import { planNotes, isEmptyNotesPlan, type NotesPlan } from '@/lib/scan-import/notes';
import { readZip } from '@/lib/scan-import/zip';
import { normalizeScanNotes, type NormalizedNotesPayload } from '@/lib/scan-import/normalizer';
import { sameVehicle } from '@/lib/scan-import/manifest';
import { fetchNotesFromScanFolder, type ScanDriveFolderItem } from '@/lib/scan-import/drive-notes';
import { loadDriveIndex, saveDriveIndex } from '@/lib/drive';
import { PhoneFolderPickerDialog } from './PhoneFolderPickerDialog';
import { PhoneNotesDialog } from './PhoneNotesDialog';

interface Props {
  className?: string;
  label?: string;
}

interface VehicleMismatchAsk {
  phoneVehicle: string;
  claimVehicle: string;
  onConfirm: () => void;
}

export function UsePhoneNotesButton({ className = '', label = 'Use Phone Notes' }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [plannedNotes, setPlannedNotes] = useState<{ plan: NotesPlan; claimId: string } | null>(null);
  const [vehicleAsk, setVehicleAsk] = useState<VehicleMismatchAsk | null>(null);

  const currentClaim = useClaimStore((s) => s.currentClaim);
  const claimVehicle = currentClaim?.vehicle?.registrationNumber ?? '';

  const processNotesPayload = (normalized: NormalizedNotesPayload, scanClaimId?: string) => {
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
      setVehicleAsk({
        phoneVehicle: phoneVeh,
        claimVehicle: currentVeh,
        onConfirm: () => {
          setVehicleAsk(null);
          proceedWithNotes();
        },
      });
      return;
    }

    proceedWithNotes();
  };

  const handleSelectDriveFolder = async (folder: ScanDriveFolderItem) => {
    setPickerOpen(false);
    setBusy(true);
    try {
      const normalized = await fetchNotesFromScanFolder(folder.id);
      if (!normalized) {
        toast.error('No notes file (_surveyos-backup.json or _surveyos-scan.json) found in this Drive folder.');
        return;
      }
      // Bind this Drive folder directly to the claim so phone & Prime share the exact same folder
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

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-card border border-border text-foreground hover:border-primary/40 hover:text-primary transition-all active:scale-95 disabled:opacity-50 shadow-sm min-h-[38px]"
      >
        {busy ? <Loader2 size={14} className="animate-spin text-primary" /> : <Smartphone size={14} className="text-primary" />}
        <span>{label}</span>
        <ChevronDown size={13} className="text-muted-foreground" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1.5 z-50 min-w-[14rem] overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-xl text-xs"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); setPickerOpen(true); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-foreground hover:bg-muted font-medium transition-colors"
            >
              <Cloud size={15} className="text-[#4285F4]" />
              From Google Drive
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-foreground hover:bg-muted font-medium transition-colors"
            >
              <Laptop size={15} className="text-muted-foreground" />
              From this computer (.zip)
            </button>
          </div>
        </>
      )}

      {/* Hidden local file input for .zip */}
      <input
        ref={fileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Drive Folder Picker Dialog */}
      <PhoneFolderPickerDialog
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelectFolder={handleSelectDriveFolder}
        onPickComputerFile={() => fileRef.current?.click()}
        currentVehicle={claimVehicle}
      />

      {/* Vehicle Mismatch Confirmation Dialog */}
      {vehicleAsk && (
        <Dialog open onOpenChange={(open) => { if (!open) setVehicleAsk(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-amber-600 dark:text-amber-500">
                Different Vehicle Number
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                The phone notes are for vehicle <span className="font-mono font-semibold text-foreground">{vehicleAsk.phoneVehicle}</span>, but the current claim is <span className="font-mono font-semibold text-foreground">{vehicleAsk.claimVehicle || '(none)'}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
              Please verify before applying to avoid mixing records across different vehicles.
            </div>
            <DialogFooter className="gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVehicleAsk(null)}
                className="min-h-[44px] rounded-xl border border-border px-4 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={vehicleAsk.onConfirm}
                className="min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 text-xs font-semibold uppercase tracking-wider"
              >
                Import Anyway
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* The Notes Review & Apply Dialog */}
      {plannedNotes && (
        <PhoneNotesDialog
          plan={plannedNotes.plan}
          claimId={plannedNotes.claimId}
          onClose={() => setPlannedNotes(null)}
        />
      )}
    </div>
  );
}
