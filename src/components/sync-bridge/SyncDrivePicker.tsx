'use client';

// ═══════════════════════════════════════════════════════════
// SYNC DRIVE PICKER
// Slot-scoped picker: opened from one Documents-tab field's ✈️ badge.
// Claim list is searchable and grouped by insurer; picking a document
// streams its bytes as a File and hands it back via onPick(file).
// The destination slot is owned by the caller — this component never
// guesses where the file goes.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useProfileStore } from '@/stores/profile-store';
import { listSyncClaims, getSyncClaim, fetchSyncDocFile } from '@/lib/sync-bridge/client';
import { filterAndGroupClaims } from '@/lib/sync-bridge/group-claims';
import type { SyncClaimSummary, SyncClaimDetail } from '@/lib/sync-bridge/types';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, ChevronDown, ChevronRight, FileText, Car, Search, FolderDown, HardDriveDownload } from 'lucide-react';
import { useLocalSync } from '@/lib/local-sync/useLocalSync';
import { getLocalFile } from '@/lib/local-sync/local-source';
import { isDocSynced, emptyManifest, MANIFEST_FILENAME, type LocalManifest } from '@/lib/local-sync/sync-manifest';
import { claimFolderName } from '@/lib/local-sync/nomenclature';

interface SyncDrivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Destination slot label shown in the header, e.g. "RC Book". */
  targetSlotLabel?: string;
  /** Returns the picked document as a File. The caller owns the destination slot. */
  onPick: (file: File) => void;
}

