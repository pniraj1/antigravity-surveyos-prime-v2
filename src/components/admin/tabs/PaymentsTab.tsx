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
            className={`px-4 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-all ${
              paymentFilter === f
                ? 'bg-[var(--color-neutral-900)] text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f} {f !== 'all' && `(${payments.filter(p => p.status === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={40} className="animate-spin text-primary opacity-20 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Loading Payments...</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--color-neutral-50)] border-b border-border">
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">User</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Transaction ID</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-neutral-100)]">
              {visiblePayments.map((payment) => {
                const matchedUser = surveyors.find(s => s.id === payment.userUid);
                return (
                  <tr key={`${payment.userUid}-${payment.id}`} className="hover:bg-[var(--color-neutral-50)] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{matchedUser?.name || payment.userName || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{matchedUser?.email || payment.userEmail || ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground">₹{payment.amount}</span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono bg-[var(--color-neutral-100)] px-2 py-1 rounded">{payment.transactionId}</code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">{new Date(payment.submittedAt).toLocaleDateString('en-IN')}</div>
                      <div className="text-[10px] text-muted-foreground">{payment.paymentDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wider border ${
                        payment.status === 'verified'
                          ? 'bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] border-[var(--color-status-success)]'
                          : payment.status === 'rejected'
                          ? 'bg-[var(--color-status-danger-tint)] text-[var(--color-status-danger)] border-[var(--color-status-danger)]'
                          : 'bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)] border-[var(--color-status-warning)]'
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
                            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-status-success-tint)] text-[var(--color-status-success)] hover:bg-[var(--color-status-success)] hover:text-primary-foreground transition-all"
                          >
                            <CheckCircle2 size={10} className="inline mr-1" />
                            Verify
                          </button>
                          <button
                            onClick={() => onReject(payment)}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[var(--color-status-danger-tint)] text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger)] hover:text-primary-foreground transition-all"
                          >
                            <XCircle size={10} className="inline mr-1" />
                            Reject
                          </button>
                        </div>
                      )}
                      {payment.status === 'rejected' && payment.notes && (
                        <span className="text-[10px] text-[var(--color-status-danger)]">{payment.notes}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visiblePayments.length === 0 && (
            <div className="py-16 text-center">
              <CreditCard size={32} className="text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-muted-foreground">No {paymentFilter !== 'all' ? paymentFilter : ''} payments found</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
