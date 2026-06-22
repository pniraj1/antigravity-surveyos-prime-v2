'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import type { SurveyorAdminProfile } from '../types';

interface DeleteAccountModalProps {
  surveyor: SurveyorAdminProfile;
  onConfirm: () => void;
  onCancel: () => void;
  processing: boolean;
}

export function DeleteAccountModal({ surveyor, onConfirm, onCancel, processing }: DeleteAccountModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const nameMatches = confirmName.trim() === surveyor.name.trim();

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(13,27,42,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-status-danger/10 flex items-center justify-center">
            <Trash2 size={18} className="text-status-danger" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Delete Account</h3>
            <p className="text-[11px] text-muted-foreground font-medium">{surveyor.name} — {surveyor.email}</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="p-4 rounded-xl border border-status-danger/20 bg-status-danger/5 flex items-start gap-3">
            <AlertTriangle size={16} className="text-status-danger mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-status-danger">This action is irreversible.</p>
              <p className="text-xs text-status-danger/80 font-medium">
                Deleting this account will permanently remove the surveyor&apos;s profile, all claims, and all payment records. This cannot be undone.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Type <span className="text-status-danger font-mono">{surveyor.name}</span> to confirm
            </label>
            <input
              type="text"
              placeholder={surveyor.name}
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none bg-neutral-50 border"
              style={{ borderColor: nameMatches ? 'var(--color-status-success)' : 'var(--color-neutral-200)', color: 'var(--color-neutral-900)' }}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-neutral-100 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!nameMatches || processing}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-medium bg-status-danger text-white hover:bg-status-danger/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={12} />
            {processing ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
