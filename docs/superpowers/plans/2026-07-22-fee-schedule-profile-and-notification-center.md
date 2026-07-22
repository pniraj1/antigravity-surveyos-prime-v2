# Fee Schedule → Profile + Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the IISLA fee-schedule editor into the Profile tab, add an admin→surveyor "schedule updated — adopt/keep" prompt, and add a header notification bell with an admin-authored announcement feed.

**Architecture:** The fee-schedule editor moves from the Fees Bill tab to a self-contained `FeeScheduleSection` in Profile; the Fees Bill tab keeps only the existing auto-fill + hint (unchanged). A `basedOnGlobalVersion`-style acknowledgment (`profile.feeScheduleAckVersion`) drives an adopt/keep prompt when the admin bumps the global schedule version. Notifications ride a new admin-only `announcements` Firestore collection plus a client-derived schedule prompt — surfaced via a bell + badge in the sidebar header, read-tracked by a single `profile.notificationsLastSeen` timestamp.

**Tech Stack:** Next.js 16, React, TypeScript, Zustand (profile store), Firebase Firestore, Vitest.

## Global Constraints

- Immutability: never mutate; spread to new objects.
- No `console.log` in production code.
- Tests: `npx vitest run <path>`; live in `__tests__/` beside source, `*.test.ts`.
- Firestore global/admin config mirrors `src/lib/ai/models-config.ts`: code fallback, admin-only writes enforced in `firestore.rules`.
- No IDV foolproofing — the fee calculation is correct and unchanged. Do not touch `computeProfessionalFee` or the FeesTab auto-fill logic.
- Announcement `body` renders as **plain text**; `link` renders only via `sanitizeLink` (http/https only).
- Announcement reads are bounded: `orderBy(createdAt desc) limit 20`, fetched once per session (no live listener).

---

### Task 1: Announcements config module + profile fields + Firestore rule

**Files:**
- Create: `src/lib/config/announcements.ts`
- Test: `src/lib/config/__tests__/announcements.test.ts`
- Modify: `src/types/vehicle.ts` (`SurveyorProfile` — add two fields near the existing `feeSchedule?`)
- Modify: `firestore.rules` (after the `fee_config/schedule` block)

**Interfaces:**
- Produces:
  - `type AnnouncementType = 'update' | 'blog' | 'general'`
  - `interface Announcement { id: string; title: string; body: string; type: AnnouncementType; link?: string; createdAt: number; createdBy: string }`
  - `sanitizeLink(url: string | null | undefined): string | null`
  - `countUnread(items: Announcement[], lastSeen: number | undefined): number`
  - `loadAnnouncements(): Promise<Announcement[]>`
  - `saveAnnouncement(a: Omit<Announcement, 'id' | 'createdAt'>): Promise<void>`
  - `deleteAnnouncement(id: string): Promise<void>`
  - `SurveyorProfile.notificationsLastSeen?: number`, `SurveyorProfile.feeScheduleAckVersion?: string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/config/__tests__/announcements.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sanitizeLink, countUnread, type Announcement } from '../announcements';

const ann = (id: string, createdAt: number): Announcement => ({
  id, title: 't', body: 'b', type: 'general', createdAt, createdBy: 'admin',
});

describe('sanitizeLink', () => {
  it('allows http/https, blocks everything else', () => {
    expect(sanitizeLink('https://example.com/x')).toBe('https://example.com/x');
    expect(sanitizeLink('http://a.b')).toBe('http://a.b');
    expect(sanitizeLink('  https://trim.me  ')).toBe('https://trim.me');
    expect(sanitizeLink('javascript:alert(1)')).toBeNull();
    expect(sanitizeLink('data:text/html,x')).toBeNull();
    expect(sanitizeLink('/relative')).toBeNull();
    expect(sanitizeLink('')).toBeNull();
    expect(sanitizeLink(null)).toBeNull();
  });
});

describe('countUnread', () => {
  it('counts items newer than lastSeen', () => {
    const items = [ann('a', 300), ann('b', 200), ann('c', 100)];
    expect(countUnread(items, 150)).toBe(2);   // a, b
    expect(countUnread(items, undefined)).toBe(3);
    expect(countUnread(items, 300)).toBe(0);
    expect(countUnread([], 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/config/__tests__/announcements.test.ts`
