'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { submitPayment, getUserPayments } from '@/lib/firebase/payments';
import type { PaymentRecord } from '@/types/payment';
import { CreditCard, CheckCircle, XCircle, Clock, Send } from 'lucide-react';

export function PaymentSubmissionForm() {
  const user = useAuthStore((s) => s.user);
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    getUserPayments(user.uid)
      .then(setPayments)
      .finally(() => setLoadingHistory(false));
  }, [user?.uid, submitted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid || !amount || !transactionId) return;

    setSubmitting(true);
    try {
      await submitPayment(user.uid, {
        amount: parseFloat(amount),
        transactionId: transactionId.trim(),
        paymentDate,
        notes: '',
        screenshotUrl: null,
      });
      setSubmitted(true);
      setAmount('');
      setTransactionId('');
    } finally {
      setSubmitting(false);
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle size={14} className="text-emerald-400" />;
      case 'rejected': return <XCircle size={14} className="text-red-400" />;
      default: return <Clock size={14} className="text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <CreditCard size={20} />
          Submit Payment
        </h3>

        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle size={48} className="text-emerald-400 mx-auto" />
            <p className="text-emerald-300 font-bold">Payment submitted successfully!</p>
            <p className="text-slate-400 text-sm">Admin will verify and activate your account shortly.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-sm text-[#D4AF37] hover:underline mt-2"
            >
              Submit another payment
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="999"
                required
                min="1"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">UPI Transaction ID</label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. 412345678901"
                required
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-3 bg-[#D4AF37] text-[#0D1B2A] font-bold rounded-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
              <Send size={16} />
              {submitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </form>
        )}
      </div>

      <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50">
        <h3 className="text-sm font-bold text-slate-300 mb-3">Payment History</h3>
        {loadingHistory ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-xs text-slate-500">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/30"
              >
                <div className="flex items-center gap-2">
                  {statusIcon(p.status)}
                  <div>
                    <span className="text-sm font-bold text-white">₹{p.amount}</span>
                    <span className="text-xs text-slate-400 ml-2">{p.transactionId}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">
                    {new Date(p.submittedAt).toLocaleDateString()}
                  </span>
                  {p.status === 'verified' && p.durationGranted && (
                    <p className="text-xs text-emerald-400">+{p.durationGranted} days</p>
                  )}
                  {p.status === 'rejected' && p.notes && (
                    <p className="text-xs text-red-400">{p.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
