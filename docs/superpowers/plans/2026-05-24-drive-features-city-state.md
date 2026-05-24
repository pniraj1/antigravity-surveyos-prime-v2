# Drive Features + City/State + Admin Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add duplicate upload detection for Google Drive, per-claim Drive file listing with IDB cache, city/state fields in access-request, and expandable surveyor detail rows in the admin panel.

**Architecture:** Three independent features built sequentially. Feature 1 (duplicate detection) wraps the existing `uploadFileToDrive` with a pre-check against `listFilesInFolder`. Feature 2 (file listing) adds a `useClaimDriveFiles` hook with stale-while-revalidate IDB caching. Feature 3 (city/state + admin visibility) adds form fields, extends admin types, and adds expandable detail rows to SurveyorsTab.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Firebase/Firestore, Google Drive API, IndexedDB (idb), Zustand, Sonner toasts, Lucide icons

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/lib/drive/index.ts` | Drive API helpers | MODIFY — add `deleteFile` export |
| `src/lib/drive/upload-with-check.ts` | Duplicate-check wrapper around upload | CREATE |
| `src/components/dialogs/DuplicateUploadDialog.tsx` | Modal for Replace/Keep Both/Cancel | CREATE |
| `src/components/tabs/DocumentsTab.tsx` | Document upload + Drive file list UI | MODIFY |
| `src/hooks/useClaimDriveFiles.ts` | Hook: fetch + cache Drive files per claim | CREATE |
| `src/lib/storage/indexeddb.ts` | IDB schema + driveFileCache helpers | MODIFY |
| `src/app/access-request/page.tsx` | Access request form | MODIFY — add city/state inputs |
| `src/stores/profile-store.ts` | Profile defaults | MODIFY — add city/state defaults |
| `src/components/admin/types.ts` | Admin type definitions | MODIFY — extend types |
| `src/components/admin/hooks/useAdminData.ts` | Admin data fetching | MODIFY — fetch new fields |
| `src/components/admin/tabs/SurveyorsTab.tsx` | Surveyors table | MODIFY — add expandable detail row |
| `src/components/admin/tabs/ApprovalQueueTab.tsx` | Approval queue | MODIFY — show city/state |

---

### Task 1: Add `deleteFile` to Drive helpers

**Files:**
- Modify: `src/lib/drive/index.ts:161-185` (near `driveRequest` helper)

- [ ] **Step 1: Add the `deleteFile` function**

Add this export after the `downloadFileAsBase64` function (after line 400) in `src/lib/drive/index.ts`:

```typescript
/**
 * Delete a file from Google Drive by its file ID.
 * Used by duplicate upload detection to replace an existing file.
 */
export async function deleteFile(fileId: string): Promise<void> {
  await driveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
  });
}
```

Note: `driveRequest` checks `res.ok` — DELETE returns 204 (no content) which is `ok`, so no special handling needed. On 401, `driveRequest` already clears the token and sets `isDriveConnected` to false.

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/drive/index.ts
git commit -m "feat(drive): add deleteFile helper for duplicate upload replacement"
```

---

### Task 2: Create `DuplicateUploadDialog` component

**Files:**
- Create: `src/components/dialogs/DuplicateUploadDialog.tsx`

- [ ] **Step 1: Create the dialog component**

Create `src/components/dialogs/DuplicateUploadDialog.tsx`:

