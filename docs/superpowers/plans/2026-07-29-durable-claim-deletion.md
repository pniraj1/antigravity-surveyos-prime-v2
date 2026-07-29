# Durable Claim Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a deleted claim stay deleted — on every device and in the cloud — by replacing the hard Firestore delete with a tombstone stub.

**Architecture:** On delete, the Firestore claim document is *overwritten* with a small marker (`{ id, ownerId, deleted: true, deletedAt, updatedAt, version }`) instead of being removed. The stub carries no claim payload, so the overwrite is also the personal-data purge. Because the stub sets `updatedAt`, it flows to other devices through the delta pull that already exists; because it bumps `version`, the existing version-guarded write refuses a stale device's push. Propagation therefore does not depend on the order in which sync steps run.

**Tech Stack:** TypeScript, Next.js 16 (static export), Firebase Firestore, `idb` (IndexedDB), Zustand, Vitest (node environment), sonner (toasts).

**Spec:** [2026-07-29-durable-claim-deletion-design.md](../specs/2026-07-29-durable-claim-deletion-design.md)

## Global Constraints

- **Tests run in the `node` environment** — there is no DOM library (no jsdom, no testing-library). Test pure functions directly, or mock modules with `vi.mock`. Follow `src/lib/firebase/__tests__/sync-conflict.test.ts` for the Firestore mocking pattern.
- **Run tests scoped to `src/`** — `npx vitest run src/` — never bare `npx vitest run`. A pre-existing unrelated failure exists in `src/lib/ai/__tests__/discovery.test.ts` (`fetchNvidiaModels`); it is **not** caused by this work and must be left alone.
- **No `console.log`** in production code. Use `logger` from `@/lib/utils/logger` (`logger.error` prints in production; `logger.log` is dev-only).
- **Immutability** — never mutate an existing object; build a new one with spread.
- **Explicit types on exported functions** — parameters and return types. No `any`; use `unknown` and narrow.
- **A tombstone is never a `ClaimData`.** `ClaimData` has many required fields a stub deliberately lacks. Never cast a stub to `ClaimData`, and never write one into IndexedDB.
- **Out of scope:** Google Drive folder cleanup. Do not add it. A deleted claim still leaves its Drive folder; that is tracked separately as audit item F5.
- **Commit after every task**, using the exact message given in the task's final step.

---

### Task 1: Tombstone types and pure helpers

Creates the vocabulary the rest of the plan uses. Everything here is pure — no Firestore, no IndexedDB — so it tests with no mocking.

**Files:**
- Create: `src/lib/sync/tombstone.ts`
- Test: `src/lib/sync/__tests__/tombstone.test.ts`

**Interfaces:**
- Consumes: `ClaimData` from `@/types`
- Produces:
  - `interface ClaimTombstone { id: string; ownerId: string; deleted: true; deletedAt: string; updatedAt: string; version: number }`
  - `type CloudClaimDoc = ClaimData | ClaimTombstone`
  - `makeTombstone(claimId: string, uid: string, nextVersion: number, now?: string): ClaimTombstone`
  - `isTombstone(doc: CloudClaimDoc): doc is ClaimTombstone`
  - `shouldStashOnRemoteDelete(localUpdatedAt: string, deletedAt: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sync/__tests__/tombstone.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { makeTombstone, isTombstone, shouldStashOnRemoteDelete } from '../tombstone';
import type { ClaimData } from '@/types';

const NOW = '2026-07-29T10:00:00.000Z';

describe('makeTombstone', () => {
  it('records identity, deletion time and the next version', () => {
    const t = makeTombstone('claim-1', 'uid-1', 4, NOW);
    expect(t).toEqual({
      id: 'claim-1',
      ownerId: 'uid-1',
      deleted: true,
      deletedAt: NOW,
      updatedAt: NOW,
      version: 4,
    });
  });

  it('sets updatedAt equal to deletedAt so the delta pull carries it', () => {
    const t = makeTombstone('claim-1', 'uid-1', 1, NOW);
    expect(t.updatedAt).toBe(t.deletedAt);
  });

  it('carries NO claim payload — this is the personal-data guarantee', () => {
    const t = makeTombstone('claim-1', 'uid-1', 1, NOW) as Record<string, unknown>;
    for (const forbidden of [
      'insured', 'vehicle', 'photos', 'assessment', 'reportNo',
      'surveyType', 'spotDamage', 'insurer', 'claimNo',
    ]) {
      expect(t[forbidden]).toBeUndefined();
    }
    expect(Object.keys(t).sort()).toEqual(
      ['deleted', 'deletedAt', 'id', 'ownerId', 'updatedAt', 'version'],
    );
  });
});

describe('isTombstone', () => {
  it('is true for a tombstone', () => {
    expect(isTombstone(makeTombstone('c', 'u', 1, NOW))).toBe(true);
  });

  it('is false for a live claim', () => {
    const claim = { id: 'c', updatedAt: NOW, reportNo: 'R1' } as unknown as ClaimData;
    expect(isTombstone(claim)).toBe(false);
  });

  it('is false for a claim that merely has a falsy deleted field', () => {
    const claim = { id: 'c', updatedAt: NOW, deleted: false } as unknown as ClaimData;
    expect(isTombstone(claim)).toBe(false);
  });
});

describe('shouldStashOnRemoteDelete', () => {
  it('stashes when the local copy was edited after the deletion', () => {
    expect(shouldStashOnRemoteDelete('2026-07-29T11:00:00.000Z', NOW)).toBe(true);
  });

  it('drops a copy older than the deletion — a stale duplicate', () => {
    expect(shouldStashOnRemoteDelete('2026-07-29T09:00:00.000Z', NOW)).toBe(false);
  });

  it('drops a copy edited at exactly the deletion instant', () => {
    expect(shouldStashOnRemoteDelete(NOW, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sync/__tests__/tombstone.test.ts`