Expected: FAIL — cannot find module `../announcements`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/config/announcements.ts`:

```ts
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export type AnnouncementType = 'update' | 'blog' | 'general';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  link?: string;
  createdAt: number;
  createdBy: string;
}

/** Returns a safe http/https URL, or null for anything else (blocks javascript:, data:, relative). */
export function sanitizeLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/** Count of announcements created after the surveyor last opened the bell. */
export function countUnread(items: Announcement[], lastSeen: number | undefined): number {
  const since = lastSeen ?? 0;
  return items.filter((a) => a.createdAt > since).length;
}

/** Newest 20 announcements. Empty array on any error (never blocks the UI). */
export async function loadAnnouncements(): Promise<Announcement[]> {
  try {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }));
  } catch {
    return [];
  }
}

/** Admin-only write (enforced by Firestore rules). */
export async function saveAnnouncement(a: Omit<Announcement, 'id' | 'createdAt'>): Promise<void> {
  await addDoc(collection(db, 'announcements'), { ...a, createdAt: Date.now() });
}

/** Admin-only delete (enforced by Firestore rules). */
export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, 'announcements', id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/config/__tests__/announcements.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the profile fields**

In `src/types/vehicle.ts`, inside `interface SurveyorProfile`, immediately after the existing `feeSchedule?: FeeSchedule;` line, add:

```ts
  /** Admin global schedule version the surveyor has adopted/acknowledged (drives the adopt/keep prompt). */
  feeScheduleAckVersion?: string;
  /** Epoch ms the surveyor last opened the notification bell (unread = announcements newer than this). */
  notificationsLastSeen?: number;
```

- [ ] **Step 6: Add the Firestore rule**

In `firestore.rules`, immediately after the closing `}` of the `match /fee_config/schedule { ... }` block, insert:

```
    // Announcements — admin broadcasts, all signed-in surveyors read.
    match /announcements/{id} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
```

- [ ] **Step 7: Verify typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "announcements|vehicle.ts" ; echo done`
Expected: `done` with no errors above it.

```bash
git add src/lib/config/announcements.ts src/lib/config/__tests__/announcements.test.ts src/types/vehicle.ts firestore.rules
git commit -m "feat(notify): announcements config module + profile notification fields + Firestore rule"
```

---

### Task 2: Schedule adopt/keep helper

**Files:**
- Create: `src/lib/config/fee-schedule-adopt.ts`
- Test: `src/lib/config/__tests__/fee-schedule-adopt.test.ts`

**Interfaces:**
- Consumes: `FeeSchedule` from `@/lib/config/fee-schedule`.
- Produces: `schedulePromptNeeded(personal: FeeSchedule | undefined, ackVersion: string | undefined, globalVersion: string | null): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/config/__tests__/fee-schedule-adopt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { schedulePromptNeeded } from '../fee-schedule-adopt';
import { FALLBACK_FEE_SCHEDULE, type FeeSchedule } from '../fee-schedule';

const personal: FeeSchedule = { ...FALLBACK_FEE_SCHEDULE, version: 'IISLA-2022' };

