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
import { saveDocuments } from './sink';

async function pickPdf(label: string): Promise<File | null> {
  if (typeof window === 'undefined' || !window.showOpenFilePicker) return null;
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
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
  if (!(await getStoredRootHandle())) return;

  const label = DOC_TYPE_LABEL[type];
  toast(`Saved the ${label} as a PDF?`, {
    description: 'File it into the claim folder so the list holds the copy you sent.',
    duration: Infinity,
    action: {
      label: 'File the PDF',
      onClick: () => {
        // The click is the user gesture the picker needs; failures are the
        // surveyor cancelling, which is not an error worth a toast.
        void pickPdf(label)
          .then((file) => {
            if (file) return saveDocuments(type, [{ blob: file, name: file.name }], 'generated');
          })
          .catch(() => undefined);
      },
    },
  });
}