export function SyncDrivePicker({ open, onOpenChange, targetSlotLabel, onPick }: SyncDrivePickerProps) {
  const token = useProfileStore((s) => s.profile.syncBridgeToken) ?? '';
  const [claims, setClaims] = useState<SyncClaimSummary[]>([]);
  const [detail, setDetail] = useState<SyncClaimDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Remember the last-opened claim across re-opens within the session (read-only inside the effect).
  const lastClaimIdRef = useRef<string | null>(null);
  const localSync = useLocalSync(token);
  const [claimManifest, setClaimManifest] = useState<LocalManifest | null>(null);

  const openClaim = useCallback(async (claimId: string) => {
    setLoading(true);
    try {
      const d = await getSyncClaim(token, claimId);
      setDetail(d);
      lastClaimIdRef.current = claimId;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load the claim list whenever the dialog opens. If we previously opened a
  // claim this session and it still exists, jump straight back into it.
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    listSyncClaims(token)
      .then((list) => {
        setClaims(list);
        const remembered = lastClaimIdRef.current;
        if (remembered && list.some((c) => c.claimId === remembered)) {
          void openClaim(remembered);
        } else {
          setDetail(null);
        }
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Could not load Sync claims.')
      )
      .finally(() => setLoading(false));
  }, [open, token, openClaim]);

  // Read the opened claim's local manifest so we can show "✓ on disk" per document.
  useEffect(() => {
    if (!detail || !localSync.root) { setClaimManifest(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const claimDir = await localSync.root!.getDirectoryHandle(
          claimFolderName({ vehicleNumber: detail.vehicleNumber, insuranceCompany: detail.insuranceCompany }),
        );
        const fh = await claimDir.getFileHandle(MANIFEST_FILENAME);
        const text = await (await fh.getFile()).text();
        if (!cancelled) setClaimManifest(JSON.parse(text) as LocalManifest);
      } catch {
        if (!cancelled) setClaimManifest(emptyManifest(detail.claimId));
      }
    })();
    return () => { cancelled = true; };
  }, [detail, localSync.root, localSync.busy]);

  const groups = useMemo(() => filterAndGroupClaims(claims, query), [claims, query]);
  const searching = query.trim().length > 0;

  const pickDoc = async (docId: string, docType: string) => {
    if (!detail) return;
    setDownloadingId(docId);
    try {
      const doc = detail.documents.find((d) => d.docId === docId);
      const fileCount = doc?.fileCount ?? 1;
      const mimeType = doc?.mimeType ?? 'image/jpeg';
      // Local-first: if the newest file of this doc is already on disk, read it (no Worker call).
      const local = await getLocalFile(
        localSync.root,
        { vehicleNumber: detail.vehicleNumber, insuranceCompany: detail.insuranceCompany },
        { docType, fileIndex: fileCount - 1, fileCount, mimeType, docId },
      );
      const file = local ?? await fetchSyncDocFile(token, detail.claimId, docId, docType);
      onPick(file);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not download the document.');
    } finally {
      setDownloadingId(null);
    }
  };

  // A document name "looks like" the target slot — used only to soft-highlight, never to filter.
  const isSuggested = (docType: string): boolean => {
    if (!targetSlotLabel) return false;
    const a = docType.toLowerCase();
    const b = targetSlotLabel.toLowerCase();
    const first = b.split(' ')[0];
    return a.includes(b) || (first.length > 2 && a.includes(first));
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
            {targetSlotLabel
              ? `Add to: ${targetSlotLabel}`
              : detail
                ? 'Tap a document to add it to this claim.'
                : 'Choose a vehicle/claim to see its collected documents.'}
          </DialogDescription>
        </DialogHeader>

        {/* Search box — claim-list view only */}
        {!detail && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vehicle no., insurer, model…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="animate-spin" size={20} />
          </div>
        )}

        {/* Claim list — grouped by insurer */}
        {!loading && !detail && (
          <div className="max-h-80 overflow-y-auto">
            {localSync.supported && claims.length > 0 && (
              <button
                onClick={() => localSync.runSyncAll(claims)}
                disabled={localSync.busy}
                className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{ background: 'rgba(212,175,55,0.12)', color: '#B8860B', border: '1px solid rgba(212,175,55,0.3)' }}
              >
                {localSync.busy
                  ? <><Loader2 size={13} className="animate-spin" /> {localSync.progress?.claimLabel ?? 'Syncing…'}</>
                  : <><FolderDown size={13} /> Sync all claims to local folder</>}
              </button>
            )}
            {groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {searching ? 'No claims match your search.' : 'No claims found in SurveyOS Sync.'}
              </p>
            ) : (
              groups.map((group) => {
                const isCollapsed = !searching && collapsed[group.insurer];
                return (
                  <div key={group.insurer} className="mb-1">
                    <button
                      onClick={() => setCollapsed((c) => ({ ...c, [group.insurer]: !c[group.insurer] }))}
                      className="w-full flex items-center justify-between px-2 py-2 text-left hover:bg-muted/40 rounded-md"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                        {group.insurer}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{group.claims.length}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y">
                        {group.claims.map((c) => (
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
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Document list for one claim */}
        {!loading && detail && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {localSync.supported && (
              <button
                onClick={() => localSync.runSyncClaim({
                  claimId: detail.claimId,
                  vehicleNumber: detail.vehicleNumber,
                  insuranceCompany: detail.insuranceCompany,
                  label: `${detail.vehicleNumber} - ${detail.insuranceCompany}`,
                })}
                disabled={localSync.busy}
                className="w-full mb-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{ background: 'rgba(212,175,55,0.12)', color: '#B8860B', border: '1px solid rgba(212,175,55,0.3)' }}
              >
                {localSync.busy
                  ? <><Loader2 size={13} className="animate-spin" /> {localSync.progress ? `Syncing ${localSync.progress.done}/${localSync.progress.total}…` : 'Syncing…'}</>
                  : <><HardDriveDownload size={13} /> Sync to local folder</>}
              </button>
            )}
            {detail.documents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No received documents in this claim.
              </p>
            ) : (
              detail.documents.map((d) => {
                const suggested = isSuggested(d.docType);
                return (
                  <button
                    key={d.docId}
                    onClick={() => pickDoc(d.docId, d.docType)}
                    disabled={downloadingId !== null}
                    className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/50 px-2 rounded-md transition-colors disabled:opacity-50"
                    style={suggested ? { background: 'rgba(212,175,55,0.10)' } : undefined}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText size={15} className="shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{d.docType}</span>
                      {suggested && (
                        <span className="shrink-0 text-[10px] font-bold text-[#D4AF37]">suggested</span>
                      )}
                    </span>
                    {downloadingId === d.docId ? (
                      <Loader2 size={14} className="animate-spin shrink-0" />
                    ) : claimManifest && isDocSynced(d.docId, d.fileCount, claimManifest) ? (
                      <span className="text-[10px] font-bold shrink-0" style={{ color: '#16a34a' }}>✓ on disk</span>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {d.fileSizeKb} KB
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
