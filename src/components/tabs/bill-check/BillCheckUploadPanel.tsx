'use client';

import { Sparkles, Loader2 } from 'lucide-react';

interface BillCheckData {
  billNo: string;
  billDate: string;
  billTotal: number;
}

interface Props {
  bc: BillCheckData;
  onBillCheckChange: (updates: Partial<BillCheckData>) => void;
  isProcessing: boolean;
  progress: string;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function BillCheckUploadPanel({ bc, onBillCheckChange, isProcessing, progress, onFileUpload }: Props) {
  return (
    <div
      className="rounded-2xl overflow-hidden bg-card border border-border"
    >
      <div className="px-6 py-4 border-b border-border bg-neutral-50">
        <div className="text-sm font-medium text-foreground">Step 1 — Upload Final Workshop Bill</div>
        <div className="text-xs mt-0.5 text-muted-foreground">
          AI will extract the bill items to compare against allowed assessment
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[10px] font-medium uppercase tracking-widest block mb-1 text-muted-foreground">
              Bill / Invoice No.
            </label>
            <input
              value={bc.billNo}
              onChange={e => onBillCheckChange({ billNo: e.target.value })}
              placeholder="INV-001"
              className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-neutral-50 text-foreground outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase tracking-widest block mb-1 text-muted-foreground">
              Bill Date
            </label>
            <input
              type="date"
              value={bc.billDate}
              onChange={e => onBillCheckChange({ billDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-neutral-50 text-foreground outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase tracking-widest block mb-1 text-muted-foreground">
              Total Bill Amount (₹)
            </label>
            <input
              type="number"
              value={bc.billTotal || ''}
              onChange={e => onBillCheckChange({ billTotal: Number(e.target.value) })}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-neutral-50 text-foreground outline-none"
            />
          </div>
        </div>

        <label
          className="relative flex items-center gap-3 px-5 py-3 rounded-xl cursor-pointer transition-all bg-neutral-950/5 border border-dashed border-border"
          style={{
            pointerEvents: isProcessing ? 'none' : 'auto',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.background = 'rgb(212 175 55 / 0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'rgb(13 27 42 / 0.04)'; }}
        >
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            accept="image/*,application/pdf"
            onChange={onFileUpload}
            disabled={isProcessing}
          />
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
            {isProcessing ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              {isProcessing ? progress || 'Scanning bill…' : 'Upload Final Workshop Bill'}
            </div>
            <div className="text-xs text-muted-foreground">
              {isProcessing ? 'AI is reading the bill…' : 'Image or PDF — AI extracts all line items'}
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}
