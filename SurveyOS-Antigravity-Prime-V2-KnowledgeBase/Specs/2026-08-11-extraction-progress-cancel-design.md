# AI Extraction — Progress, Cancel & Verification Commentary — Design

**Date:** 2026-08-11
**Status:** Approved for planning
**Source:** Surveyor complaint #2 (see `2026-08-11-surveyor-feedback-audit.md`)
**Depends on:** `2026-08-11-brand-mark-rollout-design.md` (the progress animation is built from the new mark)

---

## Problem

Three defects, one root cause plus two that surface alongside it.

### 1. Switching tabs appears to kill the extraction

`src/components/layout/Dashboard.tsx:660` renders `<ErrorBoundary key={activeTab}>`. Changing tabs changes the `key`, which forces React to unmount and remount the whole subtree — including whichever component called `useAIExtraction()`.

That hook owns its state as component-local `useState` (`src/hooks/useAIExtraction.ts:29-32`). On unmount the state is destroyed.

The network request is **not** cancelled — there is no `AbortController` anywhere in the extraction path. The fetch in `src/lib/ai/service.ts` keeps running and the provider still bills the call. But when it resolves, its `setState` calls target a component instance that no longer exists and are silently dropped. The spinner is gone, the review dialog never appears, and the extracted data never lands.

To the surveyor this is indistinguishable from the analysis being killed. Worse, it is **silent** — there is no warning that leaving the tab will cost them the result.

### 2. The Cancel button does nothing during extraction

`ProcessingProgressOverlay` renders a Cancel button (`src/components/ui/ProcessingProgressOverlay.tsx:111-137`) wired to `cancelReview` (`DocumentsTab.tsx:552`). `cancelReview` only does `setReviewData(null)` (`useAIExtraction.ts:177-179`) — it clears the *post*-extraction review dialog.

While extraction is running, `reviewData` is already `null`. The button is dead in exactly the window a surveyor would reach for it.

### 3. The progress bar is decorative and misleading

`ProcessingProgressOverlay.tsx:183` animates `width: 10% → 70% → 10%` on a 2s infinite loop, unrelated to actual progress. Meanwhile `processor.ts` already emits real per-page progress through an `onProgress` callback that only feeds a text line. The app knows the truth and displays a fiction.

## Goals

- Tab switching never costs the surveyor their extraction.
- Cancel actually cancels, and stops burning BYOK free-tier quota.
- Progress is honest and bounded.
- Wait time is turned into verification priming rather than dead time.

## Non-goals

- **No server-side extraction.** Evaluated and rejected: BYOK keys are deliberately device-local (`src/lib/firebase/sync.ts:394-416` strips them before cloud sync), so server-side calls would either put surveyor API keys on our infrastructure or require the browser to stay in the loop anyway. It also introduces Cloud Function cost against a product that must stay practically free, and none of the required infrastructure (API route, job queue, status polling) exists today. The bug is client state ownership, not durability.
- **No blocking of tab navigation.** The surveyor keeps full freedom to move.
- **No AI-generated commentary.** See Commentary below.

---

## Architecture

### Extraction store

New file: `src/stores/extraction-store.ts`. A Zustand store (the app already uses Zustand for `claim-store`, `profile-store`, `ui-store`), living outside React's tree and therefore surviving the `key={activeTab}` remount.

```ts
type JobStatus = 'processing' | 'done' | 'error' | 'cancelled';

interface ExtractionJob {
  status:     JobStatus;
  progress:   string;   // human message from processor callback
  pagesDone:  number;
  pagesTotal: number;
  result:     { key: string; data: any; file: File } | null;
  error:      string | null;
  startedAt:  number;
  originTab:  string;   // which tab started it, for the completion toast
}

interface ExtractionState {
  jobs: Record<string, ExtractionJob>;   // keyed by docKey ('rc', 'dl', 'estimate', …)
  startJob(key: string, originTab: string): void;
  setProgress(key: string, msg: string, done?: number, total?: number): void;
  finishJob(key: string, result: ExtractionJob['result']): void;
  failJob(key: string, error: string): void;
  cancelJob(key: string): void;
  clearJob(key: string): void;   // after review applied or dismissed
}
```

**Keyed by document, not global.** Today each tab has its own hook instance, so a Documents extraction and an Assessment extraction are independent by accident. A single global `isProcessing` boolean would regress that; `Record<docKey, Job>` preserves it deliberately.

**`AbortController`s live in a module-level `Map<string, AbortController>`, not in the store.** They are not render-relevant and not serialisable; keeping them out of state avoids putting non-serialisable objects in a store others may later try to persist.

**The store is in-memory and must NOT be wrapped in `persist()`.** `File` objects cannot be serialised, and a page reload kills the fetch regardless. This is a deliberate boundary: **tab switching is fixed; a page refresh is not.** Stating it here so it is a known limit rather than a later surprise.

### `useAIExtraction` becomes a thin wrapper

