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
- A slow extraction offers an obvious way out rather than an open-ended wait.
- Progress is honest and bounded.
- Wait time is turned into verification priming rather than dead time.
- The surveyor is prompted to confirm what the AI read, at the moment the numbers exist.

## Non-goals

- **No server-side extraction.** Evaluated and rejected: BYOK keys are deliberately device-local (`src/lib/firebase/sync.ts:394-416` strips them before cloud sync), so server-side calls would either put surveyor API keys on our infrastructure or require the browser to stay in the loop anyway. It also introduces Cloud Function cost against a product that must stay practically free, and none of the required infrastructure (API route, job queue, status polling) exists today. The bug is client state ownership, not durability.
- **No *hard* blocking of tab navigation.** The surveyor is never trapped. A soft, dismissible nudge is in scope — see Soft tab-switch nudge.
- **No AI-generated commentary.** See Commentary below.
- **The surveyor is not asked to judge repudiation.** Tips say *record / note / confirm*, never *reject*. Indian courts have repeatedly held that insurers cannot repudiate on technicality alone without proving material breach; the surveyor's job is to document facts accurately, and the insurer decides consequences. Tip wording must not drift into adjudication.

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

### Long-running escalation

Cancel exists from the first second, but it is a small icon button — easy to miss when a surveyor is wondering whether to give up. Once a job passes its expected duration the overlay escalates it into an explicit choice.

**Threshold:** `max(60s, pagesTotal × 20s)`. A one-page RC that has run 60 seconds is stuck; a five-page estimate legitimately takes longer, and escalating at a flat 60s would cry wolf on every large document. `pagesTotal` is known once the first progress callback lands; before that the 60s floor applies.

**On crossing the threshold** the card changes state:

- Copy becomes *"This is taking longer than usual — page 3 of 5, 1m 40s elapsed."* Naming the actual page and elapsed time keeps it factual rather than alarming.
- A full-width **Cancel extraction** button appears beneath the progress text, replacing the icon-only affordance as the primary action.
- **Keep waiting** dismisses the escalation for that job; it does not fire again for the same job.

No auto-cancel, ever. A timeout that silently kills a nearly-finished extraction is worse than a slow one — the surveyor loses work they were about to receive, and they did not choose it. The decision stays theirs.

The escalation is presentation only: it reuses `cancelExtraction(key)` and adds no new cancel path.

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

## Soft tab-switch nudge

When the surveyor clicks another tab while a job is `processing`, navigation pauses on a small inline confirm anchored near the tab bar — not a centred modal, not a full-screen block.

### It must tell the truth

This is the design constraint that shapes everything else. Once the store lift lands, **switching tabs is safe** — the extraction continues and the result comes back. A nudge that implies otherwise would be manufacturing urgency the system no longer has, and surveyors would learn within a day that it lies.

So the copy states the real situation:

> **Still reading RC — page 2 of 4, about 20s left.**
> You can switch tabs; the result will come back to you.
> **[ Stay here ]  [ Switch anyway ]**
> ☐ Don't remind me again

`Switch anyway` navigates immediately. `Stay here` dismisses and keeps them where they are. Neither cancels the extraction — leaving and cancelling are different intentions and must never be collapsed into one control.

The value is not protection, which is no longer needed. It is (a) making the invisible work visible at the exact moment the surveyor is about to walk away from it, which is the original complaint, and (b) offering a beat to reconsider when the remaining wait is trivially short — task-switching has a real cost, and "20s left" is often enough to make staying the obvious choice.

### Volume

A surveyor processes many claims a day; an unconditional interruption becomes a nag by the second one. The "Don't remind me again" checkbox persists to `profile.warnOnTabSwitchDuringExtraction` (default `true`, stored in the existing `profile-store`, so it follows the existing persistence behaviour). Once off, tab switching is silent and the persistent shell badge remains the only indicator — which is sufficient, because by then the surveyor has learned the system.

The nudge never fires when no job is processing.

### Remaining-time estimate

"About 20s left" is derived from elapsed time per completed page × pages remaining. It is a rough figure and must be rendered as such ("about", rounded to 5s). If fewer than one page has completed there is no basis for an estimate, and the line is omitted rather than guessed — a wrong countdown is worse than none.

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

### Two unifying principles

Every tip below derives from one of two things the surveyor can do that the AI structurally cannot.

