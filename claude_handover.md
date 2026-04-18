# SurveyOS-Prime-V2: Handover Document for Claude

## Current Objective
**Optimizing SurveyOS Local Storage (Memory Bloat Issue)**

## The Problem
The platform uses IndexedDB to store claim data locally. Currently, photos are Base64 encoded and stored directly inside the main `ClaimData` object's `photos` array. 
- A typical claim with 30 photos inflates to ~40MB of data.
- The UI freezes and stutters because the browser has to serialize/deserialize massive objects every time the state auto-saves.
- At 50 claims, this approaches ~2GB, causing browser memory quotas to fail (especially on mobile/Safari).

## The Evolved Plan
Initially, the plan was to completely delete the Photo Generation Engine. **We have dropped that plan.** We must KEEP the Photo Sheet Generation feature.

The new technical plan to solve the memory bloat consists of three strategies (we were just about to implement these):

1. **Client-Side Image Compression (High Priority)**
   - Intercept uploaded photos in the browser, resize them (e.g., max 1200px), and compress to `JPEG`/`WEBP` (~60% quality) *before* saving to local state.
   - *Impact:* Reduces a 40MB claim down to ~4.5MB.

2. **Database Separation / Schema Splitting (High Priority)**
   - Move the `photos` array out of the main `claims` object in IndexedDB (`src/lib/storage/indexeddb.ts`).
   - Create a separate `claim_photos` store.
   - *Impact:* The dashboard and text inputs become lightning fast because they no longer load/save heavy image data on every keystroke. 

3. **Soft Archiving (Claim Limit)**
   - Enforce a 50 active-claim limit to ensure safety.
   - When a user hits 50, they must "Archive" claims.
   - Archiving simply deletes the local `claim_photos` blob from IndexedDB but retains the text details locally. 

## Current Status & Next Steps
- **No code has been modified yet** for this specific memory optimization.
- The next step is to implement the **Compression logic** when adding photos in the store (`src/stores/claim-store.ts`).
- Followed by refactoring `src/lib/storage/indexeddb.ts` to use a separate store for images.

## Key Files Involved for Memory Optimization
- `src/stores/claim-store.ts` (State management for adding photos)
- `src/lib/storage/indexeddb.ts` (Database schema & persistence)
- `src/types/claim.ts` (Interfaces for `ClaimData`)
- `src/components/tabs/PhotosTab.tsx` (Photo UI)
- `src/components/pdf/PhotoSheetDocument.tsx` (PDF Generation)

## Recent Project Context (Last 3 Days)
To get you up to speed, here is a summary of what has been built and modified in the last few days. Note that there are several **uncommitted changes** currently sitting in the working directory that are fully functional but not yet pushed.

### Uncommitted Working Changes:
- **Constructive Total Loss (CTL):** Integrated a 75% IDV threshold detection logic and a 4-way liability comparison table into `UIICReportDocument` and `StandardReportDocument`.
- **Spot Report Fixes:** Mapped missing fields ("Licence Classes", "Date of Birth", and "Appoint Office") correctly into the Spot Report.
- **AI Router & Extraction:** Stabilized OpenRouter API connectivity, restored Turbo Layer (NVIDIA NIM), and updated the AI bank statement/invoice extraction logic.
- **Google Drive Sync:** Corrected the `autoUploadDrive` configuration to ensure file sync and queueing (`lib/drive/index.ts`) works robustly.

### Recent Commits:
- `cdfbe3a8` Fix: preserve local API keys during profile sync & refresh claims list on initial sync
- `f9905026` Fix: auto-redirect from landing page on successful login
- `bb9419e3` Fix: Resolved sticky scroll issue on landing page
- `4dfbe272` Deployment: Refactored Dashboard, Auth-Aware Landing Page, and Sidebar Integration
