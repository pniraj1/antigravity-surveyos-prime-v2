'use client';

import React, { useState } from 'react';
import { XCircle } from 'lucide-react';
import type { PaymentRecord } from '@/types/payment';

interface RejectPaymentModalProps {
  payment: PaymentRecord;
  onConfirm: (payment: PaymentRecord, reason: string) => void;
  onCancel: () => void;
}

export function RejectPaymentModal({ payment, onConfirm, onCancel }: RejectPaymentModalProps) {
  const [rejectReason, setRejectReason] = useState('');

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(13,27,42,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-status-danger-tint flex items-center justify-center">
            <XCircle size={18} className="text-status-danger" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Reject Payment</h3>
            <p className="text-[11px] text-muted-foreground font-medium">₹{payment.amount} • {payment.transactionId}</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Reason</label>
            <textarea
              rows={3}
              placeholder="e.g. Transaction ID not found in records"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none bg-neutral-50 border border-border text-foreground"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-neutral-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(payment, rejectReason.trim() || 'Payment rejected by admin.')}
            className="px-5 py-2 rounded-xl text-xs font-medium bg-status-danger text-white hover:bg-red-700 transition-all"
          >
            <XCircle size={12} className="inline mr-1.5" />
            Reject Payment
          </button>
        </div>
      </div>
    </div>
  );
}
