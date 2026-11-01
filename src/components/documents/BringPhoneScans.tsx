'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Smartphone, ChevronDown, Loader2, CloudDownload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { importScanZip, type ImportOptions, type ImportResult } from '@/lib/scan-import/import';
import { importFromDrive } from '@/lib/scan-import/drive-source';
import { planNotes, isEmptyNotesPlan, type NotesPlan } from '@/lib/scan-import/notes';
import { pickDriveZip, DriveDownloadError } from '@/lib/scan-import/picker';
import { PhoneNotesDialog } from './PhoneNotesDialog';

interface Props {
  /** The import found no claim folder: open the folder connect. */
  onNeedsFolder: () => void;
  /** The folder lost its permission this session: "Allow access" (must run from a click). */
  onAllowAccess: () => void;
}

interface VehicleAsk { zip: string; claim: string; resolve: (ok: boolean) => void }
interface FolderAsk { folders: Array<{ id: string; name: string }>; resolve: (id: string | null) => void }

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * "Bring phone scans": a SurveyOS Scan export zip from Google Drive or this computer, or (Drive connected)
 * "Import from Drive": the claim's Scan folder, whose files are moved into Prime's claim folder. No AI calls.
 */
export function BringPhoneScans({ onNeedsFolder, onAllowAccess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const driveConnected = useUIStore((s) => s.isDriveConnected);
  const [folderAsk, setFolderAsk] = useState<FolderAsk | null>(null);
  const [vehicleAsk, setVehicleAsk] = useState<VehicleAsk | null>(null);
  const [relinkAsk, setRelinkAsk] = useState<{ resolve: (ok: boolean) => void } | null>(null);
  const [notes, setNotes] = useState<{ plan: NotesPlan; claimId: string } | null>(null);

  const answerVehicle = (ok: boolean) => { vehicleAsk?.resolve(ok); setVehicleAsk(null); };

  const answerRelink = (ok: boolean) => { relinkAsk?.resolve(ok); setRelinkAsk(null); };

  const answerFolder = (id: string | null) => { folderAsk?.resolve(id); setFolderAsk(null); };

  const showNotes = (raw: unknown, claimId: string | undefined) => {
    const claim = useClaimStore.getState().currentClaim;
    if (!raw || !claim || claim.id !== claimId) return; // never plan one claim's notes onto another
    const plan = planNotes(claim, raw, claim.scanImport?.decided);
    if (isEmptyNotesPlan(plan)) toast.info('Phone notes: nothing new');
    else setNotes({ plan, claimId: claim.id });
  };

  const asks: ImportOptions = {
    confirmVehicle: (zip, claim) => new Promise((resolve) => setVehicleAsk({ zip, claim, resolve })),
    confirmRelink: () => new Promise((resolve) => setRelinkAsk({ resolve })),
  };

  /** Toasts the outcome and offers the notes; `fromDrive`: an import that found nothing says "nothing new". */
  const report = (r: ImportResult, claimId: string | undefined, fromDrive = false) => {
    if (r.status === 'needs-folder') {
      toast.error('Connect the claim folder first, then bring the phone scans again.');
      onNeedsFolder();
    } else if (r.status === 'needs-permission') {
      toast.error('Click Allow access on the folder line, then bring the phone scans again.', {
        action: { label: 'Allow access', onClick: onAllowAccess },
      });
    } else if (r.status === 'claim-changed') {
      toast.warning(`Another claim was opened, so the import stopped. Added ${r.added}.`);
    } else if (r.status === 'done') {
      if (fromDrive && r.added === 0 && !r.failed) toast.info(`Phone scans on Drive: nothing new${r.contactsFilled ? `, ${r.contactsFilled} contacts filled` : ''}`);
      else toast.success(`Added ${r.added}, skipped ${r.skipped}${r.failed ? `, ${r.failed} failed` : ''}${r.contactsFilled ? `, ${r.contactsFilled} contacts filled` : ''}`);
      showNotes(r.notes, claimId);
    }
  };

  const run = async (blob: Blob) => {
    setBusy(true);
    const claimId = useClaimStore.getState().currentClaim?.id;
    try {
      report(await importScanZip(blob, asks), claimId);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const fromDrive = async () => {
    setMenu(false);
    setBusy(true); // covers sign-in, picker and download
    let blob: Blob | null;
    try {
      blob = await pickDriveZip();
    } catch (e) {
      setBusy(false);
      if (e instanceof DriveDownloadError) { toast.error(e.message); return; }
      // Picker API off, not configured, or sign-in refused: the local chooser always works.
      toast.error(`Google Drive picker unavailable (${msg(e)}). Choose the zip from this computer instead.`);
      fileRef.current?.click();
      return;
    }
    if (blob) await run(blob);
    else setBusy(false);
  };

  const fromComputer = () => { setMenu(false); fileRef.current?.click(); };

  const fromDriveFolder = async () => {
    setBusy(true);
    const claimId = useClaimStore.getState().currentClaim?.id;
    try {
      const { result, moveFailed, mismatched } = await importFromDrive({
        ...asks,
        choose: (folders) => new Promise((resolve) => setFolderAsk({ folders, resolve })),
      });
      report(result, claimId, true);
      if (mismatched.length) toast.warning(`Not imported yet (still uploading from the phone?): ${mismatched.join(', ')}. Try again shortly.`, { duration: 8000 });
      if (result.status === 'done' && result.kept?.length) toast.warning(result.kept.join('. '), { duration: 8000 });
      if (moveFailed) toast.warning("Saved. Some files couldn't be moved on Drive — tap Import from Drive again later.", { duration: 8000 });
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const item = 'block w-full px-4 py-2 text-left text-sm hover:bg-muted';
  return (
    <div className="relative flex items-center gap-2" onKeyDown={(e) => { if (e.key === 'Escape') setMenu(false); }}>
      {driveConnected && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void fromDriveFolder()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest bg-white border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all active:scale-95 disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <CloudDownload size={12} />}
          Import from Drive
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => setMenu((m) => !m)}
        aria-haspopup="menu"
        aria-expanded={menu}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest bg-white border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all active:scale-95 disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />}
        Bring phone scans
        <ChevronDown size={12} />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
            <button type="button" role="menuitem" className={item} onClick={fromDrive}>From Google Drive</button>
            <button type="button" role="menuitem" className={item} onClick={fromComputer}>From this computer</button>
          </div>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // the same zip can be picked again
          if (f) void run(f);
        }}
      />

      {folderAsk && (
        <Dialog open onOpenChange={(open) => { if (!open) answerFolder(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Which phone claim?</DialogTitle>
              <DialogDescription>Several claims on the phone have this vehicle number. Pick the one to import.</DialogDescription>
            </DialogHeader>
            <ul className="space-y-2">
              {folderAsk.folders.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => answerFolder(f.id)} className="min-h-[44px] w-full rounded-md border border-border px-3 text-left text-sm hover:bg-muted">
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <button type="button" onClick={() => answerFolder(null)} className="min-h-[44px] rounded-md border border-border px-4 text-sm">
                Cancel
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {relinkAsk && (
        <Dialog open onOpenChange={(open) => { if (!open) answerRelink(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Different claim on the phone</DialogTitle>
              <DialogDescription>
                These phone scans are from a different claim on the phone. Import them and link this claim to it?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <button type="button" onClick={() => answerRelink(false)} className="min-h-[44px] rounded-md border border-border px-4 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => answerRelink(true)}
                className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Import and link
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {vehicleAsk && (
        <Dialog open onOpenChange={(open) => { if (!open) answerVehicle(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Different vehicle number</DialogTitle>
              <DialogDescription>
                The phone scans are for <span className="font-mono">{vehicleAsk.zip || '(none)'}</span>, but this claim is{' '}
                <span className="font-mono">{vehicleAsk.claim || '(none)'}</span>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <button type="button" onClick={() => answerVehicle(false)} className="min-h-[44px] rounded-md border border-border px-4 text-sm">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => answerVehicle(true)}
                className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Import anyway
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {notes && <PhoneNotesDialog plan={notes.plan} claimId={notes.claimId} onClose={() => setNotes(null)} />}
    </div>
  );
}
