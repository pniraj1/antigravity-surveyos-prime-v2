# IISLA Fee Schedule + Appointment Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-derive the professional survey fee from an editable IISLA-2022 slab schedule (surveyor personal default + admin global), keep it surveyor-editable, and print the appointment date on the report formats where it is currently dropped.

**Architecture:** A pure `computeProfessionalFee(estimate, idv, schedule)` drives the fee; the active schedule resolves personal (`profile.feeSchedule`) → admin global (Firestore `fee_config/schedule`) → code fallback (IISLA 2022). The Fees Bill tab auto-fills the fee and hosts a collapsible Rate Card editor; the Admin panel edits the global doc. Config module mirrors the existing `src/lib/ai/models-config.ts` pattern exactly.

**Tech Stack:** Next.js 16, React, TypeScript, Zustand (profile store, localStorage-persisted), Firebase Firestore, Vitest.

## Global Constraints

- Immutability: never mutate state objects; spread to new objects (project `coding-style.md`).
- No `console.log` in production code.
- Test runner: `npx vitest run <path>`; tests live in `__tests__/` beside source, named `*.test.ts`.
- IDV source is `claim.policy.idv` (a **string** like `"₹5,00,000"`) — always parse before math.
- Estimate source is `calculateAssessmentSummary(...).estimateGrossTotal` — never assume a stored field.
- Empty report values render as the existing dash placeholder `—`.
- Firestore global config: read = signed-in, write = admin, enforced in `firestore.rules` (mirror `ai_config/models`).

---

### Task 1: Fee schedule config module (types, IISLA fallback, resolver, Firestore load/save)

**Files:**
- Create: `src/lib/config/fee-schedule.ts`
- Test: `src/lib/config/__tests__/fee-schedule.test.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/firebase/config`; `doc,getDoc,setDoc` from `firebase/firestore`.
- Produces:
  - `interface FeeSlab { label: string; upTo: number | null; base: number; marginalFrom: number; marginalRatePct: number; maxFee: number | null }`
  - `interface FeeSchedule { version: string; updatedAt: number | null; updatedBy: string; slabs: FeeSlab[] }`
  - `FALLBACK_FEE_SCHEDULE: FeeSchedule`
  - `mergeWithFallback(raw: Partial<FeeSchedule> | null | undefined): FeeSchedule`
  - `getActiveFeeSchedule(personal: FeeSchedule | undefined, global: FeeSchedule | null): FeeSchedule`
  - `loadFeeSchedule(): Promise<FeeSchedule>`
  - `saveFeeSchedule(schedule: FeeSchedule, updatedBy: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/config/__tests__/fee-schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  FALLBACK_FEE_SCHEDULE, mergeWithFallback, getActiveFeeSchedule, type FeeSchedule,
} from '../fee-schedule';

describe('fee-schedule config', () => {
  it('fallback is the IISLA-2022 six-slab schedule', () => {
    expect(FALLBACK_FEE_SCHEDULE.version).toBe('IISLA-2022');
    expect(FALLBACK_FEE_SCHEDULE.slabs).toHaveLength(6);
    expect(FALLBACK_FEE_SCHEDULE.slabs[0]).toMatchObject({ upTo: 20000, base: 850 });
    expect(FALLBACK_FEE_SCHEDULE.slabs[5]).toMatchObject({ upTo: null, base: 15000, maxFee: 25000 });
  });

  it('mergeWithFallback returns fallback for empty/missing slabs', () => {
    expect(mergeWithFallback(null)).toBe(FALLBACK_FEE_SCHEDULE);
    expect(mergeWithFallback({ slabs: [] })).toBe(FALLBACK_FEE_SCHEDULE);
  });

  it('mergeWithFallback keeps a valid custom schedule and backfills meta', () => {
    const raw: Partial<FeeSchedule> = { slabs: FALLBACK_FEE_SCHEDULE.slabs };
    const merged = mergeWithFallback(raw);
    expect(merged.slabs).toHaveLength(6);
    expect(merged.updatedBy).toBe('unknown');
    expect(merged.version).toBe('IISLA-2022');
  });

  it('getActiveFeeSchedule resolves personal → global → fallback', () => {
    const personal = { ...FALLBACK_FEE_SCHEDULE, version: 'personal' };
    const global = { ...FALLBACK_FEE_SCHEDULE, version: 'global' };
    expect(getActiveFeeSchedule(personal, global).version).toBe('personal');
    expect(getActiveFeeSchedule(undefined, global).version).toBe('global');
    expect(getActiveFeeSchedule(undefined, null)).toBe(FALLBACK_FEE_SCHEDULE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/config/__tests__/fee-schedule.test.ts`
