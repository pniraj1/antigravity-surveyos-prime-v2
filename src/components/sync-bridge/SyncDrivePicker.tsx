'use client';

// ═══════════════════════════════════════════════════════════
// SYNC DRIVE PICKER
// Slot-scoped picker: opened from one Documents-tab field's ✈️ badge.
// Claim list is searchable and grouped by insurer; picking a document
// streams its bytes as a File and hands it back via onPick(file).
// The destination slot is owned by the caller — this component never
// guesses where the file goes.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useProfileStore } from '@/stores/profile-store';
import { listSyncClaims, getSyncClaim, fetchSyncDocFile } from '@/lib/sync-bridge/client';
import { filterAndGroupClaims } from '@/lib/sync-bridge/group-claims';
import type { SyncClaimSummary, SyncClaimDetail } from '@/lib/sync-bridge/types';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, ChevronDown, ChevronRight, FileText, Car, Search } from 'lucide-react';

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
  // Remember the last-opened claim across re-opens within the session.
  const [lastClaimId, setLastClaimId] = useState<string | null>(null);

  // Load the claim list whenever the dialog opens. If we previously opened a
  // claim this session and it still exists, jump straight back into it.
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    listSyncClaims(token)
      .then((list) => {
        setClaims(list);
        if (lastClaimId && list.some((c) => c.claimId === lastClaimId)) {
          void openClaim(lastClaimId);
        } else {
          setDetail(null);
        }
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Could not load Sync claims.')
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  const groups = useMemo(() => filterAndGroupClaims(claims, query), [claims, query]);
  const searching = query.trim().length > 0;

  const openClaim = async (claimId: string) => {
    setLoading(true);
    try {
      const d = await getSyncClaim(token, claimId);
      setDetail(d);
      setLastClaimId(claimId);
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
