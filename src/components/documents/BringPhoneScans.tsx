'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Smartphone, ChevronDown, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useClaimStore } from '@/stores/claim-store';
import { importScanZip } from '@/lib/scan-import/import';
import { planNotes, isEmptyNotesPlan, type NotesPlan } from '@/lib/scan-import/notes';
import { pickDriveZip } from '@/lib/scan-import/picker';
import { PhoneNotesDialog } from './PhoneNotesDialog';

interface Props {
  /** The import found no claim folder: open the folder connect. */
  onNeedsFolder: () => void;
}

interface VehicleAsk { zip: string; claim: string; resolve: (ok: boolean) => void }

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** "Bring phone scans": a SurveyOS Scan export zip from Google Drive or this computer. No AI calls. */
export function BringPhoneScans({ onNeedsFolder }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vehicleAsk, setVehicleAsk] = useState<VehicleAsk | null>(null);
  const [notes, setNotes] = useState<{ plan: NotesPlan; claimId: string } | null>(null);

  const answerVehicle = (ok: boolean) => { vehicleAsk?.resolve(ok); setVehicleAsk(null); };

  const showNotes = (raw: unknown, claimId: string | undefined) => {
    const claim = useClaimStore.getState().currentClaim;
    if (!raw || !claim || claim.id !== claimId) return; // never plan one claim's notes onto another
    const plan = planNotes(claim, raw, claim.scanImport?.decided);
    if (isEmptyNotesPlan(plan)) toast.info('Phone notes: nothing new');
    else setNotes({ plan, claimId: claim.id });
  };

  const run = async (blob: Blob) => {
    setBusy(true);
    const claimId = useClaimStore.getState().currentClaim?.id;
    try {
      const r = await importScanZip(blob, {
        confirmVehicle: (zip, claim) => new Promise((resolve) => setVehicleAsk({ zip, claim, resolve })),
      });
      if (r.status === 'needs-folder') {
        toast.error('Connect the claim folder first, then bring the phone scans again.');
        onNeedsFolder();
      } else if (r.status === 'claim-changed') {
        toast.warning(`Another claim was opened, so the import stopped. Added ${r.added}.`);
      } else if (r.status === 'done') {
        toast.success(`Added ${r.added}, skipped ${r.skipped}${r.failed ? `, ${r.failed} failed` : ''}`);
        showNotes(r.notes, claimId);
      }
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
      // Picker API off, not configured, or sign-in refused: the local chooser always works.
      toast.error(`Google Drive picker unavailable (${msg(e)}). Choose the zip from this computer instead.`);
      fileRef.current?.click();
      return;
    }
    if (blob) await run(blob);
    else setBusy(false);
  };

  const fromComputer = () => { setMenu(false); fileRef.current?.click(); };

  const item = 'block w-full px-4 py-2 text-left text-sm hover:bg-muted';
  return (
    <div className="relative" onKeyDown={(e) => { if (e.key === 'Escape') setMenu(false); }}>
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
