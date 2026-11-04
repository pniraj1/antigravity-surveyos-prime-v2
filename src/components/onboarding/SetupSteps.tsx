'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { SurveyorProfile } from '@/types/vehicle';
import { Field, ImageUploader, MultiKeyInput } from '@/components/tabs/ProfileTab';
import { fetchGeminiModelEntries } from '@/lib/ai/service';

export type KeyTestState = 'idle' | 'testing' | 'ok' | 'fail';

export interface StepBodyProps {
  profile: SurveyorProfile;
  onProfile: (updates: Partial<SurveyorProfile>) => void;
}

/** Internal call: asks the provider for its model list; any answer means the key is accepted. */
export async function testKeyResult(key: string): Promise<'ok' | 'fail'> {
  const trimmed = key.trim();
  if (!trimmed) return 'fail';
  try {
    const entries = await fetchGeminiModelEntries(trimmed);
    return entries && entries.length > 0 ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

export function KeyTestMessage({ state }: { state: KeyTestState }) {
  if (state === 'ok') {
    return (
      <p role="status" className="flex items-center gap-1.5 text-xs font-medium text-status-success">
        <CheckCircle2 size={14} /> This key works.
      </p>
    );
  }
  if (state === 'fail') {
    return (
      <p role="status" className="text-xs font-medium text-status-danger">
        Could not confirm this key. Check it and your internet connection.
      </p>
    );
  }
  return null;
}

export function DetailsBody({ profile, onProfile }: StepBodyProps) {
  const locked = !profile.isAdmin;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Full Name"
          value={profile.name}
          readOnly={locked}
          onChange={(v) => onProfile({ name: v })}
          hint={locked ? 'Locked to your account. Contact an administrator to change it.' : ''}
        />
        <Field
          label="IRDAI Licence Number"
          value={profile.licenceNumber}
          onChange={(v) => onProfile({ licenceNumber: v })}
          placeholder="e.g. SLA-MH-123456"
        />
        <Field
          label="Licence Expiry"
          value={profile.licenceExpiry}
          type="date"
          onChange={(v) => onProfile({ licenceExpiry: v })}
        />
        <Field
          label="Mobile"
          value={profile.mobile}
          type="tel"
          onChange={(v) => onProfile({ mobile: v })}
          placeholder="+91 98765 43210"
        />
        <Field
          label="Address"
          value={profile.address}
          fullWidth
          onChange={(v) => onProfile({ address: v })}
          placeholder="Office / Home address"
        />
      </div>
      <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-0.5">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">How it prints</div>
        <div className="font-medium text-foreground">{profile.name || 'Your name'}</div>
        <div>Lic. No. {profile.licenceNumber || '-'}</div>
        {profile.mobile && <div>{profile.mobile}</div>}
        {profile.address && <div>{profile.address}</div>}
      </div>
    </div>
  );
}

export function MarksBody({ profile, onProfile }: StepBodyProps) {
  return (
    <div className="grid grid-cols-1 gap-3">
      <ImageUploader
        label="Signature"
        dataUrl={profile.signatureDataUrl}
        onUpload={(url) => onProfile({ signatureDataUrl: url })}
        onClear={() => onProfile({ signatureDataUrl: null })}
        hint="Appears on the Final Report and Fee Bill"
      />
      <ImageUploader
        label="Rubber Stamp"
        dataUrl={profile.stampDataUrl}
        onUpload={(url) => onProfile({ stampDataUrl: url })}
        onClear={() => onProfile({ stampDataUrl: null })}
        hint="Appears on signed documents"
      />
    </div>
  );
}

export function KeyBody({ profile, onProfile }: StepBodyProps) {
  const [state, setState] = useState<KeyTestState>('idle');
  const keys = profile.geminiApiKeys || [];
  const firstKey = keys.find((k) => k?.trim()) ?? '';

  const runTest = async () => {
    setState('testing');
    setState(await testKeyResult(firstKey));
  };

  return (
    <div className="space-y-3">
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 min-h-11 text-sm font-medium text-primary underline"
      >
        Get a free key <ExternalLink size={12} />
      </a>
      <MultiKeyInput
        keys={keys}
        onChange={(next) => {
          setState('idle');
          onProfile({ geminiApiKeys: next });
        }}
        placeholder="Paste your key"
        accentColor="#4285F4"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runTest}
          disabled={!firstKey.trim() || state === 'testing'}
          className="min-h-11 px-4 rounded-lg text-sm font-medium border border-border disabled:opacity-50"
        >
          {state === 'testing' ? 'Testing...' : 'Test key'}
        </button>
        <KeyTestMessage state={state} />
      </div>
    </div>
  );
}
