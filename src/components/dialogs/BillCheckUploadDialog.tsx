'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface BillCheckUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File, kind: 'final-bill' | 'estimate') => void;
  defaultKind?: 'final-bill' | 'estimate';
  isProcessing?: boolean;
}

export function handleDialogKeyDown(
  e: { key: string },
  { onClose, isProcessing = false }: { onClose: () => void; isProcessing?: boolean }
) {
  if (e.key === 'Escape' && !isProcessing) {
    onClose();
  }
}

export function BillCheckUploadDialog({
  isOpen,
  onClose,
  onConfirm,
  defaultKind = 'final-bill',
  isProcessing = false,
}: BillCheckUploadDialogProps) {
  const [selectedKind, setSelectedKind] = useState<'final-bill' | 'estimate'>(defaultKind);
  const [prevDefaultKind, setPrevDefaultKind] = useState<'final-bill' | 'estimate'>(defaultKind);
  if (defaultKind !== prevDefaultKind) {
    setPrevDefaultKind(defaultKind);
    setSelectedKind(defaultKind);
  }
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Chrome Modern Web Guidance: Close dialog on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      handleDialogKeyDown(e, { onClose, isProcessing });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isProcessing]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    onConfirm(selectedFile, selectedKind);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-primary flex items-center justify-center shrink-0 border border-amber-300/60">
              <Upload size={20} />
            </div>
            <div>
              <h2 id="upload-dialog-title" className="text-base font-bold text-foreground">
                Upload Document for Bill Check
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select document type and upload your file for AI extraction &amp; reconciliation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5">
          {/* Document Type Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground">
              What type of document are you uploading?
            </label>
            <div
              role="radiogroup"
              aria-label="Document type"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {/* Option 1: Final Bill */}
              <div
                role="radio"
                aria-checked={selectedKind === 'final-bill'}
                tabIndex={0}
                onClick={() => setSelectedKind('final-bill')}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setSelectedKind('final-bill')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-2 select-none ${
                  selectedKind === 'final-bill'
                    ? 'border-primary bg-amber-50/60 dark:bg-amber-950/20 shadow-xs'
                    : 'border-border hover:border-amber-300 bg-white dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className={selectedKind === 'final-bill' ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-xs font-bold text-foreground">Final Bill / Invoice</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Workshop tax invoice. Match part numbers, verify rates, isolate disallowed items, and calculate savings.
                </p>
              </div>

              {/* Option 2: Estimate */}
              <div
                role="radio"
                aria-checked={selectedKind === 'estimate'}
                tabIndex={0}
                onClick={() => setSelectedKind('estimate')}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setSelectedKind('estimate')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-2 select-none ${
                  selectedKind === 'estimate'
                    ? 'border-primary bg-amber-50/60 dark:bg-amber-950/20 shadow-xs'
                    : 'border-border hover:border-amber-300 bg-white dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className={selectedKind === 'estimate' ? 'text-primary' : 'text-muted-foreground'} />
                  <span className="text-xs font-bold text-foreground">Repair Estimate</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Workshop quotation. Maps Est. S.No against the final bill when the assessment was built from the bill.
                </p>
              </div>
            </div>
          </div>

          {/* Dropzone / File Picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground">Select File (PDF or Image)</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              disabled={isProcessing}
            />

            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                  isDragging
                    ? 'border-primary bg-amber-50 dark:bg-amber-950/30'
                    : 'border-amber-300 hover:border-primary bg-amber-50/20 hover:bg-amber-50/40'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/60 text-primary flex items-center justify-center">
                  <Upload size={18} />
                </div>
                <div className="text-xs font-semibold text-foreground">
                  Click to choose file or drag &amp; drop
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Supports PDF invoices, scans, and multi-page camera captures
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-300/80 bg-amber-50/40 dark:bg-amber-950/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-primary flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate max-w-[280px]">
                      {selectedFile.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  disabled={isProcessing}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-amber-100/60 transition-colors"
                  aria-label="Remove chosen file"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted/40 border-t border-border flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isProcessing}
            className="text-xs h-9 px-4"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!selectedFile || isProcessing}
            className="bg-primary hover:bg-amber-600 text-white font-semibold text-xs h-9 px-5 gap-1.5 cursor-pointer shadow-xs"
          >
            <Upload size={14} />
            Start AI Reading
          </Button>
        </div>
      </div>
    </div>
  );
}