```typescript
'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Copy, X } from 'lucide-react';

interface DuplicateUploadDialogProps {
  fileName: string;
  suffixedName: string;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export function DuplicateUploadDialog({
  fileName,
  suffixedName,
  onReplace,
  onKeepBoth,
  onCancel,
}: DuplicateUploadDialogProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in duration-200"
        style={{ background: '#fff', border: '1px solid rgba(13,27,42,0.08)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.1)' }}
          >
            <AlertTriangle size={20} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#0D1B2A]">File Already Exists</h2>
            <p className="text-xs text-[#8D99AE] mt-1 leading-relaxed">
              A file named <span className="font-bold text-[#0D1B2A]">&ldquo;{fileName}&rdquo;</span> already
              exists in this claim&apos;s Drive folder.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onReplace}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #f0d870)',
              color: '#0D1B2A',
            }}
          >
            <RefreshCw size={14} />
            Replace existing file
          </button>
          <button
            onClick={onKeepBoth}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border border-[#E2E6EA] text-[#0D1B2A] hover:bg-[#FAFBFC] transition-all"
          >
            <Copy size={14} />
            Keep both &mdash; upload as &ldquo;{suffixedName}&rdquo;
          </button>
          <button
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-[#8D99AE] hover:text-[#0D1B2A] transition-all"
          >
            <X size={14} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dialogs/DuplicateUploadDialog.tsx
git commit -m "feat(drive): add DuplicateUploadDialog component"
```

---

### Task 3: Create `upload-with-check` wrapper

**Files:**
- Create: `src/lib/drive/upload-with-check.ts`

- [ ] **Step 1: Create the upload wrapper**

Create `src/lib/drive/upload-with-check.ts`:

```typescript
// ═══════════════════════════════════════════════════════════
// DUPLICATE-CHECKED DRIVE UPLOAD
// Wraps uploadFileToDrive with a pre-check for existing files.
// If a file with the same name exists, delegates to showDialog
// callback which returns the user's choice.
// ═══════════════════════════════════════════════════════════

import {
  getDriveToken,
  getOrCreateClaimFolder,
  listFilesInFolder,
  uploadFileToDrive,
  deleteFile,
} from './index';
import { logger } from '../utils/logger';

export type DuplicateAction = 'replace' | 'keep-both' | 'cancel';

export interface ExistingFile {
  id: string;
  name: string;
  mimeType: string;
}

/**
 * Generate a suffixed filename that doesn't collide with existing files.
 * "rc.pdf" → "rc (2).pdf", "rc (2).pdf" → "rc (3).pdf", etc.
 */
export function generateSuffixedName(fileName: string, existingNames: string[]): string {
  const dotIdx = fileName.lastIndexOf('.');
  const base = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
  const ext = dotIdx > 0 ? fileName.slice(dotIdx) : '';

  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  const lowerNames = new Set(existingNames.map(name => name.toLowerCase()));
  while (lowerNames.has(candidate.toLowerCase())) {
    n++;
    candidate = `${base} (${n})${ext}`;
  }
  return candidate;
}

/**
 * Upload a file to Drive with duplicate detection.
 *
 * @param claimId     - The claim this file belongs to
 * @param fileName    - Target filename on Drive (e.g. "rc.pdf")
 * @param blob        - File data
 * @param claimLabel  - Human-readable claim label for folder naming
 * @param showDialog  - Callback that presents the user with a choice.
 *                      Receives the existing file info and a suggested suffix name.
 *                      Returns the user's decision as a Promise.
 *
 * If Drive is not linked (no token), falls through to uploadFileToDrive
 * which handles queuing. No duplicate check for queued uploads.
 */
export async function uploadWithDuplicateCheck(
  claimId: string,
  fileName: string,
  blob: Blob,
  claimLabel: string,
  showDialog: (existing: ExistingFile, suffixedName: string) => Promise<DuplicateAction>,
): Promise<void> {
  // If Drive isn't linked, skip duplicate check — uploadFileToDrive will queue
  if (!getDriveToken()) {
    return uploadFileToDrive(claimId, fileName, blob, claimLabel);
  }

  let folderId: string;
  let existingFiles: ExistingFile[];

  try {
    folderId = await getOrCreateClaimFolder(claimId, claimLabel);
    existingFiles = await listFilesInFolder(folderId);
  } catch (err) {
    // Network error during check — fall through to direct upload (best-effort)
    logger.log(`[Drive] Duplicate check failed, uploading directly: ${err}`);
    return uploadFileToDrive(claimId, fileName, blob, claimLabel);
  }

  // Case-insensitive match
  const match = existingFiles.find(
    f => f.name.toLowerCase() === fileName.toLowerCase()
  );

  if (!match) {
    // No duplicate — upload directly
    return uploadFileToDrive(claimId, fileName, blob, claimLabel);
  }

  // Duplicate found — ask user
  const allNames = existingFiles.map(f => f.name);
  const suffixedName = generateSuffixedName(fileName, allNames);
  const action = await showDialog(match, suffixedName);

  switch (action) {
    case 'replace':
      await deleteFile(match.id);
      return uploadFileToDrive(claimId, fileName, blob, claimLabel);

    case 'keep-both':
      return uploadFileToDrive(claimId, suffixedName, blob, claimLabel);

    case 'cancel':
      logger.log(`[Drive] Upload of "${fileName}" cancelled by user (duplicate).`);
      return;
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/drive/upload-with-check.ts
git commit -m "feat(drive): add uploadWithDuplicateCheck wrapper"
```

