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
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
        <div className="px-6 py-5 border-b border-[#F0F2F5] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <XCircle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#0D1B2A]">Reject Payment</h3>
            <p className="text-[11px] text-[#8D99AE] font-semibold">₹{payment.amount} • {payment.transactionId}</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-2">Reason</label>
            <textarea
              rows={3}
              placeholder="e.g. Transaction ID not found in records"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none"
              style={{ background: '#F8F9FA', border: '1px solid #E2E6EA', color: '#0D1B2A' }}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#F0F2F5] flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#8D99AE] hover:bg-[#F0F2F5] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(payment, rejectReason.trim() || 'Payment rejected by admin.')}
            className="px-5 py-2 rounded-xl text-xs font-black bg-red-600 text-white hover:bg-red-700 transition-all"
          >
            <XCircle size={12} className="inline mr-1.5" />
            Reject Payment
          </button>
        </div>
      </div>
    </div>
  );
}
