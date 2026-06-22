'use client';

import React, { useState } from 'react';
import { XCircle } from 'lucide-react';

interface DismissModalProps {
  uid: string;
  email: string;
  name: string;
  onConfirm: (uid: string, email: string, name: string, reason: string, sendEmail: boolean) => void;
  onCancel: () => void;
}

export function DismissModal({ uid, email, name, onConfirm, onCancel }: DismissModalProps) {
  const [dismissReason, setDismissReason] = useState('');
  const [sendEmailOnDismiss, setSendEmailOnDismiss] = useState(true);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(13,27,42,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-status-danger-tint flex items-center justify-center">
            <XCircle size={18} className="text-status-danger" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Dismiss Request</h3>
            <p className="text-[11px] text-muted-foreground font-medium">{name} — {email}</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Reason / Admin Note</label>
            <textarea
              rows={4}
              placeholder="e.g. IRDAI licence number appears invalid. Please re-enter your correct licence number and resubmit."
              value={dismissReason}
              onChange={e => setDismissReason(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none bg-neutral-50 border border-border text-foreground"
              style={{ lineHeight: '1.6' }}
            />
            <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">
              This message will be shown to the surveyor on their registration form so they know what to fix.
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendEmailOnDismiss}
              onChange={e => setSendEmailOnDismiss(e.target.checked)}
              className="w-4 h-4 rounded accent-status-danger"
            />
            <span className="text-xs font-medium text-foreground">
              Also send email notification to <span className="text-status-danger">{email}</span>
            </span>
          </label>
          {sendEmailOnDismiss && (
            <p className="text-[10px] text-muted-foreground font-medium -mt-1">
              Email will be sent from <strong>surveyosprime@gmail.com</strong> once the Firebase Trigger Email extension is configured.
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-neutral-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(uid, email, name, dismissReason, sendEmailOnDismiss)}
            className="px-5 py-2 rounded-xl text-xs font-medium bg-status-danger-tint text-status-danger hover:bg-red-200 transition-all"
          >
            <XCircle size={12} className="inline mr-1.5" />
            Dismiss Request
          </button>
        </div>
      </div>
    </div>
  );
}
