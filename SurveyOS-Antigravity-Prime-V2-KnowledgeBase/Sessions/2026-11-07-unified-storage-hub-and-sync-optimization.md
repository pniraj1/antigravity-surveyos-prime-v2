# Session Log: Unified Storage Hub, Firestore Quota Optimization & Cloud Sync UX

**Date:** 2026-11-07  
**Agent:** Antigravity  
**Branch:** `main`  
**Status:** Completed & 100% Verified

---

## 1. Context & Objectives
Based on surveyor feedback and live production Firestore audits:
1. **Firestore Quota Burn:** Rapid tab navigation between claim sections was triggering immediate milestone writes to Firestore, resulting in 30–40+ writes per claim assessment and burning daily free-tier quotas.
2. **Confusing Storage Mental Models & Modals:**
   - Popups on every photo/document upload asking "Save to Drive?" interrupted surveyor workflows.
   - The top header featured 4 disjointed indicators (`DriveQueueChip`, `SyncStatusBadge`, `ClaimFolderButton`, and a blue `Save & Sync` button).
   - Surveyors were unclear about the roles of `Cloud Vault` vs `Recovered` in the sidebar.
   - When surveyors opened an existing claim on a secondary laptop, high-res photos stored on Google Drive were not locally accessible without an intuitive 1-click sync.
   - "Use Phone Notes" and "Bring Phone Scans" were separate side-by-side buttons in `DocumentsTab.tsx`.

---

## 2. Implementation Summary

### Task 1: Firestore Quota Optimization — Tab-Switch Coalescing
- **File:** `src/hooks/useCloudSync.ts`
- **Changes:**
  - Added `TAB_SWITCH_COALESCE_MS = 15_000` (15s quiet window) for Milestone 2a (tab switch).
  - Rapid tab transitions coalesce into a single write once the surveyor pauses.
  - Implemented immediate flush logic for Milestone 2b (claim switch), Milestone 2d (visibility hidden / app minimized), and Milestone 2c (page beforeunload).
- **Tests:** `src/hooks/__tests__/useCloudSync-coalesce.test.ts` (6 tests).

### Task 2: Seamless File & Photo Cloud Sync — Eliminate "Save to Drive?" Popup Modal
- **Files:** `src/hooks/useSaveToCloudPrompt.tsx`, `usePhotoUpload.ts`, `DocumentsTab.tsx`, `AssessmentTab.tsx`
- **Changes:**
  - `confirmSaveToCloud` automatically resolves `true` if Google Drive is connected (`isDriveConnected || !!getDriveToken()`), and `false` if disconnected.
  - Returns `saveToCloudDialog: null` without rendering blocking modals.
  - Callers upload/mirror files seamlessly to Google Drive in the background while keeping the local computer folder synced.
- **Tests:** `src/hooks/__tests__/useSaveToCloudPrompt.test.ts` (3 tests).

### Task 3: Unified Top Header Storage & Safety Status Pill
- **Files:** `src/components/layout/ClaimHeader.tsx`, `src/components/layout/StorageSafetyPopover.tsx`
- **Changes:**
  - Replaced the blue "Save & Sync" button and scattered chips with an interactive Status Pill:
    - `[✓ All Changes Saved]` (emerald check)
    - `[↻ Saving...]` (spinner)
    - `[● Saved to Laptop]` (amber dot, indicates offline/local or conflict error)
  - Clicking the pill opens a detailed 3-tier popover card detailing:
    1. Local Computer Folder (path or link/change action)
    2. Google Drive (connected account email, unified folder link, pending queue count)
    3. Cloud Vault (Firestore sync status & reassurance)
    4. On-demand `[Sync Now]` button with spinner.
- **Tests:** `src/components/layout/__tests__/StorageSafetyPopover.test.tsx` (10 tests), `ClaimHeader.test.tsx` (5 tests).

### Task 4: Left Sidebar Helper Tooltips & Subtitles
- **Files:** `src/components/layout/sidebar.tsx`
- **Changes:**
  - Updated `NavItem` interface with `tooltip?: string` and `subtitle?: string`.
  - Added subtitle `"Cloud Text Sync"` and tooltip `"View, download, or restore claim text synced to your SurveyOS cloud account"` to `cloud-vault`.
  - Added subtitle `"Emergency Cache"` and tooltip `"Local emergency cache — find autosaved claims if browser closed unexpectedly"` to `recovered-claims`.
  - Displayed subtitles beneath the item label when sidebar is expanded.
- **Tests:** `src/components/layout/__tests__/sidebar-navigation.test.tsx` (2 tests).

### Task 5: Multi-Device Photos 1-Click Download Banner
- **Files:** `src/components/layout/NewDrivePhotosBanner.tsx`, `src/components/tabs/PhotosTab.tsx`, `src/lib/photos/drive-photo-diff.ts`, `download-drive-photos.ts`
- **Changes:**
  - Removed strict prefix restriction, allowing detection of standard image formats (`IMG_...`, raw camera photos).
  - Displayed notification banner: `"☁️ {pending.length} photo(s) found in Google Drive for this claim. [Download to this Laptop]"` with dynamic progress tracking (`Downloading (X/Y)...`).
  - Added "Sync from Drive" toolbar trigger and empty-state download cards in `PhotosTab.tsx`.
- **Tests:** `src/lib/photos/__tests__/drive-photo-diff.test.ts` (8 tests), `src/components/layout/__tests__/NewDrivePhotosBanner.test.tsx` (6 tests).

### Task 6: Unified "From Phone" Action
- **Files:** `src/components/documents/FromPhoneButton.tsx`, `src/components/tabs/DocumentsTab.tsx`
- **Changes:**
  - Consolidated `UsePhoneNotesButton` and `BringPhoneScans` into a single `[📱 From Phone]` dropdown button in `DocumentsTab.tsx`.
  - Menu provides two clear choices:
    1. 📝 **Phone Notes** (Review field notes recorded on phone & auto-populate details)
    2. 📁 **Phone Scans & Photos** (Import scans and photos from phone .zip or Drive folder)
  - Retained full underlying Drive binding, vehicle registration mismatch safety checks, and multi-folder disambiguation.
- **Tests:** `src/components/documents/__tests__/FromPhoneButton.test.tsx` (6 tests).

---

## 3. Verification & Metrics
- **Vitest Suite:** 302 test files passed, 2,638 tests passed (100% green).
- **TypeScript Typecheck:** `npx tsc --noEmit` exited 0 (0 errors).
- **Android Scan Coupling:** `./gradlew.bat :app:testDebugUnitTest` BUILD SUCCESSFUL (28 tasks passed).
- **Subagent-Driven Development:** Every task underwent independent implementer execution, spec compliance review, and code quality review before merging.