Expected: FAIL — `Failed to resolve import "../tombstone"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/sync/tombstone.ts`:

```typescript
// ═══════════════════════════════════════════════════════════
// CLAIM TOMBSTONES
//
// A deleted claim is not removed from Firestore — its document is
// OVERWRITTEN with a tombstone: a marker carrying the claim's identity and
// nothing else. Two consequences, both load-bearing:
//
//   1. The overwrite erases the claim payload, so deleting a claim genuinely
//      removes the insured's personal data from the cloud.
//   2. A marker is something other devices can SEE. A hard-deleted document
//      is merely absent from a query, which is indistinguishable from
//      "unchanged" or "never existed" — which is why deletions used to fail
//      to propagate, and why a second device could push the claim back.
//
// `updatedAt` makes the tombstone travel on the existing delta pull.
// `version` makes the existing version-guarded write refuse a stale push.
// ═══════════════════════════════════════════════════════════

import type { ClaimData } from '@/types';

/** A deleted claim's gravestone in Firestore. Carries NO claim payload. */
export interface ClaimTombstone {
  id: string;
  ownerId: string;
  deleted: true;
  /** ISO timestamp of the deletion. */
  deletedAt: string;
  /** Equals deletedAt. Drives the `updatedAt > cursor` delta pull. */
  updatedAt: string;
  /** cloudVersion + 1, so a stale device's push loses the version check. */
  version: number;
}

/** What a document in users/{uid}/claims may be. */
export type CloudClaimDoc = ClaimData | ClaimTombstone;

/**
 * Builds the tombstone written in place of a deleted claim.
 *
 * @param nextVersion MUST be the current cloud version + 1. Writing a stale
 *   version would let a stale device win `canOverwrite` and resurrect the claim.
 * @param now Injectable for deterministic tests.
 */
export function makeTombstone(
  claimId: string,
  uid: string,
  nextVersion: number,
  now: string = new Date().toISOString(),
): ClaimTombstone {
  return {
    id: claimId,
    ownerId: uid,
    deleted: true,
    deletedAt: now,
    updatedAt: now,
    version: nextVersion,
  };
}

/**
 * Type guard separating tombstones from live claims.
 *
 * Every cloud document must pass through this before anything downstream
 * touches it. Once narrowed, the compiler prevents a tombstone from being
 * treated as a claim — which is what stops a stub being written into
 * IndexedDB and rendered as an empty row on the dashboard.
 */
export function isTombstone(doc: CloudClaimDoc): doc is ClaimTombstone {
  return (doc as ClaimTombstone).deleted === true;
}

/**
 * True if a local copy holds work that postdates the deletion, and so must be
 * kept in Recovered rather than dropped.
 *
 * NOTE: the tempting test — "is this claim dirty?" via pushTracking — is WRONG
 * here. On a freshly installed device pushTracking is empty, so every claim
 * reads as dirty and a restored laptop would produce dozens of Recovered
 * entries and warnings on its first sync. Comparing timestamps needs no local
 * bookkeeping and so survives a fresh install.
 */
export function shouldStashOnRemoteDelete(
  localUpdatedAt: string,
  deletedAt: string,
): boolean {
  return localUpdatedAt > deletedAt;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sync/__tests__/tombstone.test.ts`
Expected: PASS — 9 tests passed.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/tombstone.ts src/lib/sync/__tests__/tombstone.test.ts
git commit -m "feat(sync): add claim tombstone types and pure helpers"
```

---

### Task 2: Apply a remote deletion locally

The local half of propagation: a device has learned a claim was deleted elsewhere and must remove it, stashing first if it holds newer work.

**Files:**
- Modify: `src/lib/storage/indexeddb.ts` (add `applyRemoteDeletion` after the Tombstones section, ~line 402)
- Test: `src/lib/storage/__tests__/applyRemoteDeletion.test.ts`

**Interfaces:**
- Consumes: `shouldStashOnRemoteDelete` (Task 1); existing `getClaim`, `addRecoveredClaim`, `getDB`
- Produces: `applyRemoteDeletion(claimId: string, deletedAt: string): Promise<'stashed' | 'dropped' | 'absent'>`

**Critical:** this function must **not** write a local tombstone. The local `tombstones` store means "this device owes the cloud a delete." A deletion learned *from* the cloud owes it nothing.

- [ ] **Step 1: Write the failing test**

Create `src/lib/storage/__tests__/applyRemoteDeletion.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { ClaimData } from '@/types';
import { applyRemoteDeletion, type RemoteDeletionDeps } from '../indexeddb';

const mk = (id: string, updatedAt: string): ClaimData =>
  ({ id, updatedAt, reportNo: `R-${id}` } as ClaimData);