`src/hooks/useAIExtraction.ts` keeps its exported surface (`isProcessing`, `progress`, `reviewData`, `triggerExtraction`, `confirmApply`, `cancelReview`, `reScanWithFeedback`, `reScanLatest`, `triggerTargetedRescan`, `hasFile`) so the four consuming tabs need no changes. Internally, `useState` is replaced by store reads and writes. It gains one new export, `cancelExtraction(key)` — see Cancel semantics.

Two derived values need explicit resolution rules, because the store is keyed by document while the hook's existing API is singular:

- **`isProcessing`** → true if *any* job is `processing`. Tabs use it only to show/hide their own spinner, and the overlay is moving to the shell anyway.
- **`reviewData`** → the most recently finished job (`status: 'done'`, highest `startedAt`) that still has a non-null `result`. A tab owning several document keys (`DocumentsTab` owns `rc`, `dl`, `policy`, …) therefore surfaces one review dialog at a time, in completion order, which matches today's single-dialog behaviour. `confirmApply` / `cancelReview` call `clearJob(key)` on that job, letting the next finished one surface.

`lastFiles` (`Record<string, File>`) moves into the module-level map alongside the controllers, for the same reason — the existing `sessionStorage` filename fallback (`useAIExtraction.ts:8, 50-61`) is retained unchanged so the "please re-upload after refresh" message still works.

### Threading the abort signal

`AbortController` per job, threaded down:

```
triggerExtraction(key, files)
  └─ extractDocument(..., signal)          src/lib/ai/processor.ts:477-727
       ├─ page loop: check signal.aborted between pages   (:551-705)
       └─ callAIGateway(..., signal)        src/lib/ai/service.ts:388-519
            └─ fetch(url, { ..., signal })  (:405, :501; NVIDIA proxy :490)
```

Aborting mid-document stops both the in-flight request and the remaining page iterations — otherwise a 4-page document would keep issuing calls for pages 3 and 4 after cancel.

### Real progress

`onProgress` is widened from `(msg: string)` to `(msg: string, done?: number, total?: number)`. Backwards compatible — existing single-argument call sites keep working. The multi-page loop in `processor.ts` already knows both numbers and simply passes them.

---

## Cancel semantics

**Cancel discards everything.** Fields extracted from pages 1–2 of a 4-page document are thrown away; nothing enters the claim.

Rationale: partial data is the automation-bias trap. A surveyor who cancelled because they were in a hurry is precisely the surveyor least likely to register that half the document was never read — and their signature carries IRDAI liability. Salvaging a half-read extraction optimises for the wasted API call at the cost of the thing that actually matters. They re-upload if they want another attempt.

Cancel therefore: aborts the controller → `cancelJob(key)` → job removed from store → overlay disappears. No toast (the surveyor knows what they did; a confirmation toast for a deliberate action is noise).

**The overlay's Cancel button must be rewired.** It currently calls `cancelReview` (`DocumentsTab.tsx:552`), which is why it is dead during processing. It must instead call the new `cancelExtraction(key)`. `cancelReview` keeps its existing, separate job: dismissing the post-extraction review dialog. Conflating the two is the original bug and must not be reintroduced.

An `AbortError` must be distinguished from a genuine failure in the `catch` in `triggerExtraction` (`useAIExtraction.ts:160-162`): aborts are silent, real failures toast as they do today.

---

## Progress UI

### Placement

`ProcessingProgressOverlay` moves out of the individual tabs and into the Dashboard shell as a **sibling of** `<ErrorBoundary key={activeTab}>` (`Dashboard.tsx:660`), so it is outside the remount boundary and survives navigation. It reads all jobs from the store; if two documents are extracting at once it stacks or shows a combined count rather than rendering two overlapping cards.

The per-tab `<ProcessingProgressOverlay>` instances (`DocumentsTab.tsx:549`, and the equivalents in `AssessmentTab` / `BillCheckTab`) are removed.

### The mark as the progress indicator

The new brand mark is a bracketed form field with a ruled baseline — its own design note describes it as "the boxed field on a survey form, where a value is written and then signed for." That is a literal description of document extraction, so the mark doubles as the progress object with no new visual vocabulary.

- Brackets and monogram render in ink (`currentColor`).
- The field rule (`rect x=21.5 y=45.4 w=21 h=3.1`) fills left-to-right as a **determinate** bar driven by `pagesDone / pagesTotal`.
- The fill is oxide — `#B03C26` on light ground, `#E2705A` on dark, per the two-step rule in the brand spec.
- On completion the rule sits full and oxide: the brand's own "filled in black, ruled and attested in red."

This replaces the looping fake bar at `ProcessingProgressOverlay.tsx:183` and its `@keyframes progress` block.

A 20px version of the same mark, with the same partial fill, sits persistently in the app shell as the "still working" badge when the surveyor has navigated away. The mark was drawn to hold at 16px, so this is within its designed range.

The elapsed-time counter (`ProcessingProgressOverlay.tsx:21-52`) is retained — it is honest and it bounds the wait.

### Completion handoff

The review payload lives in the store, so the tab that owns a given `docKey` renders its review dialog whenever it is mounted — no dialog hoisting required.

- **Surveyor still on the originating tab:** dialog opens as today.
- **Surveyor moved on:** a toast — *"RC ready to review →"* — whose action sets `activeTab` back to `originTab`. On arrival, that tab mounts, reads `result` from the store, and opens the dialog.

