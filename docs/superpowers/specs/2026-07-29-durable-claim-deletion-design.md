# Durable Claim Deletion — Design

- **Date:** 2026-07-29
- **Status:** Draft — awaiting user review
- **Scope:** Make a deleted claim stay deleted, on every device and in the cloud.
- **Out of scope:** Google Drive folder cleanup (explicitly excluded by the user; see §9.2).
- **Related:** [2026-07-08-conflict-free-multidevice-sync-design.md](./2026-07-08-conflict-free-multidevice-sync-design.md) —
  introduced version-guarded writes and the Recovered Claims stash. This spec is its
  successor: that design made *edits* safe across devices but left *deletion* unhandled.

---

## 1. Summary

Deleting a claim today removes it from the local device and eventually removes it from
Firestore, but it leaves no durable record that the deletion ever happened. Because a
deleted document is simply *absent* from a Firestore query — indistinguishable from
"unchanged" or "never existed" — a second device never learns about it, keeps its copy,
and can push that copy back into the cloud.

This spec replaces the hard delete with a **tombstone stub**: the claim document is
overwritten in place with a small marker (`{ id, ownerId, deleted: true, deletedAt, … }`)
instead of being removed. The stub carries no personal data, travels through the sync
pipeline the app already has, and blocks resurrection inside the existing version-guarded
write.

---

## 2. Problem statement (grounded in code)

Four distinct defects, in order of severity.

### 2.1 Deletion does not propagate between devices

`deleteClaim` ([indexeddb.ts:375](../../../src/lib/storage/indexeddb.ts)) removes the claim
locally and writes a **local-only** tombstone. `syncTombstones`
([sync.ts:143](../../../src/lib/firebase/sync.ts)) later calls `deleteDoc` on the Firestore
document and then **removes the local tombstone**. After that, no record of the deletion
exists anywhere.

```
Device A: delete X → local tombstone → next login → X removed from Firestore, tombstone cleared
Device B: never learns X died (a deleted doc is absent from a pull, which is
          indistinguishable from "unchanged")
Device B: edits X, or logs in fresh → pushes X back to Firestore
Device A: pulls X back down — its tombstone was consumed and is gone
```

The claim returns from the dead on the device that deleted it.

This is aggravated by `syncDeltaToCloud` ([sync.ts:170](../../../src/lib/firebase/sync.ts)):
when `sinceTimestamp === null` (first login on a device) it pushes **every** local claim.

### 2.2 The cloud delete waits for the next login

`syncTombstones` is called from exactly one place —
[useCloudSync.ts:158](../../../src/hooks/useCloudSync.ts), inside the login-sync effect,
guarded by `isSyncingFullRef` so it runs once per session. A surveyor who deletes ten
claims and keeps working leaves all ten in Firestore for the rest of the day.

### 2.3 Cloud Vault displays deleted claims

`pullClaimsFromCloud` checks tombstones only to `continue` the local-merge loop; it returns
the **unfiltered** `remoteClaims` array. `CloudVaultTab.fetchData`
([CloudVaultTab.tsx:44](../../../src/components/tabs/CloudVaultTab.tsx)) calls it directly —
without first calling `syncTombstones`, violating that function's documented contract — and
renders whatever comes back. Deleted claims appear as live rows.

### 2.4 Cloud Vault can resurrect a deleted claim

`handleRestore` ([CloudVaultTab.tsx:71](../../../src/components/tabs/CloudVaultTab.tsx))
calls `saveClaim(claim)` with no tombstone check. Restoring a ghost writes it back to
IndexedDB while the local tombstone still exists, leaving local and cloud permanently
disagreeing.

---

## 3. Goals

- A deleted claim is gone from **every** device and from the cloud, permanently.
- Deletion propagates without depending on the order in which sync steps run.
- No field work is ever destroyed silently.
- The insured's personal data is genuinely erased from Firestore on delete.
- Reuse existing mechanisms; add as little new machinery as possible.

### Non-goals

- Google Drive folder cleanup (§9.2).
- Undo / trash / restore-within-N-days. Deletion stays a deliberate, confirmed, final act.
- Any audit log of who deleted what.

---

## 4. Decisions taken

