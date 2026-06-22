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
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-card border border-border">
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-neutral-50 flex items-center justify-center">
            <Mail size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Send Email</h3>
            <p className="text-[11px] text-muted-foreground font-medium">To: {name} — {email}</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Subject</label>
            <input
              type="text"
              placeholder="e.g. Additional Information Required"
              value={customSubject}
              onChange={e => setCustomSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none bg-neutral-50 border border-border text-foreground"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Message</label>
            <textarea
              rows={5}
              placeholder="Type your message here..."
              value={customBody}
              onChange={e => setCustomBody(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none resize-none bg-neutral-50 border border-border text-foreground"
              style={{ lineHeight: '1.6' }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground font-medium">
            Sent from <strong>surveyosprime@gmail.com</strong> via Firebase Trigger Email.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
          <button
            onClick={() => { onCancel(); setCustomSubject(''); setCustomBody(''); }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-neutral-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sendingEmail || !customSubject.trim() || !customBody.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-40"
          >
            {sendingEmail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
            Send Email
          </button>
        </div>
      </div>
    </div>
  );
}
