# Telegram Badge + Smarter Validated Local Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the gold ✈️ badge with a blue Telegram glyph + "OS Sync" caption, and add per-device sync validation — a claim-list "✓ synced / N new / not on this device" tick plus a "Sync all" that skips unchanged claims to cut Worker manifest calls (with the manual per-claim sync always available as override).

**Architecture:** All validation keys off each claim folder's local `_surveyos-sync.json`, made per-device by adding a `receivedDocsAtSync` count to the manifest. A pure `claimSyncState` helper classifies a claim from (recorded vs current `receivedDocs`); a pure `partitionClaimsForSync` decides skip-vs-sync. The engine records the count and skips fully-synced claims; the hook exposes a per-claim status map read from disk (no Worker calls); the picker renders the tick. The badge swap is an isolated visual change.

**Tech Stack:** Next.js 16 / React 19 / TypeScript, File System Access API, `idb`, Vitest, sonner.

**Spec:** `docs/superpowers/specs/2026-06-11-telegram-badge-and-smart-sync-design.md`

**Working dir:** `C:\Users\Manasi\OneDrive\Desktop\Antigravity Surveyor V6 fixed\SurveyOS-Prime-V2` (Bash tool for npm/git; Windows/PowerShell; `npm test` = `vitest run`). Scope test runs to relevant suites; a full `npm test` shows ~191 pre-existing failures from a vendored `open-design` sub-project missing `jsdom` — ignore those.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/components/icons/TelegramIcon.tsx` | Inline Telegram SVG glyph | Create |
| `src/components/tabs/DocumentsTab.tsx` | Badge → Telegram glyph + "OS Sync" caption | Modify |
| `src/lib/local-sync/sync-manifest.ts` | `receivedDocsAtSync` field + pure `claimSyncState` + `partitionClaimsForSync` | Modify |
| `src/lib/local-sync/__tests__/sync-manifest.test.ts` | Tests for the two new pure helpers | Modify |
| `src/lib/local-sync/local-source.ts` | `getClaimRecordedDocs(root, claim)` reader | Modify |
| `src/lib/local-sync/sync-engine.ts` | Record `receivedDocsAtSync`; skip 'synced' claims in `syncAllClaims` | Modify |
| `src/lib/local-sync/useLocalSync.ts` | `claimStatus` map + `loadClaimStatuses`; skipped-aware toast | Modify |
| `src/components/sync-bridge/SyncDrivePicker.tsx` | Claim-list tick; trigger status load | Modify |

---

## Task 1: Telegram icon + "OS Sync" badge (Change 1)

**Files:**
- Create: `src/components/icons/TelegramIcon.tsx`
- Modify: `src/components/tabs/DocumentsTab.tsx`

- [ ] **Step 1: Create the icon component**

Create `src/components/icons/TelegramIcon.tsx`:
```tsx
// Official Telegram logo (white paper plane on a #229ED9 blue circle), inline SVG.
interface TelegramIconProps {
  size?: number;
  className?: string;
}