**1. Validity is judged on the accident date, not today.** For a commercial vehicle the fitness certificate, permit, driving licence, registration and policy must all be valid *simultaneously on the date of loss*; a lapse in any one is a documented repudiation ground ([NCDRC, via LiveLaw](https://www.livelaw.in/consumer-cases/ncdrc-fitness-certificate-vehicle-insurance-claim-repudiation-260300)). The AI reads a date off a page. Only the surveyor holds the accident date in mind while reading it. Note that `DriverForm.tsx` currently highlights DL expiry against *today* (`ntExpired` / `tExpired`), which is the wrong reference date for a claim — worth revisiting separately.

**2. The surveyor is standing at the vehicle; the AI is reading paper.** Chassis and engine numbers, damage patterns, and pre-existing wear can only be reconciled against physical metal by the person present.

Tips say **record / note / confirm** — never *reject*. See Non-goals.

### Where the tips come from

Three grounded sources, not invention:

- **`FIELD_MAPPINGS` in `reconciliation.ts:27-77`** — any field listed under two or more `aiKeys` is a field the app already knows can disagree across documents. Those overlaps are the highest-value cross-checks, and several encode real claim consequences (e.g. `Insured Name` maps to both `policy.insured_name` *and* `rc.owner_name` — a genuine mismatch there means ownership transferred without the policy following, which is material).
- **Documented AI traps in `prompts.ts`** — every "CRITICAL", "IMPORTANT" and "do NOT" in a prompt marks a failure the model is known to make. Those are exactly what a human should re-check.
- **Case law**, for the validity-date principle above.

### Initial tip set

```ts
// src/lib/ai/verification-tips.ts

rc: [
  'Match chassis and engine numbers against the vehicle itself, not just the RC.',
  'Check the RC owner name against the policy insured name — if they differ, ownership may have transferred without the policy.',
  'Note the date of registration; it drives the depreciation slab.',
  'Year of manufacture and year of registration are often different — record both.',
  'Look for a hypothecation / financier entry; it affects who is paid.',
  'Confirm the class of vehicle matches how it was actually being used.',
]
// Grounding: chassis/engine/reg-number all appear in 4-5 documents in FIELD_MAPPINGS —
// the most cross-referenced fields in the app. owner_name→policy.insuredName is the
// mapping that surfaces the ownership-transfer case.

dl: [
  'Check both validity dates against the accident date, not today.',
  'Transport and non-transport validity expire separately — a licence can be valid for one and not the other.',
  'Confirm the licence class actually covers this vehicle category.',
  'Check the badge number yourself; it is often faint or rubbed out on older licences.',
  'Compare the DL holder name with the driver named in the FIR and the claim form.',
  'If this vehicle carries hazardous goods, confirm the endorsement is present and current.',
]
// Grounding: prompts.ts:85-86 extracts NT and TR validity separately and warns they differ.
// Driver Name maps across dl/claim/fir in FIELD_MAPPINGS — a mismatch means someone else drove.
// Badge tip retained because badge_no was silently dropped until the 2026-08-11 mapping fix.

policy: [
  'Confirm the policy period covers the accident date AND time — same-day expiry turns on the hour.',
  'Check you have the CURRENT policy period, not the previous policy’s expiry date sitting next to it.',
  'Note the policy type — a liability-only policy carries no own-damage cover at all.',
  'Check IDV against the vehicle’s age; it caps a total-loss settlement.',
  'Record compulsory and voluntary excess, and whether zero-depreciation applies.',
  'Note the financer / HPA entry if present.',
]
// Grounding: prompts.ts:96-98 documents the "Prev Policy" trap explicitly — the model is
// warned about it, which means it is a known failure. The 00.00 Hrs / Midnight parsing at
// :97 is why the time of a same-day expiry matters, and why time-of-survey was added.

claim: [
  'Cross-check the accident date and time against the FIR.',
  'Confirm the insured name matches the policy and the RC.',
  'Check the driver named here against the DL holder.',
  'Note any third-party involvement; it opens a separate liability head.',
]

fir: [
  'Compare the FIR date with the accident date — a long gap is worth recording.',
  'Check the driver named in the FIR against the DL holder.',
  'Compare the stated cause with the damage you can actually see.',
  'Confirm the place of accident matches the claim form.',
]
// Grounding: accident date/place/cause and driver name all map across claim+fir in
// FIELD_MAPPINGS — these are the app's designed conflict surfaces.

fitness: [
  'The fitness certificate must be valid ON the accident date, not merely present.',
  'Form 38 states expiry in prose and may carry several renewal rows — use the latest.',
  'Check GVW and seating capacity against the RC.',
]
// Grounding: prompts.ts:258-264 devotes a whole block to Form 38 prose dates and renewal
// rows, and warns against reading the signature timestamp as validity. High error rate.

permit: [
  'Check permit validity against the accident date.',
  'Confirm the vehicle was on a route the permit covers.',
  'Match the goods category against what was actually being carried.',
  'Compare GVW here with the RC and the fitness certificate.',
]

auth: [
  'Confirm the authorisation matches the vehicle class and the permit.',
  'Check validity against the accident date.',
]

'load-challan': [
  'Match the goods described against the permit category — and against any hazardous endorsement.',
  'Compare the load weight with the registered laden weight; overloading is material.',
  'Check the challan date against the accident date.',
]

estimate: [
  'Count the line items on the last page and compare with what was read — items on later pages are the usual miss.',
  'Confirm the gross total against the figure printed on the bill.',
  'Check the GST rate is the TOTAL (CGST + SGST), not one half of it.',
  'Watch for "Total c/f" or "b/f" carry-forward rows being counted as items.',
  'Check each part is classified metal / plastic / glass correctly — depreciation differs by material.',
  'Confirm parts, labour and painting are split correctly; only parts depreciate.',
  'Note any part already replaced under a prior claim.',
]
// Grounding: prompts.ts:124 ("50-80+ items across 3-5 pages, do NOT stop at page 1"),
// :135 (GST component vs total — "never write just one component's rate"),
// :151 (carry-forward rows), :137-140 (material category), :150 (duplicate splitting).
// Every one of these is a failure the prompt itself is written to defend against,
// which makes it exactly what a human should re-check.

'final-bill': [
  'Compare the bill line-by-line against the approved estimate.',
  'Query any part on the bill that was not on the estimate.',
  'Confirm the item count and gross total against the last page.',
  'Check the GST rate is the total, not one component.',
]
```

Document keys come from `DOC_GROUPS` (`DocumentsTab.tsx:31-66`) plus `estimate` (`AssessmentTab.tsx:46`). A key with no entry shows progress text only — no filler.

### Review-time numeric confirmation (estimate and final-bill)

Static tips run *during* the wait, when no numbers exist yet. The higher-value moment is *after*: at review, the app knows exactly what it read, and can ask the surveyor to confirm those specific figures against the paper.

For `estimate` and `final-bill`, the review dialog gains a confirmation block above the field list:

```
Read from this document:
  Spare parts     28 items    ₹  84,200 taxable
  Labour          14 items    ₹  19,500 taxable
  Painting         5 items    ₹  12,300 taxable
  ─────────────────────────────────────────────
  Gross total                 ₹ 1,36,466

  Confirm these against the last page of the bill.
  [ Totals match ]   [ Something is off — rescan ]
```

This exists because the known failure mode is **silent under-reading**: the model stops early on a multi-page bill and returns a smaller, internally-consistent set of items. Nothing looks wrong — the arithmetic adds up, just over fewer items. The only reliable detector is a human comparing the printed grand total and item count against what was read.

The app already has adjacent machinery: `extractDocument` returns `discrepancies`, and Smart Fix (`useAIExtraction.ts:64-113`) rescans summary pages when the internal arithmetic disagrees. This block covers the case Smart Fix cannot — where the arithmetic is *consistent* but *incomplete*. "Something is off" routes into the existing targeted-rescan path rather than adding a new one.

Shown only for the two line-item document types. Every other document goes straight to the normal field review.

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
6. Long-running escalation (presentation over step 4's cancel path).
7. Commentary map + rotation + 3s threshold.
8. Completion toast + `originTab` handoff.
9. Soft tab-switch nudge + `profile.warnOnTabSwitchDuringExtraction`.
10. Review-time numeric confirmation for `estimate` / `final-bill`.

Steps 1–2 alone fix the reported bug. Everything after is the experience around it, and each step is independently shippable.

Steps 9 and 10 depend on earlier ones and should not be pulled forward: the nudge's copy claims switching is safe, which is only true once 1–2 have landed, and the confirmation block reuses the rescan path touched in step 4.
