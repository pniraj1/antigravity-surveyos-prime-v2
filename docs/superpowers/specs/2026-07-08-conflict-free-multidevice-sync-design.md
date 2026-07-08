# Conflict-Free Multi-Device Sync — Design

**Date:** 2026-07-08 · **Status:** Draft for review

## Context

SurveyOS is offline-first: a surveyor edits claims in the browser's IndexedDB and the
app syncs to the Firestore "vault" on milestones (tab/claim switch, tab hidden, debounced
autosave) and on login. Today the vault write is an **unconditional `setDoc`** — whoever
pushes last wins, regardless of whose data is actually newer.

This creates a silent data-loss path (single surveyor, two devices):
1. Laptop 1 edits claim X but never syncs (offline / rushed off / tab killed).
2. Laptop 2 pulls the older X, edits it, and syncs the newer version to the vault.
3. Laptop 1 returns and its login sync **pushes before it pulls** (`useCloudSync.ts:146-148`),
   overwriting the vault's newer version with its stale one. Laptop 2's work is silently gone.

The single-session lock (`session.ts`, `useSessionHeartbeat.ts`) prevents *simultaneous*
editing but not this *time-separated* stale overwrite, and it cannot flush a device that is
offline/asleep when it is kicked.

**Confirmed constraint (simplifies everything):** it is always **one surveyor across their own
devices** — never two humans editing concurrently. So there is never a semantic "who is right"
conflict, only "which copy is freshest." Merging fields (CRDT/stitching) is explicitly out.

## Goals

- **No silent data loss and no corruption, ever** — a stale device can never overwrite newer
  cloud data.
- **Clean handoff in the common case** — logging out (or being kicked) auto-flushes to the cloud
  when online, so the next device starts fresh.
- **Deterministic recovery in the unavoidable case** — when an offline device returns with edits
  the cloud never saw and the cloud has since moved on: newest becomes live, the old copy is
  **stashed, never deleted** (Option B).
- **Visible sync status** — the surveyor can always see whether their work is in the cloud yet.

## Non-goals

- Field-level merge / CRDT / stitching two edits together.
- Multi-user concurrent editing (single-user assumption holds).
- Real-time collaborative editing.

## Design overview — four pillars

1. **Versioned claims** — every claim carries a monotonic `version`; the cloud increments it on
   each write. This is the ordering source of truth (more reliable than wall-clock `updatedAt`).
2. **Version-guarded push** — writes go through a Firestore **transaction** that refuses to
   overwrite if the cloud version is newer than the device's base version. Stale overwrites become
   physically impossible.
3. **Option B recovery** — on a refused push, stash the local copy in a "Recovered" store, pull the
   newer cloud version into IndexedDB, and notify. Nothing is lost; nothing blocks.
4. **Auto-flush on logout/kick + visible status** — flush all unsynced claims before releasing the
   session (when online); show a loud "in cloud / not in cloud" indicator; warn on unsynced+offline.

## Component design

### 1. Versioned claims
- Add `version: number` to `ClaimData` (default/treat-missing as `0`).
- The **cloud** value is authoritative. A device's local `claim.version` records the cloud
  generation its edits are based on. **Local edits do NOT change `version`** — only a successful
  cloud write (or a pull) does. Dirtiness is still tracked separately by `pushTracking` /
  `updatedAt` (unchanged).
- Migration: no backfill needed. Existing docs lack `version` → read as `0`; the first guarded
  write sets it to `1`.

### 2. Version-guarded push (`sync.ts`)
Replace the unconditional `setDoc` in `pushClaimToCloud` with a `runTransaction`:
```
tx:
  snap = get(claimRef)
  cloudVersion = snap.exists ? (snap.version ?? 0) : 0
  if (cloudVersion > localClaim.version):
      throw ClaimConflictError(remote = snap.data)     // cloud moved on → refuse
  tx.set(claimRef, { ...stripPhotos(localClaim), version: cloudVersion + 1, ownerId })
  return cloudVersion + 1
```
On success: update the local claim's `version` to the returned value and `setPushedAt`.
`syncDeltaToCloud` (bulk) uses the same guarded push per claim instead of `batch.set`
(losing batching is acceptable — correctness over speed; sequential is fine at surveyor volumes).
- Same-device normal autosave always hits the accept path (its version matches the cloud, since
  it is the only writer). The guard only ever fires on the genuine fork.

