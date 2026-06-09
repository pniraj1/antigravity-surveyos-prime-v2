# Homogenize SurveyOS Sync into a Per-Field Document Source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make SurveyOS Sync a peer source on every Documents-tab field — pulling a Sync document into the exact field whose ✈️ badge was clicked — and make the Sync claim list searchable and grouped by insurer.

**Architecture:** Delete the brittle filename→slot keyword heuristic and the single global "Add from SurveyOS Sync" button. Each document card renders a per-card ✈️ badge (only when Sync is connected) that opens the picker carrying that card's slot `key`; the picked file flows through the existing `processFile(file, key)` pipeline unchanged. The picker gains a live search box and insurer grouping (backed by a small pure helper), shows the destination slot in its header, and remembers the last-opened claim within the session.

**Tech Stack:** Next.js 16 (static export) + React 19, Zustand, shadcn/base-ui Dialog, lucide-react icons, Vitest (already configured; pure-module tests with mocked fetch — no component-render harness).

**Source spec:** `docs/superpowers/specs/2026-06-09-homogenize-sync-per-field-source-design.md`

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/sync-bridge/group-claims.ts` | Pure `filterAndGroupClaims(claims, query)` → insurer-grouped, filtered, sorted groups | Create |
| `src/lib/sync-bridge/__tests__/group-claims.test.ts` | Unit tests for the helper | Create |
| `src/components/sync-bridge/SyncDrivePicker.tsx` | Add `targetSlotLabel` prop, search box, insurer grouping, remember-last-claim; `onPick(file)` drops routing arg | Modify |
| `src/components/tabs/DocumentsTab.tsx` | Per-card ✈️ badge; remove global button + heuristic; scoped picker state | Modify |

---

## Task 1: Pure filter/group helper (TDD)

**Files:**
- Create: `src/lib/sync-bridge/group-claims.ts`
- Test: `src/lib/sync-bridge/__tests__/group-claims.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/sync-bridge/__tests__/group-claims.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { filterAndGroupClaims } from '../group-claims'
import type { SyncClaimSummary } from '../types'

const claim = (over: Partial<SyncClaimSummary>): SyncClaimSummary => ({
  claimId: 'c',
  label: 'MH12AB1234 - HDFC ERGO',
  vehicleNumber: 'MH12AB1234',
  insuranceCompany: 'HDFC ERGO',
  modelMake: 'Maruti Swift',
  status: 'open',
  totalDocs: 3,
  receivedDocs: 2,
  ...over,
})