/** In-memory stand-in for the three store operations this function performs. */
function makeFakeDeps() {
  const claims = new Map<string, ClaimData>();
  const recovered: { claim: ClaimData; reason: string }[] = [];
  const deps: RemoteDeletionDeps = {
    getClaim: async (id) => claims.get(id),
    addRecoveredClaim: async (claim, reason) => { recovered.push({ claim, reason }); },
    removeClaimRecord: async (id) => { claims.delete(id); },
  };
  return { claims, recovered, deps };
}

describe('applyRemoteDeletion', () => {
  let f: ReturnType<typeof makeFakeDeps>;
  beforeEach(() => { f = makeFakeDeps(); });

  it('reports absent when the device never had the claim', async () => {
    const outcome = await applyRemoteDeletion('missing', '2026-07-29T10:00:00.000Z', f.deps);
    expect(outcome).toBe('absent');
    expect(f.recovered).toHaveLength(0);
  });

  it('drops a stale copy quietly, with no Recovered entry', async () => {
    f.claims.set('c1', mk('c1', '2026-07-29T09:00:00.000Z'));
    const outcome = await applyRemoteDeletion('c1', '2026-07-29T10:00:00.000Z', f.deps);
    expect(outcome).toBe('dropped');
    expect(f.recovered).toHaveLength(0);
    expect(f.claims.has('c1')).toBe(false);
  });

  it('stashes a copy edited after the deletion, then removes it', async () => {
    f.claims.set('c2', mk('c2', '2026-07-29T11:00:00.000Z'));
    const outcome = await applyRemoteDeletion('c2', '2026-07-29T10:00:00.000Z', f.deps);
    expect(outcome).toBe('stashed');
    expect(f.recovered).toHaveLength(1);
    expect(f.recovered[0].reason).toBe('deleted-on-another-device');
    expect(f.claims.has('c2')).toBe(false);
  });

  it('removes the claim even when it stashed it first', async () => {
    f.claims.set('c3', mk('c3', '2026-07-29T11:00:00.000Z'));
    await applyRemoteDeletion('c3', '2026-07-29T10:00:00.000Z', f.deps);
    expect(f.claims.has('c3')).toBe(false);
  });
});
```

**Why injected dependencies rather than `vi.mock`:** `vi.mock` does not intercept calls a module makes *to itself*. Mocking `../indexeddb` and then calling `applyRemoteDeletion` from it would still run the real `getClaim`/`getDB`, which need a live IndexedDB — absent in the node test environment. There is no `fake-indexeddb` in this project and adding one is out of scope. A three-function seam with a production default is the smallest thing that makes a data-destroying function testable.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/storage/__tests__/applyRemoteDeletion.test.ts`
Expected: FAIL — `applyRemoteDeletion is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/storage/indexeddb.ts`, add the import at the top alongside the existing imports:

```typescript
import { shouldStashOnRemoteDelete } from '@/lib/sync/tombstone';
```

Then add this immediately after `removeTombstone` (end of the Tombstones section):

```typescript
/** The store operations applyRemoteDeletion performs. Injectable for tests —
 *  vi.mock cannot intercept a module's calls to itself, and there is no
 *  fake-indexeddb in this project. */
export interface RemoteDeletionDeps {
  getClaim: (id: string) => Promise<ClaimData | undefined>;
  addRecoveredClaim: (claim: ClaimData, reason: string) => Promise<void>;
  removeClaimRecord: (id: string) => Promise<void>;
}

/** Production wiring: remove the claim and its push-tracking row together. */
const defaultRemoteDeletionDeps: RemoteDeletionDeps = {
  getClaim: (id) => getClaim(id),
  addRecoveredClaim: (claim, reason) => addRecoveredClaim(claim, reason),
  removeClaimRecord: async (id) => {
    const db = await getDB();
    const tx = db.transaction(['claims', 'pushTracking'], 'readwrite');
    await tx.objectStore('claims').delete(id);
    await tx.objectStore('pushTracking').delete(id);
    await tx.done;
  },
};

/**
 * Applies a deletion that happened on ANOTHER device.
 *
 * Deletion always wins — the claim leaves this device. But if this device
 * holds work that postdates the deletion, that copy goes to Recovered first,
 * so field work is never destroyed silently.
 *
 * Deliberately does NOT write a local tombstone: the `tombstones` store means
 * "this device owes the cloud a delete", and a deletion learned FROM the cloud
 * owes it nothing.
 *
 * @returns 'stashed'  — removed, a copy was kept in Recovered
 *          'dropped'  — removed, it was a stale duplicate
 *          'absent'   — this device never had it
 */
export async function applyRemoteDeletion(
  claimId: string,
  deletedAt: string,
  deps: RemoteDeletionDeps = defaultRemoteDeletionDeps,
): Promise<'stashed' | 'dropped' | 'absent'> {
  const existing = await deps.getClaim(claimId);
  if (!existing) return 'absent';

  const stash = shouldStashOnRemoteDelete(existing.updatedAt, deletedAt);
  if (stash) {
    await deps.addRecoveredClaim(existing, 'deleted-on-another-device');
  }

  await deps.removeClaimRecord(claimId);
  return stash ? 'stashed' : 'dropped';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/storage/__tests__/applyRemoteDeletion.test.ts`
Expected: PASS — 4 tests passed.