| Question | Decision |
|---|---|
| How far must deletion reach? | **Cross-device and durable.** A local-only fix was rejected. |
| What happens to a second device's local copy? | **Deletion always wins.** If that device holds work that never reached the cloud, the copy is stashed into Recovered Claims first. |
| Retention of tombstones | **Kept indefinitely.** No TTL, no cleanup job (§5.3). |

---

## 5. Approach: tombstone stub in place of the claim document

### 5.1 Chosen design

On delete, instead of `deleteDoc(claimRef)`, the document is overwritten:

```ts
{ id, ownerId, deleted: true, deletedAt, updatedAt: <now>, version: cloudVersion + 1 }
```

Every field carrying insured, vehicle, or assessment data is removed by the overwrite — the
write *is* the personal-data purge. What remains is an ID, a flag and two timestamps.

This works because it rides pipelines that already exist:

- **Propagation is free.** The delta pull is `where('updatedAt', '>', cursor)`. Setting
  `updatedAt` to now means every device picks the stub up on its next ordinary sync. No
  second collection, no second cursor, no extra query.
- **Resurrection is blocked inside the write.** `pushClaimToCloud` already runs a
  transaction that reads the remote document and refuses to overwrite newer data. The stub
  bumps `version`, so a stale device's push is refused by the guard that is already there.
- **The stash already exists.** `addRecoveredClaim(claim, reason)` and the Recovered Claims
  tab already handle "your copy was superseded, here it is, nothing was lost."

### 5.2 Alternatives rejected

**B — separate `users/{uid}/deletions/{claimId}` collection.** Conceptually tidier: the
claims collection stays purely claims, and no stub can ever be mistaken for a claim.
Rejected because it is **order-dependent**. The login sync pushes before it pulls
([useCloudSync.ts:159-160](../../../src/hooks/useCloudSync.ts)), so a freshly installed
device would upload its entire local store *before* learning what had been deleted.
Correctness would depend on every present and future caller remembering to fetch deletions
first. Approach A blocks resurrection inside the write itself, so ordering cannot defeat it.

This was a genuine trade-off: B fails *safer* (a missed read path means the deletion is not
applied — status quo), whereas A fails *worse* (a missed read path can write a stub into
IndexedDB as if it were a claim). A was chosen anyway because order-independence is a
structural guarantee, whereas B's ordering rule is a convention that must be maintained
forever. A's failure mode is closed by the single ingestion chokepoint in §6.1.

**C — reconcile by absence** (delete any local claim missing from the cloud). Rejected
outright: it cannot distinguish "deleted remotely" from "created offline and not yet
pushed," so it would destroy unsynced field work. This is precisely why tombstones must
exist at all.

### 5.3 Retention

Stubs are kept forever. A stub is ~100 bytes; the delta cursor means each device downloads
a given stub once and never sees it again. A surveyor deleting 1,000 claims over five years
costs ~100 KB and no recurring reads.

Expiry was considered and rejected on correctness grounds, not cost: a device switched off
for longer than the TTL would come back, never see the stub, and resurrect the claim.
"Forever" is the safer choice as well as the simpler one.

---

## 6. Data model

### 6.1 Types

A tombstone is **not** a `ClaimData`. `ClaimData` requires `surveyType`, `vehicleType`,
`reportNo` and many other fields that a stub deliberately does not carry — the whole point
is that the payload is gone. Modelling the stub as a partially-filled `ClaimData` would be
a lie the compiler cannot catch.

Instead, a separate type and a discriminated union for what a cloud document may be:

```ts
/** A deleted claim's gravestone in Firestore. Carries NO claim payload. */
export interface ClaimTombstone {
  id: string;
  ownerId: string;
  deleted: true;
  deletedAt: string;   // ISO
  updatedAt: string;   // ISO — drives the delta pull; equals deletedAt on write
  version: number;
}

/** What a document in users/{uid}/claims may be. */
export type CloudClaimDoc = ClaimData | ClaimTombstone;
```

New module **`src/lib/sync/tombstone.ts`**:

```ts
export function makeTombstone(claimId: string, uid: string, nextVersion: number): ClaimTombstone
export function isTombstone(doc: CloudClaimDoc): doc is ClaimTombstone
```

`isTombstone` is a **type guard**, so once a document is partitioned at the chokepoint the
compiler enforces that stubs and claims never mix downstream. This is what makes §8.1 and
§8.2 structurally impossible rather than merely avoided by review.

