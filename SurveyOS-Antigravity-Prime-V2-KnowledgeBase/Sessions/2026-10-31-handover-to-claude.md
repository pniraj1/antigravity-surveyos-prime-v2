# Session Log: 2026-10-31 — Comprehensive Handover to Claude Code

**Date:** 2026-10-31  
**Author:** Google Antigravity  
**Recipient:** Claude Code  
**Repository:** SurveyOS-Prime-V2 (`main` @ commit `89d1cb54`)  
**Coupled Repository:** SurveyOS Scan (`main` @ commit `ff3227ce`)  
**Status:** All tasks built, tested, and pushed to `main`; Sandbox deployed; 1 active auto-split ordering investigation in progress.

---

## 1. Executive Summary & Continuity Context

On 2026-10-27, Claude Code completed the handover to Antigravity (documented in `HANDOVER.md` and `Sessions/2026-10-27-surveyor-feedback-round-1.md`).  
Between 2026-10-27 and 2026-10-31, Antigravity delivered 6 major engineering workstreams directly on `main` across Prime and Scan:
1. **Bill Check Reference Serials & Surveyor Feedback Round 1** (tested, deployed).
2. **Estimate View Lenses, Toolbar Streamlining & Deductive Reconciliation** (tested, pushed).
3. **Survey Date & Time Unification across Claim & Spot** (tested, deployed).
4. **Browser Storage Exhaustion Fix & IndexedDB Memory Cleaner** (tested, deployed).
5. **Field Unifications (Weights, Load, Goods Description, HPA/Financier, Valuation Odometer)** (tested, deployed to production `motorsurveyos-in.web.app`).
6. **Scan Fee Bill Notes, Mobile Rate Memory & SQLite Cross-Section Sync** (tested across Prime and Android Scan).
7. **Zero-Login Sandbox Bypass, Anonymous Firebase Auth & BYOK Proxy Exemption for Ollama/NVIDIA** (tested, deployed to both sandbox channels).

The app currently passes all **227 Vitest test suites (1,999 tests)**, `npx tsc --noEmit` is clean (0 errors), and the SurveyOS Scan Android suite (`:app:testDebugUnitTest`) passes all 337 tests.

---

## 2. Chronological Log of Everything Antigravity Built & Changed

### A. Bill Check Reference Serials & Surveyor Feedback (2026-10-27)
- **Problem:** Surveyors cross-checking garage final bills against initial estimates had no way to track original estimate serial numbers or compare line numbers side-by-side.
- **Changes Made:**
  - Added `refSrNo` and `refStatus` to `AssessmentRow`; added `baseDocument` and `refColumnTitle` to `BillCheckDetails`.
  - Added editable Reference Column in `BillCheckGrid` with click-to-rename header and amber dot for ambiguous rows.
  - Implemented 400-line ergonomics filter: "Review Ref Numbers (N)" toggle to isolate ambiguous/unmatched items without review fatigue.
  - Appended Reference column in Standard Report (section 9, width 4.5%) and UIIC Final Report (13-column layout) without breaking normal 12-column final reports.
  - Automated matching in `applyFinalBill` to link invoice rows to estimate rows.
  - Fixed duplicate row offers in "Fix estimate reading" dialog (`88f1ccd1`).
  - Retired obsolete "Site" tab; hid Insured Report behind admin gate (`a3ae84a6`).

### B. Estimate View Lenses & Lean Assessment Toolbar (2026-10-28)
- **Problem:** Multi-page or multi-quote estimates cluttered the screen; toolbar consumed >200px vertical table space.
- **Changes Made:**
  - Streamlined `AssessmentTab.tsx` header into a lean ~36px toolbar, recovering over 200px vertical table space.
  - Converted `PolicyCheckStrip` into a compact inline badge chip with popover card.
  - Added `estimateId` to `AssessmentRow` and implemented `EstimateViewSwitcher` and `EstimateTallyBanner` to filter views (Quote 1, Quote 2, Supplementary) without mutating the underlying flat row array.
  - Added visual left-border color accents to `AssessmentSectionTable` rows when 2+ estimates exist.
  - *Note on Prompts:* Experimental prompt rewrite was subsequently reverted back to battle-tested prompts (`a05c0d3e`) per owner instructions.