Note: importing `../indexeddb` in a node test pulls in the `idb` package at module load. That is import-only and does not open a database, so it is safe — no store is touched unless a function that calls `getDB()` runs, and the injected deps mean none does.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/indexeddb.ts src/lib/storage/__tests__/applyRemoteDeletion.test.ts
git commit -m "feat(sync): apply a remote claim deletion locally, stashing newer work"
```

---

### Task 3: Write the tombstone to Firestore instead of deleting

**Files:**
- Modify: `src/lib/firebase/sync.ts` (imports; replace `syncTombstones` body, ~lines 138-163)

**Interfaces:**
- Consumes: `makeTombstone`, `CloudClaimDoc` (Task 1)
- Produces: `writeTombstoneToCloud(uid: string, claimId: string): Promise<void>`

- [ ] **Step 1: Update imports in `src/lib/firebase/sync.ts`**

Add to the existing `firebase/firestore` import (`deleteDoc` is no longer needed for claims but remains used elsewhere — leave it):

```typescript
import { makeTombstone, isTombstone, type CloudClaimDoc, type ClaimTombstone } from '@/lib/sync/tombstone';
import { applyRemoteDeletion } from '../storage/indexeddb';
```

Add `applyRemoteDeletion` to the existing `'../storage/indexeddb'` import block rather than creating a second import from the same module.

- [ ] **Step 2: Add `writeTombstoneToCloud` immediately above `syncTombstones`**

```typescript
/**
 * Overwrites a claim document with its tombstone.
 *
 * Runs in a transaction because `version` must be cloudVersion + 1 — writing a
 * stale version would let a stale device win `canOverwrite` and resurrect the
 * claim, defeating the whole design. If the document does not exist (the claim
 * was never uploaded) the tombstone is written at version 1.
 *
 * Idempotent: re-writing a tombstone over a tombstone simply restates the
 * deletion at a higher version.
 */
export async function writeTombstoneToCloud(uid: string, claimId: string): Promise<void> {
  const claimRef = doc(db, `users/${uid}/claims`, claimId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(claimRef);
    const cloudVersion = snap.exists() ? ((snap.data() as CloudClaimDoc).version ?? 0) : 0;
    tx.set(claimRef, makeTombstone(claimId, uid, cloudVersion + 1));
  });
}
```

- [ ] **Step 3: Replace the body of `syncTombstones`**

Replace the whole existing function with:

```typescript
/**
 * Flushes this device's pending deletions to the cloud.
 *
 * The local `tombstones` store is a queue of "deletes this device still owes
 * the cloud". Each one is written as a tombstone stub (not a hard delete) so
 * other devices can see it, then cleared from the queue.
 *
 * A failure keeps the entry queued for the next attempt. Expired/read-only
 * surveyors cannot write to Firestore at all (see firestore.rules
 * hasActiveAccess), so their deletions stay queued until access is restored —
 * their local tombstone still blocks resurrection on that device meanwhile.
 */
export async function syncTombstones(uid: string): Promise<void> {
  const tombstones = await getTombstones();
  if (tombstones.length === 0) return;

  logger.log(`[Sync] Flushing ${tombstones.length} pending deletion(s) to cloud.`);
  for (const t of tombstones) {
    try {
      await writeTombstoneToCloud(uid, t.id);
      // ponytail: the claim's Drive folder (photos + claim.json backup) is NOT
      // cleaned up here, so a deleted claim leaves an orphaned copy incl. PII.
      // Out of scope by decision; tracked as F5 in the data-storage audit.
      await removeTombstone(t.id);
      logger.log(`[Sync] Tombstone for ${t.id} written to cloud.`);
    } catch (err) {
      logger.error(`[Sync] Tombstone write for ${t.id} failed (stays queued):`, err);
    }
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 5: Run the existing sync suite for regressions**

Run: `npx vitest run src/lib/firebase/`
Expected: PASS — all existing sync tests still green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase/sync.ts
git commit -m "feat(sync): write a tombstone stub instead of hard-deleting the claim doc"
```

---

### Task 4: Refuse a push against a tombstone

This is what makes propagation order-independent: even a device that pushes before it pulls cannot resurrect a deleted claim.

**Files:**
- Modify: `src/lib/firebase/sync-guard.ts` (add `ClaimDeletedError`)
- Modify: `src/lib/firebase/sync.ts` (`pushClaimToCloud` transaction + catch; add `recoverFromRemoteDeletion`)
- Test: `src/lib/firebase/__tests__/sync-deleted.test.ts`

**Interfaces:**
- Consumes: `isTombstone`, `ClaimTombstone` (Task 1); `applyRemoteDeletion` (Task 2)
- Produces: `class ClaimDeletedError extends Error { tombstone: ClaimTombstone }`

**Critical:** the tombstone check must run **before** the `canOverwrite` comparison. The stub bumps `version`, so a stale device would otherwise throw `ClaimConflictError` first and land in `recoverFromConflict`, which does `saveClaim({ ...remote, photos })` — replacing the surveyor's real claim with a tombstone on his own device.

- [ ] **Step 1: Write the failing test**

Create `src/lib/firebase/__tests__/sync-deleted.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClaimData } from '@/types';

const h = vi.hoisted(() => ({
  cloud: { exists: true, data: {} as Record<string, unknown> },
  setCalls: [] as Record<string, unknown>[],
  savedClaims: [] as ClaimData[],
  applied: [] as { id: string; deletedAt: string }[],
  appliedResult: 'dropped' as 'stashed' | 'dropped' | 'absent',
}));

vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getDocs: vi.fn(),
  runTransaction: async (_db: unknown, cb: (tx: unknown) => unknown) =>
    cb({
      get: async () => ({
        exists: () => h.cloud.exists,
        data: () => h.cloud.data,
      }),
      set: (_ref: unknown, payload: Record<string, unknown>) => { h.setCalls.push(payload); },
    }),
}));

