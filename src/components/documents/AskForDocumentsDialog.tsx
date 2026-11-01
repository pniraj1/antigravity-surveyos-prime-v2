'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { askMessage, askSubject, mailtoUri, waLink, waNumber, type AskLang, type ContactRole } from '@/lib/chase/ask-message';
import { dialogDocs, istNow, preTicked, recipients } from '@/lib/chase/ask-dialog';

const LANGS: [AskLang, string][] = [['en', 'EN'], ['hi', 'HI'], ['mr', 'MR']];
const ROLE_LABEL: Record<ContactRole, string> = { insured: 'Insured', garage: 'Garage', other: 'Other' };
const langKey = (claimId: string) => `ask-lang:${claimId}`;

function savedLang(claimId: string): AskLang {
  try {
    const v = localStorage.getItem(langKey(claimId));
    return v === 'hi' || v === 'mr' ? v : 'en';
  } catch { return 'en'; }
}

/** "Ask for documents": a WhatsApp or email request for what is missing. Nothing leaves without the surveyor's tap. */
export function AskForDocumentsButton() {
  const [open, setOpen] = useState(false);
  const claim = useClaimStore((s) => s.currentClaim);
  if (!claim) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest bg-white border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all active:scale-95"
      >
        <MessageSquare size={12} />
        Ask for documents
      </button>
      {open && <AskDialog key={claim.id} onClose={() => setOpen(false)} />}
    </>
  );
}

function AskDialog({ onClose }: { onClose: () => void }) {
  const claim = useClaimStore((s) => s.currentClaim)!;
  const surveyor = useProfileStore((s) => s.profile.name);
  const people = recipients(claim);
  const docs = dialogDocs(claim);
  const [role, setRole] = useState<ContactRole | null>(null);
  const [ticked, setTicked] = useState<string[]>([]);
  const [lang, setLang] = useState<AskLang>(() => savedLang(claim.id));

  const pickRole = (r: ContactRole) => { setRole(r); setTicked(preTicked(claim, r)); };
  const pickLang = (l: AskLang) => {
    setLang(l);
    try { localStorage.setItem(langKey(claim.id), l); } catch { /* remembered only when storage works */ }
  };
  const toggle = (k: string) => setTicked((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));

  const person = people.find((p) => p.role === role);
  const picked = docs.filter((d) => ticked.includes(d.key));
  const reminder = !!role && !!claim.scanChase?.asks?.some((a) => a.to === role);
  const wa = person ? waNumber(person.phone) : null;
  const canMail = !!person && person.email.includes('@');
  const text = person
    ? askMessage(lang, person.name, claim.vehicle?.registrationNumber ?? '', claim.policy?.insurerName ?? '',
        picked.map((d) => [d.label, d.reason] as const), surveyor, reminder)
    : '';

  const send = (via: 'whatsapp' | 'email') => {
    if (!person || !role) return;
    // Log first: navigating away on mailto can end this page's script.
    const prev = claim.scanChase;
    useClaimStore.getState().updateClaim({
      scanChase: { ...prev, importedAt: prev?.importedAt ?? istNow(), asks: [...(prev?.asks ?? []), { at: istNow(), to: role, via, lang, docs: picked.map((d) => d.key) }] },
    });
    if (via === 'whatsapp' && wa) window.open(waLink(wa, text), '_blank');
    else if (via === 'email') location.href = mailtoUri(person.email, askSubject(claim.vehicle?.registrationNumber ?? '', claim.policy?.insurerName ?? ''), text);
    onClose();
  };

  const chip = (on: boolean) => `min-h-[36px] rounded-full border px-3 text-xs disabled:opacity-40 ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background'}`;
  const btn = 'min-h-[44px] rounded-md px-4 text-sm font-medium disabled:opacity-40';

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask for documents</DialogTitle>
          <DialogDescription>Opens WhatsApp or your mail app with the message ready. You press send.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <button key={p.role} type="button" className={chip(role === p.role)} disabled={!waNumber(p.phone) && !p.email.includes('@')} onClick={() => pickRole(p.role)}>
              {ROLE_LABEL[p.role]}{p.name ? ` · ${p.name}` : ''}
            </button>
          ))}
        </div>

        <div className="flex gap-2" role="group" aria-label="Language">
          {LANGS.map(([l, label]) => <button key={l} type="button" className={chip(lang === l)} onClick={() => pickLang(l)}>{label}</button>)}
        </div>

        <section className="space-y-1">
          {docs.length === 0 && <p className="text-sm text-muted-foreground">Nothing is missing.</p>}
          {docs.map((d) => (
            <label key={d.key} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <input type="checkbox" checked={ticked.includes(d.key)} onChange={() => toggle(d.key)} />
              <span>{d.label}</span>
              {d.reason && <span className="text-xs text-destructive">rejected: {d.reason}</span>}
            </label>
          ))}
        </section>

        {role && <pre className="whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{text}</pre>}

        <DialogFooter className="gap-2">
          <button type="button" className={`${btn} border border-border`} onClick={onClose}>Cancel</button>
          <button type="button" className={`${btn} border border-border`} disabled={!canMail || picked.length === 0} onClick={() => send('email')}>Send email</button>
          <button type="button" className={`${btn} bg-primary text-primary-foreground`} disabled={!wa || picked.length === 0} onClick={() => send('whatsapp')}>Send on WhatsApp</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
