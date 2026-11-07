'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder,
  Cloud,
  Database,
  ExternalLink,
  Loader2,
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getClaimFolderPath,
  pickClaimFolder,
  isLocalFolderSupported,
} from '@/lib/storage/claim-folder-store';
import { useUIStore } from '@/stores/ui-store';

export interface StorageSafetyPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  claimId?: string;
  folderPath?: string | null;
  onSetFolder?: () => void | Promise<void>;
  driveConnected?: boolean;
  driveEmail?: string | null;
  gDriveFolderId?: string | null;
  driveQueueCount?: number;
  cloudSyncStatus?: 'saved' | 'saving' | 'unsynced' | 'queued' | 'error' | 'idle';
  isOnline?: boolean;
  isSaving?: boolean;
  onSyncNow?: () => void | Promise<void>;
  lastSyncedAt?: string | null;
  getAction?: (actions: {
    syncNow: () => Promise<void> | void;
    setFolder?: () => Promise<void> | void;
  }) => void;
}

export function StorageSafetyPopover({
  isOpen,
  onClose,
  claimId,
  folderPath: propFolderPath,
  onSetFolder,
  driveConnected: propDriveConnected,
  driveEmail: propDriveEmail,
  gDriveFolderId,
  driveQueueCount = 0,
  cloudSyncStatus: propCloudSyncStatus,
  isOnline: propIsOnline,
  isSaving = false,
  onSyncNow,
  lastSyncedAt,
  getAction,
}: StorageSafetyPopoverProps) {
  const storeDriveConnected = useUIStore((s) => s.isDriveConnected);
  const storeDriveEmail = useUIStore((s) => s.driveEmail);
  const storeIsOnline = useUIStore((s) => s.isOnline);
  const storeSaveStatus = useUIStore((s) => s.saveStatus);

  const driveConnected = propDriveConnected ?? storeDriveConnected;
  const driveEmail = propDriveEmail ?? storeDriveEmail;
  const isOnline = propIsOnline ?? storeIsOnline;
  const cloudSyncStatus = propCloudSyncStatus ?? storeSaveStatus;

  const [folderPath, setFolderPath] = useState<string | null>(propFolderPath ?? null);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [supported] = useState<boolean>(() => isLocalFolderSupported());

  // Sync folder path from props or storage
  useEffect(() => {
    if (propFolderPath !== undefined) {
      setFolderPath(propFolderPath);
      return;
    }
    if (!claimId) return;

    let alive = true;
    getClaimFolderPath(claimId)
      .then((p) => {
        if (alive) setFolderPath(p);
      })
      .catch(() => {});

    const handleUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ claimId?: string }>;
      if (!custom.detail?.claimId || custom.detail.claimId === claimId) {
        getClaimFolderPath(claimId)
          .then((p) => {
            if (alive) setFolderPath(p);
          })
          .catch(() => {});
      }
    };

    window.addEventListener('surveyos:claim-folder-updated', handleUpdated);
    return () => {
      alive = false;
      window.removeEventListener('surveyos:claim-folder-updated', handleUpdated);
    };
  }, [claimId, propFolderPath]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleFolderClick = useCallback(async () => {
    if (onSetFolder) {
      await onSetFolder();
      return;
    }
    if (!claimId) {
      toast.error('No claim selected');
      return;
    }
    try {
      setLoadingFolder(true);
      const res = await pickClaimFolder(claimId);
      setFolderPath(res.folderPath);
      toast.success(`Claim folder connected: ${res.folderPath}`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('surveyos:claim-folder-updated', { detail: { claimId } })
        );
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      toast.error('Failed to select folder');
    } finally {
      setLoadingFolder(false);
    }
  }, [claimId, onSetFolder]);

  const handleSyncNowClick = useCallback(() => {
    if (isSaving || !onSyncNow) return;
    void onSyncNow();
  }, [isSaving, onSyncNow]);

  if (getAction) {
    getAction({
      syncNow: handleSyncNowClick,
      setFolder: handleFolderClick,
    });
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Click-away backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Popover Container */}
      <div
        className="absolute right-0 top-full mt-2 w-84 sm:w-96 max-w-[calc(100vw-2rem)] z-50 bg-card border border-border rounded-xl shadow-2xl p-4 sm:p-5 flex flex-col gap-4 text-card-foreground animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Storage & Safety Status"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 size={15} />
            </div>
            <div>
              <h3 className="text-xs font-semibold tracking-tight text-foreground uppercase">
                Storage &amp; Safety Status
              </h3>
              <p className="text-[10px] text-muted-foreground">
                3-tier offline &amp; cloud data protection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            aria-label="Close storage popover"
          >
            <X size={14} />
          </button>
        </div>

        {/* 3 Storage Tiers */}
        <div className="space-y-3 text-xs">
          {/* Tier 1: Local Computer Folder */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <HardDrive size={13} className="text-primary shrink-0" />
                <span className="text-[11px] font-semibold">Local Computer Folder</span>
              </div>
              <button
                type="button"
                onClick={handleFolderClick}
                disabled={loadingFolder || !supported}
                title={!supported ? 'Local folder access requires Chrome or Edge' : undefined}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-background border border-border hover:bg-muted text-foreground transition-all cursor-pointer disabled:opacity-50"
              >
                {loadingFolder ? (
                  <Loader2 size={10} className="animate-spin inline mr-1" />
                ) : null}
                {folderPath ? 'Change Folder' : 'Set Folder'}
              </button>
            </div>

            {folderPath ? (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-background/60 p-1.5 rounded border border-border/40 font-mono truncate">
                <Folder size={11} className="text-emerald-500 shrink-0" />
                <span className="truncate" title={folderPath}>
                  {folderPath}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                No local folder linked. Set a folder to save photos, notes, and generated reports directly onto your PC.
              </p>
            )}
          </div>

          {/* Tier 2: Google Drive */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Cloud size={13} className="text-sky-500 shrink-0" />
                <span className="text-[11px] font-semibold">Google Drive</span>
              </div>
              {driveConnected ? (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Connected
                </span>
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Not Connected
                </span>
              )}
            </div>

            {driveConnected ? (
              <div className="space-y-1.5 text-[10px]">
                {driveEmail ? (
                  <div className="text-muted-foreground truncate">
                    Account: <span className="text-foreground font-medium">{driveEmail}</span>
                  </div>
                ) : null}

                {gDriveFolderId ? (
                  <a
                    href={`https://drive.google.com/drive/folders/${gDriveFolderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
                  >
                    <span>Open in Drive</span>
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    Folder linked on first sync
                  </span>
                )}

                {driveQueueCount > 0 ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    <UploadCloud size={11} className="shrink-0" />
                    <span>{driveQueueCount} waiting to upload</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground">
                    Queue empty · Photos up to date
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Connect Google Drive in Profile to automatically back up inspection photos to cloud storage.
              </p>
            )}
          </div>

          {/* Tier 3: Cloud Vault */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Database size={13} className="text-indigo-500 shrink-0" />
                <span className="text-[11px] font-semibold">Cloud Vault</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="text-[10px]">
              {!isOnline ? (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertCircle size={11} className="shrink-0" />
                  <span>Saved to laptop (offline)</span>
                </div>
              ) : isSaving || cloudSyncStatus === 'saving' ? (
                <div className="flex items-center gap-1.5 text-sky-500">
                  <Loader2 size={11} className="animate-spin shrink-0" />
                  <span>Saving changes...</span>
                </div>
              ) : cloudSyncStatus === 'saved' || cloudSyncStatus === 'idle' ? (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 size={11} className="shrink-0" />
                  <span>All text backed up</span>
                  {lastSyncedAt ? (
                    <span className="text-muted-foreground font-normal">
                      · Synced: {lastSyncedAt}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Saved to laptop · Queued for cloud sync
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Button & Reassurance */}
        <div className="pt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSyncNowClick}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg text-xs font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 size={12} className="animate-spin shrink-0" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <RefreshCw size={12} className="shrink-0" />
                <span>Sync Now</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-muted-foreground leading-tight">
            Continuous safety: changes are preserved in your browser&apos;s local vault.
          </p>
        </div>
      </div>
    </>
  );
}
