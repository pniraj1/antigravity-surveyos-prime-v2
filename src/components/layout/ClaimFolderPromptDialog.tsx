'use client';

import React, { useState, useEffect } from 'react';
import { Folder, FolderCheck, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { pickClaimFolder } from '@/lib/storage/claim-folder-store';
import { useClaimStore } from '@/stores/claim-store';

export interface ClaimFolderPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  claimId?: string;
  registrationNumber?: string;
  onAllocated?: (handle: FileSystemDirectoryHandle) => void;
  getAction?: (actions: {
    handlePickFolder: () => Promise<void>;
    handleSkip: () => void;
  }) => void;
}

export function ClaimFolderPromptDialog({
  isOpen,
  onClose,
  claimId: propClaimId,
  registrationNumber,
  onAllocated,
  getAction,
}: ClaimFolderPromptDialogProps) {
  const [loading, setLoading] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handlePickFolder = async () => {
    const activeClaimId =
      propClaimId ?? useClaimStore.getState().currentClaim?.id;

    if (!activeClaimId) {
      toast.error('No claim selected');
      return;
    }

    try {
      setLoading(true);
      const result = await pickClaimFolder(activeClaimId);
      toast.success(`Claim folder connected: ${result.folderPath}`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('surveyos:claim-folder-updated', {
            detail: { claimId: activeClaimId },
          })
        );
      }
      onAllocated?.(result.handle);
      onClose();
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        // User cancelled directory picker
        return;
      }
      toast.error('Failed to select folder');
    } finally {
      setLoading(false);
    }
  };

  if (getAction) {
    getAction({
      handlePickFolder,
      handleSkip: onClose,
    });
  }

  if (!isOpen) return null;

  const regNo = registrationNumber?.trim();
  const targetLabel = regNo || 'this claim';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-folder-prompt-title"
      aria-describedby="claim-folder-prompt-desc"
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in zoom-in-95 duration-200 bg-card border border-border text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary border border-primary/20">
              <Folder size={22} className="text-primary" />
            </div>
            <div>
              <h2
                id="claim-folder-prompt-title"
                className="text-base sm:text-lg font-semibold tracking-tight text-foreground"
              >
                Where should this claim&apos;s files be kept?
              </h2>
              <p
                id="claim-folder-prompt-desc"
                className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed"
              >
                Choose a folder on your PC for{' '}
                {regNo ? (
                  <span className="font-semibold text-foreground">{regNo}</span>
                ) : (
                  'this claim'
                )}{' '}
                to auto-save phone scans, RC/DL uploads, photo sheets, and
                generated PDF reports.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Informative Value Callout */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <FolderCheck size={14} className="text-emerald-500 shrink-0" />
            <span>One isolated folder per claim</span>
          </div>
          <p className="text-[11px] leading-relaxed pl-5.5 text-muted-foreground">
            Files stay 100% private on your PC. Never mixed up with other
            vehicles or insurers.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row-reverse items-stretch sm:items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={handlePickFolder}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Folder size={15} className="shrink-0" />
            )}
            <span>Select Folder for this Claim</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer text-center"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
