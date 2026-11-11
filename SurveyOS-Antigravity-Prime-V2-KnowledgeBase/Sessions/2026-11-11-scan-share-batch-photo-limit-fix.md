# Session Log: SurveyOS Scan Batch Photo Share Limit & Transaction Batching Fix

**Date:** 2026-11-11  
**Agent:** Antigravity  
**Persona Invocation:** `/debugger` (Root cause analysis, isolation, minimal fix, verification)

---

## 1. Problem Statement
The user reported that when sharing photos from external gallery apps (Google Photos, WhatsApp, Gallery) into SurveyOS Scan for Final Photos or RI Photos, only 20 photos were added even though 25 (or more) were selected.

---

## 2. Root Cause Analysis
- **Location:** `ShareInbox.kt` (`app/src/main/java/surveyos/scan/share/ShareInbox.kt`).
- **Cause:** `const val MAX_SHARED_URIS = 20` had been defined when incoming share was originally built for document scanning (1–3 page RC or Policy).
- When receiving `ACTION_SEND_MULTIPLE`, `uris.take(MAX_SHARED_URIS)` silently truncated the incoming URI list to the first 20 items.
- In addition, `ClaimViewModel.kt`'s `importSharedPhotos` and `importSharedAsNamedDoc` called `ingest()` in a loop per photo, triggering $N$ separate Room transactions and UI redraws.

---

## 3. Implementation Details
1. **`app/src/main/java/surveyos/scan/share/ShareInbox.kt`**:
   - Increased `MAX_SHARED_URIS` from `20` to `200`.
   - Streaming buffer in `copyCapped` (64 KB) ensures RAM footprint remains $O(1)$.
2. **`app/src/main/java/surveyos/scan/ui/claim/ClaimViewModel.kt`**:
   - Refactored `importSharedPhotos`, `importSharedAsNamedDoc`, and `importShared` to filter all non-PDF URIs into `imageUris` and pass them to `ingest()` in a single atomic call.
   - Executes one Room transaction in `Repository.addPages()` and emits UI updates once.
3. **`app/src/test/java/surveyos/scan/share/ShareInboxTest.kt`**:
   - Added unit test `maxSharedUrisAllowsLargeBatchPhotoSharing`.
4. **`version.properties`**:
   - Bumped `VERSION_CODE=7` (`PLAY_CONSOLE_LAST_USED_CODE=6`) and `VERSION_NAME=1.5.1`.

---

## 4. Verification & Release Build
- **Unit Tests:** `./gradlew.bat :app:testDebugUnitTest` ran with 28 actionable tasks, 100% green.
- **Signed Release Bundle:** Built via `./gradlew :app:bundleRelease`:
  - Path: `SurveyOS Scan/app/build/outputs/bundle/release/app-release.aab`
  - Version Code: `7`
  - Version Name: `1.5.1`
  - Size: `11.64 MB`
- **Coupling Impact:** None (Scan internal share pipeline fix).
