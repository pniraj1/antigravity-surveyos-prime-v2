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

export async function saveDocuments(
  type: DocType,
  files: FolderInput[],
  source: ClaimDocument['source'],
): Promise<ClaimDocument[]> {
  const claim = useClaimStore.getState().currentClaim;
  if (!claim || files.length === 0) return [];
  if (!(await getStoredRootHandle())) return [];
  try {
    const { claim: next, written } = await writeDocuments(claim, type, files, source);
    useClaimStore.getState().updateClaim({ documents: next.documents, documentsFolder: next.documentsFolder });
    toast.success(`${DOC_TYPE_LABEL[type]} saved to the claim folder`, { duration: 2500 });
    return written;
  } catch (err) {
    const msg = err instanceof PermissionDeniedError
      ? 'Claim folder: access not granted — reconnect it on the Documents tab.'
      : `Claim folder: could not save ${DOC_TYPE_LABEL[type]} (${err instanceof Error ? err.message : String(err)})`;
    toast.error(msg, { duration: 5000 });
    return [];
  }
}

/** Spec D9: call this first thing in a click handler that will end in a write. */
export { ensureReadWrite } from '@/lib/local-sync/directory-handle';