Expected: FAIL — cannot find module `../fee-schedule`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/config/fee-schedule.ts`:

```ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface FeeSlab {
  label: string;
  upTo: number | null;      // inclusive upper bound of basis; null = open-ended last slab
  base: number;             // flat base fee
  marginalFrom: number;     // basis above which marginalRatePct applies (0 = pure flat)
  marginalRatePct: number;  // e.g. 0.70 for 0.70%
  maxFee: number | null;    // cap; null = uncapped
}

export interface FeeSchedule {
  version: string;
  updatedAt: number | null;
  updatedBy: string;
  slabs: FeeSlab[];
}

/** IISLA Motor Department survey-fee schedule, Revised 2022. Estimate of Repairs basis (capped by IDV). */
export const FALLBACK_FEE_SCHEDULE: FeeSchedule = {
  version: 'IISLA-2022',
  updatedAt: null,
  updatedBy: 'fallback',
  slabs: [
    { label: 'Up to ₹20,000',          upTo: 20000,   base: 850,   marginalFrom: 0,       marginalRatePct: 0,    maxFee: null },
    { label: '₹20,001 – ₹50,000',      upTo: 50000,   base: 1500,  marginalFrom: 0,       marginalRatePct: 0,    maxFee: null },
    { label: '₹50,001 – ₹1,00,000',    upTo: 100000,  base: 1800,  marginalFrom: 0,       marginalRatePct: 0,    maxFee: null },
    { label: '₹1,00,001 – ₹2,00,000',  upTo: 200000,  base: 2800,  marginalFrom: 0,       marginalRatePct: 0,    maxFee: null },
    { label: '₹2,00,001 – ₹30,00,000', upTo: 3000000, base: 2800,  marginalFrom: 200000,  marginalRatePct: 0.70, maxFee: 15000 },
    { label: 'Above ₹30,00,000',       upTo: null,    base: 15000, marginalFrom: 3000000, marginalRatePct: 0.70, maxFee: 25000 },
  ],
};

/** Backfills a partial/absent Firestore doc so the UI never crashes on a malformed schedule. */
export function mergeWithFallback(raw: Partial<FeeSchedule> | null | undefined): FeeSchedule {
  if (!raw || !Array.isArray(raw.slabs) || raw.slabs.length === 0) return FALLBACK_FEE_SCHEDULE;
  return {
    version: raw.version ?? FALLBACK_FEE_SCHEDULE.version,
    updatedAt: raw.updatedAt ?? null,
    updatedBy: raw.updatedBy ?? 'unknown',
    slabs: raw.slabs as FeeSlab[],
  };
}

/** Resolution order: surveyor personal → admin global → code fallback. */
export function getActiveFeeSchedule(
  personal: FeeSchedule | undefined,
  global: FeeSchedule | null,
): FeeSchedule {
  return personal ?? global ?? FALLBACK_FEE_SCHEDULE;
}

/** Reads the admin global schedule; falls back gracefully on absence or error. */
export async function loadFeeSchedule(): Promise<FeeSchedule> {
  try {
    const snap = await getDoc(doc(db, 'fee_config', 'schedule'));
    if (!snap.exists()) return FALLBACK_FEE_SCHEDULE;
    return mergeWithFallback(snap.data() as Partial<FeeSchedule>);
  } catch {
    return FALLBACK_FEE_SCHEDULE;
  }
}

