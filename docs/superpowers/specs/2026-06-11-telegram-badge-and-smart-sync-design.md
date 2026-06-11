# Telegram Badge + Smarter Validated Local Sync — Design

**Date:** 2026-06-11
**Status:** Approved
**Area:** Prime V2 — Documents tab badge + SurveyOS Sync picker / local-sync engine

---

## Problem / Goal

Two related improvements to the SurveyOS Sync local-folder feature:

1. **Branding:** the per-card pull affordance is a gold ✈️ `Plane` badge. Replace it with the
   recognizable **Telegram logo** (blue) plus an **"OS Sync"** caption, so surveyors immediately
   understand the source.
2. **Validated, cheaper sync:** "Sync all" currently makes one Worker manifest call
   (`getSyncClaim`) per claim every time, even for claims that haven't changed. Add per-device
   download validation so the surveyor can *see* what's already local, and make "Sync all" **skip
   unchanged claims** to cut redundant Worker calls — while always keeping a **manual per-claim
   download** as an override (essential when the surveyor moves to a different device).

All validation keys off each claim folder's local `_surveyos-sync.json`, so it is inherently
**per-device**: a new machine with an empty/fresh folder shows everything as "not on this device"
and downloads in full.

---

## Change 1 — Telegram icon + "OS Sync" label

Replace the gold `Plane` badge on each document card ([DocumentsTab.tsx:367-382]) with a small
**Telegram glyph** and a tiny **"OS Sync"** caption stacked beneath it.

- **New component** `src/components/icons/TelegramIcon.tsx` — an inline SVG of the official Telegram
  mark (white paper plane on a `#229ED9` blue filled circle). Inline SVG (not the PNG) keeps it
  crisp at ~14px and adds no asset dependency. Takes a `size` prop (default 14).
- **Badge layout:** the existing corner button becomes a compact vertical stack — the Telegram glyph
  (~14px) with "OS Sync" in an 8px caption below. Unchanged otherwise: `onClick` still opens the
  slot-scoped picker (`setSyncPicker({ key: doc.id, label: doc.label })`), still
  `e.preventDefault()`+`e.stopPropagation()`, still gated on `syncConnected`, still `relative z-20`.
- The badge's background/border drop the gold styling in favor of a neutral/transparent chip so the
  blue Telegram color reads cleanly. `title`/`aria-label` stay "Pull \<doc\> from SurveyOS Sync".

No behavior change — purely the visual affordance.

---

## Change 2 — Per-device sync validation + smarter "Sync all"

### Manifest data
Add one field to `LocalManifest` (in `sync-manifest.ts`):
```ts
  /** The claim's receivedDocs count at the moment of the last sync (for change detection). */
  receivedDocsAtSync: number;
```
`emptyManifest()` initializes it to `0`. The sync engine sets it after a successful claim sync.

### Pure status helper (unit-tested)
Add to `sync-manifest.ts`:
```ts
export type ClaimSyncState = 'synced' | 'new' | 'none';

/**
 * Compare what we recorded locally against the claim's current receivedDocs.
 * - 'none'   : nothing recorded locally (no manifest / 0 recorded)
 * - 'synced' : recorded >= current receivedDocs (fully on disk)
 * - 'new'    : 0 < recorded < receivedDocs (new docs available since last sync)
 */
export function claimSyncState(recordedDocs: number, receivedDocs: number): ClaimSyncState;
```

### Reading a claim's local status (no Worker call)
Add `getClaimRecordedDocs(root, claim): Promise<number>` to `local-source.ts` (or a small
`claim-status.ts`): resolves the claim folder by `claimFolderName`, reads `_surveyos-sync.json`,
returns its `receivedDocsAtSync` (or `0` if absent / unreadable). Pure path logic reuses
`claimFolderName`; the FS read never throws (returns `0` on any miss). This is **local disk I/O,
not a Worker call.**

