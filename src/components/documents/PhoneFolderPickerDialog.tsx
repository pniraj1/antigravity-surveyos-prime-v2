'use client';

import { useState, useEffect } from 'react';
import { Cloud, Folder, FolderX, Laptop, Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useUIStore } from '@/stores/ui-store';
import { linkGoogleDrive } from '@/lib/drive';
import { listScanDriveFolders, type ScanDriveFolderItem } from '@/lib/scan-import/drive-notes';
import { sameVehicle } from '@/lib/scan-import/manifest';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folder: ScanDriveFolderItem) => void;
  onPickComputerFile: () => void;
  currentVehicle?: string;
}

export function PhoneFolderPickerDialog({
  isOpen,
  onClose,
  onSelectFolder,
  onPickComputerFile,
  currentVehicle = '',
}: Props) {
  const isDriveConnected = useUIStore((s) => s.isDriveConnected);
  const driveEmail = useUIStore((s) => s.driveEmail);

  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [folders, setFolders] = useState<ScanDriveFolderItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load folders whenever the dialog opens and Drive is connected
  useEffect(() => {
    if (!isOpen || !isDriveConnected) return;
    let alive = true;
    setLoading(true);
    setError(null);

    listScanDriveFolders()
      .then((items) => {
        if (alive) setFolders(items);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isOpen, isDriveConnected]);

  const handleConnectDrive = async () => {
    setLinking(true);
    setError(null);
    try {
      const ok = await linkGoogleDrive();
      if (!ok) setError('Google Drive was not linked. You can choose a .zip file from your computer instead.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Drive linking failed.');
    } finally {
      setLinking(false);
    }
  };

  const matchingFolders = folders.filter((f) => sameVehicle(f.vehicle, currentVehicle));
  const otherFolders = folders.filter((f) => !sameVehicle(f.vehicle, currentVehicle));

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Cloud size={18} className="text-primary" />
            Select Phone Scan Folder
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isDriveConnected
              ? `Connected as ${driveEmail || 'Google Drive'} · Select the claim folder to import notes from:`
              : 'Google Drive is not linked in this session. Link your account or choose a file from your computer.'}
          </DialogDescription>
        </DialogHeader>

        {/* State A: Drive Not Linked */}
        {!isDriveConnected && (
          <div className="py-6 space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-center space-y-3">
              <p className="text-xs text-muted-foreground">
                Link Google Drive to browse your SurveyOS Scan folders directly.
              </p>
              <button
                type="button"
                onClick={handleConnectDrive}
                disabled={linking}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-[#4285F4] hover:bg-[#3367D6] text-white text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {linking ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
                {linking ? 'Linking Google Drive…' : 'Link Google Drive'}
              </button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <span className="relative bg-card px-2 text-[10px] uppercase font-semibold text-muted-foreground tracking-widest">
                or use computer
              </span>
            </div>

            <button
              type="button"
              onClick={() => { onClose(); onPickComputerFile(); }}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-all"
            >
              <Laptop size={16} className="text-muted-foreground" />
              Choose .zip file from this computer
            </button>
          </div>
        )}

        {/* State B: Drive Linked -> Folder Browser */}
        {isDriveConnected && (
          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 -mr-1">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-2">
                <Loader2 size={24} className="animate-spin text-primary" />
                <span className="text-xs">Searching SurveyOS/Phone Scans/…</span>
              </div>
            )}

            {!loading && error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {error}
              </div>
            )}

            {!loading && !error && folders.length === 0 && (
              <div className="rounded-xl border border-border p-6 text-center space-y-3 bg-muted/20">
                <FolderX size={32} className="mx-auto text-muted-foreground" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">No Phone Scans Found</div>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    No folders found in <span className="font-mono">SurveyOS/Phone Scans/</span>. On your phone app, enable <strong>Settings › Drive backup › Text only</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { onClose(); onPickComputerFile(); }}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium"
                >
                  <Laptop size={14} />
                  Choose exported .zip instead
                </button>
              </div>
            )}

            {!loading && folders.length > 0 && (
              <div className="space-y-3">
                {matchingFolders.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      <Sparkles size={12} />
                      Matching this claim ({currentVehicle})
                    </div>
                    {matchingFolders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onSelectFolder(f)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-500 hover:bg-emerald-50/70 transition-all text-left min-h-[48px] group"
                      >
                        <div className="flex items-center gap-3">
                          <Folder size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                              {f.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatDate(f.modifiedTime)}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-600 text-white shrink-0">
                          Matches
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {otherFolders.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {matchingFolders.length > 0 ? 'Other Recent Scans' : 'Recent Phone Scans'}
                    </div>
                    {otherFolders.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onSelectFolder(f)}
                        className="w-full flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-muted/60 transition-all text-left min-h-[48px] group"
                      >
                        <div className="flex items-center gap-3">
                          <Folder size={18} className="text-muted-foreground group-hover:text-primary shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-foreground group-hover:text-primary">
                              {f.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {formatDate(f.modifiedTime)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between gap-2 sm:justify-between">
          <button
            type="button"
            onClick={() => { onClose(); onPickComputerFile(); }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            <Laptop size={14} />
            Pick .zip from computer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-border bg-card text-xs font-medium hover:bg-muted"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
