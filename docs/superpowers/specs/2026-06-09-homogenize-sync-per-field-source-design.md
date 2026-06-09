# Homogenize SurveyOS Sync into a Per-Field Document Source — Design

**Date:** 2026-06-09
**Status:** Approved
**Area:** Prime V2 — Documents tab / Sync bridge

---

## Problem

Local upload and Sync pull behave differently, and the difference misroutes files.

- **Local upload (correct behavior):** every document slot — RC Book, Driving Licence,
  Policy Schedule, Damage Photos, etc. — is its own card with its own `<input type="file">`
  (`DocumentsTab.tsx:359-365`). The surveyor *chooses the destination field by clicking that
  card*. `handleFile(e, 'photos')` → `processFile(file, 'photos')`. The file lands in the
  right field every time because the human picked the field.

- **Sync pull (broken behavior):** a single global "Add from SurveyOS Sync" button. After a
  document is picked, the code *guesses* the destination field from a keyword heuristic on the
  document's name (`DocumentsTab.tsx:554-567`), falling back to the generic `claim` slot for
  anything unrecognized.

Because Sync's document types are **free-form and inconsistent**, the heuristic frequently
guesses wrong or dumps into `claim`. That is why "photos uploaded into their respective fields"
stops happening when the file comes from Sync.

## Goal

Make SurveyOS Sync a **peer source on every document field**, identical in outcome to local
upload: the destination slot is always the card the surveyor acted on. Eliminate guessing.

## Non-Goals

- Batch pulling a whole claim's documents at once (the chosen workflow is one-doc-into-one-field).
- Multi-file Damage Photos (one Sync "doc" containing multiple images) — deferred to a follow-up.
- Any change to Sync's collection side or the Cloudflare Worker bridge.
- Any change to the downstream pipeline (AI extraction, Evidence Viewer, Drive upload,
  reconciliation) — all reused unchanged.

---

## Core Principle

The destination field is always the card the surveyor acted on. `processFile(file, key)` is
called with that card's `key`. **The filename/docType keyword heuristic is deleted** — it is the
root cause. Sync's free-form document types no longer influence routing.

## Chosen Approach — Approach 1: Split card + ✈️ badge

Each document card keeps its current one-click local upload untouched (click anywhere on the card
= OS file dialog, zero extra clicks). When Sync is connected, the card also renders a small ✈️
badge in its top-right corner. Tapping *just* that badge (not the card body) opens the Sync picker
**scoped to that slot**.

Rejected alternatives:
- **Per-card source menu** (click card → choose "From computer" / "From Sync"): adds a click to
  every local upload — a regression on the common path.
- **Global button + slot selector** (keep one button, force a "which field?" dropdown): keeps a
  separate flow that does not mirror local upload — the very inconsistency being removed.

---

## Components

| Component | Change |
|---|---|
| `src/components/tabs/DocumentsTab.tsx` | Add a per-card ✈️ badge rendered only when `syncConnected`. Clicking it (with `stopPropagation` + `preventDefault`) opens the picker carrying that card's `key` and `label`. **Remove** the global "Add from SurveyOS Sync" header button. **Remove** the `onPick` keyword heuristic. |
| `src/components/sync-bridge/SyncDrivePicker.tsx` | Add a `targetSlotLabel?: string` prop, shown in the header so the surveyor sees the destination ("Add to: RC Book"). `onPick` signature drops the routing `docType` argument — the slot is already known by the caller. Add a live **search box** and **group claims by insurer** in the claim-list pane. Soft-highlight name matches for the active slot; never filter documents. Remember the last-opened claim within the session. |
| `src/lib/sync-bridge/group-claims.ts` | New pure helper: `filterAndGroupClaims(claims, query)` → returns insurer-grouped, filtered, sorted claim groups. Pure + unit-tested (keeps the filter/group logic out of the component). |

### DocumentsTab — picker state

Replace the boolean `syncPickerOpen` with a small object holding the active slot:

```ts
const [syncPicker, setSyncPicker] = useState<{ key: string; label: string } | null>(null);
```

The badge sets it; the picker reads `open={!!syncPicker}` and routes via the stored `key`.

### Per-card badge

Rendered inside the existing card `<label>`, top-right next to the Upload/Scanned pill, only when
`syncConnected`:

```tsx
{syncConnected && (
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSyncPicker({ key: doc.id, label: doc.label }); }}
    className="..."
    title={`Pull ${doc.label} from SurveyOS Sync`}
  >
    <Plane size={12} />
  </button>
)}
```

`preventDefault` + `stopPropagation` are required because the badge sits inside a `<label>` that
wraps the hidden local file input — without them, the click would also open the OS file dialog.

---

## Data Flow

```
Surveyor clicks ✈️ on the "RC Book" card
   → setSyncPicker({ key: 'rc', label: 'RC Book' })
   → picker opens: browse claims → open a claim → tap a document
   → fetchSyncDocFile(token, claimId, docId, docType) returns a File
   → onPick(file) → processFile(file, 'rc')        // slot known from syncPicker.key
   → storeBlobUrl + triggerExtraction + optional Drive upload   // unchanged
```

Downstream is identical to local upload. No heuristic anywhere in the path.

---

## Picker Ergonomics

- **Searchable, grouped claim list (required for usability).** The claim-list pane gets a live
  search box at the top that filters claims as the surveyor types, matching case-insensitively
  against `vehicleNumber`, `insuranceCompany`, `modelMake`, and `label`. Without this, a surveyor
  with many claims has to scroll an undifferentiated list — the friction that makes the feature
  feel broken. All filtering is client-side over the already-fetched `claims` array; no new
  network calls.
- **Grouped by insurance company.** Filtered claims are rendered under collapsible insurer headers
  (e.g. "HDFC ERGO (3)", "ICICI Lombard (1)"), so the list reads like organized folders rather
  than a flat dump. Groups are sorted alphabetically by insurer; each header shows its match count
  and toggles open/closed. While a search term is active, all matching groups are expanded so
  results are immediately visible; with no search term, groups default to expanded.
- **Search/grouping applies only to the claim-list view**, not the document-detail view.
- **Show all documents in the claim** — nothing hidden. Soft-highlight (not filter) documents
  whose name keyword-matches the active slot, as a hint only. Free-form types remain fully visible.
- **Remember the last-opened claim within the session.** Pulling RC, then DL, then Policy from the
  same vehicle skips re-selecting the claim each time, keeping field-by-field pulling fast.
- **Header shows the destination:** "Add to: RC Book" so the surveyor always sees where the file
  will land.

---

## Edge Cases & Error Handling

- **Sync not connected** → badge does not render; cards behave exactly as today.
- **Download / CORS failure** → existing toast error in `pickDoc`; the field stays empty (no
  half-state, no partial slot).
- **Damage Photos with multiple files in one Sync doc** → out of scope for v1 (one doc → one file
  → one field). Flagged as a follow-up.
- **Badge vs. card-body click** → badge uses `e.stopPropagation()` + `e.preventDefault()` so it
  never triggers the underlying local file input.

---

## Testing

- **Unit (filter/group):** `filterAndGroupClaims` returns claims grouped by insurer, sorted
  alphabetically, filtered case-insensitively across vehicle number / insurer / model / label, and
  drops empty groups. Covered with several cases. This is the only new logic worth automated
  coverage — routing is now a no-op identity (the card's `key` is passed straight through).
- **Routing regression (manual):** the project has no React render-test harness (vitest is used
  for pure modules with mocked fetch; no Testing Library / jsdom component tests). Verify manually
  that a deliberately mis-named document opened from the **DL** card lands in `dl`, not `claim`.
  Correctness is structurally guaranteed by deleting the heuristic — there is no longer any
  filename-based decision to get wrong.
- **No client changes:** existing `src/lib/sync-bridge/__tests__/client.test.ts` stays green.
- **Manual:** connect Sync → click ✈️ on the RC card → pull a deliberately mis-named document →
  confirm it extracts into the RC field (not `claim`). Repeat from the DL card with the picker
  remembering the previously opened claim.

---

## Follow-ups (not blockers)

1. Multi-file Damage Photos — let one Sync "doc" with `fileCount > 1` fan out into the photos slot.
2. A subtle "already pulled" indicator on documents previously added in this session.
3. Optional: a "Connect SurveyOS Sync" prompt on the badge when not yet connected.