describe('filterAndGroupClaims', () => {
  it('groups by insurer and sorts groups alphabetically', () => {
    const claims = [
      claim({ claimId: 'a', insuranceCompany: 'ICICI Lombard', vehicleNumber: 'MH01' }),
      claim({ claimId: 'b', insuranceCompany: 'HDFC ERGO', vehicleNumber: 'MH02' }),
      claim({ claimId: 'c', insuranceCompany: 'HDFC ERGO', vehicleNumber: 'MH03' }),
    ]
    const groups = filterAndGroupClaims(claims, '')
    expect(groups.map((g) => g.insurer)).toEqual(['HDFC ERGO', 'ICICI Lombard'])
    expect(groups[0].claims).toHaveLength(2)
    expect(groups[1].claims).toHaveLength(1)
  })

  it('filters case-insensitively by vehicle number', () => {
    const claims = [
      claim({ claimId: 'a', vehicleNumber: 'MH12AB1234' }),
      claim({ claimId: 'b', vehicleNumber: 'DL09CX9999', insuranceCompany: 'ICICI Lombard' }),
    ]
    const groups = filterAndGroupClaims(claims, 'dl09')
    expect(groups).toHaveLength(1)
    expect(groups[0].claims[0].claimId).toBe('b')
  })

  it('filters by insurer and by model/label too', () => {
    const claims = [
      claim({ claimId: 'a', modelMake: 'Tata Ace', insuranceCompany: 'HDFC ERGO' }),
      claim({ claimId: 'b', modelMake: 'Maruti Swift', insuranceCompany: 'ICICI Lombard' }),
    ]
    expect(filterAndGroupClaims(claims, 'icici')).toHaveLength(1)
    expect(filterAndGroupClaims(claims, 'tata')[0].claims[0].claimId).toBe('a')
  })

  it('drops empty groups and returns [] when nothing matches', () => {
    const claims = [claim({ claimId: 'a', vehicleNumber: 'MH12AB1234' })]
    expect(filterAndGroupClaims(claims, 'zzz')).toEqual([])
  })

  it('trims and ignores whitespace-only queries', () => {
    const claims = [claim({ claimId: 'a' }), claim({ claimId: 'b' })]
    expect(filterAndGroupClaims(claims, '   ')).toHaveLength(1) // one insurer group, both claims
    expect(filterAndGroupClaims(claims, '   ')[0].claims).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- group-claims`
Expected: FAIL with "Cannot find module '../group-claims'".

- [ ] **Step 3: Implement the helper**

Create `src/lib/sync-bridge/group-claims.ts`:
```ts
// ═══════════════════════════════════════════════════════════
// SYNC CLAIM SEARCH + GROUPING — pure, UI-agnostic.
// Filters claims by a free-text query and groups them by insurer.
// ═══════════════════════════════════════════════════════════

import type { SyncClaimSummary } from './types'

/** One insurer "folder" of claims. */
export interface ClaimGroup {
  insurer: string
  claims: SyncClaimSummary[]
}

/**
 * Filter `claims` by a case-insensitive substring match across vehicle number,
 * insurer, model/make and label, then group the survivors by insurer and sort
 * the groups alphabetically. Empty groups are dropped; a blank query matches all.
 */
export function filterAndGroupClaims(
  claims: readonly SyncClaimSummary[],
  query: string,
): ClaimGroup[] {
  const q = query.trim().toLowerCase()
  const matches = q
    ? claims.filter((c) =>
        [c.vehicleNumber, c.insuranceCompany, c.modelMake, c.label]
          .some((field) => field?.toLowerCase().includes(q)),
      )
    : [...claims]

  const byInsurer = new Map<string, SyncClaimSummary[]>()
  for (const c of matches) {
    const key = c.insuranceCompany || 'Other'
    const bucket = byInsurer.get(key) ?? []
    bucket.push(c)
    byInsurer.set(key, bucket)
  }

  return [...byInsurer.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([insurer, groupClaims]) => ({ insurer, claims: groupClaims }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- group-claims`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
git add src/lib/sync-bridge/group-claims.ts src/lib/sync-bridge/__tests__/group-claims.test.ts
git commit -m "feat(sync-bridge): add pure filter+group helper for the claim picker"
```

---

## Task 2: Upgrade SyncDrivePicker (slot-scoped, searchable, grouped)

**Files:**
- Modify: `src/components/sync-bridge/SyncDrivePicker.tsx` (full rewrite of the component file)

This task changes the picker's public interface, so it must land together with Task 3 (the only
caller) for the app to type-check. Commit at the end of Task 3 after `tsc` passes across both.

- [ ] **Step 1: Rewrite the picker**

Replace the entire contents of `src/components/sync-bridge/SyncDrivePicker.tsx` with:
```tsx
'use client';

// ═══════════════════════════════════════════════════════════
// SYNC DRIVE PICKER
// Slot-scoped picker: opened from one Documents-tab field's ✈️ badge.
// Claim list is searchable and grouped by insurer; picking a document
// streams its bytes as a File and hands it back via onPick(file).
// The destination slot is owned by the caller — this component never
// guesses where the file goes.
// ═══════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useProfileStore } from '@/stores/profile-store';
import { listSyncClaims, getSyncClaim, fetchSyncDocFile } from '@/lib/sync-bridge/client';
import { filterAndGroupClaims } from '@/lib/sync-bridge/group-claims';
import type { SyncClaimSummary, SyncClaimDetail } from '@/lib/sync-bridge/types';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, ChevronDown, ChevronRight, FileText, Car, Search } from 'lucide-react';

interface SyncDrivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Destination slot label shown in the header, e.g. "RC Book". */
  targetSlotLabel?: string;
  /** Returns the picked document as a File. The caller owns the destination slot. */
  onPick: (file: File) => void;
}

export function SyncDrivePicker({ open, onOpenChange, targetSlotLabel, onPick }: SyncDrivePickerProps) {
  const token = useProfileStore((s) => s.profile.syncBridgeToken) ?? '';
  const [claims, setClaims] = useState<SyncClaimSummary[]>([]);
  const [detail, setDetail] = useState<SyncClaimDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Remember the last-opened claim across re-opens within the session.
  const [lastClaimId, setLastClaimId] = useState<string | null>(null);

  // Load the claim list whenever the dialog opens. If we previously opened a
  // claim this session and it still exists, jump straight back into it.
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    listSyncClaims(token)
      .then((list) => {
        setClaims(list);
        if (lastClaimId && list.some((c) => c.claimId === lastClaimId)) {
          void openClaim(lastClaimId);
        } else {
          setDetail(null);
        }
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Could not load Sync claims.')
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, token]);

  const groups = useMemo(() => filterAndGroupClaims(claims, query), [claims, query]);
  const searching = query.trim().length > 0;

  const openClaim = async (claimId: string) => {
    setLoading(true);
    try {
      const d = await getSyncClaim(token, claimId);
      setDetail(d);
      setLastClaimId(claimId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  };

  const pickDoc = async (docId: string, docType: string) => {
    if (!detail) return;
    setDownloadingId(docId);
    try {
      const file = await fetchSyncDocFile(token, detail.claimId, docId, docType);
      onPick(file);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not download the document.');
    } finally {
      setDownloadingId(null);
    }
  };

  // A document name "looks like" the target slot — used only to soft-highlight, never to filter.
  const isSuggested = (docType: string): boolean => {
    if (!targetSlotLabel) return false;
    const a = docType.toLowerCase();
    const b = targetSlotLabel.toLowerCase();
    const first = b.split(' ')[0];
    return a.includes(b) || (first.length > 2 && a.includes(first));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {detail && (
              <button
                onClick={() => setDetail(null)}
                className="hover:opacity-70 transition-opacity"
                aria-label="Back to claims list"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {detail
              ? `${detail.vehicleNumber} – ${detail.insuranceCompany}`
              : 'SurveyOS Sync — pick a document'}
          </DialogTitle>
          <DialogDescription>
            {targetSlotLabel
              ? `Add to: ${targetSlotLabel}`
              : detail
                ? 'Tap a document to add it to this claim.'
                : 'Choose a vehicle/claim to see its collected documents.'}
          </DialogDescription>
        </DialogHeader>

        {/* Search box — claim-list view only */}
        {!detail && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vehicle no., insurer, model…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="animate-spin" size={20} />
          </div>
        )}

        {/* Claim list — grouped by insurer */}
        {!loading && !detail && (
          <div className="max-h-80 overflow-y-auto">
            {groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {searching ? 'No claims match your search.' : 'No claims found in SurveyOS Sync.'}
              </p>
            ) : (
              groups.map((group) => {
                const isCollapsed = !searching && collapsed[group.insurer];
                return (
                  <div key={group.insurer} className="mb-1">
                    <button
                      onClick={() => setCollapsed((c) => ({ ...c, [group.insurer]: !c[group.insurer] }))}
                      className="w-full flex items-center justify-between px-2 py-2 text-left hover:bg-muted/40 rounded-md"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                        {group.insurer}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{group.claims.length}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="divide-y">
                        {group.claims.map((c) => (
                          <button
                            key={c.claimId}
                            onClick={() => openClaim(c.claimId)}
                            className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/50 px-2 rounded-md transition-colors"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <Car size={15} className="shrink-0 text-muted-foreground" />
                              <span className="truncate text-sm font-medium">{c.label}</span>
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {c.receivedDocs} docs
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Document list for one claim */}
        {!loading && detail && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {detail.documents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No received documents in this claim.
              </p>
            ) : (
              detail.documents.map((d) => {
                const suggested = isSuggested(d.docType);
                return (
                  <button
                    key={d.docId}
                    onClick={() => pickDoc(d.docId, d.docType)}
                    disabled={downloadingId !== null}
                    className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/50 px-2 rounded-md transition-colors disabled:opacity-50"
                    style={suggested ? { background: 'rgba(212,175,55,0.10)' } : undefined}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText size={15} className="shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{d.docType}</span>
                      {suggested && (
                        <span className="shrink-0 text-[10px] font-bold text-[#D4AF37]">suggested</span>
                      )}
                    </span>
                    {downloadingId === d.docId ? (
                      <Loader2 size={14} className="animate-spin shrink-0" />
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {d.fileSizeKb} KB
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check (expect one error from the old caller — fixed in Task 3)**

Run: `npx tsc --noEmit`
Expected: the only error is in `DocumentsTab.tsx` — `onPick` now takes one argument but the old
caller passes two. That is fixed in Task 3. Do **not** commit yet.

---

## Task 3: Per-card ✈️ badge in DocumentsTab; remove global button + heuristic

**Files:**
- Modify: `src/components/tabs/DocumentsTab.tsx`

- [ ] **Step 1: Swap the picker state for a slot-scoped object**

In `DocumentsTab.tsx`, replace this line (around line 82):
```tsx
  const [syncPickerOpen, setSyncPickerOpen] = useState(false);
```
with:
```tsx
  const [syncPicker, setSyncPicker] = useState<{ key: string; label: string } | null>(null);
```

- [ ] **Step 2: Remove the global "Add from SurveyOS Sync" header button**

Delete this whole block from the header controls (around lines 200-209):
```tsx
              {syncConnected && (
                <button
                  onClick={() => setSyncPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
                >
                  <Plane size={12} />
                  Add from SurveyOS Sync
                </button>
              )}
```
(Leave `<ProviderToggle />` and the `DocModeToggle/ModelSelector/ProviderHealthBadge` row intact.)

- [ ] **Step 3: Add the per-card ✈️ badge**

In the doc-card `<label>` (the status pill area, around lines 367-393), the icon-and-status row is:
```tsx
                    {/* Icon + Status */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ background: isScanned ? `${doc.color}18` : doc.bg, color: doc.color }}
                      >
                        <Icon size={20} />
                      </div>

                      {isScanned ? (
```
Insert the badge as the first child of that flex row's right side — change the block so the
right-hand side is wrapped with the badge **before** the status pill. Replace the
`<div className="flex items-start justify-between mb-4">` block's closing of the icon div and the
`{isScanned ? (` line so it reads:
```tsx
                    {/* Icon + Status */}
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{ background: isScanned ? `${doc.color}18` : doc.bg, color: doc.color }}
                      >
                        <Icon size={20} />
                      </div>

                      <div className="flex items-center gap-2">
                        {syncConnected && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSyncPicker({ key: doc.id, label: doc.label });
                            }}
                            className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors hover:scale-110"
                            style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
                            title={`Pull ${doc.label} from SurveyOS Sync`}
                            aria-label={`Pull ${doc.label} from SurveyOS Sync`}
                          >
                            <Plane size={12} />
                          </button>
                        )}

                        {isScanned ? (
```
Then find the matching close of that ternary (the status pills block) which currently ends:
```tsx
                          <Upload size={11} />
                          Upload
                        </div>
                      )}
                    </div>
```
and add one extra closing `</div>` for the new wrapper so it becomes:
```tsx
                          <Upload size={11} />
                          Upload
                        </div>
                      )}
                      </div>
                    </div>
```

> The badge is a real `<button>` inside the card `<label>`. `preventDefault()` + `stopPropagation()`
> stop the click from also triggering the label's hidden local file input.

- [ ] **Step 4: Replace the picker render block (remove the heuristic)**

Replace the entire existing block at the bottom of the component (around lines 550-568):
```tsx
      {/* SurveyOS Sync document picker */}
      <SyncDrivePicker
        open={syncPickerOpen}
        onOpenChange={setSyncPickerOpen}
        onPick={(file, docType) => {
          const lower = docType.toLowerCase();
          const key = lower.includes('rc') || lower.includes('registration') ? 'rc'
            : lower.includes('licen') || lower.includes('driving') ? 'dl'
            : lower.includes('policy') ? 'policy'
            : lower.includes('bill') || lower.includes('invoice') ? 'final-bill'
            : lower.includes('fir') || lower.includes('police') ? 'fir'
            : lower.includes('photo') || lower.includes('damage') ? 'photos'
            : lower.includes('permit') ? 'permit'
            : lower.includes('fitness') ? 'fitness'
            : lower.includes('challan') ? 'load-challan'
            : 'claim';
          processFile(file, key);
        }}
      />
```
with:
```tsx
      {/* SurveyOS Sync document picker — slot-scoped (no filename guessing) */}
      <SyncDrivePicker
        open={!!syncPicker}
        onOpenChange={(o) => { if (!o) setSyncPicker(null); }}
        targetSlotLabel={syncPicker?.label}
        onPick={(file) => {
          if (syncPicker) processFile(file, syncPicker.key);
        }}
      />
```

- [ ] **Step 5: Type-check across Tasks 2 + 3**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). `Plane` is still imported and now used by the badge; `syncConnected`
is still defined at line ~83.

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`
Expected: PASS, including the new `group-claims` tests and the existing `client.test` /
`src/lib/ai/__tests__` tests.

- [ ] **Step 7: Build (static export must still succeed)**

Run: `npm run build`
Expected: Next.js build completes; `out/` produced with no type errors.

- [ ] **Step 8: Commit Tasks 2 + 3 together**

```bash
git add src/components/sync-bridge/SyncDrivePicker.tsx src/components/tabs/DocumentsTab.tsx
git commit -m "feat(sync-bridge): per-field Sync source with searchable, grouped claim picker"
```

---

## Task 4: Manual end-to-end verification

Requires: backend deployed, a connected Sync surveyor (`profile.syncBridgeToken` set) with at least
one claim containing a received document, and a Prime claim open.

- [ ] **Step 1: Badge visibility**

Run `npm run dev`. Open a claim → Documents tab.
Expected: with Sync connected, every document card shows a small ✈️ badge top-right; the old global
"Add from SurveyOS Sync" button is gone. Disconnect Sync (Profile → Disconnect) → badges disappear,
local upload still works by clicking a card.

- [ ] **Step 2: Routing regression (the core fix)**

Click the ✈️ badge on the **Driving Licence** card. In the picker, open any claim and pick a
deliberately mis-named document (e.g. one whose type does not contain "licence"/"dl").
Expected: the AI extraction overlay runs and the document lands in the **DL** field — never in
`claim`. The picker header reads "Add to: Driving Licence" throughout.

- [ ] **Step 3: Search + grouping**

Re-open any card's ✈️ badge. Confirm claims are grouped under insurer headers with counts, headers
collapse/expand, and typing a vehicle number / insurer / model in the search box filters live
(matching groups stay expanded; non-matches disappear).

- [ ] **Step 4: Remember last claim**

Pull a document from claim X via the RC card. Then click the DL card's ✈️ badge.
Expected: the picker re-opens directly inside claim X's document list (no need to re-select the
vehicle), with a working back-chevron to the claim list.

- [ ] **Step 5: Badge does not trigger local upload**

Click a card's ✈️ badge and immediately close the picker (Esc).
Expected: no OS file dialog opens — the badge click did not fall through to the card's hidden file
input.

---

## Self-review notes

- **Spec coverage:** per-field badge + remove global button + delete heuristic → Task 3 (Steps 2-4);
  `processFile(file, key)` reuse unchanged → Task 3 Step 4; search box + insurer grouping →
  Task 1 (pure helper) + Task 2 (UI); "Add to: <slot>" header + soft-highlight (never filter) →
  Task 2 Step 1; remember-last-claim → Task 2 Step 1; Sync-not-connected hides badge → Task 3 Step 3
  (`syncConnected` guard); badge-vs-card-click → Task 3 Step 3 (`preventDefault`/`stopPropagation`);
  download/CORS error stays in `pickDoc` toast → preserved in Task 2 Step 1; multi-file photos
  deferred → not implemented (documented non-goal).
- **Type consistency:** `filterAndGroupClaims(claims, query): ClaimGroup[]` defined in Task 1 and
  consumed in Task 2; `SyncDrivePickerProps.onPick(file: File)` (single arg) defined in Task 2 and
  called with one arg in Task 3; `syncPicker: { key; label } | null` set by the badge (Task 3 Step 3)
  and read by the picker render (Task 3 Step 4); `targetSlotLabel` passed in Task 3 matches the prop
  in Task 2.
- **Testing reality:** only the pure helper gets automated coverage (Task 1); routing is a no-op
  identity after the heuristic is deleted, so it is verified manually in Task 4 (the project has no
  component-render harness — see spec Testing section).
