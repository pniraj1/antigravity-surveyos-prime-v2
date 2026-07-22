# IISLA Professional Fee Schedule + Appointment Date — Design

**Date:** 2026-07-22
**Status:** Approved (pending spec review)

Two related report-accuracy items:

1. **Professional survey fee** on Final reports should be auto-derived from the **IISLA 2022 fee schedule** (slab-based on the Estimate of Repairs, capped by IDV), while staying surveyor-editable. The schedule itself is editable — by the surveyor (personal default) and by an admin (global default for all users).
2. **Appointment date** is dropped from several report outputs. Add it where it is genuinely missing.

---

## Part 1 — IISLA Fee Schedule → auto professional fee

### 1.1 Data model

```ts
// src/lib/config/fee-schedule.ts
export interface FeeSlab {
  label: string;            // "Up to ₹20,000", "₹2,00,001 – ₹30,00,000", …
  upTo: number | null;      // inclusive upper bound of the basis; null = open-ended (last slab)
  base: number;             // flat base fee for the slab
  marginalFrom: number;     // basis amount above which marginalRatePct applies (0 = pure flat)
  marginalRatePct: number;  // e.g. 0.70 for 0.70%
  maxFee: number | null;    // cap on the slab's fee; null = uncapped
}

export interface FeeSchedule {
  version: string;          // "IISLA-2022"
  updatedAt: number | null;
  updatedBy: string;
  slabs: FeeSlab[];
}
```

### 1.2 IISLA 2022 defaults (`FALLBACK_FEE_SCHEDULE`)

| Basis (Estimate of Repairs, ₹) | base | marginalFrom | marginalRatePct | maxFee |
|---|---|---|---|---|
| Up to 20,000 | 850 | 0 | 0 | null |
| 20,001 – 50,000 | 1,500 | 0 | 0 | null |
| 50,001 – 1,00,000 | 1,800 | 0 | 0 | null |
| 1,00,001 – 2,00,000 | 2,800 | 0 | 0 | null |
| 2,00,001 – 30,00,000 | 2,800 | 2,00,000 | 0.70 | 15,000 |
| Above 30,00,000 | 15,000 | 30,00,000 | 0.70 | 25,000 |

Slab boundaries expressed as `upTo`: 20000, 50000, 100000, 200000, 3000000, null.

### 1.3 Calculation (`src/lib/calculations/professional-fee.ts`)

Pure function, no I/O:

```ts
export function computeProfessionalFee(
  estimate: number,
  idv: number,
  schedule: FeeSchedule,
): number
```

Logic:
1. `basis = (idv > 0 && estimate > idv) ? idv : estimate` — the IISLA note: *"where the Estimate of Repairs is more than the IDV, the maximum survey fee shall be calculated based on IDV, not on Estimate of Repairs."*
2. `if (basis <= 0) return 0` — no auto-fill when there is no estimate yet.
3. Pick the first slab where `slab.upTo === null || basis <= slab.upTo`.
4. `fee = slab.base + (slab.marginalRatePct / 100) * Math.max(0, basis - slab.marginalFrom)`.
5. `if (slab.maxFee !== null) fee = Math.min(fee, slab.maxFee)`.
6. `return Math.round(fee)`.

IDV parsing: `policy.idv` is a string ("₹5,00,000") — parse with `Number(String(idv).replace(/[^\d.]/g, '')) || 0`.

**Self-check** (`professional-fee.test.ts`, assert-based, no framework beyond the existing test runner): each slab boundary (20000→850, 20001→1500, 50001→1800, 100001→2800, 200001→2800, 3000000→2800+0.7%×2800000=22400→capped 15000, 3000001→15000, large→capped 25000), plus the IDV cap (estimate 10,00,000 with IDV 1,50,000 → basis 1,50,000 → 2,800), plus `estimate 0 → 0`.

### 1.4 Three-tier schedule resolution

```ts
// active schedule used for a claim's fee
export function getActiveFeeSchedule(
  personal: FeeSchedule | undefined,   // profile.feeSchedule
  global: FeeSchedule | null,          // fee_config/schedule
): FeeSchedule {
  return personal ?? global ?? FALLBACK_FEE_SCHEDULE;
}
```

Order: **surveyor personal → admin global → code fallback**.

### 1.5 Config storage (mirrors `src/lib/ai/models-config.ts`)

`src/lib/config/fee-schedule.ts`:
- `FALLBACK_FEE_SCHEDULE` (IISLA 2022 constant above).
- `loadFeeSchedule(): Promise<FeeSchedule>` — reads Firestore `fee_config/schedule`; returns `FALLBACK_FEE_SCHEDULE` if absent or on error.
- `saveFeeSchedule(schedule, updatedBy): Promise<void>` — `setDoc(doc(db,'fee_config','schedule'), { ...schedule, updatedAt: Date.now(), updatedBy })`. Admin-only (enforced by Firestore rules).
- `mergeWithFallback(raw)` — backfills missing fields so a partial doc never crashes the UI.

**Personal override:** add `feeSchedule?: FeeSchedule` to `SurveyorProfile` (`src/types/vehicle.ts`). Stored/synced with the rest of the profile — no new collection. Absent = follow global.

### 1.6 Firestore rules

Add alongside the existing `ai_config/models` block:

```
match /fee_config/schedule {
  allow read: if isSignedIn();
  allow write: if isAdmin();
}
```

Personal `feeSchedule` needs no rule change — it is a field on the user's own profile doc, already covered by the existing profile update rule (not an admin/grant field).

### 1.7 Fees Bill tab — Approach C (`src/components/tabs/FeesTab.tsx`)

The tab already exists with a manual `feeBill.professionalFee` number. Changes:

**Auto-fill:** compute `suggested = computeProfessionalFee(assessment.estimateGrossTotal, parsedIdv, activeSchedule)`.
- On mount / when `estimateGrossTotal`, `idv`, or the active schedule change: if `feeBill.professionalFee` is falsy (0/unset) **and** `suggested > 0`, call `updateFeeBill({ professionalFee: suggested })` in an effect. Once the value is non-zero the effect stops overwriting, so a surveyor's manual entry always wins.
- A hint line under the Professional Fee input: `IISLA {version} · estimate ₹{estimate} {idv-cap note if applied}` and a **↻ Recompute** button that force-sets `professionalFee = suggested` (for when the estimate changes after a value already exists). The field stays fully editable at all times.

**Rate Card panel** (collapsible, collapsed by default — it is config, not per-claim data):
- Loads the active schedule (personal → global → fallback) and shows a source badge: **"Custom (your rate card)"** vs **"Org default (admin)"** vs **"IISLA 2022 (built-in)"**.
- Expanded: an editable slab table (label, upTo, base, marginalFrom, marginalRatePct, maxFee). Editing writes to `profile.feeSchedule` (via profile store) — the surveyor's personal default across all their claims.
- **"Reset to org default"** clears `profile.feeSchedule` so the surveyor follows the admin global again.

### 1.8 Admin Panel (`src/components/admin/AdminDashboard.tsx`)

New **"Survey Fee Schedule"** section (admin-only, following the AI-models editor pattern):
- Loads `fee_config/schedule` via `loadFeeSchedule()`.
- Same slab-table editor; **Save** calls `saveFeeSchedule(schedule, adminName)` → writes the global doc = **"change for all users at once."**
- Shows `updatedBy` / `updatedAt`.

**Semantics note (intentional):** surveyors who have set a personal `feeSchedule` keep it until they hit *Reset to org default*; the admin global reaches everyone who has **not** customised. No force-wipe of personal overrides is included.
_ponytail: skipped an admin "force-reset all personal overrides" broadcast — add only if org policy later requires overriding surveyor customisations._

### 1.9 Reports

No report change needed for the fee: `feeBill.professionalFee` already flows into the fee bill (`spot-fee-bill-builder.ts`, `FeeBillDocument.tsx`). Auto-fill simply populates that existing number.

---

## Part 2 — Appointment date on reports

"Appointment date" is a **different field per survey type**; each has its own gaps.

| Survey type | Field | Present | Missing → to fix |
|---|---|---|---|
| Final | `accident.appointmentDate` — "Final Survey Appointment Date" | UIIC PDF, UIIC HTML | **standard-report-builder.ts**, **word-builder.ts** |
| Spot | `spotDetails.allotmentDate` — "Date of Allotment" | Spot HTML print (`SpotPrintReport.tsx`) | **SpotReportDocument.tsx** (Spot PDF) |
| Valuation | `inspectionDate` — "Inspection Date" (no insurer appointment by design) | HTML + PDF | — (nothing to add) |

### Fixes
1. **`standard-report-builder.ts`** — add "Appointment Date" to section 4 (Accident & Survey Details), rendering `formatDateDMY(accident.appointmentDate)`.
2. **`word-builder.ts`** — add a "Final Appt. Date" cell to the Accident/Survey KV rows, `formatDateDMY(claim.accident.appointmentDate)`.
3. **`SpotReportDocument.tsx`** (Spot PDF) — add "Date of Allotment" (`fd(spotDetails.allotmentDate)`) to the report-meta block, matching what the Spot HTML print already shows.

Empty values render as the existing dash placeholder (`—`), consistent with sibling fields.

---

## Files touched

**New**
- `src/lib/config/fee-schedule.ts` — schedule types, IISLA-2022 fallback, load/save, resolver.
- `src/lib/calculations/professional-fee.ts` — pure fee calculation.
- `src/lib/calculations/professional-fee.test.ts` — boundary + IDV-cap self-check.

**Edited**
- `src/types/vehicle.ts` — `feeSchedule?: FeeSchedule` on `SurveyorProfile`.
- `src/components/tabs/FeesTab.tsx` — auto-fill + Rate Card panel.
- `src/components/admin/AdminDashboard.tsx` — global Fee Schedule editor.
- `firestore.rules` — `fee_config/schedule` block.
- `src/lib/reports/standard-report-builder.ts` — Final appointment date.
- `src/lib/reports/word-builder.ts` — Final appointment date.
- `src/components/pdf/SpotReportDocument.tsx` — Spot allotment date.

## Out of scope / YAGNI
- Admin force-reset of personal overrides (noted above).
- A dedicated left-nav Fee Schedule tab (chose Approach C — the collapsible panel in Fees Bill).
- Any Valuation appointment field (uses Inspection Date by design).
- Historical schedule versioning beyond the single `version` string.