### C. Survey Date & Time Consolidation (2026-10-28)
- **Problem:** Spot and Final claims had duplicate, conflicting survey date and time inputs across `SurveyForm.tsx` and `SpotTab.tsx`.
- **Changes Made:**
  - Consolidated into a single `datetime-local` input labeled "Date & Time of Survey".
  - Implemented bi-directional store sync between `accident.dateOfSurvey` / `accident.timeOfSurvey` and `spotDetails.surveyDatetime`.
  - Updated `SpotPrintReport.tsx` headers and section C with cross-field fallbacks.

### D. Browser Storage Exhaustion & IndexedDB Memory Cleaner (2026-10-29)
- **Problem:** Surveyors uploading 20+ photos experienced browser storage crashes (`QuotaExceededError`) because photos were stored as raw 1.6MB lossless PNGs, and unlinked Drive queued raw files indefinitely in IndexedDB `driveQueue`.
- **Changes Made:**
  - Switched default photo canvas compression in `src/lib/photos/compress-image.ts` and `usePhotoUpload.ts` from PNG to JPEG 0.85 (~40 KB), slashing photo payload by ~95% in `claim.photos`.
  - Guarded `uploadFileToDrive` and `usePhotoUpload` to stop hoarding uncompressed camera files in `driveQueue` when Google Drive is unlinked.
  - Added `getStorageUsageSummary()`, `clearDriveQueue()`, and `clearRecoveredClaims()` to `src/lib/storage/indexeddb.ts`.
  - Created `StorageCleanerSection.tsx` in Profile tab with live storage breakdown cards and 1-click memory cleanup.
  - Extracted `SubscriptionSection.tsx` out of `ProfileTab.tsx` to strictly observe the <800 lines rule.

### E. Field Unification: Weights, Load, Goods Description, HPA, Odometer (2026-10-29 & 2026-10-30)
- **Problem:** Surveyors had to re-type identical fields in multiple tabs (Vehicle, Policy, Spot, Valuation), causing drift and blank fields in reports.
- **Changes Made:**
  - **Option A (Weights & Load):** Bi-directional store sync between `vehicle.registeredLoadWeight`/`grossWeight`/`unladenWeight` and `spotDetails.gvw`/`spotDetails.ulw`/`spotDetails.loadCapacity` (`gvw - ulw`); unified duplicate inputs in `AtAccidentForm.tsx` into a single authoritative "Load at Accident (KG)"; synchronized AI extraction in `aiDataSlice.ts` (`applyRC`, `applyFitness`, `applyLokChallan`); added cross-fallbacks in all report builders.
  - **Option B (Goods, HPA & Odometer):** Bi-directional sync between `spotDetails.loadDesc` and `vehicle.natureOfGoods`/`detailsOfGoodsCarried`; bi-directional sync between `policy.hpaWith` and `vehicle.hypothecation`/`rcEndorsement`; bi-directional sync between `vehicle.odometer` and `valuationDetails.odometer`; single unified "Nature / Description of Goods" input in `AtAccidentForm.tsx`; AI extraction dual-field update; cross-builder fallbacks in all reports.
  - **Surveyor Rulings:** Kept Place of Survey (`accident.placeOfSurvey`) and Workshop Name (`accident.workshopName`) separate and distinct.
  - **Deployed to Live Production:** Verified live on `https://motorsurveyos-in.web.app` (chunk search confirmed `"Nature / Description of Goods"`).