No modal is ever thrown in front of someone typing on a different tab.

---

## Verification commentary

A static map, `src/lib/ai/verification-tips.ts`:

```ts
export const VERIFICATION_TIPS: Record<string, string[]> = { … };
```

Rotating one tip every ~4s, shown **only once extraction passes 3 seconds** — below that it is a flash of noise on a fast scan.

### Why static, not AI-generated

Zero latency, zero token cost, and — critically — it cannot hallucinate professional advice. Wrong guidance to a surveyor carrying statutory liability is a worse outcome than no guidance. These are hand-written from the field definitions, validation rules, and reconciliation logic already in the codebase, and are expected to be corrected over time by practising surveyors.

### Framing: surveyor-verifies, never AI-is-clever

The obvious version of this feature narrates the AI's cleverness. That is wrong here on two counts: it centres the AI in a product whose purpose is removing admin, and it worsens **automation bias** — the documented tendency to under-verify automated output. In a product where the surveyor's signature carries IRDAI liability and the assessment must be surveyor-made, commentary that impresses the surveyor with the model's competence is actively harmful.

Inverted, the same screen-time occupies the wait, demonstrates the work (the labor-illusion effect, Buell & Norton), bounds the uncertainty, primes verification, and teaches junior surveyors what an experienced eye looks for.

### Initial tip set

```
rc:           Verify engine and chassis numbers against the vehicle, not just the RC.
              Registration date drives the depreciation slab — check it.
              Look for a hypothecation / financier endorsement.

dl:           Check the badge number yourself; it is often faint on older licences.
              Transport and non-transport validity expire separately.
              Confirm the licence class actually covers this vehicle category.
              If this vehicle carries hazardous goods, confirm the endorsement is present and current.

policy:       Confirm the policy period covers the accident date and time.
              Check IDV against the vehicle's age.
              Note any endorsements or exclusions on the schedule.

claim:        Cross-check the intimation date against the accident date.
              Confirm the insured's name matches the policy and the RC.

fir:          Compare the FIR accident date and time with the claim intimation.
              Check the driver named in the FIR against the DL holder.

permit:       Confirm the permit covers the route and the goods actually carried.
              Check the permit validity against the accident date.

fitness:      Fitness certificate must be valid on the accident date, not merely present.

auth:         Confirm the authorisation matches the vehicle class and the permit.

load-challan: Match the goods described against the permit and any hazardous endorsement.
              Check the load weight against the registered laden weight.

estimate:     Parts and labour attract different GST treatment — check the split.
              Watch for parts already replaced under a prior claim.
              Painting units should reconcile against the panels claimed.

final-bill:   Compare the final bill line-by-line against the approved estimate.
              Query any part that appears on the bill but not the estimate.
```

Document keys are taken from `DOC_GROUPS` in `DocumentsTab.tsx:31-66`, plus `estimate` (`AssessmentTab.tsx:46`). A key with no entry shows no commentary — progress text only.

---

## Error handling

- **Abort** → silent. Job removed. No toast.
- **Genuine failure** → `failJob(key, message)`, toast as today (`useAIExtraction.ts:161`).
- **Unmounted originator** → the promise still writes its terminal state to the store, so no job is ever left stuck in `processing`.
- **Quota exhaustion** → unchanged. `isQuotaExhausted` (`service.ts:526-533`) and the `aiProviderHealth` pill continue to behave as they do today. Surfacing remaining calls is out of scope here (audit issue #8, deliberately parked).

---

## Testing

One Vitest file, `src/stores/__tests__/extraction-store.test.ts` (project already runs `vitest run`; precedent at `src/lib/firebase/__tests__/session.test.ts`). The store reducer is the logic worth testing; the rest is UI.

Assertions:

1. `startJob` → `setProgress` → `finishJob` leaves `status: 'done'` with the result intact.
2. `startJob` → `setProgress` → `cancelJob` leaves **no residual data** for that key — the core guarantee of the discard-everything decision.
3. Two concurrent jobs on different keys do not clobber each other; cancelling one leaves the other untouched.
4. `failJob` sets `status: 'error'` and preserves the message.

## Verification limits

The Documents, Photos, and Assessment tabs are auth-gated and need a real logged-in claim with real documents and a live BYOK key. Runtime behaviour **cannot be verified in this environment** — no preview server is to be started for it. `npx tsc --noEmit` and `vitest run` are compile and unit checks only, and must not be reported as evidence that the feature works. Functional confirmation is the user's, in their own session.

## Implementation order

1. Extraction store + tests (no UI change; nothing breaks yet).
2. Rewire `useAIExtraction` onto the store, same exported surface.
3. Move `ProcessingProgressOverlay` into the Dashboard shell; delete per-tab instances.
4. Thread `AbortSignal`; make Cancel real.
5. Widen `onProgress`; wire the determinate mark fill.
6. Commentary map + rotation + 3s threshold.
7. Completion toast + `originTab` handoff.

Steps 1–2 alone fix the reported bug. Everything after is the experience around it, and each step is independently shippable.
