# Surveyor Feedback Audit — 2026-08-11

Source: 8 complaints/improvement requests from practising surveyors. This is investigation only — no code changed. Findings are grouped by category with root cause, evidence (file:line), and fix scope, so we can sequence solutions next.

---

## Category A — Upload / Drive-sync consent (Issues #1, #2b)

**Complaint:** Every image/PDF upload should ask "save to cloud?" before syncing to Drive. Same for files uploaded for AI review — ask first, sync only on yes.

**Root cause:** No confirmation gate exists anywhere. Every upload path checks only a *global* silent toggle (`profile.autoUploadDrive !== false`, default **ON**) and fires the Drive upload automatically in the same handler that triggers AI extraction — the two are fired back-to-back, uncoupled from any user decision.

**Evidence:**
- `src/components/tabs/DocumentsTab.tsx:136-169` — `processFiles()`: extraction at 146, auto-upload at 148-167 if toggle on.
- `src/components/tabs/PhotosTab.tsx:85-114` — `handleFileUpload()`: auto-upload at 103-105.
- `src/components/tabs/AssessmentTab.tsx:29-54` — `handleEstimateUpload()`: extraction at 46, auto-upload at 48-52.
- Global toggle: `src/components/tabs/ProfileTab.tsx:797-803`.
- Core upload fn: `src/lib/drive/index.ts:341` (`uploadFileToDrive`), wrapped by `src/lib/drive/upload-with-check.ts:58-109` (only prompts on filename collision, not on every upload).
- `AIReviewDialog` (`src/components/dialogs/AIReviewDialog.tsx`) has no "save to Drive" option — AI review and Drive sync are fully independent today.

**Fix scope:** Insert a confirm step before the 3 `uploadFileToDrive`/`uploadWithDuplicateCheck` call sites (or once, centrally, inside `uploadFileToDrive` itself) so it fires for every upload regardless of caller. For the AI-review path specifically, add a "Save to Drive?" choice into `AIReviewDialog`'s confirm flow rather than firing upload independently in the tab handler. Single shared confirm dialog component, reused everywhere — small diff.

---

## Category B — AI analysis breaks on tab switch (Issue #2a)

**Complaint:** Switching tabs while a document is being AI-analyzed disrupts the analysis. Want either: a "don't switch tabs" lock, a background-safe process, an animation, or a way to keep working while it processes.

**Root cause (confirmed, not a network-cancellation bug):** `src/components/layout/Dashboard.tsx:660` keys the active tab's subtree with `<ErrorBoundary key={activeTab}>`. Switching tabs changes `activeTab`, which forces React to **fully unmount and remount** whatever component called `useAIExtraction()` (`src/hooks/useAIExtraction.ts`). That hook's state (`isProcessing`, `progress`, `reviewData`) is plain local `useState` — it has no external store. The underlying `fetch()` calls in `src/lib/ai/service.ts` (no `AbortController`, confirmed via repo grep) actually **keep running in the background** — but when they resolve, their `setState` calls land on the orphaned, unmounted hook instance and are silently dropped. The progress overlay and the "review extracted data" step never appear. To the surveyor this looks identical to the analysis being killed, but the API call itself isn't cancelled — the UI just loses track of it.

**Evidence:**
- Trigger chain: tab component → `useAIExtraction.ts:121-166` (`triggerExtraction`) → `src/lib/ai/processor.ts:477-727` (`extractDocument`, client-side base64 conversion + sequential page loop) → `src/lib/ai/service.ts:388-519` (`callAIGateway`, plain browser `fetch`).
- No server-side route, job, or queue exists anywhere in the repo — this is 100% client-side, in one component's lifetime.
- Existing progress UI: `src/components/ui/ProcessingProgressOverlay.tsx` (spinner + timer + Cancel button) — rendered per-tab, so it also unmounts on tab switch.
- In-memory-only throttle: `src/lib/ai/processor.ts:260-288` (`AITaskQueue`) — serializes calls within one browser session, not durable/resumable.

**Fix options (for solution phase, not decided yet):**
1. **Cheapest:** lift extraction state (isProcessing/progress/reviewData) out of the per-tab hook into a Zustand store (the app already uses Zustand elsewhere) that lives above the `key={activeTab}` remount boundary. Tab switches then no longer kill the in-flight promise's ability to update UI — this alone fixes the actual complaint without touching the network layer.
2. Add a lightweight "AI is analyzing…" indicator in the persistent app shell (outside the remounted subtree) so a surveyor can see it's still working even after switching tabs, then click back to review results.
3. Optionally block tab switching only while `isProcessing` is true (blunter, worse UX, not recommended given a proper state fix is available).

---

## Category C — API keys stored, but not portable (Issue #3)

**Complaint:** Keys must be stored so surveyors don't have to re-enter them every time.