### Claim-list "✓ synced" tick (the validation)
When the picker's claim list loads (claims already come from `listSyncClaims`, no extra Worker
call), compute a per-claim status map by reading each claim's local manifest from disk, then render
on each claim row:
- `claimSyncState === 'synced'` → green **✓ synced**
- `claimSyncState === 'new'` → amber **"N new"** (where N = receivedDocs − recorded)
- `claimSyncState === 'none'` → grey **"not on this device"**

The map is computed in `useLocalSync` (or the picker) when the list + root handle are available, and
refreshed after any sync completes.

### Smarter "Sync all" — skip unchanged claims
In `syncAllClaims`, before syncing each claim, read its recorded count. If
`claimSyncState(recorded, claim.receivedDocs) === 'synced'`, **skip it entirely** — no
`getSyncClaim` call, no downloads. Otherwise run the normal `syncClaim`. Report skipped vs synced
counts in the final toast (e.g. "Synced 4 files; 12 claims already up to date").

### Manual per-claim override (different-device path)
The existing claim-detail **"Sync to local folder"** button is unchanged and **always** runs a full
`syncClaim` (fetch manifest + diff + download) regardless of the tick. This is the deliberate
override: on a new device every claim shows "not on this device", and the surveyor opens a claim and
pulls it; even a "synced"-looking claim can be force-re-checked here.

---

## Honest limitation (explicit)
The skip/tick heuristic compares **document count** (`receivedDocs`). If a new *file* is added to an
*existing* multi-file slot (doc count unchanged), "Sync all" will skip that claim and the tick will
read "synced". The **manual per-claim button always catches this** (it does a full diff). Precise
auto-detection would require a Worker change to expose a per-claim "updatedAt" — out of scope.

---

## Components touched

| File | Change |
|---|---|
| `src/components/icons/TelegramIcon.tsx` | Create — inline Telegram SVG glyph |
| `src/components/tabs/DocumentsTab.tsx` | Badge → Telegram glyph + "OS Sync" caption |
| `src/lib/local-sync/sync-manifest.ts` | Add `receivedDocsAtSync` + pure `claimSyncState` |
| `src/lib/local-sync/sync-engine.ts` | Record `receivedDocsAtSync`; skip-`synced` claims in `syncAllClaims` |
| `src/lib/local-sync/local-source.ts` | Add `getClaimRecordedDocs(root, claim)` |
| `src/lib/local-sync/useLocalSync.ts` | Expose a per-claim status map + refresh after sync |
| `src/components/sync-bridge/SyncDrivePicker.tsx` | Claim-list per-claim tick (synced / N new / not on device) |

---

## Error handling
- `getClaimRecordedDocs` and the list-status read never throw — any FS miss → treated as `0`
  (`'none'`), so the worst case is "not on this device" and a normal (un-skipped) sync.
- Unsupported browser / no folder connected → no ticks shown; sync buttons already hidden.
- Skip logic only *removes* Worker calls; it never deletes or overwrites local files.

## Testing
- **Unit — `claimSyncState`:** `recorded=0`→'none'; `recorded≥received`→'synced'; `0<recorded<received`
  →'new'; boundary `recorded===received`→'synced'.
- **Unit — `syncAllClaims` skip decision:** given a fake reader returning recorded counts, a claim
  with `recorded≥received` is skipped (its `syncClaim`/fetch is never invoked) and a changed claim is
  synced. (Inject the per-claim reader + a fake `syncClaim` so the decision is testable without FS.)
- **Manual E2E:** sync a claim → claim row shows ✓ synced; add a doc in Sync → row shows "1 new";
  "Sync all" skips the unchanged claims (verify in DevTools Network: no `getSyncClaim` for them);
  open a "synced" claim and use the manual button to force a re-check; on a second device/fresh
  folder, all rows show "not on this device" and download in full.

## Follow-ups (deferred)
- Worker `updatedAt` per claim for file-level (not doc-count) change detection.
- A consolidated root index file to avoid N per-claim manifest reads on very large claim lists.