The union appears in exactly two places — the ingestion chokepoint (§6.2) and the
transaction read in `pushClaimToCloud` — both of which this change already edits.

Both functions are pure and dependency-free, so they unit-test in the existing style (see
`sync-guard.ts`) with no mocking.

### 6.2 The single ingestion chokepoint

**Stubs must never enter IndexedDB.** They are partitioned out at the one place cloud
documents enter the app — immediately after `querySnap.forEach` in `pullClaimsFromCloud`:

```ts
const remoteClaims: ClaimData[] = [];
const remoteTombstones: ClaimTombstone[] = [];
querySnap.forEach(d => {
  const data = d.data() as CloudClaimDoc;
  if (isTombstone(data)) remoteTombstones.push(data);
  else remoteClaims.push(data);
});
```

Everything downstream — the merge loop, the return value, Cloud Vault — then handles live
claims only, by construction. This is what closes the failure mode described in §5.2.

### 6.3 Local tombstone store — narrowed role

The existing IndexedDB `tombstones` store is **kept**, but its purpose changes. It is no
longer the memory that a deletion happened (that now lives in the cloud). It becomes strictly
a **pending-work queue**: "this device still owes the cloud a tombstone write." Written on
delete, cleared once the stub lands.

---

## 7. Data flow

### 7.1 Deleting (Device A)

All of this lives behind **one** exported function, `deleteClaimEverywhere(uid, claimId)`
in `sync.ts`. The Dashboard calls that and nothing else. Deletion must not be assembled
from separate calls at each UI site, or the next delete button added to the app will
re-create §2.2.

1. Claim removed from IndexedDB immediately — the UI does not wait on the network.
2. Claim ID written to the local pending list (`tombstones`).
3. The stub write to Firestore is attempted **immediately**, not deferred to next login
   (fixes §2.2).
4. On success, the pending entry is cleared.
5. On failure or offline, the entry remains and is retried on the next sync, using the
   existing retry path.

The stub write itself runs in a `runTransaction`, because `version` must be
`cloudVersion + 1` and that requires reading the current document first. Writing a stub
with a stale or absent version would let a stale device's push win the
`canOverwrite` comparison and resurrect the claim — the exact failure this design exists to
prevent. If the document does not exist (the claim was never uploaded), the stub is written
at `version: 1`.

Re-writing a stub over an existing stub is harmless and idempotent: the second write simply
restates the deletion at a higher version.

### 7.2 Propagating (Device B)

6. Device B's ordinary delta pull returns the stub — no extra request.
7. Device B deletes its local copy.
8. **If Device B holds work postdating the deletion**, that copy is written to Recovered
   Claims first, with reason `'deleted-on-another-device'`. See §7.4 for the test.

### 7.3 Blocking resurrection

9. `pushClaimToCloud`'s transaction reads the remote document. If it is a stub, the push is
   refused.
10. The refusal is handled on its **own** path, not the existing conflict path — see §8.2.

### 7.4 Stash-or-drop test

A copy is stashed only when `local.updatedAt > deletedAt` — i.e. it was edited *after* the
deletion happened. Otherwise it is a stale duplicate of something already deleted and is
removed quietly.

Rationale: the obvious test — "is this claim dirty?" using `pushedAt` vs `updatedAt` —
**fails on a fresh install**, where `pushTracking` is empty and therefore every claim reads
as dirty. A surveyor restoring a six-month-old laptop would get dozens of Recovered entries
and dozens of warnings, and would learn to ignore them. The timestamp comparison needs no
local bookkeeping and so survives a fresh install.

### 7.5 Cloud Vault

11. The vault list renders live claims only (fixes §2.3).
12. Restore cannot act on a stub (fixes §2.4).

### 7.6 Delete confirmation wording

The toast currently reads "Claim permanently deleted" the instant the button is pressed,
which is untrue when offline. It should confirm the local deletion and, **only when the
cloud write has not yet succeeded**, add that it will finish clearing when back online.

---

## 8. Defects found in design review

Three defects were found while stress-testing this design and are corrected above. They are
recorded here because each is a trap an implementer would otherwise re-introduce.

### 8.1 The stub would be saved as a claim

`pullClaimsFromCloud`'s merge loop has a "brand-new claim from cloud — always accept" branch
(`if (!local) saveClaim({ ...remote, photos: [] })`). A device that never held the claim
would hit it with a stub and write the stub into IndexedDB as a claim, rendering a broken,
empty row on the dashboard.

