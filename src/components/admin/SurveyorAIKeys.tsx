'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { MultiKeyInput } from '@/components/tabs/ProfileTab';

// Same doc and fields sync-secrets.ts syncs to the surveyor's devices.
// The surveyor picks up a change on their next sign-in or reload (cloud wins).
const PROVIDERS = [
  { field: 'geminiApiKeys', label: 'Gemini', color: '#4285F4' },
  { field: 'groqApiKeys', label: 'Groq', color: '#F26639' },
  { field: 'ollamaApiKeys', label: 'Ollama', color: '#111827' },
  { field: 'nvidiaApiKeys', label: 'NVIDIA', color: '#76B900' },
] as const;
type KeyField = typeof PROVIDERS[number]['field'];
type Keys = Record<KeyField, string[]>;

const EMPTY: Keys = { geminiApiKeys: [], groqApiKeys: [], ollamaApiKeys: [], nvidiaApiKeys: [] };

export function SurveyorAIKeys({ uid }: { uid: string }) {
  const [keys, setKeys] = useState<Keys | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = doc(db, `users/${uid}/secrets`, 'aiKeys');

  useEffect(() => {
    getDoc(ref)
      .then(snap => {
        const data = snap.exists() ? snap.data() : {};
        setKeys(Object.fromEntries(PROVIDERS.map(({ field }) =>
          [field, Array.isArray(data[field]) ? data[field] : []])) as Keys);
      })
      .catch(() => { toast.error('Could not load this surveyor\'s AI keys.'); setKeys(EMPTY); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per surveyor
  }, [uid]);

  const save = async () => {
    if (!keys) return;
    setSaving(true);
    try {
      const cleaned = Object.fromEntries(PROVIDERS.map(({ field }) =>
        [field, keys[field].map(k => k.trim()).filter(Boolean)]));
      await setDoc(ref, { ...cleaned, ownerId: uid }, { merge: true });
      toast.success('Keys saved. The surveyor gets them on their next sign-in or reload.');
    } catch {
      toast.error('Saving keys failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!keys) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Loading AI keys…</div>;
  }

  return (
    <div className="space-y-3" onClick={e => e.stopPropagation()}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">AI keys</div>
      <div className="grid md:grid-cols-2 gap-4">
        {PROVIDERS.map(({ field, label, color }) => (
          <div key={field}>
            <div className="text-xs font-medium text-foreground mb-1">{label}</div>
            <MultiKeyInput
              keys={keys[field]}
              onChange={next => setKeys(prev => prev && { ...prev, [field]: next })}
              placeholder={`${label} API key`}
              accentColor={color}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save keys'}
      </button>
    </div>
  );
}