export function TelegramIcon({ size = 16, className }: TelegramIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="120" cy="120" r="120" fill="#229ED9" />
      <path
        fill="#fff"
        d="M53.2 117.8c34.9-15.2 58.2-25.2 69.9-30.1 33.3-13.8 40.2-16.2 44.7-16.3 1 0 3.2.2 4.7 1.4.8.7 1.4 1.6 1.6 2.6.2 1 .4 2.4.3 3.5-1.3 13.7-6.9 47-9.8 62.4-1.2 6.5-3.6 8.7-5.9 8.9-5 .5-8.8-3.3-13.6-6.5-7.6-5-11.9-8.1-19.3-13-8.5-5.6-3-8.7 1.9-13.7 1.3-1.3 23.2-21.3 23.6-23.1.1-.2.1-1.1-.4-1.5s-1.2-.3-1.8-.2c-.8.2-12.8 8.1-36.1 23.8-3.4 2.3-6.5 3.5-9.3 3.4-3.1-.1-8.9-1.8-13.3-3.2-5.4-1.7-9.6-2.7-9.3-5.7.2-1.6 2.3-3.2 6.4-4.9z"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Swap the badge in DocumentsTab**

In `src/components/tabs/DocumentsTab.tsx`, the per-card badge currently is (around lines 367-382):
```tsx
                        {syncConnected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSyncPicker({ key: doc.id, label: doc.label });
                            }}
                            className="relative z-20 flex items-center justify-center w-6 h-6 rounded-lg transition-colors hover:scale-110"
                            style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
                            title={`Pull ${doc.label} from SurveyOS Sync`}
                            aria-label={`Pull ${doc.label} from SurveyOS Sync`}
                          >
                            <Plane size={12} />
                          </button>
                        )}
```
Replace that whole block with:
```tsx
                        {syncConnected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSyncPicker({ key: doc.id, label: doc.label });
                            }}
                            className="relative z-20 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-1 transition-transform hover:scale-110"
                            title={`Pull ${doc.label} from SurveyOS Sync`}
                            aria-label={`Pull ${doc.label} from SurveyOS Sync`}
                          >
                            <TelegramIcon size={16} />
                            <span className="text-[8px] font-bold leading-none text-[#229ED9]">OS Sync</span>
                          </button>
                        )}
```

- [ ] **Step 3: Fix imports**

At the top of `DocumentsTab.tsx`: remove `Plane` from the `lucide-react` import list (it is now unused — confirm via search that no other `Plane` usage remains in the file), and add:
```tsx
import { TelegramIcon } from '@/components/icons/TelegramIcon';
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc clean (no unused-`Plane` error); Next.js build produces `out/`.

- [ ] **Step 5: Commit**

```bash
git add src/components/icons/TelegramIcon.tsx src/components/tabs/DocumentsTab.tsx
git commit -m "feat(sync): replace gold plane badge with Telegram icon + OS Sync label"
```
(`--no-verify` if a hook blocks.)

---

## Task 2: Manifest field + pure status/partition helpers (TDD)

**Files:**
- Modify: `src/lib/local-sync/sync-manifest.ts`
- Modify: `src/lib/local-sync/__tests__/sync-manifest.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/local-sync/__tests__/sync-manifest.test.ts` (keep existing imports; add `claimSyncState`, `partitionClaimsForSync`, and `emptyManifest`/`type LocalManifest` if not already imported):
```ts
import { claimSyncState, partitionClaimsForSync } from '../sync-manifest'

describe('claimSyncState', () => {
  it('none when nothing recorded', () => {
    expect(claimSyncState(0, 5)).toBe('none')
  })
  it('synced when recorded >= received', () => {
    expect(claimSyncState(5, 5)).toBe('synced')
    expect(claimSyncState(6, 5)).toBe('synced')
  })
  it('new when partially recorded', () => {
    expect(claimSyncState(2, 5)).toBe('new')
  })
  it('none when received is 0 and nothing recorded', () => {
    expect(claimSyncState(0, 0)).toBe('none')
  })
})

describe('partitionClaimsForSync', () => {
  const claims = [
    { claimId: 'a', receivedDocs: 3 },
    { claimId: 'b', receivedDocs: 2 },
    { claimId: 'c', receivedDocs: 4 },
  ]
  it('skips claims whose recorded count covers receivedDocs', () => {
    const recorded = new Map([['a', 3], ['b', 0], ['c', 2]])
    const { toSync, skipped } = partitionClaimsForSync(claims, recorded)
    expect(skipped.map((c) => c.claimId)).toEqual(['a'])
    expect(toSync.map((c) => c.claimId)).toEqual(['b', 'c'])
  })
  it('syncs everything when nothing recorded', () => {
    const { toSync, skipped } = partitionClaimsForSync(claims, new Map())
    expect(skipped).toEqual([])
    expect(toSync).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- sync-manifest`
Expected: FAIL — `claimSyncState`/`partitionClaimsForSync` not exported.

- [ ] **Step 3: Implement**

In `src/lib/local-sync/sync-manifest.ts`:

(a) Add `receivedDocsAtSync` to the `LocalManifest` interface (after `syncedAt`):
```ts
  /** The claim's receivedDocs count at the moment of the last sync (for change detection). */
  receivedDocsAtSync: number
```

(b) Initialize it in `emptyManifest`:
```ts
export function emptyManifest(claimId: string): LocalManifest {
  return { claimId, syncedAt: null, receivedDocsAtSync: 0, files: {} }
}
```

(c) Append the two pure helpers at the end of the file:
```ts
export type ClaimSyncState = 'synced' | 'new' | 'none'

/**
 * Classify a claim from what we recorded locally vs its current receivedDocs.
 * - 'none'   : nothing recorded locally
 * - 'synced' : recorded >= current receivedDocs (and at least one doc exists)
 * - 'new'    : 0 < recorded < receivedDocs
 */
export function claimSyncState(recordedDocs: number, receivedDocs: number): ClaimSyncState {
  if (recordedDocs <= 0) return 'none'
  if (recordedDocs >= receivedDocs) return 'synced'
  return 'new'
}

/** Split claims into those to (re)sync vs skip, given each claim's locally-recorded doc count. */
export function partitionClaimsForSync<T extends { claimId: string; receivedDocs: number }>(
  claims: readonly T[],
  recorded: ReadonlyMap<string, number>,
): { toSync: T[]; skipped: T[] } {
  const toSync: T[] = []
  const skipped: T[] = []
  for (const c of claims) {
    if (claimSyncState(recorded.get(c.claimId) ?? 0, c.receivedDocs) === 'synced') skipped.push(c)
    else toSync.push(c)
  }
  return { toSync, skipped }
}
```

- [ ] **Step 4: Run to verify pass + type-check**

Run: `npm test -- sync-manifest && npx tsc --noEmit`
Expected: PASS, clean.

> Note: adding `receivedDocsAtSync` as a required field may surface a tsc error anywhere a `LocalManifest` is built by hand. The only constructor is `emptyManifest` (updated above) and `readManifest` in sync-engine (handled in Task 4). The existing sync-manifest tests build manifests via `emptyManifest`, so they stay green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/local-sync/sync-manifest.ts src/lib/local-sync/__tests__/sync-manifest.test.ts
git commit -m "feat(local-sync): receivedDocsAtSync + pure claimSyncState/partitionClaimsForSync"
```

---

## Task 3: Claim recorded-docs reader

**Files:**
- Modify: `src/lib/local-sync/local-source.ts`

> Thin FS read (verified manually). The pure path logic reuses `claimFolderName`.

- [ ] **Step 1: Add the reader**

Append to `src/lib/local-sync/local-source.ts`:
```ts
import { MANIFEST_FILENAME, type LocalManifest } from './sync-manifest'

/**
 * Read a claim's locally-recorded receivedDocsAtSync from its folder manifest.
 * Returns 0 if no folder / no manifest / unreadable. Never throws (local disk I/O only).
 */
export async function getClaimRecordedDocs(
  root: FileSystemDirectoryHandle | null,
  claim: { vehicleNumber: string; insuranceCompany: string },
): Promise<number> {
  if (!root) return 0
  try {
    const claimDir = await root.getDirectoryHandle(claimFolderName(claim))
    const fh = await claimDir.getFileHandle(MANIFEST_FILENAME)
    const text = await (await fh.getFile()).text()
    const parsed = JSON.parse(text) as LocalManifest
    return typeof parsed.receivedDocsAtSync === 'number' ? parsed.receivedDocsAtSync : 0
  } catch {
    return 0
  }
}
```
(The file already imports `claimFolderName` from `./nomenclature`; if not, add it to that import.)

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/lib/local-sync/local-source.ts
git commit -m "feat(local-sync): getClaimRecordedDocs reader for per-device validation"
```

---

## Task 4: Engine records count + skips synced claims

**Files:**
- Modify: `src/lib/local-sync/sync-engine.ts`

> Decision logic is the pure `partitionClaimsForSync` (tested in Task 2). This wires it in. Verified end-to-end manually.

- [ ] **Step 1: Update imports**

In `src/lib/local-sync/sync-engine.ts`, extend the `./sync-manifest` import to add `partitionClaimsForSync`, and add the reader import:
```ts
import {
  MANIFEST_FILENAME, diffManifest, emptyManifest, fileKey, partitionClaimsForSync,
  type LocalManifest, type RemoteFile,
} from './sync-manifest'
import { getClaimRecordedDocs } from './local-source'
```

- [ ] **Step 2: Normalize the read manifest (defensive default)**

Replace the `readManifest` body's success return so an older manifest without `receivedDocsAtSync` still has the field:
```ts
async function readManifest(claimDir: FileSystemDirectoryHandle, claimId: string): Promise<LocalManifest> {
  try {
    const fh = await claimDir.getFileHandle(MANIFEST_FILENAME)
    const text = await (await fh.getFile()).text()
    const parsed = JSON.parse(text) as LocalManifest
    return parsed.files ? { ...emptyManifest(claimId), ...parsed } : emptyManifest(claimId)
  } catch {
    return emptyManifest(claimId)
  }
}
```

- [ ] **Step 3: Record `receivedDocsAtSync` in `syncClaim`**

In `syncClaim`, right after `const manifest = await readManifest(claimDir, claim.claimId)`, add:
```ts
  manifest.receivedDocsAtSync = detail.documents.length
```
(That is the count of received documents the bridge returned — the same basis the claim-list compares against. It is set even when `todo` is empty, so a re-checked-but-unchanged claim still records the current count.)

Also ensure the manifest is persisted when nothing was downloaded: after the `for (const r of todo)` loop and before the final `onProgress`/`return`, add:
```ts
  if (todo.length === 0) await writeManifest(claimDir, manifest)
```

- [ ] **Step 4: Skip synced claims in `syncAllClaims`**

Replace the whole `syncAllClaims` function with:
```ts
/** Sync many claims sequentially, skipping ones already fully on disk (no Worker call). */
export async function syncAllClaims(
  token: string,
  root: FileSystemDirectoryHandle,
  claims: readonly SyncClaimSummary[],
  onClaim?: (index: number, total: number, label: string) => void,
): Promise<{ downloaded: number; failed: number; skipped: number }> {
  // Read each claim's locally-recorded count (disk only — no Worker calls), then decide.
  const recorded = new Map<string, number>()
  for (const c of claims) recorded.set(c.claimId, await getClaimRecordedDocs(root, c))
  const { toSync } = partitionClaimsForSync(claims, recorded)

  let downloaded = 0
  let failed = 0
  for (let i = 0; i < toSync.length; i++) {
    const c = toSync[i]
    onClaim?.(i + 1, toSync.length, c.label)
    const res = await syncClaim(token, root, {
      claimId: c.claimId, vehicleNumber: c.vehicleNumber, insuranceCompany: c.insuranceCompany, label: c.label,
    })
    downloaded += res.downloaded
    failed += res.failed
  }
  return { downloaded, failed, skipped: claims.length - toSync.length }
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (`syncAllClaims` return type now includes `skipped`; its only caller — `useLocalSync.runSyncAll` — is updated in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/local-sync/sync-engine.ts
git commit -m "feat(local-sync): record receivedDocsAtSync + skip synced claims in sync-all"
```

---

## Task 5: Hook status map + skipped-aware toast

**Files:**
- Modify: `src/lib/local-sync/useLocalSync.ts`

- [ ] **Step 1: Add imports + status state**

In `src/lib/local-sync/useLocalSync.ts`, add imports:
```ts
import { getClaimRecordedDocs } from './local-source'
import { claimSyncState, type ClaimSyncState } from './sync-manifest'
```
Add a status type and state (after the `progress` state):
```ts
  const [claimStatus, setClaimStatus] = useState<Record<string, { state: ClaimSyncState; newCount: number }>>({})
```

- [ ] **Step 2: Add `loadClaimStatuses`**

After `ensureRoot`, add:
```ts
  /** Read each claim's local manifest (disk only) and classify it for the list tick. */
  const loadClaimStatuses = useCallback(async (claims: readonly SyncClaimSummary[]) => {
    if (!root) { setClaimStatus({}); return }
    const entries = await Promise.all(claims.map(async (c) => {
      const recorded = await getClaimRecordedDocs(root, c)
      return [c.claimId, {
        state: claimSyncState(recorded, c.receivedDocs),
        newCount: Math.max(0, c.receivedDocs - recorded),
      }] as const
    }))
    setClaimStatus(Object.fromEntries(entries))
  }, [root])
```

- [ ] **Step 3: Skipped-aware sync-all toast**

In `runSyncAll`, replace the success toast line:
```ts
      toast.success(`Synced ${res.downloaded} files across ${claims.length} claims` + (res.failed ? ` (${res.failed} failed).` : '.'))
```
with:
```ts
      toast.success(
        `Synced ${res.downloaded} file${res.downloaded === 1 ? '' : 's'}` +
        (res.skipped ? `; ${res.skipped} claim${res.skipped === 1 ? '' : 's'} already up to date` : '') +
        (res.failed ? ` (${res.failed} failed)` : '') + '.',
      )
```

- [ ] **Step 4: Expose the new API**

Update the return statement to include `claimStatus` and `loadClaimStatuses`:
```ts
  return { supported, connected: !!root, busy, progress, root, claimStatus, runSyncClaim, runSyncAll, ensureRoot, loadClaimStatuses }
```

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
git add src/lib/local-sync/useLocalSync.ts
git commit -m "feat(local-sync): per-claim status map + skipped-aware sync-all toast"
```

---

## Task 6: Claim-list tick in the picker

**Files:**
- Modify: `src/components/sync-bridge/SyncDrivePicker.tsx`

- [ ] **Step 1: Load statuses when the claim list / folder is ready**

Add an effect (near the other effects). It refreshes when the claim list changes, the folder connects, or a sync finishes (`localSync.busy` toggles):
```tsx
  // Compute per-claim "on disk" status for the list tick (reads local manifests — no Worker calls).
  useEffect(() => {
    if (claims.length > 0) void localSync.loadClaimStatuses(claims);
  }, [claims, localSync.root, localSync.busy, localSync.loadClaimStatuses]);
```

- [ ] **Step 2: Render the tick on each claim row**

In the claim-list rendering, each claim row currently ends with:
```tsx
                            <span className="text-xs text-muted-foreground shrink-0">
                              {c.receivedDocs} docs
                            </span>
```
Replace that span with a status-aware element:
```tsx
                            {(() => {
                              const st = localSync.claimStatus[c.claimId];
                              if (st?.state === 'synced') {
                                return <span className="text-[10px] font-bold shrink-0" style={{ color: '#16a34a' }}>✓ synced</span>;
                              }
                              if (st?.state === 'new') {
                                return <span className="text-[10px] font-bold shrink-0" style={{ color: '#B8860B' }}>{st.newCount} new</span>;
                              }
                              if (localSync.connected && st?.state === 'none') {
                                return <span className="text-[10px] shrink-0 text-muted-foreground">not on this device</span>;
                              }
                              return <span className="text-xs text-muted-foreground shrink-0">{c.receivedDocs} docs</span>;
                            })()}
```
(When no folder is connected, `claimStatus` is empty so it falls through to the original "N docs" — unchanged behavior.)

- [ ] **Step 3: Type-check + tests + build**

Run: `npx tsc --noEmit && npm test -- sync-bridge local-sync && npm run build`
Expected: tsc clean; sync-bridge + local-sync suites pass; build produces `out/`.

- [ ] **Step 4: Commit**

```bash
git add src/components/sync-bridge/SyncDrivePicker.tsx
git commit -m "feat(local-sync): claim-list synced/new/not-on-device tick in the picker"
```

---

## Task 7: Manual end-to-end verification

Requires the deployed Worker (already live) + a connected Sync surveyor + desktop Chrome/Edge + Prime running (`npm run dev`) or deployed.

- [ ] **Step 1: Badge**

Open a claim → Documents tab.
Expected: each card shows the blue **Telegram** glyph with **"OS Sync"** beneath it (no gold plane). Clicking it opens the Sync picker (unchanged behavior). When Sync is disconnected, the badge is hidden.

- [ ] **Step 2: Claim-list ticks**

Connect a folder and sync one claim (open it → "Sync to local folder"). Go back to the claim list.
Expected: the synced claim row shows green **✓ synced**; unsynced claims show **"not on this device"** (folder connected) or the original "N docs" (no folder).

- [ ] **Step 3: "N new" after a change**

In the Sync app, add a new document to the synced claim. Reopen the picker / refresh the list.
Expected: that claim row shows amber **"1 new"**.

- [ ] **Step 4: Smarter Sync all (fewer Worker calls)**

Open DevTools → Network, filter `bridge/claims/`. Click **"Sync all claims to local folder"**.
Expected: claims already **✓ synced** make **no** `GET …/api/bridge/claims/:id` request; only "new"/"not on device" claims are fetched. Toast reads e.g. "Synced N files; M claims already up to date."

- [ ] **Step 5: Manual override / different device**

Open a **✓ synced** claim and click **"Sync to local folder"**.
Expected: it still runs a full check (fetches the manifest, downloads anything missing) regardless of the tick — confirming the override path works for a different device.

---

## Self-review notes

- **Spec coverage:** Telegram icon + "OS Sync" → Task 1; `receivedDocsAtSync` + `claimSyncState` → Task 2; `getClaimRecordedDocs` → Task 3; record count + skip-synced in `syncAllClaims` → Task 4; per-claim status map + skipped toast → Task 5; claim-list tick (synced / N new / not on this device) → Task 6; manual per-claim override (unchanged existing button) verified → Task 7 Step 5; doc-count heuristic limitation acknowledged (manual button catches it) → Task 7 Step 5.
- **Type consistency:** `ClaimSyncState`/`claimSyncState`/`partitionClaimsForSync` defined in Task 2, consumed in Tasks 4 (partition) and 5 (state). `receivedDocsAtSync` added to `LocalManifest` (Task 2), defaulted in `emptyManifest` (Task 2) and `readManifest` spread (Task 4), set in `syncClaim` (Task 4), read by `getClaimRecordedDocs` (Task 3). `syncAllClaims` return gains `skipped` (Task 4) and the only caller `runSyncAll` is updated to read it (Task 5). `claimStatus: Record<string, { state; newCount }>` defined in Task 5 and consumed in Task 6. `getClaimRecordedDocs(root, claim)` signature consistent between Tasks 3, 4, 5.
- **Reuse:** badge keeps the exact click/stop-propagation/z-20 behavior; status reads are disk-only (no new Worker calls); pure decision logic is unit-tested, FS/visual is manual.
- **Deferred (per spec):** Worker `updatedAt` for file-level change detection; consolidated root index to avoid N manifest reads.
```
