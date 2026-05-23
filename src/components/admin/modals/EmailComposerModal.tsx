'use client';

import React, { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';

interface EmailComposerModalProps {
  email: string;
  name: string;
  onSend: (email: string, name: string, subject: string, body: string) => Promise<void>;
  onCancel: () => void;
}

export function EmailComposerModal({ email, name, onSend, onCancel }: EmailComposerModalProps) {
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSend = async () => {
    if (!customSubject.trim() || !customBody.trim()) return;
    setSendingEmail(true);
    try {
      await onSend(email, name, customSubject, customBody);
      setCustomSubject('');
      setCustomBody('');
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to queue email. Check console.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" style={{ background: 'rgba(13,27,42,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E6EA' }}>
        <div className="px-6 py-5 border-b border-[#F0F2F5] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Mail size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#0D1B2A]">Send Email</h3>
            <p className="text-[11px] text-[#8D99AE] font-semibold">To: {name} — {email}</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-2">Subject</label>
            <input
              type="text"
              placeholder="e.g. Additional Information Required"
              value={customSubject}
              onChange={e => setCustomSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none"
              style={{ background: '#F8F9FA', border: '1px solid #E2E6EA', color: '#0D1B2A' }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-2">Message</label>
            <textarea
              rows={5}
              placeholder="Type your message here..."
              value={customBody}
              onChange={e => setCustomBody(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none"
              style={{ background: '#F8F9FA', border: '1px solid #E2E6EA', color: '#0D1B2A', lineHeight: '1.6' }}
            />
          </div>
          <p className="text-[10px] text-[#8D99AE] font-semibold">
            Sent from <strong>surveyosprime@gmail.com</strong> via Firebase Trigger Email.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-[#F0F2F5] flex gap-3 justify-end">
          <button
            onClick={() => { onCancel(); setCustomSubject(''); setCustomBody(''); }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-[#8D99AE] hover:bg-[#F0F2F5] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sendingEmail || !customSubject.trim() || !customBody.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-40"
          >
            {sendingEmail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}
