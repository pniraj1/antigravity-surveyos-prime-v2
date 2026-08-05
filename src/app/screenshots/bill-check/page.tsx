'use client';

import { useEffect, useState } from 'react';

import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { BillCheckTab } from '@/components/tabs/BillCheckTab';
import type { ClaimData, ExtraBillItem } from '@/types';

import { MOCK_CLAIM, MOCK_PROFILE } from '../_mock-data';

/**
 * No-auth harness for the Bill Check tab.
 *
 * Unlike the sibling screenshot pages, this renders the REAL BillCheckTab and
 * its real children rather than a hand-built replica — a replica would not
 * exercise the grid, the liability maths, or the unmatched-items panel, which
 * is the whole point of being able to look at it.
 *
 * Seeds the store directly so no sign-in, Firebase read, or claim load is
 * involved. Dev-only: nothing links here.
 */

// One unmatched item so the Link / Add panel is visible, and one item the
// workshop worded differently — the case that produced false extras.
const DEMO_EXTRAS: ExtraBillItem[] = [
  {
    id: 'extra-parts-RD-9-7080',
    description: 'RADIATOR ASSY',
    amount: 7080,
    taxableAmount: 6000,
    gstPercent: 18,
    partNumber: 'RD-9',
    section: 'parts',
    category: 'spare_parts',
    source: 'final-bill',
  },
  {
    id: 'extra-labour-COOLANT-1416',
    description: 'COOLANT TOP UP / CONSUMABLES',
    amount: 1416,
    taxableAmount: 1200,
    gstPercent: 18,
    section: 'labour',
    category: 'labour',
    source: 'final-bill',
  },
];

export default function BillCheckScreenshotPage() {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const claim: ClaimData = {
      ...MOCK_CLAIM,
      // Give a few rows billed figures so the liability totals are non-trivial.
      assessmentRows: MOCK_CLAIM.assessmentRows.map((r, i) =>
        r.allowed && i % 2 === 0
          ? { ...r, billedTaxable: r.assessed, billedAmount: Math.round(r.assessed * (1 + (r.gst ?? 18) / 100)), billStatus: 'in-bill' as const }
          : r
      ),
      extraBillItems: DEMO_EXTRAS,
    };

    useClaimStore.setState({ currentClaim: claim });
    useProfileStore.setState({ profile: MOCK_PROFILE });
    setSeeded(true);
  }, []);

  if (!seeded) {
    return <div className="p-8 text-sm text-slate-500">Seeding demo claim…</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="px-4 py-2 text-[11px] font-medium bg-amber-100 text-amber-900 border-b border-amber-300">
        Demo harness — mock claim, no sign-in. Not linked from the app.
      </div>
      <div className="flex-1 min-h-0">
        <BillCheckTab />
      </div>
    </div>
  );
}
