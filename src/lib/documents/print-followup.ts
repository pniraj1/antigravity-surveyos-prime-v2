// src/lib/documents/print-followup.ts
/**
 * A printed report leaves the browser through Chrome's print dialog, so the
 * PDF never passes through this app — only the HTML we saved at print time
 * does. This offers the surveyor one click to hand the PDF back, which then
 * replaces that HTML in the claim folder (see isDiscardablePlaceholder).
 */
import { toast } from 'sonner';
import type { DocType } from '@/types/documents';
import { DOC_TYPE_LABEL } from '@/types/documents';
import { getStoredRootHandle } from '@/lib/local-sync/directory-handle';
import { useClaimStore } from '@/stores/claim-store';
import { saveDocuments } from './sink';
import { getClaimDirHandle } from './folder';

async function pickPdf(label: string, startIn: FileSystemDirectoryHandle | null): Promise<File | null> {
  if (typeof window === 'undefined' || !window.showOpenFilePicker) return null;
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    excludeAcceptAllOption: true,
    ...(startIn ? { startIn } : {}),
    types: [{ description: `${label} (PDF)`, accept: { 'application/pdf': ['.pdf'] } }],
  });
  return handle ? handle.getFile() : null;
}

/**
 * Shown after the print window opens. Silent when no claim folder is
 * connected or the browser has no file picker — printing is unchanged there.
 */
export async function promptForPrintedPdf(type: DocType): Promise<void> {
  if (typeof window === 'undefined' || !window.showOpenFilePicker) return;
  // The prompt belongs to the claim that was printed, not whatever claim is
  // open when the surveyor eventually clicks it.
  const claimId = useClaimStore.getState().currentClaim?.id;
  if (!claimId) return;
  if (!(await getStoredRootHandle())) return;

  const label = DOC_TYPE_LABEL[type];
  const id = `print-pdf-${type}-${claimId}`;
  toast(`Saved the ${label} as a PDF?`, {
    description: 'Save it into the claim folder, then file it here so the list holds the copy you sent.',
    duration: Infinity,
    id,
    action: {
      label: 'File the PDF',
      onClick: () => {
        if (useClaimStore.getState().currentClaim?.id !== claimId) {
          toast.dismiss(id);
          toast.info('That prompt was for another claim — reopen it and print again.');
          return;
        }
        // The click is the user gesture the picker needs; a cancel throws
        // AbortError, which is the surveyor changing their mind, not an error.
        // getClaimDirHandle can throw (no folder / permission denied) — that
        // degrades to opening the picker without startIn, not losing it.
        void getClaimDirHandle(useClaimStore.getState().currentClaim!)
          .catch(() => null)
          .then((dir) => pickPdf(label, dir))
          // A surveyor-picked file is still recorded as 'generated': it is the
          // report we generated, only carried back to us through Chrome's print
          // dialog, so it is filed exactly as the report it replaces would be.
          .then((file) => (file && file.type === 'application/pdf'
            ? saveDocuments(type, [{ blob: file, name: file.name }], 'generated')
            : null))
          .then((saved) => { if (saved) toast.dismiss(id); })
          .catch((e: unknown) => {
            if ((e as { name?: string })?.name !== 'AbortError') {
              toast.error('Could not open the file picker — try again.');
            }
          });
      },
    },
    cancel: { label: 'Not now', onClick: () => toast.dismiss(id) },
  });
}
