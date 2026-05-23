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
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
        <div className="px-6 py-5 border-b border-[#F0F2F5] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <XCircle size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#0D1B2A]">Dismiss Request</h3>
            <p className="text-[11px] text-[#8D99AE] font-semibold">{name} — {email}</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-2">Reason / Admin Note</label>
            <textarea
              rows={4}
              placeholder="e.g. IRDAI licence number appears invalid. Please re-enter your correct licence number and resubmit."
              value={dismissReason}
              onChange={e => setDismissReason(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none"
              style={{ background: '#F8F9FA', border: '1px solid #E2E6EA', color: '#0D1B2A', lineHeight: '1.6' }}
            />
            <p className="text-[10px] text-[#8D99AE] mt-1.5 font-semibold">
              This message will be shown to the surveyor on their registration form so they know what to fix.
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendEmailOnDismiss}
              onChange={e => setSendEmailOnDismiss(e.target.checked)}
              className="w-4 h-4 rounded accent-red-500"
            />
            <span className="text-xs font-bold text-[#0D1B2A]">
              Also send email notification to <span className="text-red-600">{email}</span>
            </span>
          </label>
          {sendEmailOnDismiss && (
            <p className="text-[10px] text-[#8D99AE] font-semibold -mt-1">
              Email will be sent from <strong>surveyosprime@gmail.com</strong> once the Firebase Trigger Email extension is configured.
            </p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[#F0F2F5] flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#8D99AE] hover:bg-[#F0F2F5] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(uid, email, name, dismissReason, sendEmailOnDismiss)}
            className="px-5 py-2 rounded-xl text-xs font-black bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA] transition-all"
          >
            <XCircle size={12} className="inline mr-1.5" />
            Dismiss Request
          </button>
        </div>
      </div>
    </div>
  );
}