---

### Task 4: Wire duplicate check into DocumentsTab

**Files:**
- Modify: `src/components/tabs/DocumentsTab.tsx:1-140`

- [ ] **Step 1: Add imports and state**

In `src/components/tabs/DocumentsTab.tsx`, replace the `uploadFileToDrive` import (line 9):

```typescript
// BEFORE:
import { uploadFileToDrive } from '@/lib/drive';

// AFTER:
import { uploadWithDuplicateCheck, type DuplicateAction, type ExistingFile } from '@/lib/drive/upload-with-check';
import { DuplicateUploadDialog } from '@/components/dialogs/DuplicateUploadDialog';
```

Add state inside the `DocumentsTab` component (after the existing `useState` calls, around line 73):

```typescript
const [dupeDialog, setDupeDialog] = useState<{
  existing: ExistingFile;
  suffixedName: string;
  resolve: (action: DuplicateAction) => void;
} | null>(null);
```

- [ ] **Step 2: Replace the upload call in handleFile**

Replace the Drive upload block in `handleFile` (lines 128-136):

```typescript
    // Non-blocking Drive upload with duplicate detection
    if (currentClaim?.id && profile.autoUploadDrive !== false) {
      const label = currentClaim.vehicle?.registrationNumber || currentClaim.id;
      const ext   = file.name.split('.').pop() ?? 'bin';
      const driveName = `${key}.${ext}`;
      uploadWithDuplicateCheck(
        currentClaim.id,
        driveName,
        file,
        label,
        (existing, suffixedName) =>
          new Promise<DuplicateAction>((resolve) => {
            setDupeDialog({ existing, suffixedName, resolve });
          }),
      ).catch(err => {
        logger.error('[DocumentsTab] Drive upload failed:', err);
      });
    }
```

Also add the `logger` import at the top if not already present:

```typescript
import { logger } from '@/lib/utils/logger';
```

- [ ] **Step 3: Render the dialog**

Add the dialog render just before the closing `</div>` of the component (before line 424, after the `ProcessingProgressOverlay`):

```typescript
      {/* Duplicate Upload Dialog */}
      {dupeDialog && (
        <DuplicateUploadDialog
          fileName={dupeDialog.existing.name}
          suffixedName={dupeDialog.suffixedName}
          onReplace={() => {
            dupeDialog.resolve('replace');
            setDupeDialog(null);
          }}
          onKeepBoth={() => {
            dupeDialog.resolve('keep-both');
            setDupeDialog(null);
          }}
          onCancel={() => {
            dupeDialog.resolve('cancel');
            setDupeDialog(null);
          }}
        />
      )}
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/DocumentsTab.tsx
git commit -m "feat(drive): wire duplicate detection into DocumentsTab upload flow"
```

---

### Task 5: Add IDB `driveFileCache` store and helpers

**Files:**
- Modify: `src/lib/storage/indexeddb.ts`

- [ ] **Step 1: Add the DriveFileCache type to SurveyOSDB interface**

