# Cloud Sync

## Current Implementation

- **What it does:** Offline-first data persistence with background cloud sync. Data flows through 4 layers: Zustand (in-memory) → IndexedDB (local) → Firestore (cloud) → Google Drive (file backup). The "Auto Push Files" toggle only controls photo/document uploads; profile backup always syncs.
- **Key files:**
  - `src/hooks/useCloudSync.ts` — Orchestrates Firestore + Drive sync with offline queue
  - `src/lib/firebase/sync.ts` — Firestore push/pull for claims and profiles (`pushClaimToCloud`, `pullClaimsFromCloud`, `syncDeltaToCloud`)
  - `src/lib/storage/indexeddb.ts` — IndexedDB abstraction (`saveClaim`, `getClaim`, `getAllClaims`, `deleteClaim`)
  - `src/lib/drive/index.ts` — Google Drive file operations with retry queue
  - `src/stores/claim-store.ts` — Zustand store with auto-save to IndexedDB
  - `src/hooks/useAutoSave.ts` — Auto-save hook for continuous persistence
- **Dependencies:** Firebase Firestore, Google Drive API, IndexedDB (via `idb`), Zustand, BroadcastChannel API (cross-tab sync)

## Two Sync Mechanisms

### 1. Automated File Uploads (Photos & Documents)
- Controlled by `profile.autoUploadDrive` toggle
- Photos compressed locally → IndexedDB → Drive (`SurveyOS/{RegNumber}/photo_...jpg`)
- Documents mirrored to Drive when toggle is on
- Implementation: `PhotosTab.tsx`, `DocumentsTab.tsx`

### 2. Profile & System Backup (Always On)
- Independent of "Auto Push Files" toggle
- Critical data always backed up: signatures, stamps, API keys
- Stored as `surveyos_profile_backup.json` in Drive
- Implementation: `src/lib/drive/index.ts`

## Known Issues / What Went Wrong

- BroadcastChannel sync can trigger race conditions with multiple tabs open
- Tombstone-based deletion sync doesn't handle conflicts gracefully
- Milestone push strategy means data can be stale between push events

## Improvement Ideas

- Real-time Firestore listeners instead of milestone push
- Conflict resolution UI for divergent data
- Sync status indicator in the UI (last synced timestamp)
- Compression for claim data before cloud push

## Technical Debt

- `sync.ts` writes to `profile/main` but `AdminDashboard` reads `profile/current` (path mismatch — M-4)
- Cross-tab sync via BroadcastChannel is fragile

## Related

- [[Authentication]] — Cloud sync requires Firebase auth
- [[Google_Drive_Integration]] — L4 persistence layer
- [[Assessment_Grid]] — Assessment data synced via claim store