**Finding: this is largely already implemented, not missing.** `src/stores/profile-store.ts:6-7,122-123` persists the whole profile — including `geminiApiKeys`/`groqApiKeys`/`nvidiaApiKeys` — to `localStorage` via Zustand `persist()`. The UI already tells the user this (`ProfileTab.tsx:910-912`: "saved locally on this device"). Keys are entered at `ProfileTab.tsx:672-753` (masked input, up to 3 keys per provider for rotation).

**Real gap:** Keys are deliberately **excluded from Firestore cloud sync** (`src/lib/firebase/sync.ts:394-416` strips them before upload; `:424-439` re-injects the local device's own keys after pulling). So keys persist fine on the *same device/browser*, but do **not** follow the surveyor to a new device, browser, or after clearing site data — which is almost certainly what's actually being reported as "have to upload every time."

**Secondary gap:** keys are stored in `localStorage` in plaintext — no at-rest encryption.

**Fix scope (needs a product decision):** either (a) explain/reduce friction on the same-device case if that's actually the complaint, or (b) if surveyors genuinely switch devices, add an encrypted keys backup synced via their own Drive (there's a stale code comment in `sync.ts` referencing a "Drive backup" for keys that doesn't actually exist yet) — bigger scope, needs confirmation before building.

---

## Category D — Report field defects (Issues #4, #5, #6, #7)

### D1 — "Date of Issue" missing from Driving Licence section in final report
Data model, AI extraction, and the driver form all already carry `dateOfIssue` correctly end-to-end:
- `src/types/vehicle.ts:74` (`DriverDetails.dateOfIssue`)
- `src/lib/ai/prompts.ts:84` (extraction prompt)
- `src/stores/slices/aiDataSlice.ts:415` (mapped into store)
- `src/components/claim/DriverForm.tsx:107-114` (editable in UI)
- UIIC final report **does** render it (`src/lib/reports/uiic-final-builder.ts:249`).

**Bug is template-only:** `src/lib/reports/standard-report-builder.ts:382-404` ("3. DRIVER'S PARTICULARS" table) renders DOB, Licence Class/Badge, NT/T validity — but has no Date of Issue row. **Fix: add one row in `standard-report-builder.ts` around line 393-399.** Smallest possible diff — data's already there.

### D2 — Badge number defaulting to "12345"
No literal `"12345"` exists anywhere in the codebase (checked prompts, aiDataSlice, both report builders, DriverForm, mock data). Report/form fall back to `'—'`/`''` when empty, not a fake number.

**Actual bug found instead:** `src/lib/ai/prompts.ts:90` extracts `badge_no`, and `src/lib/ai/reconciliation.ts:66` references it — but **`applyDL()` in `src/stores/slices/aiDataSlice.ts:405-423` never maps `data.badge_no` into `claim.driver.badgeNumber`** at all (every sibling field like `dateOfIssue`/`licenceNumber` is mapped, this one silently isn't). This is a real defect worth fixing regardless.

**Needs surveyor confirmation:** "12345" may have been manually typed during testing rather than a code default — flag this back to whoever reported it. Either way, fix the missing `badge_no` mapping so real values flow through, and never introduce a hardcoded fallback for this field.

### D3 — No "Hazardous Goods Endorsement" field on DL section
Confirmed absent entirely — no `hazardous` match anywhere in DL-related code. Needs a new field added at every layer:
1. `src/types/vehicle.ts:82` area — add `hazardousEndorsement: boolean` + `hazardousEndorsementNote: string` to `DriverDetails`.
2. `src/lib/ai/prompts.ts:76-92` — add extraction hint (AI can flag if it sees a hazmat endorsement code on the DL image, but this should default to surveyor-set, not AI-asserted, given the liability weight — matches the "surveyor makes the final assessment" principle already in place elsewhere in this app).
3. `aiDataSlice.ts:405-423` (`applyDL`) — map it if extracted.
4. `DriverForm.tsx` near badge field (~line 166-172) — Yes/No selector + conditional note/date input.
5. Render in **all** report formats: `uiic-final-builder.ts:240-256`, `standard-report-builder.ts:382-404`, `SpotPrintReport.tsx:~296`, `UIICPrintReport.tsx`.

This is the widest-scope item of the four — one field touching type, prompt, mapping, form, and 4 report templates.

### D4 — "Time of Survey" missing (report + claim details)
`dateOfSurvey: string` exists on `AccidentDetails` (`src/types/vehicle.ts:107`, default `''` in `src/types/claim.ts:274`), rendered in `AccidentForm.tsx:55-61` (claim details UI), `standard-report-builder.ts:429-430`, `uiic-final-builder.ts:190,724`, `SpotPrintReport.tsx:339-340`, `UIICPrintReport.tsx:154`, `spot-fee-bill-builder.ts:59,155`.

Interesting existing precedent: `spotDetails.surveyDatetime` (`src/types/claim.ts:298`) already combines date+time in one field elsewhere, but it isn't linked to `dateOfSurvey`. **Fix scope:** add a sibling `timeOfSurvey` field next to `dateOfSurvey` in the type, the claim-details form, and all 5 render locations above — mechanical but touches many files (similar shape to D3, smaller because no AI-extraction/liability nuance).

---

## Category E — No visibility into remaining AI calls/credits (Issue #8)

**Complaint:** Surveyors can't see how many calls per model are left; they only find out a model is dead when it fails.

**Root cause: no usage/quota tracking exists at all** — everything is reactive, after-the-fact.
- `src/lib/ai/probe-classify.ts:79-88` only classifies an already-failed call (429/413/5xx) as transient — pass/fail, not a count.
- `src/lib/ai/probe-runner.ts:138-141` tracks `consecutiveFailures` for auto-disabling dead models — a durability counter, not a quota counter. It does hardcode known free-tier ceilings (`PROVIDER_CONCURRENCY`, `PROVIDER_MIN_GAP_MS`, e.g. Gemini "~9 rpm, just under 10 rpm free-tier cap", lines 41-52) but only uses them to pace its own probe requests — never surfaced to UI.
- `src/lib/ai/service.ts:526-533` (`isQuotaExhausted`) only detects exhaustion by parsing an already-received 429 error message.
- `src/lib/ai/service.ts:687-691` sets a boolean `aiProviderHealth` state (`ok`/`rate-limited`/`error`) on failure, surfaced only as a colored pill in `src/components/ai/AIControls.tsx:16,25,29`. No numeric count, no time-to-reset.
- No response headers are ever parsed for quota info (grep for `ratelimit`/`retry-after` across `src/` found nothing) — and Gemini's free-tier REST API doesn't return standard rate-limit headers anyway, so header-parsing wouldn't fully solve this even if added.

**Best integration point:** `AIModelsTab.tsx` already has a per-provider probe/status UI (badges at lines 372-401) and `ProviderProbe`/`ModelProbes` types already persist per-model state to Firestore (`ai_config/model_probes`). Adding a `callsUsed`/`callsRemaining` counter to that same Firestore doc, incremented in `service.ts`'s `callWithRotation` (~line 574) on every call (success or fail), is the natural extension — reuses existing persistence and existing UI real estate rather than building new infrastructure.

**Fix scope:** counter increments in `service.ts`, a small addition to the `ModelProbes`/`ProviderProbe` type, a display in `AIModelsTab.tsx`. Needs a product decision on what "remaining" means per provider (some free tiers are daily, some per-minute) since actual server-side quota isn't queryable — this would be a locally-tracked count reset on a known cadence, not a live authoritative number from the provider.

---

## Summary table

| # | Issue | Root cause | Scope |
|---|-------|------------|-------|
| 1 | No "save to cloud?" prompt on upload | No confirm gate exists, auto-upload on global toggle | Small — 1 shared dialog, 3 call sites |
| 2a | AI analysis breaks on tab switch | `key={activeTab}` remounts the hook holding extraction state; network call survives, UI doesn't | Medium — lift state to a store above the remount boundary |
| 2b | AI-review files should ask before drive sync | AI review and Drive sync are fully uncoupled today | Small — same dialog as #1, wired into `AIReviewDialog` |
| 3 | Keys re-entered "every time" | Already localStorage-persisted per device; gap is cross-device only, keys excluded from cloud sync by design | Needs clarification — same-device already works |
| 4 | Date of Issue missing in final report | Data exists everywhere; dropped only in `standard-report-builder.ts` template | Trivial — 1 row |
| 5 | Badge number wrong/defaulted | No hardcoded default found; real bug is `badge_no` never mapped in `applyDL()` | Trivial — 1 mapping line |
| 6 | No hazardous-goods endorsement field | Field doesn't exist anywhere | Medium-large — new field across type/prompt/mapping/form/4 report templates |
| 7 | No time-of-survey field | Field doesn't exist; a similar `surveyDatetime` precedent exists elsewhere | Medium — new field across type/form/5 render locations |
| 8 | No visibility into remaining AI calls | No usage tracking exists, only reactive failure detection | Medium — counter in `service.ts` + Firestore field + UI in `AIModelsTab.tsx` |

## Open questions for solution phase
- **#3:** Confirm whether the real complaint is same-device re-entry (already solved) or cross-device (needs a Drive-backed encrypted key backup — bigger scope).
- **#5:** Ask the reporting surveyor whether "12345" was AI-generated or manually typed during testing, to confirm there's no default we missed elsewhere (e.g. a different report format not yet checked).
- **#6:** Should the AI ever *assert* a hazardous endorsement from the DL image, or should it always be surveyor-set only (matches this app's "surveyor makes the final assessment" principle)? Recommend surveyor-set only, AI silent on this field.
- **#8:** Confirm whether a locally-tracked, resettable-per-known-cadence counter is acceptable, since true live quota isn't queryable from most of these providers.
