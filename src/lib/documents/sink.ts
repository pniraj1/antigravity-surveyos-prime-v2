// src/lib/documents/sink.ts
/**
 * The one call every "a file was born" site makes. Folder + store in one go.
 * No folder connected → quiet no-op: the browser download / Drive upload the
 * caller already does is unchanged (spec D6, D7).
 */
import { toast } from 'sonner';
import type { ClaimDocument, DocType } from '@/types/documents';
import { useClaimStore } from '@/stores/claim-store';
import { getStoredRootHandle } from '@/lib/local-sync/directory-handle';
import { writeDocuments, PermissionDeniedError, type FolderInput } from './folder';
import { DOC_TYPE_LABEL } from '@/types/documents';

// Saves run one at a time so two callers never race on the same index snapshot.
let queue: Promise<unknown> = Promise.resolve();

export function saveDocuments(
  type: DocType,
  files: FolderInput[],
  source: ClaimDocument['source'],
): Promise<ClaimDocument[]> {
  const run = queue.then(() => doSave(type, files, source));
  queue = run.catch(() => undefined);
  return run;
}

async function doSave(
  type: DocType,
  files: FolderInput[],
  source: ClaimDocument['source'],
): Promise<ClaimDocument[]> {
  const claim = useClaimStore.getState().currentClaim; // read after our turn in the queue
  if (!claim || files.length === 0) return [];
  if (!(await getStoredRootHandle())) return [];
  try {
    const { claim: next, written } = await writeDocuments(claim, type, files, source);
    if (useClaimStore.getState().currentClaim?.id !== claim.id) {
      toast.warning('Saved to the folder, but the claim changed meanwhile — the list was not updated.');
      return written;
    }
    useClaimStore.getState().updateClaim({ documents: next.documents, documentsFolder: next.documentsFolder });
    toast.success(`${DOC_TYPE_LABEL[type]} saved to the claim folder`, { duration: 2500 });
    return written;
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    const msg = err instanceof PermissionDeniedError || /user gesture|user activation|SecurityError/i.test(`${err instanceof Error ? err.name : ''} ${text}`)
      ? 'Claim folder: click "Allow access" on the Documents tab once this session, then try again.'
      : `Claim folder: could not save ${DOC_TYPE_LABEL[type]} (${text})`;
    toast.error(msg, { duration: 5000 });
    return [];
  }
}