describe('schedulePromptNeeded', () => {
  it('no prompt when the surveyor has no personal card', () => {
    expect(schedulePromptNeeded(undefined, undefined, 'IISLA-2025')).toBe(false);
  });
  it('no prompt while the global version has not loaded', () => {
    expect(schedulePromptNeeded(personal, 'IISLA-2022', null)).toBe(false);
  });
  it('prompts when acknowledged version is behind the global', () => {
    expect(schedulePromptNeeded(personal, 'IISLA-2022', 'IISLA-2025')).toBe(true);
  });
  it('no prompt once acknowledged version matches global', () => {
    expect(schedulePromptNeeded(personal, 'IISLA-2025', 'IISLA-2025')).toBe(false);
  });
  it('falls back to the card version when ack is missing', () => {
    expect(schedulePromptNeeded(personal, undefined, 'IISLA-2025')).toBe(true);
    expect(schedulePromptNeeded(personal, undefined, 'IISLA-2022')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/config/__tests__/fee-schedule-adopt.test.ts`
Expected: FAIL — cannot find module `../fee-schedule-adopt`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/config/fee-schedule-adopt.ts`:

```ts
import type { FeeSchedule } from './fee-schedule';

/**
 * True when the surveyor has a personal rate card whose acknowledged admin
 * version is behind the current global version — i.e. show the adopt/keep prompt.
 * Surveyors without a personal card follow the global automatically (no prompt).
 */
export function schedulePromptNeeded(
  personal: FeeSchedule | undefined,
  ackVersion: string | undefined,
  globalVersion: string | null,
): boolean {
  if (!personal) return false;
  if (!globalVersion) return false;
  return (ackVersion ?? personal.version) !== globalVersion;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/config/__tests__/fee-schedule-adopt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/fee-schedule-adopt.ts src/lib/config/__tests__/fee-schedule-adopt.test.ts
git commit -m "feat(fees): schedule adopt/keep prompt predicate"
```

---

### Task 3: Move the schedule editor to Profile (add section, remove from Fees tab)

**Files:**
- Create: `src/components/profile/FeeScheduleSection.tsx`
- Modify: `src/components/tabs/ProfileTab.tsx` (import + render before the AI Config block, ~line 591)
- Modify: `src/components/tabs/FeesTab.tsx` (remove `RateCardPanel` component + its render + now-unused imports)

**Interfaces:**
- Consumes: `getActiveFeeSchedule`, `loadFeeSchedule`, `type FeeSchedule`, `type FeeSlab` from `@/lib/config/fee-schedule`; `schedulePromptNeeded` from `@/lib/config/fee-schedule-adopt`; `useProfileStore`.
- Produces: `FeeScheduleSection()` (default-less named export, no props).

- [ ] **Step 1: Create the Profile fee-schedule section**

Create `src/components/profile/FeeScheduleSection.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Receipt, ChevronDown, RotateCcw, BellRing } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';
import {
  getActiveFeeSchedule, loadFeeSchedule,
  type FeeSchedule, type FeeSlab,
} from '@/lib/config/fee-schedule';
import { schedulePromptNeeded } from '@/lib/config/fee-schedule-adopt';

export function FeeScheduleSection() {
  const { profile, updateProfile } = useProfileStore();
  const [globalSchedule, setGlobalSchedule] = useState<FeeSchedule | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { loadFeeSchedule().then(setGlobalSchedule); }, []);

  const active = getActiveFeeSchedule(profile.feeSchedule, globalSchedule);
  const usingPersonal = !!profile.feeSchedule;
  const globalVersion = globalSchedule?.version ?? null;
  const promptAdopt = schedulePromptNeeded(profile.feeSchedule, profile.feeScheduleAckVersion, globalVersion);

  const updateSlab = (i: number, key: keyof FeeSlab, raw: string) => {
    const slabs = active.slabs.map((s, idx) => {
      if (idx !== i) return s;
      if (key === 'label') return { ...s, label: raw };
      if (key === 'upTo' || key === 'maxFee') return { ...s, [key]: raw === '' ? null : Number(raw) };
      return { ...s, [key]: Number(raw) || 0 };
    });
    updateProfile({
      feeSchedule: { ...active, slabs, updatedBy: profile.name || 'surveyor', updatedAt: Date.now() },
      feeScheduleAckVersion: globalVersion ?? active.version,
    });
  };

  const adoptGlobal = () => {
    if (!globalSchedule) return;
    updateProfile({ feeSchedule: { ...globalSchedule }, feeScheduleAckVersion: globalSchedule.version });
  };
  const keepMine = () => { if (globalVersion) updateProfile({ feeScheduleAckVersion: globalVersion }); };
  const resetToGlobal = () => updateProfile({ feeSchedule: undefined, feeScheduleAckVersion: undefined });

  const cell: React.CSSProperties = { padding: '4px 6px', border: '1px solid var(--color-neutral-200)', fontSize: 12 };

  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border">
      <div className="px-6 py-4 flex items-center gap-2 border-b border-border" style={{ background: 'var(--color-neutral-100)' }}>
        <Receipt size={14} className="text-primary" />
        <span className="text-sm font-medium text-foreground">Survey Fee Schedule (IISLA)</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: usingPersonal ? 'var(--color-status-warning-tint)' : 'var(--color-neutral-100)', color: usingPersonal ? 'var(--color-status-warning)' : 'var(--color-neutral-400)' }}>
          {usingPersonal ? 'Custom (your rate card)' : `Org default · ${active.version}`}
        </span>
      </div>

      <div className="p-5 space-y-4">
        {promptAdopt && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'var(--color-status-warning-tint)', border: '1px solid var(--color-status-warning)' }}>
            <BellRing size={16} style={{ color: 'var(--color-status-warning)' }} />
            <span className="text-xs" style={{ color: 'var(--color-neutral-900)' }}>
              Admin updated the IISLA schedule ({profile.feeScheduleAckVersion ?? active.version} → {globalVersion}). Adopt the new slabs or keep your custom card?
            </span>
            <button onClick={adoptGlobal} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-neutral-50)', border: 'none', cursor: 'pointer' }}>Adopt</button>
            <button onClick={keepMine} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-neutral-100)', border: 'none', cursor: 'pointer' }}>Keep mine</button>
          </div>
        )}

        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-xs font-medium" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-neutral-600)' }}>
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          {open ? 'Hide slabs' : 'View / edit slabs'}
        </button>

        {open && (
          <div className="overflow-x-auto">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>{['Slab', 'Up to (₹)', 'Base (₹)', 'Marginal from (₹)', 'Rate %', 'Max fee (₹)'].map(h => (
                  <th key={h} style={{ ...cell, textAlign: 'left', color: 'var(--color-neutral-400)', fontWeight: 500 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {active.slabs.map((s, i) => (
                  <tr key={i}>
                    <td style={cell}><input value={s.label} onChange={e => updateSlab(i, 'label', e.target.value)} style={{ width: 150, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" value={s.upTo ?? ''} placeholder="∞" onChange={e => updateSlab(i, 'upTo', e.target.value)} style={{ width: 90, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" value={s.base} onChange={e => updateSlab(i, 'base', e.target.value)} style={{ width: 70, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" value={s.marginalFrom} onChange={e => updateSlab(i, 'marginalFrom', e.target.value)} style={{ width: 90, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" step="0.01" value={s.marginalRatePct} onChange={e => updateSlab(i, 'marginalRatePct', e.target.value)} style={{ width: 60, border: 'none', background: 'transparent' }} /></td>
                    <td style={cell}><input type="number" value={s.maxFee ?? ''} placeholder="—" onChange={e => updateSlab(i, 'maxFee', e.target.value)} style={{ width: 80, border: 'none', background: 'transparent' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usingPersonal && (
              <button onClick={resetToGlobal} className="mt-4 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', border: 'none', cursor: 'pointer' }}>
                <RotateCcw size={12} /> Reset to org default
              </button>
            )}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">Auto-fills the professional fee in the Survey Fees Bill from the repair estimate. You can still edit the fee per claim.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it in ProfileTab**

In `src/components/tabs/ProfileTab.tsx`, add the import beside the others (after the `ConnectSyncDialog` import line 18):

```ts
import { FeeScheduleSection } from '@/components/profile/FeeScheduleSection';
```

Then insert the section just before the AI Config block. Find (~line 590-592):

```tsx
        </div>

        {/* ── AI Config ─────────────────────────────────── */}
```

Replace with:

```tsx
        </div>

        {/* ── Fee Schedule (IISLA) ──────────────────────── */}
        <FeeScheduleSection />

        {/* ── AI Config ─────────────────────────────────── */}
```

- [ ] **Step 3: Remove the Rate Card panel from FeesTab**

In `src/components/tabs/FeesTab.tsx`:

1. Delete the entire `function RateCardPanel({ ... }) { ... }` definition (the block between the `// ─── Rate Card (IISLA Fee Schedule) editor ───` comment and the `// ─── Component ───` comment).
2. Delete its render block:
```tsx
        {/* ── Rate Card (IISLA Fee Schedule) ─────────────────── */}
        <RateCardPanel
          schedule={activeSchedule}
          usingPersonal={usingPersonal}
          onEdit={(slabs) => updateProfile({ feeSchedule: { ...activeSchedule, slabs, updatedBy: profile.name || 'surveyor', updatedAt: Date.now() } })}
          onReset={() => updateProfile({ feeSchedule: undefined })}
        />

```
3. In the FeesTab imports, remove `ChevronDown` and `FeeSlab` (now unused). The import line becomes:
```ts
import {
  Receipt, Calculator, Percent, Plus, Minus,
  TrendingDown, FileText, Calendar, Banknote, Car, Camera,
  Package, Phone, Truck, CheckCircle, XCircle,
  RotateCcw, Sparkles,
} from 'lucide-react';
```
and:
```ts
import {
  getActiveFeeSchedule, loadFeeSchedule,
  type FeeSchedule,
} from '@/lib/config/fee-schedule';
```
4. Remove `usingPersonal` and `updateProfile` if they are now unused in FeesTab. (Keep `activeSchedule`, `suggestedFee`, `estimateGross`, `idvNum`, `idvCapped`, and the auto-fill effect — all still used by the hint.) Verify usage before deleting: `git grep -n "usingPersonal\|updateProfile" src/components/tabs/FeesTab.tsx` — remove only the declarations with zero remaining references.

- [ ] **Step 4: Verify typecheck + build**

Run: `npx tsc --noEmit 2>&1 | grep -iE "FeesTab|ProfileTab|FeeScheduleSection" ; echo done`
Expected: `done` with no errors above it. (An "unused variable" error means a Step-3 leftover — remove it.)

Run: `npm run build`
Expected: compiles.

- [ ] **Step 5: Manual verification**

Preview → Profile tab shows the "Survey Fee Schedule (IISLA)" section; expanding shows the slabs; editing flips the badge to Custom; Reset returns to Org default. The Fees Bill tab no longer shows a Rate Card panel but still auto-fills the professional fee with its hint.

- [ ] **Step 6: Commit**

```bash
git add src/components/profile/FeeScheduleSection.tsx src/components/tabs/ProfileTab.tsx src/components/tabs/FeesTab.tsx
git commit -m "feat(fees): move fee-schedule editor to Profile + adopt/keep prompt"
```

---

### Task 4: Notification bell in the sidebar header

**Files:**
- Create: `src/components/layout/NotificationBell.tsx`
- Modify: `src/components/layout/sidebar.tsx` (brand header — render the bell; import it)

**Interfaces:**
- Consumes: `loadAnnouncements`, `countUnread`, `sanitizeLink`, `type Announcement` from `@/lib/config/announcements`; `loadFeeSchedule`, `type FeeSchedule` from `@/lib/config/fee-schedule`; `schedulePromptNeeded` from `@/lib/config/fee-schedule-adopt`; `useProfileStore`; `useUIStore`.
- Produces: `NotificationBell()` (no props).

- [ ] **Step 1: Create the bell component**

Create `src/components/layout/NotificationBell.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, ExternalLink, BellRing, Megaphone } from 'lucide-react';
import { useProfileStore } from '@/stores/profile-store';
import { useUIStore } from '@/stores/ui-store';
import { loadAnnouncements, countUnread, sanitizeLink, type Announcement } from '@/lib/config/announcements';
import { loadFeeSchedule, type FeeSchedule } from '@/lib/config/fee-schedule';
import { schedulePromptNeeded } from '@/lib/config/fee-schedule-adopt';

export function NotificationBell() {
  const { profile, updateProfile } = useProfileStore();
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [globalSchedule, setGlobalSchedule] = useState<FeeSchedule | null>(null);

  useEffect(() => {
    loadAnnouncements().then(setItems);
    loadFeeSchedule().then(setGlobalSchedule);
  }, []);

  const schedulePrompt = schedulePromptNeeded(profile.feeSchedule, profile.feeScheduleAckVersion, globalSchedule?.version ?? null);
  const unreadAnnouncements = useMemo(() => countUnread(items, profile.notificationsLastSeen), [items, profile.notificationsLastSeen]);
  const badge = unreadAnnouncements + (schedulePrompt ? 1 : 0);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadAnnouncements > 0) updateProfile({ notificationsLastSeen: Date.now() });
  };

  const adoptGlobal = () => { if (globalSchedule) updateProfile({ feeSchedule: { ...globalSchedule }, feeScheduleAckVersion: globalSchedule.version }); };
  const keepMine = () => { if (globalSchedule) updateProfile({ feeScheduleAckVersion: globalSchedule.version }); };

  return (
    <div className="relative">
      <button onClick={toggle} title="Notifications" className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)]" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <Bell size={16} />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: 'var(--color-status-danger)' }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-[300px] max-h-[60vh] overflow-y-auto rounded-xl shadow-xl z-50 bg-white border border-[var(--color-neutral-200)]">
            <div className="px-4 py-3 border-b border-[var(--color-neutral-100)] text-xs font-medium uppercase tracking-wider text-[var(--color-neutral-400)]">Notifications</div>

            {schedulePrompt && (
              <div className="px-4 py-3 border-b border-[var(--color-neutral-100)]" style={{ background: 'var(--color-status-warning-tint)' }}>
                <div className="flex items-center gap-2 mb-1"><BellRing size={13} style={{ color: 'var(--color-status-warning)' }} /><span className="text-xs font-medium text-[var(--color-neutral-900)]">IISLA schedule updated</span></div>
                <p className="text-[11px] text-[var(--color-neutral-600)] mb-2">Admin updated the fee schedule to {globalSchedule?.version}. Adopt the new slabs or keep your custom card.</p>
                <div className="flex gap-2">
                  <button onClick={adoptGlobal} className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white" style={{ background: 'var(--color-primary)', border: 'none', cursor: 'pointer' }}>Adopt</button>
                  <button onClick={keepMine} className="px-2.5 py-1 rounded-md text-[11px] font-medium" style={{ background: 'var(--color-neutral-100)', border: 'none', cursor: 'pointer' }}>Keep mine</button>
                  <button onClick={() => { setActiveTab('profile'); setOpen(false); }} className="ml-auto px-2.5 py-1 rounded-md text-[11px] text-primary" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Open Profile</button>
                </div>
              </div>
            )}

            {items.length === 0 && !schedulePrompt && (
              <div className="px-4 py-8 text-center text-xs text-[var(--color-neutral-400)]">No notifications yet.</div>
            )}

            {items.map((a) => {
              const link = sanitizeLink(a.link);
              const isUnread = a.createdAt > (profile.notificationsLastSeen ?? 0);
              return (
                <div key={a.id} className="px-4 py-3 border-b border-[var(--color-neutral-100)]" style={{ background: isUnread ? 'var(--color-neutral-50)' : 'transparent' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Megaphone size={12} className="text-primary" />
                    <span className="text-xs font-medium text-[var(--color-neutral-900)]">{a.title}</span>
                    <span className="ml-auto text-[9px] uppercase tracking-wider text-[var(--color-neutral-400)]">{a.type}</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-neutral-600)] whitespace-pre-wrap">{a.body}</p>
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary">
                      Open link <ExternalLink size={10} />
                    </a>
                  )}
                  <div className="mt-1 text-[9px] text-[var(--color-neutral-400)]">{new Date(a.createdAt).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
```

> `setActiveTab` and the `AppTab` value `'profile'` come from `useUIStore` (same store the sidebar uses). Verify with `git grep -n "setActiveTab" src/stores/ui-store.ts`.

- [ ] **Step 2: Render the bell in the sidebar header**

In `src/components/layout/sidebar.tsx`, add the import near the top (after the lucide import block):

```ts
import { NotificationBell } from './NotificationBell';
```

Then place it in the brand header. Find the collapse toggle button (the one rendering `<ChevronLeft/><ChevronRight/>` around line 174-179) and insert the bell just before it, so it sits by the name (hidden when the sidebar is collapsed to keep the rail clean):

```tsx
          {!sidebarCollapsed && <NotificationBell />}

          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md transition-colors text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)]"
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit 2>&1 | grep -iE "NotificationBell|sidebar.tsx" ; echo done`
Expected: `done` with no errors above it.

Run: `npm run build`
Expected: compiles.

- [ ] **Step 4: Manual verification**

Preview → the bell shows in the sidebar header. With a personal card behind the global version, the badge shows and the dropdown shows the adopt/keep item; Adopt/Keep clears it. Announcements (after Task 5) appear newest-first; opening the bell clears the unread count.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NotificationBell.tsx src/components/layout/sidebar.tsx
git commit -m "feat(notify): sidebar notification bell with badge + schedule adopt/keep"
```

---

### Task 5: Admin Announcements composer

**Files:**
- Create: `src/components/admin/tabs/AnnouncementsTab.tsx`
- Modify: `src/components/admin/types.ts` (`AdminTab` union)
- Modify: `src/components/admin/AdminDashboard.tsx` (import ~line 29; nav button ~after Fee Schedule button; render ~after fee-schedule render; `Megaphone` icon import)

**Interfaces:**
- Consumes: `loadAnnouncements`, `saveAnnouncement`, `deleteAnnouncement`, `type Announcement`, `type AnnouncementType` from `@/lib/config/announcements`.
- Produces: `AnnouncementsTab({ adminName }: { adminName: string })`.

- [ ] **Step 1: Create the composer component**

Create `src/components/admin/tabs/AnnouncementsTab.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadAnnouncements, saveAnnouncement, deleteAnnouncement,
  type Announcement, type AnnouncementType,
} from '@/lib/config/announcements';

export function AnnouncementsTab({ adminName }: { adminName: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<AnnouncementType>('update');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => loadAnnouncements().then(setItems);
  useEffect(() => { refresh(); }, []);

  async function post() {
    if (!title.trim() || !body.trim()) { toast.error('Title and body are required.'); return; }
    setBusy(true);
    try {
      await saveAnnouncement({ title: title.trim(), body: body.trim(), type, link: link.trim() || undefined, createdBy: adminName });
      setTitle(''); setBody(''); setLink(''); setType('update');
      toast.success('Announcement posted to all surveyors.');
      await refresh();
    } catch {
      toast.error('Post failed. Check your admin permissions.');
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await deleteAnnouncement(id); await refresh(); }
    catch { toast.error('Delete failed.'); }
  }

  const input: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-neutral-200)', background: 'var(--color-neutral-50)', fontSize: 13 };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Post an announcement</h3>
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={input} />
        <textarea placeholder="Body (plain text)" value={body} onChange={e => setBody(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
        <div className="flex gap-3">
          <select value={type} onChange={e => setType(e.target.value as AnnouncementType)} style={{ ...input, width: 140 }}>
            <option value="update">Update</option>
            <option value="blog">Blog</option>
            <option value="general">General</option>
          </select>
          <input placeholder="Link (optional, https://…)" value={link} onChange={e => setLink(e.target.value)} style={input} />
        </div>
        <button onClick={post} disabled={busy} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-neutral-50)', border: 'none', cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Post to all surveyors
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recent ({items.length})</h4>
        {items.map(a => (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border">
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="text-sm font-medium">{a.title}</span><span className="text-[9px] uppercase tracking-wider text-muted-foreground">{a.type}</span></div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.body}</p>
              <div className="text-[10px] text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleString()} · {a.createdBy}</div>
            </div>
            <button onClick={() => remove(a.id)} className="text-[var(--color-status-danger)]" style={{ background: 'none', border: 'none', cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the AdminTab member**

In `src/components/admin/types.ts`, extend the union:

```ts
export type AdminTab = 'surveyors' | 'signups' | 'payments' | 'dev-notes' | 'ai-models' | 'fee-schedule' | 'announcements';
```

- [ ] **Step 3: Wire into AdminDashboard**

In `src/components/admin/AdminDashboard.tsx`:

1. Add the import beside `FeeScheduleTab` (line ~29):
```ts
import { AnnouncementsTab } from './tabs/AnnouncementsTab';
```
2. Add `Megaphone` to the lucide import block (after `Receipt,`):
```ts
  Receipt,
  Megaphone,
```
3. Add a nav button after the Fee Schedule button (mirror it), changing the tab key to `'announcements'`, icon to `<Megaphone size={14} />`, label to `Announcements`:
```tsx
          <button
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-wider rounded-t-lg transition-all ${
              activeTab === 'announcements'
                ? 'bg-white border border-b-white border-border text-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Megaphone size={14} />
            Announcements
          </button>
```
4. Add the render line after the fee-schedule render (line ~287):
```tsx
          {activeTab === 'announcements' && <AnnouncementsTab adminName={user?.email ?? 'admin'} />}
```

- [ ] **Step 4: Verify typecheck + build**

Run: `npx tsc --noEmit 2>&1 | grep -iE "AnnouncementsTab|AdminDashboard|admin/types" ; echo done`
Expected: `done` with no errors above it.

Run: `npm run build`
Expected: compiles.

- [ ] **Step 5: Manual verification (end-to-end)**

Preview as admin → Admin Panel → **Announcements** → post one → it appears in the list. Open the app as a surveyor (or same session) → the bell badge increments and the announcement shows in the dropdown newest-first; opening the bell clears the count. Post one with a `javascript:` link → the surveyor feed shows no link (sanitized).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/tabs/AnnouncementsTab.tsx src/components/admin/types.ts src/components/admin/AdminDashboard.tsx
git commit -m "feat(admin): announcements composer for surveyor notification feed"
```

---

## Self-Review

**Spec coverage:**
- Move schedule editor to Profile tab → Task 3 (`FeeScheduleSection`, removed from FeesTab) ✅
- Admin→surveyor schedule adopt/keep (version-based) → Task 2 (predicate) + surfaced in Task 3 (Profile banner) and Task 4 (bell) ✅
- Notification bell + badge in sidebar header → Task 4 ✅
- Announcement feed (admin-authored: update/blog/general) → Task 1 (data) + Task 5 (composer) + Task 4 (feed render) ✅
- Bounded query (limit 20), fetch-once, sanitized rendering → Task 1 (`loadAnnouncements` limit; `sanitizeLink`), Task 4 (plain-text body, `sanitizeLink` for link, no live listener) ✅
- No IDV foolproofing / calc unchanged → Global Constraints; Task 3 explicitly leaves FeesTab auto-fill intact ✅

**Placeholder scan:** No TBD/TODO. UI tasks (3,4,5) with no component-test infra use typecheck + build + explicit manual-verification steps, stated honestly.

**Type consistency:** `Announcement`/`AnnouncementType` defined in Task 1, imported unchanged in Tasks 4 & 5. `sanitizeLink`/`countUnread` signatures match Task 1 definitions and Task 4 usage. `schedulePromptNeeded(personal, ackVersion, globalVersion)` defined in Task 2, called identically in Tasks 3 & 4. Profile fields `feeScheduleAckVersion` / `notificationsLastSeen` added in Task 1, read/written in Tasks 3 & 4. `FeeScheduleSection` (no props) matches its Task 3 render. `AnnouncementsTab({ adminName })` matches its Task 5 render.

## Out of scope (YAGNI)
- Admin↔user chat / "message admin" (deferred by user).
- Per-item read receipts (single `notificationsLastSeen` timestamp).
- Real-time listeners (fetch-once per session).
- Blog automation (manual announcement with link).
- IDV validation/guardrails (calc is correct; typo was user data-entry).
