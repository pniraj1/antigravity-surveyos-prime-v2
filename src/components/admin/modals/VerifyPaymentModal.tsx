'use client';

import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { PaymentRecord } from '@/types/payment';

interface VerifyPaymentModalProps {
  payment: PaymentRecord;
  onConfirm: (payment: PaymentRecord, duration: number) => void;
  onCancel: () => void;
}

export function VerifyPaymentModal({ payment, onConfirm, onCancel }: VerifyPaymentModalProps) {
  const [verifyDuration, setVerifyDuration] = useState('30');

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(13,27,42,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Verify Payment</h3>
            <p className="text-[11px] text-muted-foreground font-medium">₹{payment.amount} • {payment.transactionId}</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Duration to Grant (days)</label>
            <input
              type="number"
              value={verifyDuration}
              onChange={e => setVerifyDuration(e.target.value)}
              min="1"
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
              style={{ background: 'var(--color-neutral-50)', border: '1px solid var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}
            />
            <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">
              User&apos;s subscription will be extended by this many days from today (or current expiry if still valid).
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-[#F0F2F5] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(payment, parseInt(verifyDuration) || 30)}
            className="px-5 py-2 rounded-xl text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
          >
            <CheckCircle2 size={12} className="inline mr-1.5" />
            Confirm & Extend
          </button>
        </div>
      </div>
    </div>
  );
}