### 3. Option B recovery (on `ClaimConflictError`)
- Write the **local** (refused) claim into a new `recoveredClaims` IndexedDB store
  (`{ id, claim, supersededAt, reason }`) — a snapshot, not the live claim.
- Overwrite the live claim in IndexedDB with the transaction's `remote` (newer) data and set its
  `version` to the cloud version; `setPushedAt` to match (no longer dirty).
- Surface a non-blocking notice: *"Your earlier unsynced changes to <claim> were replaced by a
  newer version from your other device. The old copy is saved in Recovered."*
- New minimal **Recovered** view (list) so the surveyor can inspect/copy a stashed version. Read-only
  list is enough for v1; full restore-into-claim can follow.

### 4. Auto-flush on logout/kick + visible status
- **`flushAllPendingToCloud(uid)`** — pushes every dirty claim (and drains the sync queue) via the
  guarded push. No-op/return summary if offline.
- Call it:
  - **Manual logout** (`useAuth.ts` logout path) — flush, then `releaseSession` + `closeUserDB`.
  - **Remote kick** (`useSessionHeartbeat.ts`) — on detecting the deviceId change, flush (if online)
    *then* sign out, with a brief "Saving your work before switching…" state.
  - If **offline** at logout/kick: skip flush, warn *"You have unsynced changes and are offline —
    they'll sync when you reconnect"*, proceed. The version-guard protects them later.
- **Sync status indicator** (replaces the ignorable "• Unsaved"): a persistent, prominent
  **"✓ All saved to cloud"** vs **"⚠ N changes not in cloud"**, driven by the dirty-claim count.
  Warn before logout/switch when dirty. (UI polish; can land as its own slice.)

## Data flow

**Normal handoff (both online):** Laptop 1 logout → `flushAllPendingToCloud` → vault current →
session released → Laptop 2 login → pulls current → edits → guarded push (versions match) → accepted.
No fork.

**Unavoidable fork (Laptop 1 was offline/dead):** Laptop 2 pulls older cloud, edits, pushes
(version N→N+1). Laptop 1 returns, tries to push based on N → cloud is N+1 → **refused** → Option B:
stash Laptop 1's copy, pull N+1 into IndexedDB, notify. Newest survives; old preserved; no corruption.

## Failure handling & edge cases
- **Offline device returns:** guarded push simply defers (still offline) or is refused (cloud newer)
  → Option B. Never overwrites.
- **New claim, never in cloud:** `cloudVersion = 0`, local `version = 0` → accepted as version 1. No
  conflict (unique id).
- **Transaction contention/retries:** Firestore retries transactions automatically; the version
  check is idempotent.
- **Clock skew:** irrelevant — ordering uses the integer `version`, not timestamps.
- **Flush fails mid-way (partial):** remaining dirty claims stay queued and retry; guard keeps them safe.

## Testing
- **Pure unit test** the guard decision: `(localVersion, cloudVersion) → 'accept' | 'reject'`.
- **Unit test** Option B stash: refused push → recovered store gets the old, live claim becomes remote.
- **Integration (emulator)**: two simulated devices, offline-fork scenario end-to-end.
- Existing `syncClaimNow` / session tests must still pass.

## Rollout / phases (for the plan)
1. Version field + guarded `pushClaimToCloud` + `syncDeltaToCloud` (core safety).
2. Option B recovery store + notice + minimal Recovered list.
3. `flushAllPendingToCloud` wired into logout + kick.
4. Visible sync-status indicator + unsynced/offline warning.

## Files (anticipated)
- `src/types/claim.ts` — add `version`.
- `src/lib/firebase/sync.ts` — transactional guarded push; guarded delta; conflict error type.
- `src/lib/storage/indexeddb.ts` — `recoveredClaims` store (v6); flush helpers.
- `src/hooks/useAuth.ts` — flush before logout; feed pull result into local version.
- `src/hooks/useSessionHeartbeat.ts` — flush-then-signout on kick.
- `src/components/layout/ClaimHeader.tsx` (or a small status component) — prominent sync status.
- New: minimal Recovered list view.
