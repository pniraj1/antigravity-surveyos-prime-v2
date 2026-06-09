'use client';

// ═══════════════════════════════════════════════════════════
// SYNC DRIVE PICKER
// Two-pane dialog: list Sync claims (drive "folders") →
// tap one → see its received documents → tap a document →
// stream the bytes as a File and hand it back via onPick.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useProfileStore } from '@/stores/profile-store';
import { listSyncClaims, getSyncClaim, fetchSyncDocFile } from '@/lib/sync-bridge/client';
import type { SyncClaimSummary, SyncClaimDetail } from '@/lib/sync-bridge/types';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, FileText, Car } from 'lucide-react';

interface SyncDrivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (file: File, docType: string) => void;
}

export function SyncDrivePicker({ open, onOpenChange, onPick }: SyncDrivePickerProps) {
  const token = useProfileStore((s) => s.profile.syncBridgeToken) ?? '';
  const [claims, setClaims] = useState<SyncClaimSummary[]>([]);
  const [detail, setDetail] = useState<SyncClaimDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Load the claim list whenever the dialog opens (manual freshness — re-open re-fetches).
  useEffect(() => {
    if (!open || !token) return;
    setDetail(null);
    setLoading(true);
    listSyncClaims(token)
      .then(setClaims)
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Could not load Sync claims.')
      )
      .finally(() => setLoading(false));
  }, [open, token]);

  const openClaim = async (claimId: string) => {
    setLoading(true);
    try {
      setDetail(await getSyncClaim(token, claimId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  };

  const pickDoc = async (docId: string, docType: string) => {
    if (!detail) return;
    setDownloadingId(docId);
    try {
      const file = await fetchSyncDocFile(token, detail.claimId, docId, docType);
      onPick(file, docType);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not download the document.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {detail && (
              <button
                onClick={() => setDetail(null)}
                className="hover:opacity-70 transition-opacity"
                aria-label="Back to claims list"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {detail
              ? `${detail.vehicleNumber} – ${detail.insuranceCompany}`
              : 'SurveyOS Sync — pick a document'}
          </DialogTitle>
          <DialogDescription>
            {detail
              ? 'Tap a document to add it to this claim.'
              : 'Choose a vehicle/claim to see its collected documents.'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="animate-spin" size={20} />
          </div>
        )}

        {!loading && !detail && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {claims.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No claims found in SurveyOS Sync.
              </p>
            ) : (
              claims.map((c) => (
                <button
                  key={c.claimId}
                  onClick={() => openClaim(c.claimId)}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/50 px-2 rounded-md transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Car size={15} className="shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{c.label}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {c.receivedDocs} docs
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {!loading && detail && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {detail.documents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No received documents in this claim.
              </p>
            ) : (
              detail.documents.map((d) => (
                <button
                  key={d.docId}
                  onClick={() => pickDoc(d.docId, d.docType)}
                  disabled={downloadingId !== null}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/50 px-2 rounded-md transition-colors disabled:opacity-50"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText size={15} className="shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{d.docType}</span>
                  </span>
                  {downloadingId === d.docId ? (
                    <Loader2 size={14} className="animate-spin shrink-0" />
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {d.fileSizeKb} KB
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
