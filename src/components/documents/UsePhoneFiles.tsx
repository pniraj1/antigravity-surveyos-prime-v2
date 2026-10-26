'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useClaimStore } from '@/stores/claim-store';
import { readDocument, PermissionDeniedError, NoFolderError } from '@/lib/documents/folder';
import { phoneFilesOfTypes } from '@/lib/scan-import/phone-files';
import { DOC_TYPE_LABEL, type ClaimDocument, type DocType } from '@/types/documents';

interface Props {
  types: readonly DocType[];
  /** Runs the screen's own upload path; nothing here starts AI on its own. */
  onPick: (file: File, doc: ClaimDocument) => void;
  disabled?: boolean;
  className?: string;
}

/** One toast for a failed phone-file read; a missing folder permission points to the Documents tab. */
export function toastPhoneReadError(err: unknown, relPath: string): void {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (err instanceof PermissionDeniedError || err instanceof NoFolderError || /user gesture|user activation|SecurityError/i.test(text)) {
    toast.error('Claim folder: click "Allow access" on the Documents tab, then try again.', { duration: 5000 });
  } else {
    toast.error(`Could not read the phone file ${relPath} (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** "Use phone files": pick one imported phone file of the given types. Hidden when the claim has none. */
export function UsePhoneFiles({ types, onPick, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // A pick only lands while the dialog is still open and mounted.
  const openRef = useRef(false);
  openRef.current = open;
  useEffect(() => () => { openRef.current = false; }, []);
  const claim = useClaimStore((s) => s.currentClaim);
  const files = claim ? phoneFilesOfTypes(claim, types) : [];
  if (!claim || files.length === 0) return null;

  const pick = async (doc: ClaimDocument) => {
    const claimId = claim.id;
    setBusy(true);
    try {
      const file = await readDocument(claim, doc); // can be slow on Drive for desktop
      if (useClaimStore.getState().currentClaim?.id !== claimId) return; // claim switched meanwhile: never use A's file on B
      if (!openRef.current) return; // dialog gone meanwhile: the surveyor dismissed this pick
      setOpen(false);
      onPick(file, doc);
    } catch (err) {
      toastPhoneReadError(err, doc.relPath);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" className={`gap-2 ${className ?? ""}`} disabled={disabled} onClick={() => setOpen(true)}>
        <Smartphone size={16} />
        Use phone files
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Use phone files</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2">
            {files.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void pick(d)}
                  className="w-full rounded-md border border-border p-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <span className="font-medium">{DOC_TYPE_LABEL[d.type]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {d.relPath} · {new Date(d.addedAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
