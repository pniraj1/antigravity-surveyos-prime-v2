# Reliable Cross-Device Claim Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a surveyor's assessment reliably appear on a second computer by adding an explicit "Save to Cloud" action (pushing the full claim to the Firebase vault + flushing photos/documents to Google Drive), fixing the clock-skew bug that makes the receiving device skip claims, adding an automatic push when the tab is hidden, and replacing the fake "100% Synced" indicator with the truth.

**Architecture:** Today claim *data* lives in Firestore (`users/{uid}/claims/{id}`, photos stripped) and *photos/documents* live in Google Drive (per-claim folder). Cross-device sync only happens on milestone events (tab switch, claim switch, login) and the page-close path only writes to a **device-local** IndexedDB queue that drains on the *same* device's next login — so data created and abandoned on Computer 1 never reaches the cloud. Even when it does, the pull on Computer 2 filters by `where('updatedAt', '>', sinceTimestamp)` comparing ISO strings generated on two different machine clocks, so clock skew can hide a claim that is actually in the vault. This plan keeps the existing storage model (it already stores the complete claim minus photos) and fixes **trigger reliability**, **pull reliability**, and **status honesty** — no data-model restructure.

**Tech Stack:** Next.js 16, React 19, Zustand 5, Firebase Firestore 12, `idb` 8 (IndexedDB), Google Drive REST (`drive.file` scope), Vitest 4 (node env, `globals: true`, `@`→`src` alias), Tailwind 4, lucide-react, sonner.

---

## File Structure

| File | Responsibility | New/Modify |
|---|---|---|
| `src/lib/firebase/sync-cursor.ts` | Pure helper: roll the pull cursor back by a skew margin so the receiving device cannot skip a claim due to clock differences | **New** |
| `src/lib/firebase/__tests__/sync-cursor.test.ts` | Unit tests for the cursor helper | **New** |
| `src/lib/firebase/sync.ts` | Use the skew-margin cursor inside `pullClaimsFromCloud` | Modify |
| `src/lib/sync/sync-health.ts` | Pure helper: compute real sync health from local + cloud claim ids | **New** |
| `src/lib/sync/__tests__/sync-health.test.ts` | Unit tests for sync-health | **New** |
| `src/components/tabs/CloudVaultTab.tsx` | Render the real sync health instead of hardcoded "100% Synced" | Modify |
| `src/lib/sync/syncClaimNow.ts` | Pure (dependency-injected) orchestrator: push full claim to vault (critical path) + flush Drive queue (best-effort) | **New** |
| `src/lib/sync/__tests__/syncClaimNow.test.ts` | Unit tests for the orchestrator | **New** |
| `src/components/sync/SaveProgressButton.tsx` | Reusable button that calls `syncClaimNow` and gives honest user feedback | **New** |
| `src/components/tabs/AssessmentTab.tsx` | Mount the Save button in the assessment tab header | Modify |
| `src/components/tabs/BillCheckTab.tsx` | Mount the Save button in the bill-check tab header | Modify |
| `src/hooks/useCloudSync.ts` | Add a `visibilitychange → hidden` real-push safety net | Modify |

**Task order rationale:** Tasks 1–2 are pure-logic wins (clock fix + honest status) that ship independently. Task 3–5 deliver the Save button (the feature the user asked for). Task 6 is the automatic safety net. Each task leaves the app working and testable.

---

### Task 1: Skew-margin pull cursor (fixes the "vault had it but Computer 2 skipped it" bug)

**Files:**
- Create: `src/lib/firebase/sync-cursor.ts`
- Test: `src/lib/firebase/__tests__/sync-cursor.test.ts`
- Modify: `src/lib/firebase/sync.ts:152-157`

- [ ] **Step 1: Write the failing test**