// Mock via ALIAS paths (@/...), matching sync-conflict.test.ts. sync.ts imports
// './config' and '../storage/indexeddb'; the alias resolves to the same files,
// and this is the form already proven to intercept correctly in this suite.
vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('@/lib/firebase/sync-cursor', () => ({ applySkewMargin: (t: string | null) => t }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/drive', () => ({ backupClaimToDrive: vi.fn().mockResolvedValue('ok') }));
vi.mock('@/stores/profile-store', () => ({ useProfileStore: { getState: () => ({ profile: {} }) } }));
vi.mock('@/stores/claim-store', () => ({
  useClaimStore: { getState: () => ({ syncVersion: vi.fn(), currentClaim: null, closeClaim: vi.fn() }) },
}));
vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: async () => [],
  saveClaim: async (c: ClaimData) => { h.savedClaims.push(c); },
  setPushedAt: vi.fn(),
  addRecoveredClaim: vi.fn(),
  getAllPushedAt: async () => new Map(),
  getTombstones: async () => [],
  getTombstoneIds: async () => new Set<string>(),
  removeTombstone: vi.fn(),
  deleteClaim: vi.fn(),
  applyRemoteDeletion: async (id: string, deletedAt: string) => {
    h.applied.push({ id, deletedAt });
    return h.appliedResult;
  },
}));

import { pushClaimToCloud } from '../sync';

const mk = (id: string, version: number): ClaimData =>
  ({ id, version, updatedAt: '2026-07-29T11:00:00.000Z', reportNo: 'R-1', photos: [] } as unknown as ClaimData);

