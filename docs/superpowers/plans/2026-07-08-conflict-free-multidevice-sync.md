# Conflict-Free Multi-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make single-user multi-device sync bulletproof — a stale device can never silently overwrite newer cloud data, and unsynced work is never lost.

**Architecture:** Add a monotonic `version` to each claim; replace the unconditional vault write with a Firestore transaction that refuses to overwrite a newer cloud version (optimistic concurrency). On refusal, adopt the newer cloud copy and stash the local one in a `recoveredClaims` store (Option B). Auto-flush pending claims on logout/kick when online, and surface a prominent sync-status indicator.

**Tech Stack:** TypeScript, Next.js (static export), Firestore (`firebase/firestore` `runTransaction`), `idb` IndexedDB wrapper, Zustand, Vitest, sonner toasts.

## Global Constraints

- Single-user assumption: one surveyor across their own devices; no field-level merge, no multi-user concurrency, no CRDT.
- Ordering source of truth is the integer `version`, never wall-clock `updatedAt`.
- Never silently delete a user's data — a superseded local copy is always stashed.
- Follow existing test style: unit-test **pure** functions; storage/transaction paths are verified via the Firebase emulator or manual steps (matches `sync-cursor.test.ts`, `session.test.ts`).
- Vault writes exclude photos (existing `stripPhotos`), sanitize `undefined`→`null` (existing `sanitize`).
- Commit after every task.

---

## File Structure

- `src/types/claim.ts` — add `version` field to `ClaimData`.
- `src/lib/firebase/sync-guard.ts` — **new**, pure decision helpers (`canOverwrite`, `selectDirtyClaims`, `countUnsynced`) + `ClaimConflictError`. Kept separate so it's unit-testable with zero Firestore/IndexedDB imports.
- `src/lib/firebase/sync.ts` — transactional guarded `pushClaimToCloud`, guarded `syncDeltaToCloud`, `recoverFromConflict`, `flushAllPendingToCloud`.
- `src/lib/storage/indexeddb.ts` — `recoveredClaims` store (DB v6) + `addRecoveredClaim` / `getRecoveredClaims`.
- `src/hooks/useAuth.ts` — flush before logout.
- `src/hooks/useSessionHeartbeat.ts` — flush before sign-out on kick.
- `src/components/sync/SyncStatusBadge.tsx` — **new**, prominent unsynced indicator.
- `src/components/tabs/RecoveredClaimsView.tsx` — **new**, minimal read-only stash list.
- Tests: `src/lib/firebase/__tests__/sync-guard.test.ts`.

---

## Task 1: Add `version` to ClaimData and the pure overwrite guard

**Files:**
- Modify: `src/types/claim.ts` (add field near `updatedAt`)
- Create: `src/lib/firebase/sync-guard.ts`
- Test: `src/lib/firebase/__tests__/sync-guard.test.ts`

**Interfaces:**
- Produces: `canOverwrite(localVersion: number, cloudVersion: number): boolean`; `class ClaimConflictError extends Error { remote: ClaimData }`

- [ ] **Step 1: Add the field to the type**

In `src/types/claim.ts`, inside `interface ClaimData`, right after the `updatedAt` line:
```typescript
  /** Cloud generation this claim is based on. Bumped only by a successful
   *  cloud write or a pull — never by local edits. Missing/legacy = 0. */
  version?: number;
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/firebase/__tests__/sync-guard.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { canOverwrite } from '../sync-guard';

describe('canOverwrite', () => {
  it('allows when cloud is at the same version the device based on', () => {
    expect(canOverwrite(5, 5)).toBe(true);
  });
  it('allows when the device is ahead of the cloud (new claim, cloud=0)', () => {
    expect(canOverwrite(0, 0)).toBe(true);
    expect(canOverwrite(3, 2)).toBe(true);
  });
  it('refuses when the cloud has moved ahead of the device', () => {
    expect(canOverwrite(5, 6)).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run src/lib/firebase/__tests__/sync-guard.test.ts`
Expected: FAIL — cannot resolve `../sync-guard`.

