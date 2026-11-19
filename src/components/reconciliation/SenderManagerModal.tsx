'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Plus,
  Trash2,
  RotateCcw,
  ShieldCheck,
  Building,
  Check,
} from 'lucide-react';
import type { InsurerSenderConfig } from '@/types/payment-reconciliation';
import {
  loadSavedSenders,
  saveSender,
  removeSender,
  resetSendersToDefault,
} from '@/lib/reconciliation/sample-store';
import { toast } from 'sonner';

export interface SenderManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendersUpdated?: (senders: InsurerSenderConfig[]) => void;
}

export function SenderManagerModal({
  isOpen,
  onClose,
  onSendersUpdated,
}: SenderManagerModalProps) {
  const [senders, setSenders] = useState<InsurerSenderConfig[]>(() => loadSavedSenders());
  const [newEmail, setNewEmail] = useState('');
  const [newInsurer, setNewInsurer] = useState('');
  const [newKeywords, setNewKeywords] = useState('');

  // Re-sync when modal opens
  useEffect(() => {
    if (isOpen) {
      setSenders(loadSavedSenders());
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    const insurer = newInsurer.trim();
    if (!email || !insurer) {
      toast.error('Please enter both sender email and insurer name.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    const keywords = newKeywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const updated = saveSender({
      email,
      insurerName: insurer,
      subjectKeywords: keywords.length > 0 ? keywords : ['Payment', 'Advice'],
      lastUsed: new Date().toISOString(),
    });

    setSenders(updated);
    setNewEmail('');
    setNewInsurer('');
    setNewKeywords('');
    toast.success(`Added ${email} to verified senders`);
    onSendersUpdated?.(updated);
  };

  const handleRemove = (email: string) => {
    const updated = removeSender(email);
    setSenders(updated);
    toast.info(`Removed ${email}`);
    onSendersUpdated?.(updated);
  };

  const handleReset = () => {
    const updated = resetSendersToDefault();
    setSenders(updated);
    toast.success('Reset verified senders to defaults');
    onSendersUpdated?.(updated);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sender-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="sender-modal-title"
                className="text-base font-semibold text-foreground"
              >
                Verified Insurer Senders
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage trusted email addresses used to fetch payment advice emails from Gmail
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-neutral-100 transition-colors"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Add New Sender Form */}
          <form
            onSubmit={handleAdd}
            className="rounded-xl border border-border bg-neutral-50 p-4 space-y-3"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Sender</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Sender Email Address *
                </label>
                <input
                  type="email"
                  placeholder="e.g. payments@insurance.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs bg-white border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Insurer / Company Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. HDFC ERGO General Insurance"
                  value={newInsurer}
                  onChange={(e) => setNewInsurer(e.target.value)}
                  className="w-full text-xs bg-white border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 shadow-2xs"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Subject Keywords (Optional, comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Payment, Advice, NEFT, Surveyor"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                className="w-full text-xs bg-white border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 shadow-2xs"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-amber-500 hover:bg-amber-600 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Sender</span>
              </button>
            </div>
          </form>

          {/* Senders List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Configured Senders ({senders.length})
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {senders.map((s) => (
                <div
                  key={s.email}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-white text-xs hover:border-amber-400/50 shadow-2xs transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">
                        {s.insurerName}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {s.email}
                      </div>
                      {s.subjectKeywords && s.subjectKeywords.length > 0 && (
                        <div className="flex items-center flex-wrap gap-1 mt-1">
                          {s.subjectKeywords.map((kw, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 text-[9px] rounded bg-neutral-100 text-neutral-600"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(s.email)}
                    className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                    title={`Remove ${s.email}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-border bg-neutral-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-border bg-white hover:bg-neutral-100 text-foreground transition-colors shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
