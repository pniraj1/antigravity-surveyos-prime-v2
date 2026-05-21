# Google Drive Integration

## Current Implementation

- **What it does:** Handles Google Drive OAuth token management, folder/file operations, and queue-based uploads with retry logic. Creates a `SurveyOS` root folder in Drive, organizes claim files by claim ID, and maintains an IndexedDB-synced file index.
- **Key files:**
  - `src/lib/drive/index.ts` — Token lifecycle (localStorage with 58-min expiry), silent restore (`prompt='none'`), folder creation, file upload with queue (MAX_RETRIES=3), IndexedDB sync
  - `src/components/auth/DriveGateScreen.tsx` — Post-login screen requiring Drive linking
  - `src/components/tabs/CloudVaultTab.tsx` — Drive sync UI and file management
  - `src/hooks/useCloudSync.ts` — Cloud sync hook orchestrating Firestore + Drive sync
- **Dependencies:** Google OAuth2 API, Firebase config, IndexedDB storage, Zustand stores (ui, profile)

## Known Issues / What Went Wrong

- OAuth token stored in localStorage (`surveyos_drive_token`) — survives reload but not secure
- Silent auth can fail if Google session expired; falls back to queuing but doesn't proactively notify user to re-link
- `@ts-ignore` used for `google.accounts.oauth2` type access
- "Auto Push Files" toggle confusion — it only applies to photos/docs, not profile backup

## Improvement Ideas

- Move token to encrypted IndexedDB or secure httpOnly cookie
- Proactive notification when silent auth fails (prompt user to re-link)
- Drive file versioning / conflict resolution
- Proper TypeScript types for Google OAuth2 API

## Technical Debt

- Large `index.ts` file handles token management, folder ops, file uploads, and queue management — could split into separate modules
- Drive file list cache is in-memory only (`src/lib/drive/list-cache.ts`)

## Related

- [[Authentication]] — Drive linking happens after Firebase auth
- [[Cloud_Sync]] — Drive is L4 persistence layer
- [[PDF_Reports]] — Generated reports can be uploaded to Drive