Filtering only the *return value* does not help — the corruption happens in the merge loop.
**Corrected by the ingestion chokepoint (§6.2).**

### 8.2 Conflict recovery would adopt the stub

The stub bumps `version`, so a stale device fails `canOverwrite` and throws
`ClaimConflictError` **before** any `deleted` check. That lands in `recoverFromConflict`,
which does `saveClaim({ ...remote, photos: local.photos })` — replacing the surveyor's real
claim with a tombstone on his own device.

**Corrected** by checking `isTombstone(remote)` inside the transaction *before* the version
comparison and throwing a distinct `ClaimDeletedError`, handled separately. "The cloud is
newer" and "the cloud says this is dead" require opposite responses; reusing one path for
both is wrong.

### 8.3 The stash-or-drop test was wrong

Documented in §7.4. The original proposal used the dirty check, which collapses on a fresh
install — exactly the case it was introduced to fix.

---

## 9. Known limitations

### 9.1 Expired and read-only subscriptions cannot delete from the cloud

`firestore.rules` allows writes only when `hasActiveAccess()`. An expired, read-only, or
suspended surveyor can read his claims but cannot write, so the stub write is rejected and
the claim ID stays on the pending list until access is restored.

This is **not a regression** — `deleteDoc` requires the same permission today — but it means
"delete forever" is locally honoured and cloud-deferred for such users. The local pending
tombstone continues to block resurrection on that device in the meantime.

### 9.2 Google Drive folders are not cleaned up

Out of scope by explicit instruction. A deleted claim still leaves its Drive folder —
photos and a `claim.json` backup containing personal data — in the surveyor's Drive. This is
already flagged in code (`sync.ts`, `syncTombstones`) and tracked as **F5** in the
data-storage audit. It should be resolved separately; until then, "delete forever" does not
erase Drive copies.

---

## 10. Files touched

| File | Change |
|---|---|
| `src/lib/sync/tombstone.ts` | **New.** `ClaimTombstone`, `CloudClaimDoc`, `makeTombstone`, `isTombstone`. Types live here beside their guard, so `types/claim.ts` is untouched and `ClaimData` stays purely a live claim. |
| `src/lib/firebase/sync.ts` | `deleteClaimEverywhere`; transactional stub write replaces `deleteDoc`; ingestion chokepoint; `ClaimDeletedError` path; apply deletions locally; return live claims only. |
| `src/lib/storage/indexeddb.ts` | Narrow the tombstone store's role; helper to apply a remote deletion. |
| `src/components/layout/Dashboard.tsx` | Attempt the cloud write on delete; honest toast wording. |
| `src/components/tabs/CloudVaultTab.tsx` | Filter stubs; block restore of a stub. |
| `src/hooks/useCloudSync.ts` | Retry pending tombstones on sync/reconnect, not only at login. |

---

## 11. Testing

**Unit (pure, no mocking — matches the existing suite):**

- `isTombstone` — true for a stub, false for a live claim, false for a claim with no flag.
- `makeTombstone` — carries `id`/`ownerId`, sets `deleted`/`deletedAt`, bumps `version`, and
  **contains no claim payload fields** (the personal-data guarantee, asserted explicitly).
- Stash-or-drop test — stash when `updatedAt > deletedAt`, drop when older or equal.

**Integration (mocked Firestore, following `sync-conflict.test.ts`):**

- A push against a stub is refused and does **not** adopt the stub locally (§8.2).
- A pull containing a stub for an unknown claim does **not** write it to IndexedDB (§8.1).
- A pull containing a stub for a known clean claim deletes it and creates no Recovered entry.
- A pull containing a stub for a claim edited after `deletedAt` creates a Recovered entry.

**Manual verification checklist:**

- [ ] Delete a claim online → gone from Cloud Vault immediately, not after re-login.
- [ ] Delete a claim offline → gone locally; reconnect → stub lands, pending list clears.
- [ ] Second device syncs → claim disappears there too.
- [ ] Second device with edits postdating the delete → claim appears in Recovered.
- [ ] Second device with a stale clean copy → disappears quietly, no Recovered noise.
- [ ] Cloud Vault never lists a deleted claim, and cannot restore one.
- [ ] A deleted claim's Firestore document contains no insured or vehicle data.
