'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Images, Loader2 } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { getDriveToken, listFilesInFolder, findClaimFolderId } from '@/lib/drive';
import { PHOTO_FILE_PREFIX } from '@/lib/photos/document-annexure';
import { findNewDrivePhotos, type DriveFileLite } from '@/lib/photos/drive-photo-diff';
import { downloadDrivePhotos } from '@/lib/photos/download-drive-photos';

/** Offers damage photos uploaded from another device. Never downloads without a tap. */
export function NewDrivePhotosBanner() {
  const claimId = useClaimStore((s) => s.currentClaim?.id);
  const addPhoto = useClaimStore((s) => s.addPhoto);
  const isOnline = useUIStore((s) => s.isOnline);
  const [pending, setPending] = useState<DriveFileLite[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPending([]);
    if (!claimId || !isOnline || !getDriveToken()) return;
    let alive = true;
    (async () => {
      try {
        const claim = useClaimStore.getState().currentClaim;
        if (!claim) return;
        const folderId = claim.gDriveFolderId ?? await findClaimFolderId(claim.id);
        if (!folderId) return;
        const files = (await listFilesInFolder(folderId))
          .filter((f) => f.mimeType.startsWith('image/') && f.name.startsWith(PHOTO_FILE_PREFIX));
        if (alive) setPending(findNewDrivePhotos(claim.photos, files));
      } catch {
        // offline or Drive error — checked again next time the claim opens
      }
    })();
    return () => { alive = false; };
  }, [claimId, isOnline]);

  if (pending.length === 0) return null;

  const add = async () => {
    setBusy(true);
    try {
      const n = await downloadDrivePhotos(pending, addPhoto);
      toast.success(`Added ${n} photo${n === 1 ? '' : 's'} from Drive.`);
    } finally {
      setPending([]);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-2.5 text-sm bg-[var(--color-status-info-tint,var(--color-neutral-50))] border-b border-border">
      <Images size={16} className="shrink-0 text-primary" />
      <span className="flex-1 min-w-[12rem]">
        {pending.length} new photo{pending.length === 1 ? '' : 's'} from another device
      </span>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy && <Loader2 size={14} className="animate-spin" />} Add
      </button>
      <button type="button" onClick={() => setPending([])} className="min-h-[40px] px-2 text-sm text-muted-foreground">
        Not now
      </button>
    </div>
  );
}