Create `src/lib/firebase/__tests__/sync-cursor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applySkewMargin, DEFAULT_SKEW_MARGIN_MS } from '@/lib/firebase/sync-cursor';

describe('applySkewMargin', () => {
  it('returns null for a null cursor (full pull on first login)', () => {
    expect(applySkewMargin(null)).toBeNull();
  });

  it('rolls a valid ISO timestamp back by the default margin', () => {
    const since = '2026-06-12T10:00:00.000Z';
    const expected = new Date(Date.parse(since) - DEFAULT_SKEW_MARGIN_MS).toISOString();
    expect(applySkewMargin(since)).toBe(expected);
  });

  it('honours a custom margin', () => {
    const since = '2026-06-12T10:00:00.000Z';
    expect(applySkewMargin(since, 60_000)).toBe('2026-06-12T09:59:00.000Z');
  });

  it('returns null for an invalid timestamp (safe fallback to full pull)', () => {
    expect(applySkewMargin('not-a-date')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/firebase/__tests__/sync-cursor.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/firebase/sync-cursor"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/firebase/sync-cursor.ts`:

```ts
// ═══════════════════════════════════════════════════════════
// PULL CURSOR HELPER
// Cross-device clocks are never perfectly in sync. The delta pull
// filters claims with `updatedAt > sinceTimestamp`, comparing an ISO
// string stamped on the EDITING device against a cutoff stamped on the
// PULLING device. If the editing device's clock lags, a freshly-pushed
// claim looks "older" than the cutoff and is skipped. Rolling the cutoff
// back by a margin re-fetches a small recent window so nothing is missed.
// Re-fetching is harmless: pullClaimsFromCloud only overwrites a local
// claim when remote is newer AND the local copy is not dirty.
// ═══════════════════════════════════════════════════════════

/** Safety window for cross-device clock skew. 5 minutes covers normal drift. */
export const DEFAULT_SKEW_MARGIN_MS = 5 * 60 * 1000;

/**
 * Returns a pull cursor rolled back by `marginMs`.
 * - null in  → null out (first login on this device → full pull).
 * - invalid timestamp → null (safe fallback to full pull).
 */
export function applySkewMargin(
  sinceTimestamp: string | null,
  marginMs: number = DEFAULT_SKEW_MARGIN_MS
): string | null {
  if (sinceTimestamp === null) return null;
  const t = Date.parse(sinceTimestamp);
  if (Number.isNaN(t)) return null;
  return new Date(t - marginMs).toISOString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/firebase/__tests__/sync-cursor.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the helper into the pull**

In `src/lib/firebase/sync.ts`, add the import after line 9 (`import { db } from './config';`):

```ts
import { applySkewMargin } from './sync-cursor';
```

Then replace lines 152-157 (the start of `pullClaimsFromCloud`):

```ts
export async function pullClaimsFromCloud(uid: string, sinceTimestamp: string | null) {
  const claimsRef = collection(db, `users/${uid}/claims`);
  const q = sinceTimestamp
    ? query(claimsRef, where('updatedAt', '>', sinceTimestamp))
    : query(claimsRef);
  const querySnap = await getDocs(q);
```

with:

```ts
export async function pullClaimsFromCloud(uid: string, sinceTimestamp: string | null) {
  const claimsRef = collection(db, `users/${uid}/claims`);
  // Roll the cursor back by a skew margin so a claim stamped on another
  // device's slightly-behind clock is never skipped. See sync-cursor.ts.
  const cursor = applySkewMargin(sinceTimestamp);
  const q = cursor
    ? query(claimsRef, where('updatedAt', '>', cursor))
    : query(claimsRef);
  const querySnap = await getDocs(q);
```

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS (all existing tests + the 4 new ones).

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase/sync-cursor.ts src/lib/firebase/__tests__/sync-cursor.test.ts src/lib/firebase/sync.ts
git commit -m "fix: roll pull cursor back by skew margin so receiving device never skips a claim"
```

---

### Task 2: Honest sync health in Cloud Vault (replaces hardcoded "100% Synced")

**Files:**
- Create: `src/lib/sync/sync-health.ts`
- Test: `src/lib/sync/__tests__/sync-health.test.ts`
- Modify: `src/components/tabs/CloudVaultTab.tsx:140-146`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sync/__tests__/sync-health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSyncHealth } from '@/lib/sync/sync-health';

describe('computeSyncHealth', () => {
  it('reports 100% when both sides are empty', () => {
    expect(computeSyncHealth([], [])).toEqual({
      total: 0, syncedCount: 0, localOnlyCount: 0, cloudOnlyCount: 0, syncedPct: 100,
    });
  });

  it('reports 100% when every local claim is in the cloud', () => {
    const r = computeSyncHealth(['a', 'b'], ['a', 'b']);
    expect(r.syncedPct).toBe(100);
    expect(r.localOnlyCount).toBe(0);
  });

  it('exposes local-only claims that never reached the cloud (the 21-vs-27 case)', () => {
    const local = Array.from({ length: 27 }, (_, i) => `c${i}`);
    const cloud = local.slice(0, 21); // 6 local-only
    const r = computeSyncHealth(local, cloud);
    expect(r.total).toBe(27);
    expect(r.syncedCount).toBe(21);
    expect(r.localOnlyCount).toBe(6);
    expect(r.cloudOnlyCount).toBe(0);
    expect(r.syncedPct).toBe(78); // round(21/27*100)
  });

  it('counts cloud-only claims not yet pulled to this device', () => {
    const r = computeSyncHealth(['a'], ['a', 'b']);
    expect(r.cloudOnlyCount).toBe(1);
    expect(r.syncedPct).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/sync/__tests__/sync-health.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/sync/sync-health"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/sync/sync-health.ts`:

```ts
// ═══════════════════════════════════════════════════════════
// SYNC HEALTH — honest cross-device sync status.
// Replaces the previously hardcoded "100% Synced" label.
// Pure function of claim ids on each side; no I/O.
// ═══════════════════════════════════════════════════════════

export interface SyncHealth {
  /** Union of local + cloud claim ids. */
  total: number;
  /** Claims present in BOTH local and cloud. */
  syncedCount: number;
  /** Claims on this device but NOT in the cloud (not backed up). */
  localOnlyCount: number;
  /** Claims in the cloud but NOT on this device (not pulled down yet). */
  cloudOnlyCount: number;
  /** syncedCount / total, as a rounded 0-100 percentage. 100 when empty. */
  syncedPct: number;
}

export function computeSyncHealth(
  localIds: readonly string[],
  cloudIds: readonly string[]
): SyncHealth {
  const local = new Set(localIds);
  const cloud = new Set(cloudIds);
  const union = new Set<string>([...local, ...cloud]);

  let syncedCount = 0;
  let localOnlyCount = 0;
  for (const id of local) {
    if (cloud.has(id)) syncedCount++;
    else localOnlyCount++;
  }
  let cloudOnlyCount = 0;
  for (const id of cloud) {
    if (!local.has(id)) cloudOnlyCount++;
  }

  const total = union.size;
  const syncedPct = total === 0 ? 100 : Math.round((syncedCount / total) * 100);

  return { total, syncedCount, localOnlyCount, cloudOnlyCount, syncedPct };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/sync/__tests__/sync-health.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Render real health in CloudVaultTab**

In `src/components/tabs/CloudVaultTab.tsx`, add the import after line 6 (`import { getAllClaims } from '@/lib/storage/indexeddb';`):

```ts
import { computeSyncHealth } from '@/lib/sync/sync-health';
```

Then add a derived value immediately after the existing `filteredClaims` declaration (currently lines 64-68). Insert below it:

```ts
  const syncHealth = computeSyncHealth(
    localClaims.map(c => c.id),
    cloudClaims.map(c => c.id),
  );
```

Then replace the hardcoded "Sync Health" card (currently lines 140-146):

```tsx
            <div className="p-6 rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/10 text-white">
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-100 mb-1">Sync Health</div>
              <div className="text-2xl font-black">100% Synced</div>
              <div className="text-[10px] text-blue-100 font-bold mt-1 flex items-center gap-1">
                <Cloud size={12} /> Real-time Protection Active
              </div>
            </div>
```

with:

```tsx
            <div className={`p-6 rounded-2xl shadow-xl text-white ${syncHealth.localOnlyCount > 0 ? 'bg-amber-600 shadow-amber-500/10' : 'bg-blue-600 shadow-blue-500/10'}`}>
              <div className="text-[10px] font-black uppercase tracking-wider text-white/70 mb-1">Sync Health</div>
              <div className="text-2xl font-black">{syncHealth.syncedPct}% Synced</div>
              <div className="text-[10px] text-white/80 font-bold mt-1 flex items-center gap-1">
                <Cloud size={12} />
                {syncHealth.localOnlyCount > 0
                  ? `${syncHealth.localOnlyCount} claim${syncHealth.localOnlyCount > 1 ? 's' : ''} not yet backed up`
                  : 'All claims backed up to cloud'}
              </div>
            </div>
```

- [ ] **Step 6: Run full suite + lint**

Run: `npm test`
Expected: PASS.
Run: `npm run lint`
Expected: no new errors in `CloudVaultTab.tsx` or `sync-health.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sync/sync-health.ts src/lib/sync/__tests__/sync-health.test.ts src/components/tabs/CloudVaultTab.tsx
git commit -m "fix: show real sync health in Cloud Vault instead of hardcoded 100%"
```

---

### Task 3: `syncClaimNow` orchestrator (vault = critical path, Drive = best-effort)

**Files:**
- Create: `src/lib/sync/syncClaimNow.ts`
- Test: `src/lib/sync/__tests__/syncClaimNow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sync/__tests__/syncClaimNow.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { syncClaimNow, type SyncClaimDeps } from '@/lib/sync/syncClaimNow';
import type { ClaimData } from '@/types';

const claim = { id: 'claim-1', updatedAt: '2026-06-12T10:00:00.000Z' } as unknown as ClaimData;

function deps(over: Partial<SyncClaimDeps> = {}): SyncClaimDeps {
  return {
    pushClaimToCloud: vi.fn().mockResolvedValue(undefined),
    flushDriveQueue: vi.fn().mockResolvedValue(3),
    isOnline: () => true,
    ...over,
  };
}

describe('syncClaimNow', () => {
  it('does not push when offline and reports offline', async () => {
    const d = deps({ isOnline: () => false });
    const r = await syncClaimNow(claim, 'uid-1', d);
    expect(r).toEqual({ ok: false, pushedToVault: false, driveFilesSynced: 0, error: 'offline' });
    expect(d.pushClaimToCloud).not.toHaveBeenCalled();
  });

  it('pushes the full claim to the vault and flushes Drive on success', async () => {
    const d = deps();
    const r = await syncClaimNow(claim, 'uid-1', d);
    expect(d.pushClaimToCloud).toHaveBeenCalledWith('uid-1', claim);
    expect(r.ok).toBe(true);
    expect(r.pushedToVault).toBe(true);
    expect(r.driveFilesSynced).toBe(3);
  });

  it('fails when the vault push throws (the cross-device data did not save)', async () => {
    const d = deps({ pushClaimToCloud: vi.fn().mockRejectedValue(new Error('permission-denied')) });
    const r = await syncClaimNow(claim, 'uid-1', d);
    expect(r.ok).toBe(false);
    expect(r.pushedToVault).toBe(false);
    expect(r.error).toContain('permission-denied');
  });

  it('still succeeds when only Drive fails (vault is the source of truth for assessment data)', async () => {
    const d = deps({ flushDriveQueue: vi.fn().mockRejectedValue(new Error('drive down')) });
    const r = await syncClaimNow(claim, 'uid-1', d);
    expect(r.ok).toBe(true);
    expect(r.pushedToVault).toBe(true);
    expect(r.driveFilesSynced).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/sync/__tests__/syncClaimNow.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/sync/syncClaimNow"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/sync/syncClaimNow.ts`:

```ts
// ═══════════════════════════════════════════════════════════
// SYNC CLAIM NOW — explicit, on-demand cross-device save.
// Critical path: push the FULL claim (minus photos) to the Firestore
// vault — that is the only store the other device reads assessment data
// from. Best-effort: flush queued photos/documents to Google Drive.
// Drive failure must NOT fail the whole operation: the assessment is
// already safe in the vault and photos retry automatically later.
// Dependency-injected so it is unit-testable in the node test env.
// ═══════════════════════════════════════════════════════════

import type { ClaimData } from '@/types';

export interface SyncClaimDeps {
  pushClaimToCloud: (uid: string, claim: ClaimData) => Promise<unknown>;
  flushDriveQueue: () => Promise<number>;
  isOnline: () => boolean;
}

export interface SyncClaimResult {
  ok: boolean;
  pushedToVault: boolean;
  driveFilesSynced: number;
  error?: string;
}

export async function syncClaimNow(
  claim: ClaimData,
  uid: string,
  deps: SyncClaimDeps,
): Promise<SyncClaimResult> {
  if (!deps.isOnline()) {
    return { ok: false, pushedToVault: false, driveFilesSynced: 0, error: 'offline' };
  }

  try {
    await deps.pushClaimToCloud(uid, claim);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'vault push failed';
    return { ok: false, pushedToVault: false, driveFilesSynced: 0, error };
  }

  let driveFilesSynced = 0;
  try {
    driveFilesSynced = await deps.flushDriveQueue();
  } catch {
    // Non-fatal: assessment data is already in the vault. Photos stay
    // queued in IndexedDB and retry on reconnect via useCloudSync.
    driveFilesSynced = 0;
  }

  return { ok: true, pushedToVault: true, driveFilesSynced };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/sync/__tests__/syncClaimNow.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/syncClaimNow.ts src/lib/sync/__tests__/syncClaimNow.test.ts
git commit -m "feat: add syncClaimNow orchestrator (vault critical-path, Drive best-effort)"
```

---

### Task 4: `SaveProgressButton` component

**Files:**
- Create: `src/components/sync/SaveProgressButton.tsx`

> No unit test: the Vitest env is `node` (no DOM), so this thin view component is verified manually. All testable logic lives in `syncClaimNow` (Task 3).

- [ ] **Step 1: Create the component**

Create `src/components/sync/SaveProgressButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Cloud, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { syncClaimNow } from '@/lib/sync/syncClaimNow';
import { pushClaimToCloud } from '@/lib/firebase/sync';
import { flushDriveQueue } from '@/lib/drive';
import { saveClaim } from '@/lib/storage/indexeddb';

type BtnState = 'idle' | 'saving' | 'saved' | 'error';

interface SaveProgressButtonProps {
  className?: string;
}

export function SaveProgressButton({ className = '' }: SaveProgressButtonProps) {
  const currentClaim = useClaimStore(s => s.currentClaim);
  const user = useAuthStore(s => s.user);
  const setSaveStatus = useUIStore(s => s.setSaveStatus);
  const [state, setState] = useState<BtnState>('idle');

  const handleClick = async () => {
    if (!currentClaim || !user) {
      toast.error('No claim open, or you are not signed in.');
      return;
    }

    setState('saving');
    setSaveStatus('saving');

    // Layer 1 — guarantee a local save first so data is never lost even if
    // the cloud push fails. Non-fatal if this throws; the cloud result drives UI.
    try {
      await saveClaim(currentClaim);
    } catch {
      /* surfaced via the cloud result below */
    }

    const result = await syncClaimNow(currentClaim, user.uid, {
      pushClaimToCloud,
      flushDriveQueue,
      isOnline: () => navigator.onLine,
    });

    if (result.ok) {
      setState('saved');
      setSaveStatus('saved');
      toast.success('Saved to cloud — available on all your devices.', { duration: 3000 });
    } else if (result.error === 'offline') {
      setState('error');
      setSaveStatus('queued');
      toast.warning('Saved on this device. It will sync to the cloud when you are back online.', { duration: 5000 });
    } else {
      setState('error');
      setSaveStatus('queued');
      toast.error('Saved on this device, but cloud sync failed. It will retry automatically.', { duration: 6000 });
    }

    setTimeout(() => setState('idle'), 2800);
  };

  const cfg: Record<BtnState, { icon: React.ReactNode; label: string }> = {
    idle:   { icon: <Cloud size={16} />, label: 'Save to Cloud' },
    saving: { icon: <Loader2 size={16} className="animate-spin" />, label: 'Saving…' },
    saved:  { icon: <CheckCircle size={16} />, label: 'Saved everywhere' },
    error:  { icon: <AlertTriangle size={16} />, label: 'Saved locally' },
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'saving' || !currentClaim}
      title="Save this claim to the cloud so it is available on your other computers"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${className}`}
      style={{ background: state === 'error' ? '#B45309' : '#0D1B2A', color: '#F8F9FA' }}
    >
      {cfg[state].icon}
      <span>{cfg[state].label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Verify it type-checks and lints**

Run: `npm run lint`
Expected: no errors for `SaveProgressButton.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/sync/SaveProgressButton.tsx
git commit -m "feat: add SaveProgressButton for explicit cross-device save"
```

---

### Task 5: Mount the Save button in the Assessment and Bill Check tabs

**Files:**
- Modify: `src/components/tabs/AssessmentTab.tsx`
- Modify: `src/components/tabs/BillCheckTab.tsx`

> No unit test (view wiring). Verified manually by running the app in Step 4.

- [ ] **Step 1: Read both tab files to locate the header/toolbar row**

Run (read, don't guess): open `src/components/tabs/AssessmentTab.tsx` and `src/components/tabs/BillCheckTab.tsx`. Find the top-level header area — the row that holds the tab title / existing action buttons (look for the first `<h1>`, `<h2>`, or a flex row near the top of the returned JSX).

- [ ] **Step 2: Add the import to `AssessmentTab.tsx`**

Add alongside the existing imports at the top of `src/components/tabs/AssessmentTab.tsx`:

```tsx
import { SaveProgressButton } from '@/components/sync/SaveProgressButton';
```

- [ ] **Step 3: Place the button in the Assessment header**

Inside the header/toolbar row identified in Step 1, add the button as the right-aligned action. If the header is a flex container, place it at the end:

```tsx
<SaveProgressButton className="ml-auto" />
```

If the header is not already a flex row, wrap the existing title and the button:

```tsx
<div className="flex items-center justify-between gap-3">
  {/* existing title element stays here */}
  <SaveProgressButton />
</div>
```

- [ ] **Step 4: Repeat for `BillCheckTab.tsx`**

Add the same import to `src/components/tabs/BillCheckTab.tsx`:

```tsx
import { SaveProgressButton } from '@/components/sync/SaveProgressButton';
```

and place `<SaveProgressButton className="ml-auto" />` (or the wrapped variant) in its header row, mirroring Step 3.

- [ ] **Step 5: Manual verification (the actual bug scenario)**

1. Run: `npm run dev`
2. Sign in, create a new claim, open the **Assessment** tab, enter data.
3. Open the **Bill Check** tab, enter a bill total.
4. Click **Save to Cloud**. Confirm the toast "Saved to cloud — available on all your devices." and the button shows "Saved everywhere".
5. In the browser devtools console, confirm a log line `[Sync] Pushed claim <id> to cloud`.
6. Open the app in a different browser profile (simulating Computer 2), sign in as the same user, and confirm the claim — with both the assessment and bill-check data — appears.

Expected: the claim and its assessment + bill check are visible on the second session.

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/AssessmentTab.tsx src/components/tabs/BillCheckTab.tsx
git commit -m "feat: add Save to Cloud button to Assessment and Bill Check tabs"
```

---

### Task 6: Automatic push on tab-hidden (safety net for forgetful surveyors)

**Files:**
- Modify: `src/hooks/useCloudSync.ts` (add a new effect after section 2c, currently ending at line 200)

> No unit test (React effect bound to `document` lifecycle). Verified manually in Step 3.

- [ ] **Step 1: Add the visibilitychange effect**

In `src/hooks/useCloudSync.ts`, immediately after the section "2c. Milestone: Page close / refresh" effect (the block that ends at line 200 with `}, []);`), insert:

```ts
  // ─── 2d. Milestone: Tab hidden / app backgrounded ───────
  // visibilitychange fires reliably BEFORE the page is frozen or closed
  // (unlike beforeunload, which can only queue locally). We attempt a real
  // cloud push here so a surveyor who just switches tabs or minimises the
  // window — then walks to another computer — has their latest state in the
  // vault. milestonePushRef pushes when online and queues when offline.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'hidden') return;
      const claim = currentClaimRef.current;
      const uid = userRef.current?.uid;
      if (!claim || !uid || !isAuthRef.current) return;
      milestonePushRef.current(claim, uid);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
```

(`currentClaimRef`, `userRef`, `isAuthRef`, and `milestonePushRef` are already declared at the top of `useCloudSync` — lines 44-53 — so no new refs are needed.)

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors in `useCloudSync.ts`.

- [ ] **Step 3: Manual verification**

1. Run: `npm run dev`, sign in, open a claim, edit a field.
2. Switch to another browser tab (or minimise the window) — this fires `visibilitychange: hidden`.
3. In devtools console, confirm `[useCloudSync] Milestone push: claim <id>` appears.
4. In a second browser profile signed in as the same user, confirm the edit is present.

Expected: the edit reaches the vault without an explicit button press.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCloudSync.ts
git commit -m "feat: push current claim to cloud on visibilitychange:hidden"
```

---

## Out of Scope (deliberately deferred)

These were discussed but are **not** in this plan; they are follow-ups, not blockers:

- **Server-timestamp pull cursor.** The 5-minute skew margin (Task 1) is the low-risk fix. Switching the delta query to a Firestore `serverTimestamp()`-driven cursor is the fully-correct long-term fix but requires a read-back and a schema field — defer to a hardening pass.
- **Photos auto-restore on the second device.** `listFilesInFolder` / `downloadFileAsBase64` exist in `src/lib/drive/index.ts` but are not wired into claim open. Cross-device *photo* viewing is a separate feature.
- **Lightweight claim index doc** (eager-index / lazy-payload read optimisation). A reads/egress optimisation, not required to fix the bug.
- **`extractedData` size audit** (1 MiB Firestore doc limit risk). Worth a separate investigation.

## Risk & Cost Notes

- **Firestore writes (the binding free-tier limit — 20k/day):** the Save button is one write per press; the visibilitychange push is rate-limited by user behaviour (only on hide). Neither pushes on every keystroke, so this stays within the Spark free tier for a small surveyor team. Do **not** add per-keystroke debounced pushing.
- **Drive cost:** zero to Firebase — files live in the surveyor's own 15 GB Google quota via `drive.file` scope.
- **Re-pull from skew margin (Task 1):** re-fetches at most a 5-minute window of recently-changed claims; the reconciler dedupes and never overwrites locally-dirty claims, so it is safe and cheap.

---

## Self-Review

**Spec coverage:**
- ✅ Save button on assessment + bill check → Tasks 4 & 5.
- ✅ Button pushes the assessment to the **vault** (the cross-device fix) → Task 3 (`pushClaimToCloud`) + Task 4 wiring.
- ✅ Button also pushes photos/documents to **Drive** → Task 3 (`flushDriveQueue`).
- ✅ Clock-skew fix so the receiving computer reliably pulls → Task 1.
- ✅ Automatic safety-net push (not just the button) → Task 6.
- ✅ Honest sync status instead of fake "100% Synced" → Task 2.

**Placeholder scan:** No TBD/TODO; every code step contains complete code. Task 5 intentionally includes a "read the file first" step because the tab headers are large and varied — the import and element to add are given exactly; only the insertion point is located at execution time.

**Type consistency:** `SyncClaimDeps` / `SyncClaimResult` defined in Task 3 are imported unchanged in Task 4. `computeSyncHealth` signature (`readonly string[]` × 2 → `SyncHealth`) matches its use in Task 2 (`.map(c => c.id)`). `applySkewMargin(string | null, number?)` matches its call in Task 1 Step 5. `useAuthStore(s => s.user)`, `useUIStore(s => s.setSaveStatus)`, and `useClaimStore(s => s.currentClaim)` all match the store definitions verified during planning.