describe('pushClaimToCloud against a tombstone', () => {
  beforeEach(() => {
    h.setCalls.length = 0;
    h.savedClaims.length = 0;
    h.applied.length = 0;
    h.appliedResult = 'dropped';
    h.cloud = {
      exists: true,
      data: {
        id: 'c1', ownerId: 'u1', deleted: true,
        deletedAt: '2026-07-29T10:00:00.000Z',
        updatedAt: '2026-07-29T10:00:00.000Z',
        version: 9,
      },
    };
  });

  it('refuses the write — nothing is pushed', async () => {
    const result = await pushClaimToCloud('u1', mk('c1', 3));
    expect(h.setCalls).toHaveLength(0);
    expect(result.conflicted).toBe(true);
  });

  it('does NOT adopt the tombstone as the local claim', async () => {
    await pushClaimToCloud('u1', mk('c1', 3));
    for (const saved of h.savedClaims) {
      expect((saved as unknown as Record<string, unknown>).deleted).toBeUndefined();
    }
  });

  it('applies the deletion locally with the tombstone timestamp', async () => {
    await pushClaimToCloud('u1', mk('c1', 3));
    expect(h.applied).toEqual([{ id: 'c1', deletedAt: '2026-07-29T10:00:00.000Z' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/firebase/__tests__/sync-deleted.test.ts`
Expected: FAIL — the push adopts the tombstone (`h.savedClaims` contains `deleted: true`) and `h.applied` is empty.

- [ ] **Step 3: Add `ClaimDeletedError` to `src/lib/firebase/sync-guard.ts`**

```typescript
import type { ClaimTombstone } from '@/lib/sync/tombstone';

/** Thrown by a guarded push when the cloud says the claim was DELETED.
 *  Distinct from ClaimConflictError: "the cloud is newer" and "the cloud says
 *  this is dead" need opposite responses — adopt versus remove. */
export class ClaimDeletedError extends Error {
  tombstone: ClaimTombstone;
  constructor(tombstone: ClaimTombstone) {
    super('Claim was deleted on another device');
    this.name = 'ClaimDeletedError';
    this.tombstone = tombstone;
  }
}
```

- [ ] **Step 4: Guard the transaction in `pushClaimToCloud`**

In `src/lib/firebase/sync.ts`, update the import from `./sync-guard` to include `ClaimDeletedError`, then replace the transaction body:

```typescript
    newVersion = await runTransaction(db, async (tx) => {
      const snap = await tx.get(claimRef);
      const remote = snap.exists() ? (snap.data() as CloudClaimDoc) : null;

      // MUST precede the version check. The tombstone bumps `version`, so a
      // stale device would otherwise fail canOverwrite and land in
      // recoverFromConflict — which adopts the remote copy, replacing the
      // surveyor's real claim with a tombstone on his own device.
      if (remote && isTombstone(remote)) {
        throw new ClaimDeletedError(remote);
      }

      const cloudVersion = remote ? (remote.version ?? 0) : 0;
      if (!canOverwrite(localVersion, cloudVersion)) {
        throw new ClaimConflictError(remote as ClaimData);
      }
      const next = cloudVersion + 1;
      tx.set(claimRef, { ...stripPhotos(claim), version: next, ownerId: uid });
      return next;
    });
  } catch (err) {
    if (err instanceof ClaimDeletedError) {
      return recoverFromRemoteDeletion(claim, err.tombstone);
    }
    if (err instanceof ClaimConflictError) {
      return recoverFromConflict(claim, err.remote);
    }
    throw err;
  }
```

- [ ] **Step 5: Add `recoverFromRemoteDeletion` beside `recoverFromConflict`**

```typescript
/**
 * The cloud says this claim was deleted on another device. Deletion wins: the
 * local copy is removed. If it held work postdating the deletion, that copy is
 * kept in Recovered and the surveyor is told. A stale duplicate goes quietly —
 * a restored old laptop must not produce dozens of warnings on first sync.
 */
async function recoverFromRemoteDeletion(
  local: ClaimData,
  tombstone: ClaimTombstone,
): Promise<PushResult> {
  const outcome = await applyRemoteDeletion(local.id, tombstone.deletedAt);

  if (useClaimStore.getState().currentClaim?.id === local.id) {
    useClaimStore.getState().closeClaim();
  }

  if (outcome === 'stashed') {
    toast.warning(
      `"${local.reportNo || local.id}" was deleted on another device. Your unsaved changes were kept in Recovered.`,
    );
  }
  logger.log(`[Sync] Claim ${local.id} deleted remotely — local copy ${outcome}.`);
  return { ...local, conflicted: true };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/firebase/__tests__/sync-deleted.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 7: Run the whole firebase suite for regressions**

Run: `npx vitest run src/lib/firebase/`
Expected: PASS — including the pre-existing `sync-conflict` and `sync-stale-version` suites.

- [ ] **Step 8: Type-check and commit**

Run: `npx tsc --noEmit -p tsconfig.json` → no output.

```bash
git add src/lib/firebase/sync-guard.ts src/lib/firebase/sync.ts src/lib/firebase/__tests__/sync-deleted.test.ts
git commit -m "feat(sync): refuse a push against a tombstone instead of resurrecting the claim"
```

---

### Task 5: Partition tombstones out of the pull and apply them

**Files:**
- Modify: `src/lib/firebase/sync.ts` (`pullClaimsFromCloud`, ~lines 206-282)
- Test: `src/lib/firebase/__tests__/sync-pull-deleted.test.ts`

**Interfaces:**
- Consumes: `isTombstone`, `CloudClaimDoc`, `ClaimTombstone` (Task 1); `applyRemoteDeletion` (Task 2)
- Produces: `pullClaimsFromCloud` returns `ClaimData[]` containing **live claims only**

**Critical:** partition at ingestion, immediately after `querySnap.forEach`. Filtering only the return value is not enough — the merge loop's "brand-new claim from cloud — always accept" branch would write a stub into IndexedDB as a claim.

- [ ] **Step 1: Write the failing test**

Create `src/lib/firebase/__tests__/sync-pull-deleted.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClaimData } from '@/types';

const h = vi.hoisted(() => ({
  docs: [] as Record<string, unknown>[],
  savedClaims: [] as ClaimData[],
  applied: [] as { id: string; deletedAt: string }[],
}));

vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getDocs: async () => ({ forEach: (cb: (d: { data: () => unknown }) => void) => {
    h.docs.forEach(d => cb({ data: () => d }));
  } }),
  runTransaction: vi.fn(),
}));

// Alias paths, matching sync-conflict.test.ts — see Task 4 for why.
vi.mock('@/lib/firebase/config', () => ({ db: {} }));
vi.mock('@/lib/firebase/sync-cursor', () => ({ applySkewMargin: (t: string | null) => t }));
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/drive', () => ({ backupClaimToDrive: vi.fn() }));
vi.mock('@/stores/profile-store', () => ({ useProfileStore: { getState: () => ({ profile: {} }) } }));
vi.mock('@/stores/claim-store', () => ({
  useClaimStore: { getState: () => ({ syncVersion: vi.fn(), currentClaim: null, closeClaim: vi.fn() }) },
}));
vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: async () => [],
  saveClaim: async (c: ClaimData) => { h.savedClaims.push(c); },
  setPushedAt: vi.fn(),
  addRecoveredClaim: vi.fn(),
  getAllPushedAt: async () => new Map<string, string>(),
  getTombstones: async () => [],
  getTombstoneIds: async () => new Set<string>(),
  removeTombstone: vi.fn(),
  deleteClaim: vi.fn(),
  applyRemoteDeletion: async (id: string, deletedAt: string) => {
    h.applied.push({ id, deletedAt });
    return 'absent' as const;
  },
}));

// BroadcastChannel does not exist in the node test environment.
vi.stubGlobal('BroadcastChannel', class {
  postMessage() {}
  close() {}
});

import { pullClaimsFromCloud } from '../sync';

describe('pullClaimsFromCloud with tombstones present', () => {
  beforeEach(() => {
    h.docs.length = 0;
    h.savedClaims.length = 0;
    h.applied.length = 0;
  });

  it('never writes a tombstone into IndexedDB as a claim', async () => {
    h.docs = [{
      id: 'gone', ownerId: 'u1', deleted: true,
      deletedAt: '2026-07-29T10:00:00.000Z',
      updatedAt: '2026-07-29T10:00:00.000Z', version: 2,
    }];
    await pullClaimsFromCloud('u1', null);
    expect(h.savedClaims).toHaveLength(0);
  });

  it('applies the deletion locally', async () => {
    h.docs = [{
      id: 'gone', ownerId: 'u1', deleted: true,
      deletedAt: '2026-07-29T10:00:00.000Z',
      updatedAt: '2026-07-29T10:00:00.000Z', version: 2,
    }];
    await pullClaimsFromCloud('u1', null);
    expect(h.applied).toEqual([{ id: 'gone', deletedAt: '2026-07-29T10:00:00.000Z' }]);
  });

  it('returns live claims only', async () => {
    h.docs = [
      { id: 'live', updatedAt: '2026-07-29T12:00:00.000Z', reportNo: 'R-9', version: 1 },
      { id: 'gone', ownerId: 'u1', deleted: true,
        deletedAt: '2026-07-29T10:00:00.000Z',
        updatedAt: '2026-07-29T10:00:00.000Z', version: 2 },
    ];
    const result = await pullClaimsFromCloud('u1', null);
    expect(result.map(c => c.id)).toEqual(['live']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/firebase/__tests__/sync-pull-deleted.test.ts`
Expected: FAIL — the tombstone is saved as a claim and returned in the result array.

- [ ] **Step 3: Partition at ingestion**

In `pullClaimsFromCloud`, replace the collection block:

```typescript
  // Partition at ingestion — the ONE place cloud documents enter the app.
  // Everything downstream then handles live claims only, by construction.
  // Filtering just the return value would be too late: the merge loop's
  // "brand-new claim from cloud" branch would write a stub into IndexedDB.
  const remoteClaims: ClaimData[] = [];
  const remoteTombstones: ClaimTombstone[] = [];
  querySnap.forEach((d) => {
    const data = d.data() as CloudClaimDoc;
    if (isTombstone(data)) remoteTombstones.push(data);
    else remoteClaims.push(data);
  });

  // Deletions first: a claim deleted elsewhere must go even if this pull also
  // carries an older live copy of it.
  for (const t of remoteTombstones) {
    const outcome = await applyRemoteDeletion(t.id, t.deletedAt);
    if (outcome !== 'absent') {
      logger.log(`[Sync] Remote deletion applied for ${t.id} (${outcome}).`);
    }
  }
```

- [ ] **Step 4: Fix the early return so it accounts for tombstones**

The existing early return fires when nothing came back. Replace it with:

```typescript
  if (remoteClaims.length === 0 && remoteTombstones.length === 0) {
    logger.log('[Sync] Pull: no remote changes since last sync.');
    return remoteClaims;
  }
```

Move this **below** the partition block (it currently sits above it). If tombstones arrived but no live claims, execution must continue so the broadcast still fires.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/firebase/__tests__/sync-pull-deleted.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 6: Regression, type-check, commit**

Run: `npx vitest run src/lib/firebase/` → PASS
Run: `npx tsc --noEmit -p tsconfig.json` → no output

```bash
git add src/lib/firebase/sync.ts src/lib/firebase/__tests__/sync-pull-deleted.test.ts
git commit -m "feat(sync): partition tombstones at ingestion and apply remote deletions"
```

---

### Task 6: One deletion entry point, wired to the Dashboard

**Files:**
- Modify: `src/lib/firebase/sync.ts` (add `deleteClaimEverywhere`)
- Modify: `src/components/layout/Dashboard.tsx` (delete confirmation handler, ~line 583)

**Interfaces:**
- Consumes: `deleteClaim`, `removeTombstone` (existing); `writeTombstoneToCloud` (Task 3)
- Produces: `deleteClaimEverywhere(uid: string, claimId: string): Promise<'synced' | 'pending'>`

**Why one function:** deletion must not be assembled from separate calls at each UI site, or the next delete button someone adds re-creates the "cloud delete waits for next login" bug.

- [ ] **Step 1: Add `deleteClaimEverywhere` to `src/lib/firebase/sync.ts`**

Add `deleteClaim` to the existing `'../storage/indexeddb'` import, then:

```typescript
/**
 * THE deletion entry point. Every delete in the app must route through here.
 *
 * Removes the claim locally at once (the UI never waits on the network), then
 * immediately attempts the cloud tombstone. Previously the cloud write was
 * deferred to the next login, so a deleted claim could sit in Firestore — and
 * in Cloud Vault — for the rest of the working day.
 *
 * @returns 'synced'  — the tombstone is in the cloud
 *          'pending' — offline or refused; queued and retried on the next sync
 */
export async function deleteClaimEverywhere(
  uid: string,
  claimId: string,
): Promise<'synced' | 'pending'> {
  await deleteClaim(claimId); // local removal + queue the pending tombstone
  try {
    await writeTombstoneToCloud(uid, claimId);
    await removeTombstone(claimId);
    return 'synced';
  } catch (err) {
    logger.error(`[Sync] Cloud tombstone for ${claimId} deferred:`, err);
    return 'pending';
  }
}
```

- [ ] **Step 2: Wire the Dashboard**

In `src/components/layout/Dashboard.tsx`, add the imports:

```typescript
import { deleteClaimEverywhere } from '@/lib/firebase/sync';
import { useAuthStore } from '@/stores/auth-store';
```

Inside the component holding the delete dialog, read the uid:

```typescript
  const uid = useAuthStore.getState().user?.uid;
```

Replace the `onClick` handler of the "Delete forever" button:

```typescript
                onClick={async () => {
                  const outcome = uid
                    ? await deleteClaimEverywhere(uid, deleteTarget.id)
                    : 'pending';
                  const channel = new BroadcastChannel('surveyos_claims_sync');
                  channel.postMessage('CLAIMS_UPDATED');
                  channel.close();
                  // Only claim "permanently" once the cloud actually has the
                  // tombstone — offline, the deletion is real locally but not
                  // yet everywhere.
                  if (outcome === 'synced') {
                    toast.success('Claim permanently deleted');
                  } else {
                    toast.success('Claim deleted. It will finish clearing from the cloud when you are back online.');
                  }
                  setDeleteTarget(null);
                }}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: exit 0, "Compiled successfully".

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase/sync.ts src/components/layout/Dashboard.tsx
git commit -m "feat(sync): route deletion through one entry point that flushes to the cloud immediately"
```

---

### Task 7: Cloud Vault stops showing and restoring ghosts

`pullClaimsFromCloud` now returns live claims only (Task 5), so the listing is already fixed. This task adds the defence-in-depth guard on restore and removes the stale contract violation.

**Files:**
- Modify: `src/components/tabs/CloudVaultTab.tsx` (`fetchData` ~line 40, `handleRestore` ~line 71)

**Interfaces:**
- Consumes: `isTombstone` (Task 1); `syncTombstones` (Task 3)

- [ ] **Step 1: Flush pending deletions before pulling**

`syncTombstones` documents that it must be called before `pullClaimsFromCloud`; `fetchData` never did. Add the import:

```typescript
import { pullClaimsFromCloud, pushClaimToCloud, syncTombstones } from '@/lib/firebase/sync';
import { isTombstone } from '@/lib/sync/tombstone';
```

In `fetchData`, before the pull:

```typescript
      // Honour syncTombstones' contract: flush this device's pending deletions
      // first, so the vault never lists something the surveyor already deleted.
      await syncTombstones(user.uid);
      const cloud = await pullClaimsFromCloud(user.uid, null);
```

- [ ] **Step 2: Block restoring a tombstone**

Replace the body of `handleRestore`:

```typescript
  const handleRestore = async (claim: ClaimData) => {
    // Defence in depth: pullClaimsFromCloud already returns live claims only,
    // so this should be unreachable. If a tombstone ever does reach the UI,
    // restoring it would write a gravestone into IndexedDB as a claim.
    if (isTombstone(claim)) {
      toast.error('This claim was deleted and cannot be restored.');
      return;
    }
    setSyncingId(claim.id);
    try {
      await saveClaim(claim);
      toast.success(`Claim ${claim.reportNo || claim.id} restored to this device.`);
      fetchData();
    } catch {
      toast.error('Restore failed. Try again.');
    } finally {
      setSyncingId(null);
    }
  };
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit -p tsconfig.json` → no output
Run: `npm run build` → exit 0

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/CloudVaultTab.tsx
git commit -m "fix(vault): stop listing and restoring deleted claims in Cloud Vault"
```

---

### Task 8: Retry pending deletions on reconnect, not only at login

**Files:**
- Modify: `src/hooks/useCloudSync.ts` (queue-drain effect, ~lines 252-298)

**Interfaces:**
- Consumes: `syncTombstones` (Task 3) — already imported in this file

- [ ] **Step 1: Flush pending tombstones when the queue drains**

The drain effect runs whenever the app comes back online. A deletion made offline currently waits for the next *login*. In the drain effect's async body, before the `claimItems.length === 0` early return, add:

```typescript
        // Deletions made offline are queued as local tombstones. Flush them on
        // reconnect — waiting for the next login leaves a deleted claim alive
        // in the cloud, and visible in Cloud Vault, for the rest of the day.
        try {
          await syncTombstones(user.uid);
        } catch (err) {
          logger.error('[useCloudSync] Pending tombstone flush failed:', err);
        }
```

Note the early return below it must not skip this — place the flush **above** `if (claimItems.length === 0) { isDrainingRef.current = false; return; }`.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit -p tsconfig.json` → no output
Run: `npm run build` → exit 0

- [ ] **Step 3: Run the full src suite**

Run: `npx vitest run src/`
Expected: PASS except the known pre-existing `src/lib/ai/__tests__/discovery.test.ts` failure.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCloudSync.ts
git commit -m "fix(sync): flush pending deletions on reconnect instead of waiting for login"
```

---

## Manual verification checklist

Run after Task 8. Requires two signed-in devices (or two browser profiles).

- [ ] Delete a claim online → disappears from Cloud Vault immediately, without re-login.
- [ ] Delete a claim offline → gone locally, toast says it will finish clearing; reconnect → tombstone lands and the pending entry clears.
- [ ] Second device syncs → the claim disappears there too.
- [ ] Second device edits the claim *after* the deletion, then syncs → claim appears in Recovered with a warning.
- [ ] Second device holds a stale clean copy → disappears quietly, no Recovered entry, no toast.
- [ ] Cloud Vault never lists a deleted claim and cannot restore one.
- [ ] In the Firebase console, the deleted claim's document contains only `id`, `ownerId`, `deleted`, `deletedAt`, `updatedAt`, `version` — no insured or vehicle data.
- [ ] Existing flows unaffected: create a claim, edit on two devices, confirm the conflict path still stashes to Recovered as before.