/** Admin-only write (enforced by Firestore rules). */
export async function saveFeeSchedule(schedule: FeeSchedule, updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'fee_config', 'schedule'), { ...schedule, updatedAt: Date.now(), updatedBy });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/config/__tests__/fee-schedule.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/config/fee-schedule.ts src/lib/config/__tests__/fee-schedule.test.ts
git commit -m "feat(fees): IISLA-2022 fee schedule config module + fallback resolver"
```

---

### Task 2: Professional fee calculation

**Files:**
- Create: `src/lib/calculations/professional-fee.ts`
- Test: `src/lib/calculations/__tests__/professional-fee.test.ts`

**Interfaces:**
- Consumes: `FeeSchedule`, `FALLBACK_FEE_SCHEDULE` from `@/lib/config/fee-schedule` (Task 1).
- Produces:
  - `parseIdv(idv: string | number | null | undefined): number`
  - `computeProfessionalFee(estimate: number, idv: number, schedule: FeeSchedule): number`

- [ ] **Step 1: Write the failing test**

Create `src/lib/calculations/__tests__/professional-fee.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeProfessionalFee, parseIdv } from '../professional-fee';
import { FALLBACK_FEE_SCHEDULE } from '@/lib/config/fee-schedule';

const S = FALLBACK_FEE_SCHEDULE;
const fee = (est: number, idv = 0) => computeProfessionalFee(est, idv, S);

describe('computeProfessionalFee — IISLA 2022 slabs', () => {
  it('flat slabs by boundary', () => {
    expect(fee(0)).toBe(0);         // no estimate → no auto-fill
    expect(fee(20000)).toBe(850);
    expect(fee(20001)).toBe(1500);
    expect(fee(50000)).toBe(1500);
    expect(fee(50001)).toBe(1800);
    expect(fee(100000)).toBe(1800);
    expect(fee(100001)).toBe(2800);
    expect(fee(200000)).toBe(2800);
  });

  it('slab 5: 2800 + 0.70% over 2,00,000, capped 15,000', () => {
    expect(fee(200001)).toBe(2800);                 // +~0
    expect(fee(1200000)).toBe(2800 + Math.round(0.007 * 1000000)); // 9800
    expect(fee(3000000)).toBe(15000);               // 2800+19600=22400 → capped
  });

  it('slab 6: 15000 + 0.70% over 30,00,000, capped 25,000', () => {
    expect(fee(3000001)).toBe(15000);
    expect(fee(4300000)).toBe(15000 + Math.round(0.007 * 1300000)); // 24100
    expect(fee(10000000)).toBe(25000);              // capped
  });

  it('IDV cap: when estimate > IDV, fee is based on IDV', () => {
    expect(fee(1000000, 150000)).toBe(2800);        // basis = 150000 → slab 4
    expect(fee(150000, 1000000)).toBe(2800);        // estimate < idv → basis = estimate
    expect(fee(150000, 0)).toBe(2800);              // idv 0/unknown → ignore cap
  });
});

