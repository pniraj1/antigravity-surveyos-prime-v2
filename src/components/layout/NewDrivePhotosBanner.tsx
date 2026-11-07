'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { getDriveToken, listFilesInFolder, findClaimFolderId } from '@/lib/drive';
import { findNewDrivePhotos, type DriveFileLite } from '@/lib/photos/drive-photo-diff';
import { getIgnoredDrivePhotos, ignoreDrivePhotos } from '@/lib/photos/ignored-drive-photos';
import { downloadDrivePhotos } from '@/lib/photos/download-drive-photos';

export interface NewDrivePhotosBannerViewProps {
  pendingCount: number;
  busy: boolean;
  progress: { completed: number; total: number } | null;
  onDownload: () => void;
  onDismiss: () => void;
}

export function NewDrivePhotosBannerView({
  pendingCount,
  busy,
  progress,
  onDownload,
  onDismiss,
}: NewDrivePhotosBannerViewProps) {
  if (pendingCount === 0) return null;

  return (
    <div className="flex flex-col border-b border-border bg-[var(--color-status-info-tint,var(--color-neutral-50))] text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-foreground">
            ☁️ {pendingCount} photo(s) found in Google Drive for this claim.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDownload}
            disabled={busy}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy
              ? (progress && progress.total > 0
                  ? `Downloading (${progress.completed}/${progress.total})...`
                  : 'Downloading...')
              : 'Download to this Laptop'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="min-h-[38px] px-3 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            Not now
          </button>
        </div>
      </div>
      {busy && progress && progress.total > 0 && (
        <div className="w-full bg-primary/20 h-1 overflow-hidden">
          <div
            className="bg-primary h-1 transition-all duration-200"
            style={{ width: `${Math.min(100, Math.round((progress.completed / progress.total) * 100))}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Offers damage photos uploaded from another device. Never downloads without a tap. */
export function NewDrivePhotosBanner() {
  const claimId = useClaimStore((s) => s.currentClaim?.id);
  const addPhoto = useClaimStore((s) => s.addPhoto);
  const isOnline = useUIStore((s) => s.isOnline);
  const [pending, setPending] = useState<DriveFileLite[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);

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
        const ignored = getIgnoredDrivePhotos(claimId);
        const files = (await listFilesInFolder(folderId))
          .filter((f) => f.mimeType.startsWith('image/') && !ignored.has(f.name));
        const current = useClaimStore.getState().currentClaim;
        if (alive && current?.id === claimId) setPending(findNewDrivePhotos(current.photos, files));
      } catch {
        // offline or Drive error — checked again next time the claim opens
      }
    })();
    return () => { alive = false; };
  }, [claimId, isOnline]);

  const add = async () => {
    setBusy(true);
    setProgress({ completed: 0, total: pending.length });
    const startedFor = claimId;
    try {
      const { added, failed } = await downloadDrivePhotos(
        pending,
        addPhoto,
        () => useClaimStore.getState().currentClaim?.id === startedFor,
        (p) => setProgress(p),
      );
      if (added > 0) toast.success(`Added ${added} photo${added === 1 ? '' : 's'} from Drive.`);
      if (failed.length > 0) toast.error(`${failed.length} photo(s) couldn't be downloaded — tap Download to try again.`);
      if (useClaimStore.getState().currentClaim?.id === startedFor) setPending(failed);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <NewDrivePhotosBannerView
      pendingCount={pending.length}
      busy={busy}
      progress={progress}
      onDownload={add}
      onDismiss={() => {
        if (claimId) ignoreDrivePhotos(claimId, pending.map((f) => f.name));
        setPending([]);
      }}
    />
  );
}