In `src/lib/storage/indexeddb.ts`, find the `SurveyOSDB` interface (around line 100-120). Add a new store entry inside the interface:

```typescript
  driveFileCache: {
    key: string;
    value: {
      claimId: string;
      files: { id: string; name: string; mimeType: string }[];
      updatedAt: string;
    };
  };
```

- [ ] **Step 2: Bump DB_VERSION and add store creation**

Change `DB_VERSION` from `3` to `4` (line 60):

```typescript
const DB_VERSION = 4;
```

Add the store creation inside the `upgrade` handler, after the `pushTracking` block (after line 186):

```typescript
      // Drive file cache — cached file listings per claim folder (v4)
      if (oldVersion < 4 && !db.objectStoreNames.contains('driveFileCache')) {
        db.createObjectStore('driveFileCache', { keyPath: 'claimId' });
      }
```

- [ ] **Step 3: Add cache helper functions**

Add these exports at the end of the file, before any closing comments:

```typescript
// ─── Drive File Cache ────────────────────────────────────────────────────────

export interface DriveFileCacheEntry {
  id: string;
  name: string;
  mimeType: string;
}

export async function getDriveFileCache(claimId: string): Promise<DriveFileCacheEntry[] | null> {
  const db = await getDB();
  const record = await db.get('driveFileCache', claimId);
  return record?.files ?? null;
}

export async function setDriveFileCache(claimId: string, files: DriveFileCacheEntry[]): Promise<void> {
  const db = await getDB();
  await db.put('driveFileCache', {
    claimId,
    files,
    updatedAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/indexeddb.ts
git commit -m "feat(drive): add driveFileCache IDB store for offline file listings"
```

---

### Task 6: Create `useClaimDriveFiles` hook

**Files:**
- Create: `src/hooks/useClaimDriveFiles.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useClaimDriveFiles.ts`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDriveToken, getOrCreateClaimFolder, listFilesInFolder } from '@/lib/drive';
import { getDriveFileCache, setDriveFileCache, type DriveFileCacheEntry } from '@/lib/storage/indexeddb';
import { logger } from '@/lib/utils/logger';