describe('parseIdv', () => {
  it('strips currency formatting', () => {
    expect(parseIdv('₹5,00,000')).toBe(500000);
    expect(parseIdv('500000')).toBe(500000);
    expect(parseIdv(500000)).toBe(500000);
    expect(parseIdv('')).toBe(0);
    expect(parseIdv(null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/__tests__/professional-fee.test.ts`
Expected: FAIL — cannot find module `../professional-fee`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/calculations/professional-fee.ts`:

```ts
import type { FeeSchedule } from '@/lib/config/fee-schedule';

/** Parses an IDV that may be a formatted string ("₹5,00,000") into a number. */
export function parseIdv(idv: string | number | null | undefined): number {
  if (typeof idv === 'number') return Number.isFinite(idv) ? idv : 0;
  if (!idv) return 0;
  return Number(String(idv).replace(/[^\d.]/g, '')) || 0;
}

/**
 * IISLA professional survey fee from the Estimate of Repairs.
 * Per the schedule note, when the estimate exceeds the IDV the fee is based on
 * the IDV instead. Returns 0 for a non-positive basis (no estimate yet → no auto-fill).
 */
export function computeProfessionalFee(estimate: number, idv: number, schedule: FeeSchedule): number {
  const basis = idv > 0 && estimate > idv ? idv : estimate;
  if (basis <= 0) return 0;

  const slabs = schedule.slabs;
  const slab = slabs.find((s) => s.upTo === null || basis <= s.upTo) ?? slabs[slabs.length - 1];

  let fee = slab.base + (slab.marginalRatePct / 100) * Math.max(0, basis - slab.marginalFrom);
  if (slab.maxFee !== null) fee = Math.min(fee, slab.maxFee);
  return Math.round(fee);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calculations/__tests__/professional-fee.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/professional-fee.ts src/lib/calculations/__tests__/professional-fee.test.ts
git commit -m "feat(fees): professional fee calculation from IISLA schedule with IDV cap"
```

---

### Task 3: Profile personal-schedule field + Firestore rules

**Files:**
- Modify: `src/types/vehicle.ts` (add field to `SurveyorProfile`, after line 168 area)
- Modify: `firestore.rules` (after the `ai_config/models` block, lines 46-49)

**Interfaces:**
- Consumes: `FeeSchedule` from `@/lib/config/fee-schedule` (Task 1).
- Produces: `SurveyorProfile.feeSchedule?: FeeSchedule` (personal override; absent = follow global).

- [ ] **Step 1: Add the profile field**

In `src/types/vehicle.ts`, add an import at the top of the file (near the other type imports) and the optional field inside `interface SurveyorProfile` (place it just after the `aiDocMode?` line ~168, before the closing brace):

```ts
// at top of file, with the other imports
import type { FeeSchedule } from '@/lib/config/fee-schedule';
```
```ts
  /** Surveyor's personal IISLA fee-schedule override. Absent = follow the admin global schedule. */
  feeSchedule?: FeeSchedule;
```

> Note: if `src/types/vehicle.ts` has no existing `import type` lines, add the import at the very top after any file-level comment. Verify with `git grep -n "feeSchedule" src/types/vehicle.ts`.

- [ ] **Step 2: Add the Firestore rule**

In `firestore.rules`, immediately after the closing `}` of the `match /ai_config/models { ... }` block (currently line 49), insert:

```
    // Survey fee schedule — admin sets the org default, all signed-in surveyors read.
    match /fee_config/schedule {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `feeSchedule` or `fee-schedule`.

- [ ] **Step 4: Commit**

```bash
git add src/types/vehicle.ts firestore.rules
git commit -m "feat(fees): personal feeSchedule on profile + fee_config Firestore rule"
```

---

### Task 4: Fees Bill tab — auto-fill + Rate Card panel

**Files:**
- Modify: `src/components/tabs/FeesTab.tsx`

**Interfaces:**
- Consumes: `computeProfessionalFee`, `parseIdv` (Task 2); `getActiveFeeSchedule`, `loadFeeSchedule`, `FALLBACK_FEE_SCHEDULE`, `FeeSchedule`, `FeeSlab` (Task 1); `calculateAssessmentSummary` from `@/lib/calculations`; `getVehicleAgeMonths` from `@/lib/calculations/depreciation`; `updateProfile` from `useProfileStore`.
- Produces: no exports; UI behaviour only.

- [ ] **Step 1: Add imports**

At the top of `src/components/tabs/FeesTab.tsx`, add:

```ts
import { useMemo, useState, useEffect } from 'react';
import { calculateAssessmentSummary } from '@/lib/calculations';
import { getVehicleAgeMonths } from '@/lib/calculations/depreciation';
import { computeProfessionalFee, parseIdv } from '@/lib/calculations/professional-fee';
import {
  getActiveFeeSchedule, loadFeeSchedule, FALLBACK_FEE_SCHEDULE,
  type FeeSchedule, type FeeSlab,
} from '@/lib/config/fee-schedule';
import { RotateCcw as RotateIcon, ChevronDown, Sparkles } from 'lucide-react';
```

> `useMemo` is already imported (line 13) — merge, don't duplicate. `RotateCcw` may already be imported for another use; if so alias only what's missing.

- [ ] **Step 2: Pull the profile updater and load the global schedule**

Inside `FeesTab()`, replace the destructure `const { profile } = useProfileStore();` with:

```ts
  const { profile, updateProfile } = useProfileStore();
  const [globalSchedule, setGlobalSchedule] = useState<FeeSchedule | null>(null);
  useEffect(() => { loadFeeSchedule().then(setGlobalSchedule); }, []);
```

- [ ] **Step 3: Compute estimate, IDV and the schedule-suggested fee**

After `const fb = currentClaim.feeBill;` add:

```ts
  const activeSchedule = getActiveFeeSchedule(profile.feeSchedule, globalSchedule);
  const usingPersonal = !!profile.feeSchedule;

  const estimateGross = useMemo(() => {
    const ageMonths = getVehicleAgeMonths(
      currentClaim.vehicle.dateOfRegistration,
      currentClaim.vehicle.yearOfManufacture,
      currentClaim.accident.dateAndTime,
    );
    return calculateAssessmentSummary(
      currentClaim.assessmentRows, ageMonths, currentClaim.depreciationType,
      fb?.salvageValue ?? 0, fb?.compulsoryExcess ?? 0, fb?.voluntaryExcess ?? 0,
    ).estimateGrossTotal;
  }, [currentClaim.assessmentRows, currentClaim.depreciationType, currentClaim.vehicle, currentClaim.accident.dateAndTime, fb?.salvageValue, fb?.compulsoryExcess, fb?.voluntaryExcess]);

  const idvNum = parseIdv(currentClaim.policy?.idv);
  const idvCapped = idvNum > 0 && estimateGross > idvNum;
  const suggestedFee = computeProfessionalFee(estimateGross, idvNum, activeSchedule);
```

- [ ] **Step 4: One-time auto-fill effect**

After the block above, add:

```ts
  // Auto-fill the professional fee from the schedule while the field is untouched (0).
  // Once the surveyor enters any non-zero value, their value wins and this stops.
  useEffect(() => {
    if (!fb.professionalFee && suggestedFee > 0) {
      set('professionalFee', suggestedFee);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedFee]);
```

> `set` is the existing helper (`const set = (key, val) => updateFeeBill(...)`, line ~68). This effect is defined after `set`; if ordering causes a lint error, move the effect below the `set` definition.

- [ ] **Step 5: Add the fee hint + recompute button under the Professional Fee input**

The Fee Components grid renders inputs from an array (lines ~200-220). Below that grid's closing `</div>` (the `p-5 grid ...` container for Fee Components), insert a hint row:

```tsx
                {suggestedFee > 0 && (
                  <div className="col-span-1 sm:col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--color-neutral-50)', color: 'var(--color-neutral-600)' }}>
                    <Sparkles size={13} className="text-primary" />
                    <span>
                      IISLA {activeSchedule.version} suggests <strong>{fmt(suggestedFee)}</strong> from estimate {fmt(estimateGross)}
                      {idvCapped ? <> — capped by IDV {fmt(idvNum)}</> : null}.
                    </span>
                    {fb.professionalFee !== suggestedFee && (
                      <button
                        onClick={() => set('professionalFee', suggestedFee)}
                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md font-medium"
                        style={{ background: 'var(--color-primary)', color: 'var(--color-neutral-50)', border: 'none', cursor: 'pointer' }}
                      >
                        <RotateIcon size={11} /> Use {fmt(suggestedFee)}
                      </button>
                    )}
                  </div>
                )}
```

- [ ] **Step 6: Add the collapsible Rate Card panel**

Add this component definition at module scope (below `FeeLine`, above `FeesTab`):

```tsx
function RateCardPanel({
  schedule, usingPersonal, onEdit, onReset,
}: {
  schedule: FeeSchedule;
  usingPersonal: boolean;
  onEdit: (slabs: FeeSlab[]) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const cell: React.CSSProperties = { padding: '4px 6px', border: '1px solid var(--color-neutral-200)', fontSize: 12 };

  const updateSlab = (i: number, key: keyof FeeSlab, raw: string) => {
    const next = schedule.slabs.map((s, idx) => {
      if (idx !== i) return s;
      if (key === 'label') return { ...s, label: raw };
      const num = raw === '' ? null : Number(raw);
      if (key === 'upTo' || key === 'maxFee') return { ...s, [key]: num };
      return { ...s, [key]: Number(raw) || 0 };
    });
    onEdit(next);
  };

  return (
    <div className="rounded-2xl overflow-hidden mt-5" style={{ background: 'var(--color-card)', border: '1px solid var(--color-neutral-200)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full px-6 py-4 flex items-center gap-2" style={{ borderBottom: open ? '1px solid var(--color-neutral-100)' : 'none', background: 'var(--color-neutral-50)', cursor: 'pointer', border: 'none' }}>
        <span className="text-sm font-medium" style={{ color: 'var(--color-neutral-900)' }}>Rate Card (IISLA Fee Schedule)</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: usingPersonal ? 'var(--color-status-warning-tint)' : 'var(--color-neutral-100)', color: usingPersonal ? 'var(--color-status-warning)' : 'var(--color-neutral-400)' }}>
          {usingPersonal ? 'Custom (your rate card)' : `Org default · ${schedule.version}`}
        </span>
        <ChevronDown size={16} className="ml-auto" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div className="p-5 overflow-x-auto">
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>{['Slab', 'Up to (₹)', 'Base (₹)', 'Marginal from (₹)', 'Rate %', 'Max fee (₹)'].map(h => (
                <th key={h} style={{ ...cell, textAlign: 'left', color: 'var(--color-neutral-400)', fontWeight: 500 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {schedule.slabs.map((s, i) => (
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
            <button onClick={onReset} className="mt-4 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', border: 'none', cursor: 'pointer' }}>
              <RotateIcon size={12} /> Reset to org default
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

Render it inside `FeesTab` just before `<FeeBillPreview ... />` (line ~414):

```tsx
        <RateCardPanel
          schedule={activeSchedule}
          usingPersonal={usingPersonal}
          onEdit={(slabs) => updateProfile({ feeSchedule: { ...activeSchedule, slabs, updatedBy: profile.name || 'surveyor', updatedAt: Date.now() } })}
          onReset={() => updateProfile({ feeSchedule: undefined })}
        />
```

- [ ] **Step 7: Verify build + typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles; no type errors. (No component test infra for tabs — verified via build + manual preview in Step 8.)

- [ ] **Step 8: Manual verification in preview**

Start the dev server (preview_start with the project's dev config), open a Final claim with assessment rows, go to **Survey Fees Bill**. Confirm: Professional Fee auto-fills to the IISLA figure; the hint shows the estimate (and IDV cap when estimate > IDV); editing the fee sticks; the Rate Card panel expands, edits flip the badge to "Custom", and Reset returns to "Org default".

- [ ] **Step 9: Commit**

```bash
git add src/components/tabs/FeesTab.tsx
git commit -m "feat(fees): auto-fill professional fee from IISLA schedule + editable Rate Card"
```

---

### Task 5: Admin panel — global Fee Schedule editor

**Files:**
- Create: `src/components/admin/tabs/FeeScheduleTab.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx` (import ~line 28; `AdminTab` union; nav button ~line 230; render ~line 286)

**Interfaces:**
- Consumes: `loadFeeSchedule`, `saveFeeSchedule`, `FALLBACK_FEE_SCHEDULE`, `FeeSchedule`, `FeeSlab` (Task 1).
- Produces: `FeeScheduleTab({ adminName }: { adminName: string })`.

- [ ] **Step 1: Create the admin editor component**

Create `src/components/admin/tabs/FeeScheduleTab.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadFeeSchedule, saveFeeSchedule, FALLBACK_FEE_SCHEDULE,
  type FeeSchedule, type FeeSlab,
} from '@/lib/config/fee-schedule';

export function FeeScheduleTab({ adminName }: { adminName: string }) {
  const [schedule, setSchedule] = useState<FeeSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadFeeSchedule().then(setSchedule); }, []);

  if (!schedule) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading schedule…</div>;
  }

  const updateSlab = (i: number, key: keyof FeeSlab, raw: string) => {
    setSchedule(prev => {
      if (!prev) return prev;
      const slabs = prev.slabs.map((s, idx) => {
        if (idx !== i) return s;
        if (key === 'label') return { ...s, label: raw };
        const num = raw === '' ? null : Number(raw);
        if (key === 'upTo' || key === 'maxFee') return { ...s, [key]: num };
        return { ...s, [key]: Number(raw) || 0 };
      });
      return { ...prev, slabs };
    });
  };

  async function save() {
    if (!schedule) return;
    setSaving(true);
    try {
      await saveFeeSchedule(schedule, adminName);
      toast.success('Fee schedule saved — applies to all users without a custom rate card.');
    } catch {
      toast.error('Save failed. Check your admin permissions.');
    } finally { setSaving(false); }
  }

  const cell: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--color-neutral-200)', fontSize: 13 };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium">Survey Fee Schedule (Global)</h3>
        <span className="text-[11px] text-muted-foreground">
          v{schedule.version} · {schedule.updatedAt ? `updated ${new Date(schedule.updatedAt).toLocaleDateString()} by ${schedule.updatedBy}` : 'built-in default'}
        </span>
        <button onClick={() => setSchedule({ ...FALLBACK_FEE_SCHEDULE })} className="ml-auto flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-neutral-100)', border: 'none', cursor: 'pointer' }}>
          <RotateCcw size={12} /> Reset to IISLA 2022
        </button>
      </div>

      <div className="overflow-x-auto">
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>{['Slab', 'Up to (₹)', 'Base (₹)', 'Marginal from (₹)', 'Rate %', 'Max fee (₹)'].map(h => (
              <th key={h} style={{ ...cell, textAlign: 'left', fontWeight: 500, color: 'var(--color-neutral-400)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {schedule.slabs.map((s, i) => (
              <tr key={i}>
                <td style={cell}><input value={s.label} onChange={e => updateSlab(i, 'label', e.target.value)} style={{ width: 160, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" value={s.upTo ?? ''} placeholder="∞" onChange={e => updateSlab(i, 'upTo', e.target.value)} style={{ width: 100, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" value={s.base} onChange={e => updateSlab(i, 'base', e.target.value)} style={{ width: 80, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" value={s.marginalFrom} onChange={e => updateSlab(i, 'marginalFrom', e.target.value)} style={{ width: 100, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" step="0.01" value={s.marginalRatePct} onChange={e => updateSlab(i, 'marginalRatePct', e.target.value)} style={{ width: 70, border: 'none', background: 'transparent' }} /></td>
                <td style={cell}><input type="number" value={s.maxFee ?? ''} placeholder="—" onChange={e => updateSlab(i, 'maxFee', e.target.value)} style={{ width: 90, border: 'none', background: 'transparent' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium" style={{ background: 'var(--color-primary)', color: 'var(--color-neutral-50)', border: 'none', cursor: saving ? 'wait' : 'pointer' }}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save for all users
      </button>
      <p className="text-[11px] text-muted-foreground">Surveyors who set a personal rate card keep it until they reset it in the Fees Bill tab.</p>
    </div>
  );
}
```

- [ ] **Step 2: Register the tab in AdminDashboard**

In `src/components/admin/AdminDashboard.tsx`:

1. Add the import beside the `AIModelsTab` import (line 28):
```ts
import { FeeScheduleTab } from './tabs/FeeScheduleTab';
```
2. Add `'fee-schedule'` to the `AdminTab` union type (find `type AdminTab = ...`; add the member).
3. Add a nav button mirroring the `ai-models` button (~line 230). Copy that button's JSX, changing the tab key to `'fee-schedule'` and its label to `Fee Schedule`.
4. Add the render line beside line 286:
```tsx
          {activeTab === 'fee-schedule' && <FeeScheduleTab adminName={user?.email ?? 'admin'} />}
```

> `user?.email` is already in scope at line 286 (used by the AIModelsTab render). Verify with `git grep -n "adminEmail=" src/components/admin/AdminDashboard.tsx`.

- [ ] **Step 3: Verify build + typecheck**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles; the `AdminTab` union includes `'fee-schedule'`; no unused-var errors.

- [ ] **Step 4: Manual verification**

In preview, sign in as admin → Admin Panel → **Fee Schedule** tab. Edit a slab, Save, reload — the change persists (Firestore). In a non-customised surveyor's Fees Bill tab, the "Org default" badge reflects the new value.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/tabs/FeeScheduleTab.tsx src/components/admin/AdminDashboard.tsx
git commit -m "feat(admin): global IISLA fee schedule editor (applies to all users)"
```

---

### Task 6: Appointment date on the report formats that drop it

**Files:**
- Modify: `src/lib/reports/standard-report-builder.ts` (section 4, lines ~339-358)
- Modify: `src/lib/reports/word-builder.ts` (accident/survey KV rows, ~line 249+)
- Modify: `src/components/pdf/SpotReportDocument.tsx` (report-meta block)

**Interfaces:** none — report output only. Uses existing `formatDateDMY` / `fd` helpers already imported in each file.

- [ ] **Step 1: Final — standard HTML builder**

In `src/lib/reports/standard-report-builder.ts`, inside the "4. ACCIDENT & SURVEY DETAILS" table, add a row for the appointment date. After the "Date of Survey / Place of Survey" row (~line 353-357), insert:

```ts
  <tr>
    <td style="${td}color:#444;font-size:${scale.labelFont};">Appointment Date</td>
    <td style="${td}">${formatDateDMY(accident.appointmentDate)}</td>
    <td style="${td}color:#444;font-size:${scale.labelFont};"></td>
    <td style="${td}"></td>
  </tr>
```

- [ ] **Step 2: Final — Word builder**

In `src/lib/reports/word-builder.ts`, in the accident/survey `createKVRow` group (the rows around line 249), add a row pairing the appointment date with the date of survey. Insert after the existing "Date of Survey" / place row (locate the `createKVRow("Date of Survey", ...)` or nearest accident row and add below it):

```ts
        createKVRow("Final Appt. Date", formatDateDMY(claim.accident.appointmentDate), "Date of Survey", formatDateDMY(claim.accident.dateOfSurvey), ws),
```

> Verify the accident section exists and `createKVRow`/`formatDateDMY`/`ws` are in scope (they are — used by sibling rows). If a "Date of Survey" row already exists, replace that row with this combined one instead of duplicating the field.

- [ ] **Step 3: Spot — PDF document**

In `src/components/pdf/SpotReportDocument.tsx`, the report-meta area renders licence/report fields. Find where `spotDetails` (or the spot detail object) is in scope and the "Date of Report"-style rows render, then add a Date of Allotment line mirroring the existing pattern. Example (match the file's existing `<Text style={...}>` idiom and the actual variable name for spot details):

```tsx
            <Text style={styles.colValue}>Date of Allotment: {fd(claim?.spotDetails?.allotmentDate) || 'N/A'}</Text>
```

> Confirm the spot-details accessor with `git grep -n "allotmentDate\|spotDetails" src/components/pdf/SpotReportDocument.tsx src/types/claim.ts`. Use the same date formatter the file already imports (`fd` or `formatDateDMY`). Place it beside the existing licence/report-meta `Text` nodes so it lands in the header block, not mid-table.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: compiles.

- [ ] **Step 5: Manual verification**

In preview: generate a Final **standard** report and a Final **Word** export → appointment date appears (or `—` when unset). Generate a **Spot PDF** → "Date of Allotment" appears in the header.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reports/standard-report-builder.ts src/lib/reports/word-builder.ts src/components/pdf/SpotReportDocument.tsx
git commit -m "fix(report): print appointment date on Final standard/Word and Spot PDF"
```

---

## Self-Review

**Spec coverage:**
- Fee data model + IISLA 2022 fallback → Task 1 ✅
- Calculation with IDV cap → Task 2 ✅
- Three-tier resolution (personal → global → fallback) → Task 1 (`getActiveFeeSchedule`), consumed in Tasks 4 & 5 ✅
- Global config storage (Firestore, admin-only) → Task 1 (`load/saveFeeSchedule`) + Task 3 (rules) ✅
- Personal override field → Task 3 ✅
- Fees tab auto-fill + editable fee + Rate Card panel (Approach C) → Task 4 ✅
- Admin global editor ("all users at once") → Task 5 ✅
- Appointment date on Final standard/Word + Spot PDF; Valuation untouched → Task 6 ✅

**Placeholder scan:** No TBD/TODO. UI tasks that can't unit-test (no tab-test infra in repo) use build + typecheck + explicit manual-preview steps instead of fabricated tests — stated honestly, not hidden.

**Type consistency:** `FeeSchedule`/`FeeSlab` defined in Task 1 and imported unchanged in Tasks 2, 3, 4, 5. `computeProfessionalFee(estimate, idv, schedule)` / `parseIdv` signatures match between Task 2 definition and Task 4 usage. `getActiveFeeSchedule(personal, global)` argument order consistent. `saveFeeSchedule(schedule, updatedBy)` matches Task 5 call.

## Out of scope (YAGNI)
- Admin force-reset of surveyor personal overrides.
- Dedicated left-nav Fee Schedule tab (chose Approach C).
- Valuation appointment field (uses Inspection Date by design).
- Schedule version history beyond the single `version` string.
