'use client';

import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Search,
  Check,
  User,
  X,
  Loader2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import type { SurveyorAdminProfile } from '../types';

interface RecordOfflinePaymentModalProps {
  surveyors: SurveyorAdminProfile[];
  onClose: () => void;
  onRecord: (
    userUid: string,
    data: {
      amount: number;
      transactionId?: string;
      durationDays: number;
      paymentMode?: string;
      adminNotes?: string;
      planName?: string;
    }
  ) => Promise<void>;
  initialSurveyorId?: string;
}

const DURATION_PRESETS = [
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '180 Days', days: 180 },
  { label: '365 Days', days: 365 },
];

const PAYMENT_MODES = ['UPI', 'NEFT/Bank', 'Cash', 'Other'];

export function RecordOfflinePaymentModal({
  surveyors,
  onClose,
  onRecord,
  initialSurveyorId,
}: RecordOfflinePaymentModalProps) {
  const [selectedSurveyorId, setSelectedSurveyorId] = useState<string>(initialSurveyorId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [amount, setAmount] = useState<string>('1999');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [transactionId, setTransactionId] = useState<string>('');
  const [planName, setPlanName] = useState<string>('Prime Plan');
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSurveyor = useMemo(
    () => surveyors.find(s => s.id === selectedSurveyorId),
    [surveyors, selectedSurveyorId]
  );

  const filteredSurveyors = useMemo(() => {
    if (!searchQuery.trim()) return surveyors.slice(0, 8);
    const q = searchQuery.toLowerCase().trim();
    return surveyors.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        s.id.toLowerCase().includes(q) ||
        (s.surveyorId && s.surveyorId.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [surveyors, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedSurveyorId) {
      setError('Please select a surveyor.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    const effectiveDuration = customDuration ? parseInt(customDuration, 10) : durationDays;
    if (isNaN(effectiveDuration) || effectiveDuration < 1) {
      setError('Duration must be at least 1 day.');
      return;
    }

    setSubmitting(true);
    try {
      await onRecord(selectedSurveyorId, {
        amount: parsedAmount,
        transactionId: transactionId.trim() || undefined,
        durationDays: effectiveDuration,
        paymentMode,
        adminNotes: adminNotes.trim() || undefined,
        planName: planName.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      console.error('Failed to record manual payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(13,27,42,0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden bg-card border border-border my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Record Offline / Manual Payment</h3>
              <p className="text-xs text-muted-foreground font-medium">
                Log manual payments &amp; automatically extend surveyor subscription.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 rounded-xl bg-status-danger-tint border border-status-danger text-status-danger text-xs font-medium flex items-center gap-2">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Surveyor Selection */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                Target Surveyor <span className="text-status-danger">*</span>
              </label>

              {selectedSurveyor ? (
                <div className="p-3 rounded-xl border border-border bg-[var(--color-neutral-50)] flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <User size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {selectedSurveyor.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {selectedSurveyor.email} • ID: {selectedSurveyor.surveyorId || selectedSurveyor.id.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSurveyorId('')}
                    disabled={submitting}
                    className="text-xs font-medium text-primary hover:underline ml-2 flex-shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      type="text"
                      placeholder="Search surveyor by name, email, or ID..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium outline-none border border-border bg-[var(--color-neutral-50)] text-foreground"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border bg-card">
                    {filteredSurveyors.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        No surveyors found matching &quot;{searchQuery}&quot;
                      </div>
                    ) : (
                      filteredSurveyors.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedSurveyorId(s.id);
                            setSearchQuery('');
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-[var(--color-neutral-50)] flex items-center justify-between transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{s.email || s.id}</div>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground ml-2">
                            {s.surveyorId || s.subscriptionStatus}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Amount & Plan Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Amount (₹) <span className="text-status-danger">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="1999"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm font-semibold outline-none border border-border bg-[var(--color-neutral-50)] text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Plan Name (Optional)
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  placeholder="e.g. Prime Annual, Pro Pass"
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-medium outline-none border border-border bg-[var(--color-neutral-50)] text-foreground"
                />
              </div>
            </div>

            {/* Duration to Grant */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Duration to Grant <span className="text-status-danger">*</span>
                </label>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {customDuration ? `${customDuration} days (custom)` : `${durationDays} days`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {DURATION_PRESETS.map(preset => {
                  const isSelected = !customDuration && durationDays === preset.days;
                  return (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => {
                        setDurationDays(preset.days);
                        setCustomDuration('');
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-medium transition-all border ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-[var(--color-neutral-50)] border-border text-foreground hover:border-neutral-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground" />
                <input
                  type="number"
                  min="1"
                  max="1000"
                  placeholder="Or enter custom days (e.g. 45)"
                  value={customDuration}
                  onChange={e => setCustomDuration(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium outline-none border border-border bg-[var(--color-neutral-50)] text-foreground"
                />
              </div>
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                Payment Mode
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_MODES.map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium transition-all border text-center ${
                      paymentMode === mode
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm'
                        : 'bg-[var(--color-neutral-50)] border-border text-foreground hover:border-neutral-400'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference / Transaction ID */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                Transaction / Reference ID
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
                placeholder="Leave blank to auto-generate (e.g. OFFLINE-123456)"
                className="w-full px-3 py-2.5 rounded-xl text-xs font-mono font-medium outline-none border border-border bg-[var(--color-neutral-50)] text-foreground"
              />
            </div>

            {/* Admin Notes */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                Admin Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Received via cheque #45124, authorized promotional waiver, verified with ICICI Bank branch"
                className="w-full px-3 py-2.5 rounded-xl text-xs font-medium outline-none border border-border bg-[var(--color-neutral-50)] text-foreground resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 bg-[var(--color-neutral-50)]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedSurveyorId}
              className="px-5 py-2 rounded-xl text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Record &amp; Activate
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