### F. Scan Fee Bill Notes & Cross-Section Draft Sync (2026-10-30)
- **Problem:** Surveyors capturing survey notes on site had no fee bill notes section in Android Scan, and shared fields (date, place, odometer) had to be re-entered between Spot and Valuation notes.
- **Changes Made:**
  - **Handover Contract:** Updated `SurveyOS Scan/docs/handover/prime-notes-import.md` with 16 `feeBill.*` paths.
  - **Android Scan (`SurveyOS Scan`):**
    - Defined `FeeBillFields.kt` with 16 fields across 6 sections (`BILL`, `FEES`, `TRAVEL`, `PHOTOS`, `EXPENSES`, `TAX`).
    - Implemented `FeeRatesStore.kt` using `SharedPreferences` to remember rates (`ratePerKm: "10"`, `photoRate: "15"`, `includeGST: "yes"`).
    - Built `FeeBillNotes.kt` screen with live auto-calculating cards (`TravelLiveCard`, `PhotosLiveCard`, `TaxLiveCard`) and 3-way horizontal scroll chips (`Spot`, `Valuation`, `Fee Bill`).
    - Added `SHARED_SYNC_MAP` cross-section draft sync in Room SQLite (`NotesViewModel.kt`) so typing date/time, place, odometer, or enclosures in Spot automatically syncs to Valuation draft in real time.
    - Exported `Fee Bill Notes.txt` and `notes.feeBill` snapshot in `_surveyos-scan.json`.
  - **Prime Side:**
    - Updated `src/lib/scan-import/notes.ts` to allow-list `feeBill.*` fields, parse boolean/number types, and backfill survey date/time into Spot, Final, and Valuation claim states.
    - Added robust fallbacks in `valuation-report-builder.ts` and `spot-fee-bill-builder.ts`.

### G. Zero-Login Sandbox & Anonymous BYOK Proxy (2026-10-30)
- **Problem:** Testing new/old AI models (Ollama, NVIDIA NIM, Gemini, Groq) on preview deployments was completely blocked:
  1. Google OAuth threw `Error 400: origin_mismatch` because dynamic preview URLs (`motorsurveyos-in--sandbox-*.web.app`) cannot be pre-registered in Google Cloud Console.
  2. Cloud Functions `aiProxy` and `nvidiaProxy` rejected requests with `unauthenticated` or demanded a paid subscription record in Firestore.
- **Changes Made:**
  - Created `src/lib/sandbox.ts`:
    - `isSandbox()` auto-detects sandbox environments (hostname contains `sandbox` or `surveyos-v2-antigravity-in`, or query `?sandbox=true`).
    - `initSandboxSession()` seeds virtual session (`sandbox-surveyor`), connects virtual Google Drive, activates compliant subscription profile, and drops surveyors straight into the Assessment tab (`SANDBOX-TEST-01`, `MH-12-AB-1234`).
    - In the background, `initSandboxSession()` runs `signInAnonymously(auth)` so the browser gets a genuine Firebase Auth ID token with zero login popups.
  - Bypassed all OAuth iframe and sync calls during sandbox: guarded `silentlyRestoreDriveToken()`, `linkGoogleDrive()`, `uploadFileToDrive()`, `useCloudSync()`, `useSessionHeartbeat()`, and `signInWithGoogle()`.
  - Updated backend Cloud Functions `functions/index.js` (`aiProxy` & `nvidiaProxy`): exempted anonymous callers with BYOK (Bring Your Own Key) from requiring paid subscription records in Firestore.
  - Deployed Cloud Functions to `asia-south1`.
  - Added dedicated sandbox hosting site in `firebase.json`: `https://surveyos-v2-antigravity-in.web.app` (pre-authorized in Google Cloud Console OAuth).
  - Deployed frontend to `https://surveyos-v2-antigravity-in.web.app` and preview channel `https://motorsurveyos-in--sandbox-izvlcn5z.web.app`.
  - Added "Another Estimate (Estimate 2, 3...)" mode (`'another'`) in `EstimateModeDialog.tsx` and `aiDataSlice.ts`.
  - Added Start-of-Document Gap Detection in `src/lib/ai/row-check.ts` (`gapsIn` flags `1..present[0].sr-1`).
  - Added In-Flight Auto-Split Fallback in `src/lib/ai/processor.ts` (multi-page chunks that fail JSON parse automatically split into 1-page calls).

---

## 3. Active Investigation: Auto-Split Page Ordering Bug

### What Happened
The user tested **Ollama (`gemma4:31b`)** in the sandbox by uploading the **first 2 pages of Pawar Brothers' merged estimate PDF**.
- **What Worked:**
  - Anonymous Firebase Auth succeeded; backend BYOK Cloud Function proxy accepted the Ollama call.
  - Ollama overflowed output tokens on the 2 pages combined, truncating JSON.
  - Auto-split caught the `SyntaxError` and successfully triggered: `"Re-reading page 1 of 2 individually..."`, `"Re-reading page 2 of 2 individually..."`.
