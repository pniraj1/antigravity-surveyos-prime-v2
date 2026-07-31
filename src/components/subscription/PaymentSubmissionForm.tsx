'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { submitPayment, getUserPayments } from '@/lib/firebase/payments';
import { PLANS, type Plan } from '@/lib/subscription/plans';
import type { PaymentRecord } from '@/types/payment';
import { CreditCard, CheckCircle, XCircle, Clock, Send, Camera, X } from 'lucide-react';

/**
 * Downscale a payment screenshot to a small JPEG data URL.
 *
 * Stored inline on the Firestore payment doc (this app deliberately uses no
 * Firebase Storage), so it must stay well under the 1 MiB document limit —
 * 1000px @ q0.7 lands a phone screenshot around 80–200 KB.
 */
async function screenshotToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.7);
  if (url.length > 700_000) {
    throw new Error('Screenshot too large even after compression. Please crop it and try again.');
  }
  return url;
}

interface PaymentSubmissionFormProps {
  /** Set when the surrounding page already lists payment history (ProfileTab). */
  hideHistory?: boolean;
}

export function PaymentSubmissionForm({ hideHistory = false }: PaymentSubmissionFormProps) {
  const user = useAuthStore((s) => s.user);
  const [plan, setPlan] = useState<Plan>(PLANS[0]);
  const [amount, setAmount] = useState(String(PLANS[0].amount));
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState('');
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

  const selectPlan = (p: Plan) => {
    setPlan(p);
    setAmount(String(p.amount));
  };

  async function handleScreenshot(file: File | undefined) {
    setScreenshotError('');
    if (!file) return;
    try {
      setScreenshot(await screenshotToDataUrl(file));
    } catch (err: unknown) {
      setScreenshotError(err instanceof Error ? err.message : 'Could not read the screenshot.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.uid || !amount || !transactionId) return;

    setSubmitting(true);
    try {
      await submitPayment(user.uid, {
        amount: parseFloat(amount),
        transactionId: transactionId.trim(),
        paymentDate,
        notes: `${plan.label} plan (${plan.months} month${plan.months > 1 ? 's' : ''})`,
        screenshotUrl: screenshot,
      });
      setSubmitted(true);
      setTransactionId('');
      setScreenshot(null);
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
            {/* Plan selector — renders whatever plans.ts declares */}
            {PLANS.length > 1 && (
              <div className="grid grid-cols-3 gap-2">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPlan(p)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      plan.id === p.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="text-xs font-medium text-foreground">{p.label}</div>
                    <div className="text-sm font-medium text-primary-foreground">₹{p.amount}</div>
                    {p.note && <div className="text-[10px] text-status-success">{p.note}</div>}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="1"
                className="w-full px-4 py-3 bg-card border border-border rounded-lg text-primary-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {plan.label} plan — pay ₹{plan.amount} to the UPI ID shown above, then submit the details below.
              </p>
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

            {/* Payment screenshot — optional but speeds up verification */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">
                Payment Screenshot <span className="opacity-60">(optional, speeds up verification)</span>
              </label>
              {screenshot ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={screenshot} alt="Payment screenshot" className="h-24 rounded-lg border border-border" />
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-status-danger text-white"
                    aria-label="Remove screenshot"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 bg-card border border-dashed border-border rounded-lg text-muted-foreground text-sm cursor-pointer hover:border-primary/50 transition-colors">
                  <Camera size={16} />
                  Attach UPI success screenshot
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleScreenshot(e.target.files?.[0])}
                  />
                </label>
              )}
              {screenshotError && <p className="text-xs text-status-danger mt-1">{screenshotError}</p>}
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

      {!hideHistory && (
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
      )}
    </div>
  );
}
