'use client';

import { Eye, Upload, RefreshCw, X } from 'lucide-react';
import type { DriveFile } from '@/lib/drive/list-cache';

interface DuplicateUploadDialogProps {
  existingFile: DriveFile;
  incomingFileName: string;
  onViewExisting: () => void;
  onUploadAnyway: () => void;
  onReplace: () => void;
  onClose: () => void;
}

export function DuplicateUploadDialog({
  existingFile,
  incomingFileName,
  onViewExisting,
  onUploadAnyway,
  onReplace,
  onClose,
}: DuplicateUploadDialogProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid rgba(13,27,42,0.12)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #0D1B2A 0%, #1e3a5f 100%)' }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: '#D4AF37' }}>
              File Already in Drive
            </p>
            <p className="text-sm font-semibold" style={{ color: '#F8F9FA' }}>
              {existingFile.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'rgba(248,249,250,0.6)' }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm mb-5" style={{ color: '#4A4E69' }}>
            A file named <span className="font-semibold">{incomingFileName}</span> already exists
            in this claim&apos;s Drive folder. What would you like to do?
          </p>

          <div className="flex flex-col gap-3">
            {/* View existing — default focus */}
            <button
              autoFocus
              onClick={onViewExisting}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-colors"
              style={{
                background: 'rgba(13,27,42,0.06)',
                border: '1.5px solid rgba(13,27,42,0.15)',
                color: '#0D1B2A',
              }}
            >
              <Eye size={16} style={{ color: '#0D1B2A', flexShrink: 0 }} />
              <div>
                <div className="font-semibold">View existing</div>
                <div className="text-xs mt-0.5" style={{ color: '#4A4E69' }}>
                  Open the file already in Drive — no upload needed
                </div>
              </div>
            </button>

            {/* Upload anyway */}
            <button
              onClick={onUploadAnyway}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-colors"
              style={{
                background: 'rgba(74,78,105,0.06)',
                border: '1.5px solid rgba(74,78,105,0.15)',
                color: '#4A4E69',
              }}
            >
              <Upload size={16} style={{ flexShrink: 0 }} />
              <div>
                <div className="font-semibold">Upload anyway</div>
                <div className="text-xs mt-0.5">
                  Add as a new copy (will be renamed automatically)
                </div>
              </div>
            </button>

            {/* Replace */}
            <button
              onClick={onReplace}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-colors"
              style={{
                background: 'rgba(212,175,55,0.06)',
                border: '1.5px solid rgba(212,175,55,0.2)',
                color: '#92731c',
              }}
            >
              <RefreshCw size={16} style={{ flexShrink: 0 }} />
              <div>
                <div className="font-semibold">Replace existing</div>
                <div className="text-xs mt-0.5">
                  Overwrite the file in Drive with the new version
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