- **The Bug:**
  - When extraction completed, **Page 2's line items appeared first in the assessment sheet, followed by Page 1's items** (reversed ordering).

### Root Cause Analysis & Areas to Inspect
1. **Auto-split Loop in `src/lib/ai/processor.ts` (lines 585–601):**
   ```ts
   for (let p = 0; p < images.length; p++) {
     const singlePageNum = first + p;
     ...
     const singleResp = await callAIGateway(chunkPrompt, [images[p]], 'json', job, session, signal);
     const singleFragment = JSON.parse(singleResp);
     result = mergeAIResults(
       result,
       tagFieldPages(tagRows(singleFragment, singlePageNum - 1, singlePageNum - 1), pageRefs[singlePageNum - 1])
     );
   }
   ```
   - **Possibility A (Initial Failure + Gap-Fill Append):** If Page 1 failed during the individual pass (`catch (singleErr)`), only Page 2 was in `result`. Then, post-pass `rowCheck` detected missing serials 1..10 and fired `fillGaps()`. `fillGaps` appended Page 1 items to the end of `result`, causing Page 1 to appear after Page 2.
   - **Possibility B (Parts vs. Labour Section Splitting):** In `src/stores/slices/aiDataSlice.ts` (`buildEstimateRows`):
     ```ts
     (data.spare_parts || []).forEach(...);
     (data.labour_items || []).forEach(...);
     (data.painting_items || []).forEach(...);
     ```
     If Page 1 contained labour items and Page 2 contained spare parts, parts are always placed at the top of the sheet regardless of page order.
   - **Possibility C (PDF Page Array Order):** Check `fileToImages` in `src/lib/photos/pdf-to-images.ts` and `resolveAIPages(numPages, selection)` in `src/lib/ai/ai-pages.ts` to ensure that `apiImages` strictly mirrors ascending page order `[page1, page2]`.
   - **Recommended Solution:** In `buildEstimateRows()` (`src/stores/slices/aiDataSlice.ts`) or prior to sheet commit, sort rows by printed `srNo` (ascending) when serial numbers are present (`item.sr_no`). This guarantees that regardless of network call resolution order or multi-page auto-splits, serial `1, 2, 3...` always renders in strict sequential order.

---

## 4. Current Repository State

- **Branch:** `main` (clean working tree).
- **Latest Commit:** `89d1cb54` (`feat(sandbox): anonymous auth and BYOK Cloud Function proxy exemption for Ollama/NVIDIA`).
- **Test Suite Status:** 227 Vitest files, 1,999 tests passing (`npm test`).
- **TypeScript:** `npx tsc --noEmit` clean (0 errors).
- **Functions Tests:** `npm run test:functions` passing (all subscription, bramha, and proxy suites green).
- **Cloud Functions:** Deployed to `asia-south1` with anonymous BYOK proxy exemption.
- **Active Sandbox Hosting Channels:**
  - `https://surveyos-v2-antigravity-in.web.app` (Pre-authorized domain)
  - `https://motorsurveyos-in--sandbox-izvlcn5z.web.app` (Preview channel)
- **Live Production:** `https://motorsurveyos-in.web.app` (Strictly untouched and protected).

---

## 5. Important Gotchas & Reminders for Claude

1. **Commit Rules:** Work directly on `main`. Never create branches or pull requests.
2. **Production vs Sandbox Hosting:**
   - Production deploy: `npm run build` then `firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in`.
   - Sandbox deploy: `npm run build` then `firebase deploy --only hosting:surveyos-v2-antigravity-in --project surveyos-v2-antigravity-in` (or channel deploy).
   - Only deploy to production when explicitly instructed by the owner.
3. **AI Prompts Integrity:**
   - `src/lib/ai/prompts.ts` is in its battle-tested state (`RAW_PROMPTS`). Do NOT rewrite or modify extraction prompts unless explicitly directed.
4. **Prime ↔ Scan Coupling Rule:**
   - If you touch `src/types/documents.ts`, `src/lib/scan-import/`, or any coupling point, verify drift in `../SurveyOS Scan` with:
     `cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`.
5. **Sandbox Isolation:**
   - Sandbox sessions run with `isSandbox() === true`. Any new cloud sync, analytics, or OAuth calls must be guarded behind `!isSandbox()`.
