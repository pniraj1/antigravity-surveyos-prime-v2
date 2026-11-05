// ═══════════════════════════════════════════════════════════════
// UNIVERSAL DOCUMENT INGESTION PIPELINE
//
// Unifies all document ingestion points (Details tab direct uploads,
// Documents tab uploads, phone scans, and future portals).
//
// PIPELINE ORDER:
// 1. Raw Bytes to Disk: saveDocuments(...) into allocated/root claim folder
// 2. Evidence Register: storeFiles(...) for instant Evidence Viewer rendering
// 3. AI Extraction: optional triggerExtraction(...) for optical/structured parsing
// 4. Cloud Mirror: optional uploadWithDuplicateCheck(...) to Google Drive
// ═══════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import type { DocType, ClaimDocument } from '@/types/documents';
import { saveDocuments } from './sink';
import { storeFiles } from '@/components/evidence/DocumentEvidenceViewer';
import { useUIStore } from '@/stores/ui-store';
import { useProfileStore } from '@/stores/profile-store';
import { useClaimStore } from '@/stores/claim-store';
import {
  uploadWithDuplicateCheck,
  type DuplicateAction,
  type ExistingFile,
} from '@/lib/drive/upload-with-check';
import { useAIExtraction } from '@/hooks/useAIExtraction';

export interface IngestDocumentOptions {
  claimId: string;
  docType: DocType;
  file: File;
  slotKey?: string; // e.g. 'rc', 'dl', 'policy', 'estimate', 'final-bill'
  customFileName?: string;
  source?: ClaimDocument['source']; // defaults to 'upload'
  skipAI?: boolean;
  skipDrive?: boolean;
  onDuplicateDialog?: (existing: ExistingFile, suffixedName: string) => Promise<DuplicateAction>;
  triggerExtraction?: (slotKey: string, file: File) => Promise<void> | void;
}

/**
 * Universal ingestion pipeline for claim documents.
 * Orchestrates local disk write, evidence viewer registration, AI extraction,
 * and Google Drive cloud mirroring.
 *
 * Returns the written `ClaimDocument` if saved to the local folder, or null.
 */
export async function ingestDocument(
  opts: IngestDocumentOptions,
): Promise<ClaimDocument | null> {
  const fileName = opts.customFileName || opts.file.name;
  const source = opts.source ?? 'upload';

  // Step 1: Save to claim folder
  const writtenDocs = await saveDocuments(
    opts.docType,
    [{ blob: opts.file, name: fileName }],
    source,
    opts.claimId,
  );
  const writtenDoc = writtenDocs[0] ?? null;

  // Step 2: Register in Evidence Viewer if slotKey is provided
  if (opts.slotKey) {
    storeFiles(opts.claimId, opts.slotKey, [opts.file]);
  }

  // Step 3: Optional AI extraction trigger
  if (!opts.skipAI && opts.slotKey && opts.triggerExtraction) {
    try {
      await opts.triggerExtraction(opts.slotKey, opts.file);
    } catch (err) {
      console.error('[ingestDocument] AI extraction trigger failed:', err);
    }
  }

  // Step 4: Optional Google Drive upload with duplicate checking
  if (!opts.skipDrive) {
    const isDriveConnected = !!useUIStore.getState().isDriveConnected;
    const profile = useProfileStore.getState().profile;
    const autoUpload = profile?.autoUploadDrive !== false;

    if (isDriveConnected && autoUpload) {
      const currentClaim = useClaimStore.getState().currentClaim;
      const label =
        (currentClaim?.id === opts.claimId
          ? currentClaim.vehicle?.registrationNumber?.trim()
          : undefined) || opts.claimId;
      const driveFileName = opts.customFileName || opts.file.name;

      try {
        await uploadWithDuplicateCheck(
          opts.claimId,
          driveFileName,
          opts.file,
          label,
          opts.onDuplicateDialog ?? (async () => 'replace' as DuplicateAction),
        );
      } catch (err) {
        console.error('[ingestDocument] Drive upload failed:', err);
      }
    }
  }

  return writtenDoc;
}

/**
 * React hook wrapping `ingestDocument` that automatically binds the active
 * claim's `triggerExtraction` from `useAIExtraction`.
 */
export function useIngestDocument() {
  const { triggerExtraction } = useAIExtraction();

  return useCallback(
    async (opts: IngestDocumentOptions) => {
      return ingestDocument({
        triggerExtraction: opts.triggerExtraction ?? triggerExtraction,
        ...opts,
      });
    },
    [triggerExtraction],
  );
}