- [ ] **Step 4: Implement `sync-guard.ts`**

Create `src/lib/firebase/sync-guard.ts`:
```typescript
import type { ClaimData } from '@/types';

/** True if a device based on `localVersion` may overwrite the cloud's
 *  `cloudVersion`. Refuses only when the cloud is strictly newer. */
export function canOverwrite(localVersion: number, cloudVersion: number): boolean {
  return cloudVersion <= localVersion;
}

/** Thrown by a guarded push when the cloud version is newer than the
 *  device's base version. Carries the newer remote claim for recovery. */
export class ClaimConflictError extends Error {
  remote: ClaimData;
  constructor(remote: ClaimData) {
    super('Claim version conflict — cloud copy is newer');
    this.name = 'ClaimConflictError';
    this.remote = remote;
  }
}
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `npx vitest run src/lib/firebase/__tests__/sync-guard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/claim.ts src/lib/firebase/sync-guard.ts src/lib/firebase/__tests__/sync-guard.test.ts
git commit -m "feat(sync): add claim version field and canOverwrite guard"
```

---

## Task 2: Transactional guarded `pushClaimToCloud`

Replaces the unconditional `setDoc` with a version-checked transaction. On conflict it throws `ClaimConflictError` (recovery is added in Task 5).

**Files:**
- Modify: `src/lib/firebase/sync.ts` (`pushClaimToCloud`, ~line 68)

**Interfaces:**
- Consumes: `canOverwrite`, `ClaimConflictError` (Task 1)
- Produces: `pushClaimToCloud(uid: string, claim: ClaimData, opts?: { mirrorToDrive?: boolean }): Promise<ClaimData>` — returns the pushed claim with its new `version`; throws `ClaimConflictError` when the cloud is newer.

- [ ] **Step 1: Add imports**

In `src/lib/firebase/sync.ts`, extend the firestore import and add the guard import:
```typescript
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch, runTransaction } from 'firebase/firestore';
import { canOverwrite, ClaimConflictError } from './sync-guard';
import { saveClaim } from '../storage/indexeddb';
```
(`saveClaim` may already be imported via the indexeddb import block — if so, add it there instead of a new line.)

- [ ] **Step 2: Replace the body of `pushClaimToCloud`**

Replace the existing function (from `export async function pushClaimToCloud` through its closing brace) with:
```typescript
export async function pushClaimToCloud(uid: string, claim: ClaimData, opts?: { mirrorToDrive?: boolean }) {
  const claimRef = doc(db, `users/${uid}/claims`, claim.id);
  const localVersion = claim.version ?? 0;

  // Version-guarded write: refuse if the cloud has moved ahead of us.
  const newVersion = await runTransaction(db, async (tx) => {
    const snap = await tx.get(claimRef);
    const cloudVersion = snap.exists() ? ((snap.data() as ClaimData).version ?? 0) : 0;
    if (!canOverwrite(localVersion, cloudVersion)) {
      throw new ClaimConflictError(snap.data() as ClaimData);
    }
    const next = cloudVersion + 1;
    tx.set(claimRef, { ...stripPhotos(claim), version: next, ownerId: uid });
    return next;
  });

  // Reflect the new cloud generation locally without marking the claim dirty.
  const pushed: ClaimData = { ...claim, version: newVersion };
  await saveClaim(pushed, { preserveUpdatedAt: true });
  await setPushedAt(claim.id, claim.updatedAt);
  logger.log(`[Sync] Pushed claim ${claim.id} to cloud v${newVersion} (photos excluded).`);
  if (opts?.mirrorToDrive !== false) backupClaimToDrive(pushed).catch(() => {});
  return pushed;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify existing sync tests still pass**

Run: `npx vitest run src/lib/sync`
Expected: PASS (existing `syncClaimNow` suite — its `pushClaimToCloud` is a mock, unaffected).

- [ ] **Step 5: Emulator verification (manual)**

Note in the PR/checklist: with the Firebase emulator, push a claim (version 1 created), manually bump the emulator doc's `version`, push again from the app → expect `ClaimConflictError` thrown (recovery lands in Task 5). Document the result.

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase/sync.ts
git commit -m "feat(sync): version-guarded transactional pushClaimToCloud"
```

---

## Task 3: Guarded `syncDeltaToCloud`

The bulk login push must use the guard too, else it re-introduces blind overwrites.

**Files:**
- Modify: `src/lib/firebase/sync.ts` (`syncDeltaToCloud`, ~line 107)

**Interfaces:**
- Consumes: `pushClaimToCloud` (Task 2)

- [ ] **Step 1: Replace the batch loop with sequential guarded pushes**

In `syncDeltaToCloud`, replace the `for (let i = 0; i < changed.length; i += BATCH_SIZE)` batching block with a sequential loop (batching can't carry the per-doc version check):
```typescript
  let failures = 0;
  for (const claim of changed) {
    try {
      await pushClaimToCloud(uid, claim, { mirrorToDrive: false });
    } catch (err) {
      // ClaimConflictError is resolved inside pushClaimToCloud once Task 5
      // lands; any other error means this claim retries on the next sync.
      failures++;
      logger.error(`[Sync] Delta push failed for claim ${claim.id}:`, err);
    }
  }
  if (failures > 0) {
    logger.error(`[Sync] Delta push completed with ${failures} failure(s); they retry next sync.`);
  }
  logger.log(`[Sync] Delta push complete (${changed.length} claims processed).`);
```
Remove the now-unused `writeBatch` import and `BATCH_SIZE` constant if nothing else references them (check with a search first; leave them if still used).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Verify tests**

Run: `npx vitest run src/lib`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/firebase/sync.ts
git commit -m "feat(sync): guarded sequential delta push"
```

---

## Task 4: `recoveredClaims` IndexedDB store

Where superseded local copies are stashed (Option B). Additive store, DB v6.

**Files:**
- Modify: `src/lib/storage/indexeddb.ts` (DB_VERSION, schema interface, upgrade clause, helpers)

**Interfaces:**
- Produces: `addRecoveredClaim(claim: ClaimData, reason: string): Promise<void>`; `getRecoveredClaims(): Promise<RecoveredClaim[]>` where `interface RecoveredClaim { id: string; claimId: string; reportNo: string; claim: ClaimData; supersededAt: string; reason: string }`

- [ ] **Step 1: Bump DB version**

In `src/lib/storage/indexeddb.ts`, change `const DB_VERSION = 5;` to `const DB_VERSION = 6;`.

- [ ] **Step 2: Add the store type to the schema interface**

In the `interface SurveyOSDB { ... }`, after the `driveTracking` block:
```typescript
  recoveredClaims: {
    key: string;
    value: {
      id: string;
      claimId: string;
      reportNo: string;
      claim: ClaimData;
      supersededAt: string;
      reason: string;
    };
  };
```

- [ ] **Step 3: Add the upgrade clause**

In the `upgrade(db, oldVersion)` function, after the v5 `driveTracking` clause:
```typescript
      // Recovered claims — superseded local copies kept as a safety net (v6)
      if (oldVersion < 6 && !db.objectStoreNames.contains('recoveredClaims')) {
        db.createObjectStore('recoveredClaims', { keyPath: 'id' });
      }
```

- [ ] **Step 4: Add the exported type and helpers**

Near the other tracking helpers, add:
```typescript
export interface RecoveredClaim {
  id: string;
  claimId: string;
  reportNo: string;
  claim: ClaimData;
  supersededAt: string;
  reason: string;
}

export async function addRecoveredClaim(claim: ClaimData, reason: string): Promise<void> {
  const db = await getDB();
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.put('recoveredClaims', {
    id,
    claimId: claim.id,
    reportNo: claim.reportNo ?? '',
    claim,
    supersededAt: new Date().toISOString(),
    reason,
  });
}

export async function getRecoveredClaims(): Promise<RecoveredClaim[]> {
  const db = await getDB();
  const all = await db.getAll('recoveredClaims');
  return all.sort((a, b) => (a.supersededAt < b.supersededAt ? 1 : -1));
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/indexeddb.ts
git commit -m "feat(storage): recoveredClaims store (v6) for superseded copies"
```

---

## Task 5: Option B recovery inside `pushClaimToCloud`

Catch `ClaimConflictError`, stash the local copy, adopt the newer cloud copy, notify. This makes conflicts harmless and requires no caller changes.

**Files:**
- Modify: `src/lib/firebase/sync.ts` (`pushClaimToCloud` try/catch + new `recoverFromConflict`)

**Interfaces:**
- Consumes: `addRecoveredClaim`, `saveClaim`, `setPushedAt` (storage); `toast` (sonner)
- Produces: recovery is internal; `pushClaimToCloud` now resolves (returns the adopted remote claim) instead of throwing on conflict.

- [ ] **Step 1: Add imports**

In `src/lib/firebase/sync.ts`:
```typescript
import { toast } from 'sonner';
import { addRecoveredClaim } from '../storage/indexeddb';
```
(Add `addRecoveredClaim` to the existing indexeddb import block.)

- [ ] **Step 2: Wrap the transaction in try/catch and add the recovery helper**

Change the transaction call in `pushClaimToCloud` so a `ClaimConflictError` routes to recovery. Replace `const newVersion = await runTransaction(...)` and everything after it (down to `return pushed;`) with:
```typescript
  let newVersion: number;
  try {
    newVersion = await runTransaction(db, async (tx) => {
      const snap = await tx.get(claimRef);
      const cloudVersion = snap.exists() ? ((snap.data() as ClaimData).version ?? 0) : 0;
      if (!canOverwrite(localVersion, cloudVersion)) {
        throw new ClaimConflictError(snap.data() as ClaimData);
      }
      const next = cloudVersion + 1;
      tx.set(claimRef, { ...stripPhotos(claim), version: next, ownerId: uid });
      return next;
    });
  } catch (err) {
    if (err instanceof ClaimConflictError) {
      return recoverFromConflict(claim, err.remote);
    }
    throw err;
  }

  const pushed: ClaimData = { ...claim, version: newVersion };
  await saveClaim(pushed, { preserveUpdatedAt: true });
  await setPushedAt(claim.id, claim.updatedAt);
  logger.log(`[Sync] Pushed claim ${claim.id} to cloud v${newVersion} (photos excluded).`);
  if (opts?.mirrorToDrive !== false) backupClaimToDrive(pushed).catch(() => {});
  return pushed;
```

Then add the helper below the function:
```typescript
/**
 * Option B recovery: the cloud already has a newer version than this device.
 * Stash the local (refused) copy, adopt the newer remote copy locally, and
 * tell the surveyor. Nothing is lost; the newest version becomes live.
 */
async function recoverFromConflict(local: ClaimData, remote: ClaimData): Promise<ClaimData> {
  await addRecoveredClaim(local, 'superseded-by-newer-device');
  const adopted: ClaimData = { ...remote, photos: (local.photos ?? []) };
  await saveClaim(adopted, { preserveUpdatedAt: true });
  await setPushedAt(adopted.id, adopted.updatedAt);
  toast.warning(
    `"${local.reportNo || local.id}" was updated on another device. The newer version is now shown; your earlier unsynced changes are saved in Recovered.`,
    { duration: 8000 },
  );
  try {
    const channel = new BroadcastChannel('surveyos_claims_sync');
    channel.postMessage('CLAIMS_UPDATED');
    channel.close();
  } catch { /* BroadcastChannel unavailable in some environments */ }
  logger.log(`[Sync] Conflict on ${local.id} resolved — adopted remote v${remote.version ?? 0}, local stashed.`);
  return adopted;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Verify tests**

Run: `npx vitest run src/lib`
Expected: PASS.

- [ ] **Step 5: Emulator verification (manual)**

Re-run the Task 2 emulator scenario: force a newer cloud version, push from the app → expect NO throw; instead a `recoveredClaims` entry appears, the local claim adopts the remote data, and the warning toast fires. Document the result.

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase/sync.ts
git commit -m "feat(sync): Option B recovery — stash local, adopt newer remote on conflict"
```

---

## Task 6: Minimal Recovered view

Read-only list so the surveyor can inspect stashed copies. v1 = list + JSON detail; restore-into-claim is a later enhancement.

**Files:**
- Create: `src/components/tabs/RecoveredClaimsView.tsx`
- Modify: wherever tabs/views are registered (follow the existing tab registration pattern — search for how `CloudVaultTab` is wired and mirror it).

**Interfaces:**
- Consumes: `getRecoveredClaims`, `RecoveredClaim` (Task 4)

- [ ] **Step 1: Build the component**

Create `src/components/tabs/RecoveredClaimsView.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { getRecoveredClaims, type RecoveredClaim } from '@/lib/storage/indexeddb';
import { Archive, Clock } from 'lucide-react';

export function RecoveredClaimsView() {
  const [items, setItems] = useState<RecoveredClaim[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { getRecoveredClaims().then(setItems); }, []);

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No recovered copies. This list only fills if an unsynced edit was ever
        superseded by a newer version from another device.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3 max-w-3xl mx-auto">
      <h2 className="text-lg font-medium text-foreground">Recovered copies</h2>
      {items.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
          <button
            onClick={() => setOpenId(openId === r.id ? null : r.id)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Archive size={16} /> {r.reportNo || r.claimId}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock size={12} /> {new Date(r.supersededAt).toLocaleString()}
            </span>
          </button>
          {openId === r.id && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-[var(--color-neutral-50)] p-3 text-[11px] text-foreground">
              {JSON.stringify(r.claim, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Register the view**

Search for the tab registry (`grep -rn "CloudVaultTab" src/components src/app`), and add `RecoveredClaimsView` following the identical pattern (nav entry + render switch). Match the existing `AppTab` id convention.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/RecoveredClaimsView.tsx
git commit -m "feat(sync): minimal Recovered copies view"
```

---

## Task 7: `selectDirtyClaims` + `flushAllPendingToCloud`

Pure selection (tested) + the flush routine used by logout/kick.

**Files:**
- Modify: `src/lib/firebase/sync-guard.ts` (add `selectDirtyClaims`)
- Modify: `src/lib/firebase/__tests__/sync-guard.test.ts`
- Modify: `src/lib/firebase/sync.ts` (add `flushAllPendingToCloud`)

**Interfaces:**
- Produces: `selectDirtyClaims(claims: ClaimData[], pushedMap: Map<string,string>): ClaimData[]`; `flushAllPendingToCloud(uid: string): Promise<{ pushed: number; failed: number; skipped: boolean }>`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/firebase/__tests__/sync-guard.test.ts`:
```typescript
import { selectDirtyClaims } from '../sync-guard';
import type { ClaimData } from '@/types';

const mk = (id: string, updatedAt: string) => ({ id, updatedAt } as ClaimData);

describe('selectDirtyClaims', () => {
  it('includes claims never pushed', () => {
    const claims = [mk('a', '2026-01-01T00:00:00Z')];
    expect(selectDirtyClaims(claims, new Map()).map(c => c.id)).toEqual(['a']);
  });
  it('includes claims edited since last push, excludes up-to-date ones', () => {
    const claims = [mk('a', '2026-01-02T00:00:00Z'), mk('b', '2026-01-01T00:00:00Z')];
    const pushed = new Map([['a', '2026-01-01T00:00:00Z'], ['b', '2026-01-01T00:00:00Z']]);
    expect(selectDirtyClaims(claims, pushed).map(c => c.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx vitest run src/lib/firebase/__tests__/sync-guard.test.ts`
Expected: FAIL — `selectDirtyClaims` not exported.

- [ ] **Step 3: Implement `selectDirtyClaims`**

Append to `src/lib/firebase/sync-guard.ts`:
```typescript
/** Claims whose current `updatedAt` is newer than the last value pushed to
 *  the cloud (or never pushed) — i.e. not yet safely in the vault. */
export function selectDirtyClaims(
  claims: ClaimData[],
  pushedMap: Map<string, string>,
): ClaimData[] {
  return claims.filter((c) => {
    const pushed = pushedMap.get(c.id);
    return !pushed || c.updatedAt > pushed;
  });
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run src/lib/firebase/__tests__/sync-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `flushAllPendingToCloud`**

In `src/lib/firebase/sync.ts`, add (import `getAllClaims`, `getAllPushedAt` from indexeddb and `selectDirtyClaims` from `./sync-guard` if not already):
```typescript
export async function flushAllPendingToCloud(uid: string): Promise<{ pushed: number; failed: number; skipped: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { pushed: 0, failed: 0, skipped: true };
  }
  const [claims, pushedMap] = await Promise.all([getAllClaims(), getAllPushedAt()]);
  const dirty = selectDirtyClaims(claims, pushedMap);
  let pushed = 0;
  let failed = 0;
  for (const claim of dirty) {
    try {
      await pushClaimToCloud(uid, claim);
      pushed++;
    } catch (err) {
      failed++;
      logger.error(`[Sync] flushAllPendingToCloud: ${claim.id} failed:`, err);
    }
  }
  return { pushed, failed, skipped: false };
}
```

- [ ] **Step 6: Typecheck + test**

Run: `npx tsc --noEmit && npx vitest run src/lib`
Expected: exit 0, all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/firebase/sync-guard.ts src/lib/firebase/__tests__/sync-guard.test.ts src/lib/firebase/sync.ts
git commit -m "feat(sync): selectDirtyClaims + flushAllPendingToCloud"
```

---

## Task 8: Flush on logout and on kick

Guarantees the clean handoff whenever the device is online.

**Files:**
- Modify: `src/hooks/useAuth.ts` (logout path, ~line 200-205)
- Modify: `src/hooks/useSessionHeartbeat.ts` (kick handler, ~line 53-60)

**Interfaces:**
- Consumes: `flushAllPendingToCloud` (Task 7)

- [ ] **Step 1: Flush before logout**

In `src/hooks/useAuth.ts`, in the logout branch, immediately before `await releaseSession(uid);`:
```typescript
        try {
          await flushAllPendingToCloud(uid);
        } catch (err) {
          logger.error('[useAuth] Pre-logout flush failed (non-fatal):', err);
        }
```
Add the import: `import { flushAllPendingToCloud } from '@/lib/firebase/sync';` and, if not present, `import { logger } from '@/lib/utils/logger';`.

- [ ] **Step 2: Flush before sign-out on kick**

In `src/hooks/useSessionHeartbeat.ts`, in the kick branch (`if (session.deviceId !== getDeviceId() && !kickedRef.current)`), make the handler async-flush before signing out:
```typescript
          kickedRef.current = true;
          toast.error('You were signed out because SurveyOS was opened on another device.', {
            duration: 8000,
          });
          (async () => {
            if (user) {
              try { await flushAllPendingToCloud(user.uid); }
              catch (err) { logger.error('[useSessionHeartbeat] pre-kick flush failed:', err); }
            }
            signOutUser().catch(err =>
              logger.error('[useSessionHeartbeat] sign-out after kick failed:', err),
            );
          })();
```
Add the import: `import { flushAllPendingToCloud } from '@/lib/firebase/sync';`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Emulator/manual verification**

Two-tab test: edit a claim in tab A (don't manually save), open the app in tab B (same account) → tab B kicks tab A; confirm tab A's edit reaches the vault (check emulator/Firestore) before/around the sign-out, and tab B pulls it. Document the result.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.ts src/hooks/useSessionHeartbeat.ts
git commit -m "feat(sync): auto-flush pending claims on logout and on kick"
```

---

## Task 9: Prominent sync-status badge

Replaces the ignorable "• Unsaved" with a persistent "in cloud / not in cloud" signal.

**Files:**
- Modify: `src/lib/firebase/sync-guard.ts` (`countUnsynced`)
- Modify: `src/lib/firebase/__tests__/sync-guard.test.ts`
- Create: `src/components/sync/SyncStatusBadge.tsx`
- Modify: `src/components/layout/ClaimHeader.tsx` (render the badge; drop the old `• Unsaved` pill)

**Interfaces:**
- Produces: `countUnsynced(claims: ClaimData[], pushedMap: Map<string,string>): number`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/firebase/__tests__/sync-guard.test.ts`:
```typescript
import { countUnsynced } from '../sync-guard';

describe('countUnsynced', () => {
  it('counts only dirty claims', () => {
    const claims = [mk('a', '2026-01-02T00:00:00Z'), mk('b', '2026-01-01T00:00:00Z')];
    const pushed = new Map([['a', '2026-01-01T00:00:00Z'], ['b', '2026-01-01T00:00:00Z']]);
    expect(countUnsynced(claims, pushed)).toBe(1);
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx vitest run src/lib/firebase/__tests__/sync-guard.test.ts`
Expected: FAIL — `countUnsynced` not exported.

- [ ] **Step 3: Implement `countUnsynced`**

Append to `src/lib/firebase/sync-guard.ts`:
```typescript
/** Number of claims not yet safely in the cloud. */
export function countUnsynced(
  claims: ClaimData[],
  pushedMap: Map<string, string>,
): number {
  return selectDirtyClaims(claims, pushedMap).length;
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run src/lib/firebase/__tests__/sync-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the badge**

Create `src/components/sync/SyncStatusBadge.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { getAllClaims, getAllPushedAt } from '@/lib/storage/indexeddb';
import { countUnsynced } from '@/lib/firebase/sync-guard';

export function SyncStatusBadge() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const [claims, pushed] = await Promise.all([getAllClaims(), getAllPushedAt()]);
      if (alive) setPending(countUnsynced(claims, pushed));
    };
    refresh();
    const channel = new BroadcastChannel('surveyos_claims_sync');
    channel.onmessage = () => refresh();
    const interval = setInterval(refresh, 15000);
    return () => { alive = false; channel.close(); clearInterval(interval); };
  }, []);

  const synced = pending === 0;
  return (
    <span
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium uppercase tracking-wide ${
        synced
          ? 'bg-[var(--color-status-success-tint)] text-[var(--color-status-success)]'
          : 'bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)]'
      }`}
      title={synced ? 'All claims saved to the cloud' : `${pending} change(s) not yet in the cloud`}
    >
      {synced ? <Cloud size={12} /> : <CloudOff size={12} />}
      {synced ? 'All saved to cloud' : `${pending} not in cloud`}
    </span>
  );
}
```

- [ ] **Step 6: Use it in the header, drop the old pill**

In `src/components/layout/ClaimHeader.tsx`, import `SyncStatusBadge`, and replace the `{isDirty && ( ... • Unsaved ... )}` block with `<SyncStatusBadge />`.

- [ ] **Step 7: Typecheck + test + build**

Run: `npx tsc --noEmit && npx vitest run src/lib && npm run build`
Expected: exit 0, all PASS, build clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/firebase/sync-guard.ts src/lib/firebase/__tests__/sync-guard.test.ts src/components/sync/SyncStatusBadge.tsx src/components/layout/ClaimHeader.tsx
git commit -m "feat(sync): prominent cloud sync-status badge"
```

---

## Self-Review Notes

- **Spec coverage:** versioned claims (T1), version-guarded push (T2/T3), Option B stash+adopt+notify (T4/T5), Recovered view (T6), flush-on-logout/kick (T7/T8), visible status (T9). All four design pillars covered.
- **Types:** `ClaimConflictError.remote: ClaimData`, `canOverwrite(number,number)`, `selectDirtyClaims/countUnsynced(ClaimData[], Map)`, `flushAllPendingToCloud → {pushed,failed,skipped}`, `RecoveredClaim` — consistent across tasks.
- **Migration:** `version` missing→0 (T1); `recoveredClaims` additive store v6 (T4). No backfill needed.
- **Out of scope (per spec):** field-level merge, multi-user, real-time collab, restore-from-Recovered-into-claim (view is read-only in v1).
