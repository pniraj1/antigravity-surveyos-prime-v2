'use client';

import React from 'react';
import { CloudUpload, X } from 'lucide-react';

interface SaveToCloudDialogProps {
  fileLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SaveToCloudDialog({ fileLabel, onConfirm, onCancel }: SaveToCloudDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200 bg-card border border-border">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-status-info-tint, rgba(59,130,246,0.1))' }}
          >
            <CloudUpload size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground">Save to Drive?</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Save <span className="font-medium text-foreground">&ldquo;{fileLabel}&rdquo;</span> to this claim&apos;s
              Google Drive folder?
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-medium bg-primary text-primary-foreground transition-all hover:scale-[1.01]"
          >
            <CloudUpload size={14} />
            Save to Drive
          </button>
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            <X size={14} />
            Don&apos;t save
          </button>
        </div>
      </div>
    </div>
  );
}
