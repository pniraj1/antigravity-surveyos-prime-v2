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
      case 'verified': return <CheckCircle size={14} className="text-status-success" />;
      case 'rejected': return <XCircle size={14} className="text-status-danger" />;
      default: return <Clock size={14} className="text-status-warning" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-card rounded-2xl border border-border">
        <h3 className="text-lg font-medium text-primary-foreground mb-4 flex items-center gap-2">
          <CreditCard size={20} />
          Submit Payment
        </h3>

        {submitted ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle size={48} className="text-status-success mx-auto" />
            <p className="text-status-success font-medium">Payment submitted successfully!</p>
            <p className="text-muted-foreground text-sm">Admin will verify and activate your account shortly.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-sm text-primary hover:underline mt-2"
            >
              Submit another payment
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="999"
                required
                min="1"
                className="w-full px-4 py-3 bg-card border border-border rounded-lg text-primary-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">UPI Transaction ID</label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. 412345678901"
                required
                className="w-full px-4 py-3 bg-card border border-border rounded-lg text-primary-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-4 py-3 bg-card border border-border rounded-lg text-primary-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
              <Send size={16} />
              {submitting ? 'Submitting...' : 'Submit Payment'}
            </button>
          </form>
        )}
      </div>

      <div className="p-6 bg-card rounded-2xl border border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">Payment History</h3>
        {loadingHistory ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
              >
                <div className="flex items-center gap-2">
                  {statusIcon(p.status)}
                  <div>
                    <span className="text-sm font-medium text-primary-foreground">₹{p.amount}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.transactionId}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.submittedAt).toLocaleDateString()}
                  </span>
                  {p.status === 'verified' && p.durationGranted && (
                    <p className="text-xs text-status-success">+{p.durationGranted} days</p>
                  )}
                  {p.status === 'rejected' && p.notes && (
                    <p className="text-xs text-status-danger">{p.notes}</p>
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
