'use client';

import React from 'react';
import { Loader2, CreditCard, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { SurveyorAdminProfile, PaymentFilter } from '../types';
import type { PaymentRecord } from '@/types/payment';

interface PaymentsTabProps {
  payments: PaymentRecord[];
  surveyors: SurveyorAdminProfile[];
  loading: boolean;
  paymentFilter: PaymentFilter;
  setPaymentFilter: (f: PaymentFilter) => void;
  onVerify: (payment: PaymentRecord) => void;
  onReject: (payment: PaymentRecord) => void;
}

export function PaymentsTab({
  payments,
  surveyors,
  loading,
  paymentFilter,
  setPaymentFilter,
  onVerify,
  onReject,
}: PaymentsTabProps) {
  const visiblePayments = payments.filter(p => paymentFilter === 'all' || p.status === paymentFilter);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        {(['all', 'pending', 'verified', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setPaymentFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              paymentFilter === f
                ? 'bg-[#0D1B2A] text-white'
                : 'bg-white border border-[#E2E6EA] text-[#8D99AE] hover:text-[#0D1B2A]'
            }`}
          >
            {f} {f !== 'all' && `(${payments.filter(p => p.status === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary opacity-20 mb-4" />
          <p className="text-sm font-bold text-[#8D99AE]">Loading Payments...</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E6EA] shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#FAFBFC] border-b border-[#E2E6EA]">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">User</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Transaction ID</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Date</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F2F5]">
              {visiblePayments.map((payment) => {
                const matchedUser = surveyors.find(s => s.id === payment.userUid);
                return (
                  <tr key={`${payment.userUid}-${payment.id}`} className="hover:bg-[#FAFBFC] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-[#0D1B2A]">{matchedUser?.name || payment.userName || 'Unknown'}</div>
                      <div className="text-xs text-[#8D99AE]">{matchedUser?.email || payment.userEmail || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-[#0D1B2A]">₹{payment.amount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono bg-[#F0F2F5] px-2 py-1 rounded">{payment.transactionId}</code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-[#0D1B2A]">{new Date(payment.submittedAt).toLocaleDateString('en-IN')}</div>
                      <div className="text-[10px] text-[#8D99AE]">{payment.paymentDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                        payment.status === 'verified'
                          ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]'
                          : payment.status === 'rejected'
                          ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
                          : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                      }`}>
                        {payment.status === 'verified' ? <CheckCircle2 size={10} /> : payment.status === 'rejected' ? <XCircle size={10} /> : <Clock size={10} />}
                        {payment.status}
                        {payment.durationGranted && ` (+${payment.durationGranted}d)`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {payment.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onVerify(payment)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#D1FAE5] text-[#065F46] hover:bg-[#A7F3D0] transition-all"
                          >
                            <CheckCircle2 size={10} className="inline mr-1" />
                            Verify
                          </button>
                          <button
                            onClick={() => onReject(payment)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all"
                          >
                            <XCircle size={10} className="inline mr-1" />
                            Reject
                          </button>
                        </div>
                      )}
                      {payment.status === 'rejected' && payment.notes && (
                        <span className="text-[10px] text-red-500">{payment.notes}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visiblePayments.length === 0 && (
            <div className="py-16 text-center">
              <CreditCard size={32} className="text-[#8D99AE] mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold text-[#8D99AE]">No {paymentFilter !== 'all' ? paymentFilter : ''} payments found</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
