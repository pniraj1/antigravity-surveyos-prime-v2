'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Folder, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useClaimStore } from '@/stores/claim-store';
import {
  isLocalFolderSupported,
  getClaimFolderHandle,
  getClaimFolderPath,
  pickClaimFolder,
  verifyHandlePermission,
} from '@/lib/storage/claim-folder-store';

export function getDisplayFolderName(path: string): string {
  if (!path) return '';
  const normalized = path.replace(/[\\/]+$/, '');
  const parts = normalized.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export interface ClaimFolderButtonViewProps {
  supported: boolean;
  folderPath: string | null;
  permissionGranted: boolean;
  onClick: () => void;
  loading?: boolean;
}

export function ClaimFolderButtonView({
  supported,
  folderPath,
  permissionGranted,
  onClick,
  loading,
}: ClaimFolderButtonViewProps) {
  if (!supported) return null;

  // Case 1: Unallocated
  if (!folderPath) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-[10px] font-medium tracking-wide transition-all hover:bg-muted border border-border text-muted-foreground hover:text-foreground cursor-pointer shrink-0 disabled:opacity-50"
        title="Connect a local folder for this claim's documents and photos"
      >
        <Folder size={12} className="shrink-0" />
        <span>Set Folder</span>
      </button>
    );
  }

  // Case 2: Assigned, but permission prompt / lapsed
  if (!permissionGranted) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-[10px] font-medium tracking-wide transition-all bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 cursor-pointer shrink-0 disabled:opacity-50"
        title={`Permission required to read/write to folder: ${folderPath}`}
      >
        <AlertTriangle size={12} className="text-amber-500 shrink-0" />
        <span>Grant Folder Access</span>
      </button>
    );
  }

  // Case 3: Assigned and permission granted
  const displayName = getDisplayFolderName(folderPath);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-[10px] font-medium tracking-wide transition-all bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] border border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer shrink-0 disabled:opacity-50"
      title={`Connected folder: ${folderPath} (click to change)`}
    >
      <Folder size={12} className="shrink-0 text-emerald-500" />
      <span className="truncate max-w-[110px] sm:max-w-[150px]">{displayName}</span>
      <Check size={11} className="shrink-0 text-emerald-500" />
    </button>
  );
}

export interface ClaimFolderButtonProps {
  claimId?: string;
  initialHandle?: FileSystemDirectoryHandle | null;
  initialFolderPath?: string | null;
  initialPermissionGranted?: boolean;
  getAction?: (fn: () => Promise<void>) => void;
}

export function ClaimFolderButton({
  claimId: propClaimId,
  initialHandle,
  initialFolderPath,
  initialPermissionGranted,
  getAction,
}: ClaimFolderButtonProps = {}) {
  const storeClaim = useClaimStore((s) => s.currentClaim);
  const currentClaim =
    storeClaim ??
    (typeof useClaimStore?.getState === 'function' ? useClaimStore.getState().currentClaim : null);
  const claimId = propClaimId ?? currentClaim?.id;

  const [supported, setSupported] = useState<boolean>(() => isLocalFolderSupported());
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(initialHandle ?? null);
  const [folderPath, setFolderPath] = useState<string | null>(initialFolderPath ?? null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(
    initialPermissionGranted ?? false
  );
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setSupported(isLocalFolderSupported());
  }, []);

  const refreshState = useCallback(async (id: string) => {
    try {
      const [h, p] = await Promise.all([
        getClaimFolderHandle(id),
        getClaimFolderPath(id),
      ]);

      setHandle(h);
      setFolderPath(p);

      if (h) {
        if (typeof h.queryPermission === 'function') {
          const status = await h.queryPermission({ mode: 'readwrite' });
          setPermissionGranted(status === 'granted');
        } else {
          setPermissionGranted(true);
        }
      } else {
        setPermissionGranted(false);
      }
    } catch {
      setHandle(null);
      setFolderPath(null);
      setPermissionGranted(false);
    }
  }, []);

  useEffect(() => {
    if (!supported || !claimId) {
      if (!initialFolderPath && !initialHandle) {
        setHandle(null);
        setFolderPath(null);
        setPermissionGranted(false);
      }
      return;
    }

    void refreshState(claimId);

    const handleUpdated = (e: Event) => {
      const custom = e as CustomEvent<{ claimId?: string }>;
      if (!custom.detail?.claimId || custom.detail.claimId === claimId) {
        void refreshState(claimId);
      }
    };

    window.addEventListener('surveyos:claim-folder-updated', handleUpdated);
    return () => {
      window.removeEventListener('surveyos:claim-folder-updated', handleUpdated);
    };
  }, [claimId, supported, refreshState, initialFolderPath, initialHandle]);

  // Synchronous user-gesture invariant:
  // Chromium requires showDirectoryPicker or requestPermission to be invoked directly
  // inside the user gesture without intervening async ticks (e.g. no pre-fetch or delay).
  const handleClick = useCallback(async () => {
    if (!claimId) return;

    if (handle && !permissionGranted) {
      try {
        setLoading(true);
        const granted = await verifyHandlePermission(handle, 'readwrite');
        if (granted) {
          setPermissionGranted(true);
          toast.success('Folder access granted');
        } else {
          toast.error('Folder access was not granted');
        }
      } catch {
        toast.error('Failed to verify folder permission');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const result = await pickClaimFolder(claimId);
      setHandle(result.handle);
      setFolderPath(result.folderPath);
      setPermissionGranted(true);
      toast.success(`Claim folder connected: ${result.folderPath}`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('surveyos:claim-folder-updated', { detail: { claimId } })
        );
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        // User cancelled folder picker
        return;
      }
      toast.error('Failed to select folder');
    } finally {
      setLoading(false);
    }
  }, [claimId, handle, permissionGranted]);

  if (getAction) {
    getAction(handleClick);
  }

  if (!supported || !claimId) return null;

  return (
    <ClaimFolderButtonView
      supported={supported}
      folderPath={folderPath}
      permissionGranted={permissionGranted}
      onClick={handleClick}
      loading={loading}
    />
  );
}
