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
      className="rounded-2xl overflow-hidden"
      style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}
    >
      <div className="px-6 py-4" style={{ borderBottom: '1px solid #F0F2F5', background: '#FAFAFA' }}>
        <div className="text-sm font-black" style={{ color: '#0D1B2A' }}>Step 1 — Upload Final Workshop Bill</div>
        <div className="text-xs mt-0.5" style={{ color: '#8D99AE' }}>
          AI will extract the bill items to compare against allowed assessment
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: '#8D99AE' }}>
              Bill / Invoice No.
            </label>
            <input
              value={bc.billNo}
              onChange={e => onBillCheckChange({ billNo: e.target.value })}
              placeholder="INV-001"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ border: '1px solid #E2E6EA', color: '#0D1B2A', background: '#FAFAFA' }}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: '#8D99AE' }}>
              Bill Date
            </label>
            <input
              type="date"
              value={bc.billDate}
              onChange={e => onBillCheckChange({ billDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ border: '1px solid #E2E6EA', color: '#0D1B2A', background: '#FAFAFA' }}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{ color: '#8D99AE' }}>
              Total Bill Amount (₹)
            </label>
            <input
              type="number"
              value={bc.billTotal || ''}
              onChange={e => onBillCheckChange({ billTotal: Number(e.target.value) })}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ border: '1px solid #E2E6EA', color: '#0D1B2A', background: '#FAFAFA' }}
            />
          </div>
        </div>

        <label
          className="relative flex items-center gap-3 px-5 py-3 rounded-xl cursor-pointer transition-all"
          style={{
            background: 'rgba(13,27,42,0.04)',
            border: '1.5px dashed #C3C9D4',
            pointerEvents: isProcessing ? 'none' : 'auto',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.background = 'rgba(212,175,55,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#C3C9D4'; e.currentTarget.style.background = 'rgba(13,27,42,0.04)'; }}
        >
          <input
            type="file"
            className="absolute inset-0 opacity-0 cursor-pointer"
            accept="image/*,application/pdf"
            onChange={onFileUpload}
            disabled={isProcessing}
          />
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37' }}>
            {isProcessing ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: '#0D1B2A' }}>
              {isProcessing ? progress || 'Scanning bill…' : 'Upload Final Workshop Bill'}
            </div>
            <div className="text-xs" style={{ color: '#8D99AE' }}>
              {isProcessing ? 'AI is reading the bill…' : 'Image or PDF — AI extracts all line items'}
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}