interface UseClaimDriveFilesResult {
  files: DriveFileCacheEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Stale-while-revalidate hook for listing Drive files in a claim's folder.
 * Returns cached data immediately, then fetches fresh data from Drive in background.
 * If Drive is not connected, returns cached data only (not an error).
 */
export function useClaimDriveFiles(claimId: string | null): UseClaimDriveFilesResult {
  const [files, setFiles] = useState<DriveFileCacheEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!claimId) {
      setFiles([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      // 1. Read from IDB cache immediately
      try {
        const cached = await getDriveFileCache(claimId);
        if (cached && !cancelled) {
          setFiles(cached);
        }
      } catch {
        // IDB read failed — non-fatal, proceed to Drive fetch
      }

      // 2. If Drive is connected, fetch fresh list
      if (!getDriveToken()) {
        // Not connected — cached data is all we have, no error
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const folderId = await getOrCreateClaimFolder(claimId, claimId);
        const freshFiles = await listFilesInFolder(folderId);
        if (!cancelled) {
          setFiles(freshFiles);
          setError(null);
          // Update IDB cache
          await setDriveFileCache(claimId, freshFiles);
          logger.log(`[Drive] Refreshed file list for claim ${claimId}: ${freshFiles.length} files`);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to fetch Drive files';
          setError(msg);
          logger.error(`[Drive] File list fetch failed for claim ${claimId}:`, err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [claimId, refreshKey]);

  return { files, loading, error, refresh };
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useClaimDriveFiles.ts
git commit -m "feat(drive): add useClaimDriveFiles hook with IDB caching"
```

---

### Task 7: Add Drive file list UI to DocumentsTab

**Files:**
- Modify: `src/components/tabs/DocumentsTab.tsx`

- [ ] **Step 1: Import the hook and icons**

Add these imports at the top of `src/components/tabs/DocumentsTab.tsx`:

```typescript
import { useClaimDriveFiles } from '@/hooks/useClaimDriveFiles';
import { RefreshCw, ExternalLink, ChevronDown, ChevronRight, HardDrive } from 'lucide-react';
```

Note: Some of these icons (like `Loader2`) are already imported — only add the ones not already present. Check the existing import from `lucide-react` and merge.

- [ ] **Step 2: Add the hook call and expand state**

Inside the `DocumentsTab` component, after the existing state declarations (around line 73), add:

```typescript
  const { files: driveFiles, loading: driveFilesLoading, error: driveFilesError, refresh: refreshDriveFiles } = useClaimDriveFiles(currentClaimId);
  const [driveFilesExpanded, setDriveFilesExpanded] = useState(false);
```

- [ ] **Step 3: Add the Drive files section UI**

Add this section after the help note `<div>` and before the `AIReviewDialog` (insert before line 398 — the `{/* AI Review Dialog */}` comment):

```typescript
        {/* ── Files on Drive ───────────────────────────────── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E2E6EA', boxShadow: '0 1px 3px rgba(13,27,42,0.04)' }}
        >
          {/* Header — click to expand/collapse */}
          <button
            onClick={() => setDriveFilesExpanded(prev => !prev)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#FAFBFC] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <HardDrive size={16} style={{ color: '#D4AF37' }} />
              <span className="text-xs font-black text-[#0D1B2A] uppercase tracking-wider">
                Files on Drive
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#F0F2F5] text-[10px] font-bold text-[#8D99AE]">
                {driveFiles.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {driveFilesLoading && <Loader2 size={14} className="animate-spin text-[#8D99AE]" />}
              <button
                onClick={(e) => { e.stopPropagation(); refreshDriveFiles(); }}
                className="p-1 rounded-lg hover:bg-[#F0F2F5] transition-colors"
                title="Refresh file list"
              >
                <RefreshCw size={12} className="text-[#8D99AE]" />
              </button>
              {driveFilesExpanded ? <ChevronDown size={14} className="text-[#8D99AE]" /> : <ChevronRight size={14} className="text-[#8D99AE]" />}
            </div>
          </button>

          {/* Body */}
          {driveFilesExpanded && (
            <div className="border-t border-[#F0F2F5] px-5 py-3">
              {driveFilesError && (
                <p className="text-xs text-red-500 mb-2">{driveFilesError}</p>
              )}
              {driveFiles.length === 0 && !driveFilesLoading ? (
                <p className="text-xs text-[#8D99AE] py-2">
                  {getDriveToken() ? 'No files uploaded yet.' : 'Connect Google Drive to see files.'}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-[#F0F2F5]">
                  {driveFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <FileText size={14} className="text-[#8D99AE] flex-shrink-0" />
                        <span className="text-xs font-medium text-[#0D1B2A] truncate max-w-[200px]">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-[#C3C9D4]">
                          {file.mimeType.split('/').pop()}
                        </span>
                      </div>
                      <a
                        href={`https://drive.google.com/file/d/${file.id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-[#D4AF37] hover:bg-[rgba(212,175,55,0.08)] transition-colors"
                      >
                        Open <ExternalLink size={10} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
```

Also add this import at the top of the file (if not already present):

```typescript
import { getDriveToken } from '@/lib/drive';
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/DocumentsTab.tsx
git commit -m "feat(drive): add collapsible Drive file list to DocumentsTab"
```

---

### Task 8: Add city/state to access-request form and profile defaults

**Files:**
- Modify: `src/app/access-request/page.tsx:339-401`
- Modify: `src/stores/profile-store.ts:30-74`

- [ ] **Step 1: Add city/state defaults to profile store**

In `src/stores/profile-store.ts`, add these two fields to `DEFAULT_PROFILE` (after `address: ''` on line 42):

```typescript
  city: '',
  state: '',
```

- [ ] **Step 2: Add state variables to access-request form**

In `src/app/access-request/page.tsx`, in the `AccessRequestForm` component, add two new state variables after the `phone` state (after line 341):

```typescript
  const [city,          setCity]          = useState('');
  const [state,         setState]         = useState('');
```

- [ ] **Step 3: Add city/state to the Firestore payload**

In the `handleSubmit` function (line 393-401), add `city` and `state` to the payload object:

```typescript
      const payload: Record<string, unknown> = {
        name:                   name.trim(),
        irdaiLicence:           irdai.trim().toUpperCase(),
        mobile:                 phone.trim(),
        city:                   city.trim(),
        state:                  state.trim(),
        email,
        accessRequestSubmitted: true,
        updatedAt:              Timestamp.now(),
        ...(referrerUid ? { referredBy: referrerUid } : {}),
      };
```

- [ ] **Step 4: Add the input fields to the form UI**

Find the phone input field in the JSX (search for the `onChange` that calls `setPhone`). After the phone input's parent `<div>`, add:

```typescript
        {/* City */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-2">
            City <span className="text-[#C3C9D4]">(Optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Mumbai"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl text-sm font-medium border border-[#E2E6EA] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 outline-none transition-all"
            style={{ background: '#FAFBFC' }}
          />
        </div>

        {/* State */}
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-2">
            State <span className="text-[#C3C9D4]">(Optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Maharashtra"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl text-sm font-medium border border-[#E2E6EA] focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 outline-none transition-all"
            style={{ background: '#FAFBFC' }}
          />
        </div>
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/app/access-request/page.tsx src/stores/profile-store.ts
git commit -m "feat(access-request): add city and state fields to form and profile defaults"
```

---

### Task 9: Extend admin types and data fetching

**Files:**
- Modify: `src/components/admin/types.ts`
- Modify: `src/components/admin/hooks/useAdminData.ts:57-71`

- [ ] **Step 1: Extend `SurveyorAdminProfile` type**

In `src/components/admin/types.ts`, add these fields to the `SurveyorAdminProfile` interface (after `lastPaymentDate?: string;` on line 17):

```typescript
  // Detail card fields — visible when row is expanded
  mobile?: string;
  irdaiLicence?: string;
  city?: string;
  state?: string;
  qualifications?: string;
  referralCode?: string;
  referredBy?: string | null;
  createdAt?: unknown;
```

- [ ] **Step 2: Extend `NewSignup` type**

In the same file, add these fields to the `NewSignup` interface (after `accessRequestSubmitted: boolean;` on line 34):

```typescript
  profileCity: string;
  profileState: string;
```

- [ ] **Step 3: Map new fields in `fetchAllProfiles`**

In `src/components/admin/hooks/useAdminData.ts`, extend the object inside `seen.set(uid, { ... })` (lines 57-71). Add these fields after `lastPaymentDate`:

```typescript
          // Detail card fields
          mobile: data.mobile || '',
          irdaiLicence: data.irdaiLicence || '',
          city: data.city || '',
          state: data.state || '',
          qualifications: data.qualifications || '',
          referralCode: data.referralCode || '',
          referredBy: data.referredBy ?? null,
          createdAt: data.createdAt || null,
```

- [ ] **Step 4: Map new fields in `fetchSignups` enrichment**

In the same file, in `fetchSignups` (lines 98-113), add city/state to the `results.push` object:

```typescript
          // Enriched city/state
          profileCity: profile?.city || '',
          profileState: profile?.state || '',
```

Add these after the `accessRequestSubmitted` field.

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/types.ts src/components/admin/hooks/useAdminData.ts
git commit -m "feat(admin): extend types and data fetching for detail card fields"
```

---

### Task 10: Add expandable detail row to SurveyorsTab

**Files:**
- Modify: `src/components/admin/tabs/SurveyorsTab.tsx`

- [ ] **Step 1: Add expand state and imports**

Add these imports to the existing `lucide-react` import in `src/components/admin/tabs/SurveyorsTab.tsx`:

```typescript
import { Phone, MapPin, Award, ChevronDown, ChevronRight, Link2 } from 'lucide-react';
```

Merge with existing imports — don't duplicate. Inside the `SurveyorsTab` component (after `const [activeFilter, setActiveFilter]` on line 108), add:

```typescript
  const [expandedId, setExpandedId] = useState<string | null>(null);
```

- [ ] **Step 2: Make rows clickable and add detail card**

Replace the `<tr key={surveyor.id} ...>` opening tag (line 178) to add click handler:

```typescript
                <tr
                  key={surveyor.id}
                  className={`hover:bg-[#FAFBFC] transition-colors group cursor-pointer ${rowBg}`}
                  onClick={() => setExpandedId(prev => prev === surveyor.id ? null : surveyor.id)}
                >
```

After the closing `</tr>` of each surveyor row (after line 307), add the expandable detail row:

```typescript
                {expandedId === surveyor.id && (
                  <tr>
                    <td colSpan={7} className="px-6 py-0">
                      <div
                        className="py-5 px-6 mb-4 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200"
                        style={{ background: '#FAFBFC', borderTop: '2px dashed #E2E6EA' }}
                      >
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Email</div>
                            {surveyor.email && surveyor.email !== 'N/A' ? (
                              <a href={`mailto:${surveyor.email}`} className="text-xs font-medium text-[#D4AF37] hover:underline">
                                {surveyor.email}
                              </a>
                            ) : (
                              <span className="text-xs text-[#C3C9D4]">—</span>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Mobile</div>
                            {surveyor.mobile ? (
                              <a href={`tel:${surveyor.mobile}`} className="text-xs font-medium text-[#0D1B2A] hover:underline flex items-center gap-1">
                                <Phone size={10} className="text-[#8D99AE]" />
                                {surveyor.mobile}
                              </a>
                            ) : (
                              <span className="text-xs text-[#C3C9D4]">—</span>
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">IRDAI Licence</div>
                            <span className="text-xs font-medium text-[#0D1B2A]">
                              {surveyor.irdaiLicence || <span className="text-[#C3C9D4]">—</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">City</div>
                            <span className="text-xs font-medium text-[#0D1B2A] flex items-center gap-1">
                              {surveyor.city ? (
                                <><MapPin size={10} className="text-[#8D99AE]" /> {surveyor.city}</>
                              ) : (
                                <span className="text-[#C3C9D4]">—</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">State</div>
                            <span className="text-xs font-medium text-[#0D1B2A]">
                              {surveyor.state || <span className="text-[#C3C9D4]">—</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Qualifications</div>
                            <span className="text-xs font-medium text-[#0D1B2A] flex items-center gap-1">
                              {surveyor.qualifications ? (
                                <><Award size={10} className="text-[#8D99AE]" /> {surveyor.qualifications}</>
                              ) : (
                                <span className="text-[#C3C9D4]">—</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Referral Code</div>
                            <span className="text-xs font-mono font-medium text-[#0D1B2A] flex items-center gap-1">
                              {surveyor.referralCode ? (
                                <><Link2 size={10} className="text-[#8D99AE]" /> {surveyor.referralCode}</>
                              ) : (
                                <span className="text-[#C3C9D4]">—</span>
                              )}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Referred By</div>
                            <span className="text-xs font-mono font-medium text-[#0D1B2A]">
                              {surveyor.referredBy || <span className="text-[#C3C9D4]">—</span>}
                            </span>
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-[#8D99AE] mb-1">Join Date</div>
                            <span className="text-xs font-medium text-[#0D1B2A]">
                              {surveyor.createdAt && typeof surveyor.createdAt === 'object' && 'toDate' in (surveyor.createdAt as any)
                                ? (surveyor.createdAt as any).toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                : surveyor.createdAt
                                ? String(surveyor.createdAt)
                                : <span className="text-[#C3C9D4]">—</span>
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
```

- [ ] **Step 3: Add expand indicator to the first column**

In the surveyor name cell (line 180-201), add a chevron indicator before the avatar. Replace the avatar `<div>`:

```typescript
                      <div className="flex items-center gap-1">
                        {expandedId === surveyor.id
                          ? <ChevronDown size={12} className="text-[#8D99AE] flex-shrink-0" />
                          : <ChevronRight size={12} className="text-[#8D99AE] flex-shrink-0" />
                        }
                        <div className="w-10 h-10 rounded-xl bg-[#F0F2F5] flex items-center justify-center font-bold text-[#0D1B2A] text-lg">
                          {surveyor.name.charAt(0)}
                        </div>
                      </div>
```

- [ ] **Step 4: Prevent row click from triggering on input interactions**

Add `onClick={e => e.stopPropagation()}` to the editable inputs in the row (name input, surveyorId input, expiry date input) so clicking them doesn't toggle the expand:

On the name `<input>` (line 186-191), add:
```typescript
onClick={e => e.stopPropagation()}
```

On the Platform ID `<input>` (line 205-211), add:
```typescript
onClick={e => e.stopPropagation()}
```

On the expiry date `<input>` (line 253-258), add:
```typescript
onClick={e => e.stopPropagation()}
```

On the Actions `<td>` container div (line 263), add:
```typescript
onClick={e => e.stopPropagation()}
```

- [ ] **Step 5: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/tabs/SurveyorsTab.tsx
git commit -m "feat(admin): add expandable detail row showing all surveyor info"
```

---

### Task 11: Show city/state in ApprovalQueueTab

**Files:**
- Modify: `src/components/admin/tabs/ApprovalQueueTab.tsx`

- [ ] **Step 1: Add City/State column header**

In the `<thead>` section (line 154-159), add a new `<th>` after the Phone column:

```typescript
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-wider text-[#8D99AE]">Location</th>
```

- [ ] **Step 2: Add City/State cell to SignupRow**

In the `SignupRow` component, after the phone `<td>` (after line 66), add:

```typescript
      <td className="px-6 py-5">
        <div className="text-sm font-medium text-[#0D1B2A]">
          {signup.profileCity && signup.profileState
            ? `${signup.profileCity}, ${signup.profileState}`
            : signup.profileCity || signup.profileState || '—'}
        </div>
      </td>
```

- [ ] **Step 3: Update the actions td colSpan if needed**

The table now has 6 columns. Verify all `<td>` counts match (User, IRDAI, Phone, Location, Submitted, Actions = 6 columns, 6 `<th>` headers). If the "no signups" empty state has a `colSpan`, update it too.

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/tabs/ApprovalQueueTab.tsx
git commit -m "feat(admin): show city/state location in approval queue"
```

---

### Task 12: Full build verification and smoke test

**Files:**
- No file changes — verification only

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Build the project**

Run: `npm run build`
Expected: Build succeeds with populated `out/` directory

- [ ] **Step 3: Commit any build fixes if needed**

If the build revealed issues, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve build issues from drive features + admin visibility"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Feature 1: `deleteFile` (Task 1) + `DuplicateUploadDialog` (Task 2) + `uploadWithDuplicateCheck` (Task 3) + wired into DocumentsTab (Task 4)
- ✅ Feature 2: IDB cache (Task 5) + `useClaimDriveFiles` hook (Task 6) + UI in DocumentsTab (Task 7)
- ✅ Feature 3: City/state form + defaults (Task 8) + admin types + data fetch (Task 9) + expandable row (Task 10) + approval queue (Task 11)
- ✅ Admin visibility: all collected fields shown in expandable detail card

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**Type consistency:**
- `DriveFileCacheEntry` in indexeddb.ts matches `{ id, name, mimeType }` returned by `listFilesInFolder`
- `DuplicateAction` type used consistently in upload-with-check.ts and DocumentsTab
- `SurveyorAdminProfile` extensions match the fields mapped in `useAdminData.ts`
- `NewSignup.profileCity`/`profileState` match what's mapped in `fetchSignups`
