'use client';

import { useState } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { TERMS_VERSION, PRIVACY_VERSION, buildConsentRecord } from '@/lib/legal/versions';
import { FileText, Loader2 } from 'lucide-react';

/**
 * True when the stored consent is missing or predates the current documents.
 * Surveyors onboarded before the attestation shipped have no record at all.
 */
export function needsReaccept(
  consent: { termsVersion?: string; privacyVersion?: string } | undefined,
): boolean {
  if (!consent) return true;
  return consent.termsVersion !== TERMS_VERSION || consent.privacyVersion !== PRIVACY_VERSION;
}

export function TermsReacceptGate() {
  const uid = useAuthStore((s) => s.user?.uid);
  const { profile, updateProfile } = useProfileStore();
  const [saving, setSaving] = useState(false);

  // Admins and signed-out visitors are not prompted; neither are up-to-date users.
  if (!uid || profile.isAdmin || !needsReaccept(profile.consent)) return null;

  const accept = async () => {
    setSaving(true);
    try {
      const consent = buildConsentRecord();
      await setDoc(
        doc(db, 'users', uid, 'profile', 'current'),
        { consent, updatedAt: Timestamp.now() },
        { merge: true },
      );
      updateProfile({ consent });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h2 className="text-base font-medium text-foreground">We have updated our terms</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Our Terms of Service and Privacy Policy have changed: they now name the operator of Motor
          SurveyOS, set out our subscription plans and refund position, and describe how claim data is
          handled under the DPDP Act. Please review and accept them to continue.
        </p>
        <div className="flex gap-3 text-sm">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>
        </div>
        <button
          onClick={accept}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? 'Saving…' : 'I have read and accept'}
        </button>
      </div>
    </div>
  );
}
