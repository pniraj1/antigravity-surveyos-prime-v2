'use client';

import { AlertTriangle } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { missingReportDetails } from '@/lib/onboarding/profile-gaps';

export function ProfileGapBanner() {
  const profile = useProfileStore((s) => s.profile);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const gaps = missingReportDetails(profile);
  if (gaps.length === 0) return null;

  return (
    <div
      className="print:hidden mb-4 flex items-center gap-3 rounded-xl border px-4 py-2.5"
      style={{ borderColor: 'var(--color-status-warning)', background: 'var(--color-status-warning-tint)' }}
    >
      <AlertTriangle size={14} className="text-status-warning flex-shrink-0" />
      <p className="flex-1 text-xs text-status-warning">
        Your reports are missing: {gaps.join(', ')}. Add them in Profile so they print correctly.
      </p>
      <button
        onClick={() => setActiveTab('profile')}
        className="text-xs font-medium underline text-status-warning flex-shrink-0"
      >
        Open Profile
      </button>
    </div>
  );
}
