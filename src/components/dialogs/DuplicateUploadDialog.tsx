'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Copy, X } from 'lucide-react';

interface DuplicateUploadDialogProps {
  fileName: string;
  suffixedName: string;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export function DuplicateUploadDialog({
  fileName,
  suffixedName,
  onReplace,
  onKeepBoth,
  onCancel,
}: DuplicateUploadDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200"
        style={{ background: '#fff', border: '1px solid rgba(13,27,42,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.1)' }}
          >
            <AlertTriangle size={20} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#0D1B2A]">File Already Exists</h2>
            <p className="text-xs text-[#8D99AE] mt-1 leading-relaxed">
              A file named <span className="font-bold text-[#0D1B2A]">&ldquo;{fileName}&rdquo;</span> already
              exists in this claim&apos;s Drive folder.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onReplace}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #f0d870)',
              color: '#0D1B2A',
            }}
          >
            <RefreshCw size={14} />
            Replace existing file
          </button>
          <button
            onClick={onKeepBoth}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border border-[#E2E6EA] text-[#0D1B2A] hover:bg-[#FAFBFC] transition-all"
          >
            <Copy size={14} />
            Keep both &mdash; upload as &ldquo;{suffixedName}&rdquo;
          </button>
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-[#8D99AE] hover:text-[#0D1B2A] transition-all"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
