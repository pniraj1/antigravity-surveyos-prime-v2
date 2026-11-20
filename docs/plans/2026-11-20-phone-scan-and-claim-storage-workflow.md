# Phone Scans & Claim Storage Workflow Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Create a seamless, zero-jargon phone-to-PC workflow where surveyors click "From Phone", select their vehicle's scan folder with live sync timestamps, choose their local folder for that claim (Choice 2), import notes and scans with zero duplicates, and have all generated reports auto-file into that same folder.

**Architecture:**
1. Content-addressable SHA-256 deduplication in `src/lib/documents/folder.ts` preventing duplicate photo numbering.
2. Rich, plain-language Drive folder inspection in `src/lib/scan-import/drive-notes.ts` and `src/components/documents/PhoneFolderPickerDialog.tsx` exposing real backup timestamps, file counts, and notes readiness without technical jargon.
3. Streamlined `src/components/documents/FromPhoneButton.tsx` eliminating the 3-option modal and directly launching the connected Drive folder selector.
4. Per-claim local folder selection gate (Choice 2) linking the local vehicle directory to the claim handle in `src/lib/storage/claim-folder-store.ts`.
5. Unified auto-filing of all deliverables (Final Report, Bill Check, Fee Bill, Photo Sheet, NIA Excel) into the claim folder via `src/lib/reports/auto-file-report.ts` and Drive backup.

**Tech Stack:** Next.js 16, React 19, TypeScript, File System Access API, Google Drive REST API (`drive.file`), SubtleCrypto (SHA-256), Vitest.

---

### Task 1: SHA-256 Content Deduplication for Multi-File Photos

**Files:**
- Modify: `src/lib/documents/folder.ts:133-163`
- Create: `src/lib/documents/__tests__/folder-photo-dedup.test.ts`

**Step 1: Write the failing test**

Create `src/lib/documents/__tests__/folder-photo-dedup.test.ts` verifying that saving identical photo bytes to a multi-file type (`damagePhotos` or `spotPhotos`) does not create incremented duplicates (`Damage Photos 2.jpg`) and skips already present content.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ClaimData } from '@/types/claim';

const mockFolderStore = vi.hoisted(() => ({
  handles: new Map<string, any>(),
  paths: new Map<string, string>(),
}));

vi.mock('@/lib/storage/claim-folder-store', () => ({
  getClaimFolderHandle: vi.fn(async (id: string) => mockFolderStore.handles.get(id) ?? null),
  getClaimFolderPath: vi.fn(async (id: string) => mockFolderStore.paths.get(id) ?? null),
  verifyHandlePermission: vi.fn(async (handle: any) => handle?.__permissionGranted !== false),
}));

vi.mock('@/lib/local-sync/directory-handle', () => ({
  getStoredRootHandle: vi.fn(async () => null),
  ensureReadWrite: vi.fn(async () => true),
  getDeviceLabel: vi.fn(async () => 'This PC'),
}));

vi.mock('@/lib/storage/indexeddb', () => ({
  getAllClaims: vi.fn(async () => []),
}));

import { writeDocuments } from '../folder';

describe('folder-photo-dedup', () => {
  let mockClaimDir: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const files = new Map<string, { blob: Blob; file: File }>();
    const dirs = new Map<string, any>();

    const createDir = (name: string): any => ({
      kind: 'directory',
      name,
      __permissionGranted: true,
      getDirectoryHandle: vi.fn(async (sub: string, opts?: { create?: boolean }) => {
        let d = dirs.get(sub);
        if (!d && opts?.create) {
          d = createDir(sub);
          dirs.set(sub, d);
        }
        if (!d) throw new Error(`Dir ${sub} not found`);
        return d;
      }),
      getFileHandle: vi.fn(async (fileName: string, opts?: { create?: boolean }) => {
        let f = files.get(fileName);
        if (!f && opts?.create) {
          f = { blob: new Blob([]), file: new File([], fileName) };
          files.set(fileName, f);
        }
        if (!f) throw new Error(`File ${fileName} not found`);
        return {
          kind: 'file',
          name: fileName,
          getFile: vi.fn(async () => f!.file),
          createWritable: vi.fn(async () => ({
            write: vi.fn(async (b: Blob) => {
              f!.blob = b;
              f!.file = new File([b], fileName, { type: b.type });
            }),
            close: vi.fn(async () => {}),
          })),
        };
      }),
      removeEntry: vi.fn(async (entryName: string) => {
        files.delete(entryName);
      }),
    });

    mockClaimDir = createDir('MH12AB1234 - NIA');
    mockFolderStore.handles.set('claim-1', mockClaimDir);
  });

  it('skips saving a photo if exact same SHA-256 hash already exists in claim documents', async () => {
    const claim: ClaimData = {
      id: 'claim-1',
      vehicle: { registrationNumber: 'MH12AB1234' },
      documentsFolder: 'MH12AB1234 - NIA',
      documents: {},
    } as any;

    const photoBlob1 = new Blob(['same-photo-bytes'], { type: 'image/jpeg' });
    const { claim: claimAfterFirst, written: written1 } = await writeDocuments(
      claim,
      'damagePhotos',
      [{ blob: photoBlob1, name: 'photo1.jpg' }],
      'upload'
    );

    expect(written1.length).toBe(1);
    expect(written1[0].relPath).toBe('Damage Photos/Damage Photos 1.jpg');

    // Try saving identical photo bytes again
    const photoBlobDuplicate = new Blob(['same-photo-bytes'], { type: 'image/jpeg' });
    const { written: written2 } = await writeDocuments(
      claimAfterFirst,
      'damagePhotos',
      [{ blob: photoBlobDuplicate, name: 'photo1_duplicate.jpg' }],
      'upload'
    );

    // Should NOT write Damage Photos 2.jpg!
    expect(written2.length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/documents/__tests__/folder-photo-dedup.test.ts`  
Expected: FAIL (`expected written2.length to be 0, received 1` with `Damage Photos 2.jpg` generated).

**Step 3: Implement minimal code in `folder.ts`**

Update `src/lib/documents/folder.ts` in `writeDocuments()`:
Compute SHA-256 for incoming multi-file items and check against existing items of that type:

```typescript
// Hash check for MULTI_FILE_TYPES to prevent duplicate numbering
if (MULTI_FILE_TYPES.has(type)) {
  const existingDocs = existing.filter((d) => d.type === type);
  const existingHashes = new Set<string>();
  for (const doc of existingDocs) {
    if (doc.fingerprints?.['sha256']) {
      existingHashes.add(doc.fingerprints['sha256']);
    } else {
      try {
        const file = await (await getClaimDirHandle(claim, false))
          ?.getDirectoryHandle(DOC_TYPE_LABEL[type])
          .then(async (d) => (await d.getFileHandle(doc.relPath.split('/').pop()!)).getFile());
        if (file) {
          const hash = await sha256(file);
          existingHashes.add(hash);
        }
      } catch {}
    }
  }

  // Filter out files that already exist identically
  const freshInputs: FolderInput[] = [];
  for (const f of files) {
    const h = await sha256(f.blob);
    if (!existingHashes.has(h)) {
      existingHashes.add(h);
      freshInputs.push(f);
    }
  }

  if (freshInputs.length === 0) {
    return { claim, written: [] };
  }
  files = freshInputs;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/documents/__tests__/folder-photo-dedup.test.ts`  
Expected: PASS (0 duplicates written).

**Step 5: Commit**

```bash
git add src/lib/documents/folder.ts src/lib/documents/__tests__/folder-photo-dedup.test.ts
git commit -m "fix(documents): enforce SHA-256 content deduplication on multi-file photo saves"
```

---

### Task 2: Enhance Drive Notes & Folder Inspection with Live Timestamps & Counts

**Files:**
- Modify: `src/lib/scan-import/drive-notes.ts:21-87`
- Create: `src/lib/scan-import/__tests__/drive-notes-inspection.test.ts`

**Step 1: Write the failing test**

Test `listScanDriveFolders` returning enriched surveyor-friendly folder metadata: `itemCount`, `hasNotes`, `hasPhotos`, `lastBackedUpTime` (formatted / relative), and vehicle matching without requiring `_surveyos-scan.json`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listScanDriveFolders } from '../drive-notes';

vi.mock('@/lib/drive', () => ({
  driveRequest: vi.fn(),
  getRootFolder: vi.fn().mockResolvedValue('root-123'),
}));

vi.mock('@/lib/drive/scan-status-sync', () => ({
  phoneScansFolder: vi.fn().mockResolvedValue('phone-scans-id'),
}));

import { driveRequest } from '@/lib/drive';

describe('listScanDriveFolders inspection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists folders with file counts, note availability, and last backed up date', async () => {
    vi.mocked(driveRequest).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          {
            id: 'folder-1',
            name: 'MH12AB1234 - NIA',
            modifiedTime: '2026-11-20T14:30:00.000Z',
            appProperties: { claimId: 'scan-c1' },
          },
        ],
      }),
    } as any);

    const folders = await listScanDriveFolders();
    expect(folders.length).toBe(1);
    expect(folders[0].vehicle).toBe('MH12AB1234');
    expect(folders[0].name).toBe('MH12AB1234 - NIA');
    expect(folders[0].modifiedTime).toBe('2026-11-20T14:30:00.000Z');
  });
});
```

**Step 2: Run test to verify it passes/fails**

Run: `npx vitest run src/lib/scan-import/__tests__/drive-notes-inspection.test.ts`  
Expected: PASS.

**Step 3: Enrich `ScanDriveFolderItem`**

Add `summary` helper in `drive-notes.ts` to inspect file presence:
```typescript
export interface ScanDriveFolderItem {
  id: string;
  name: string;
  vehicle: string;
  modifiedTime?: string;
  scanClaimId?: string;
  fileCount?: number;
  hasNotes?: boolean;
}
```

**Step 4: Commit**

```bash
git add src/lib/scan-import/drive-notes.ts src/lib/scan-import/__tests__/drive-notes-inspection.test.ts
git commit -m "feat(scan-import): enrich Drive scan folders with timestamps and item metadata"
```

---

### Task 3: Streamline `FromPhoneButton.tsx` and Eliminate the 3-Option Modal

**Files:**
- Modify: `src/components/documents/FromPhoneButton.tsx:408-525`
- Modify: `src/components/documents/PhoneFolderPickerDialog.tsx`
- Test: `src/components/documents/__tests__/FromPhoneButton.test.tsx`

**Step 1: Write failing test in `FromPhoneButton.test.tsx`**

Ensure clicking "From Phone" directly opens the Drive folder selector dialog (no 3-option intermediate popup), pre-selecting the active vehicle folder, while providing an offline `.zip` browse fallback at the bottom.

```typescript
it('directly opens the PhoneFolderPickerDialog without intermediate 3-option modal', () => {
  const html = renderToStaticMarkup(<FromPhoneButton initialOpen />);
  expect(html).toContain('Phone Scans &amp; Field Notes');
  expect(html).not.toContain('Choose the zip SurveyOS Scan shared');
  expect(html).not.toContain('From this Computer (.zip)');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/documents/__tests__/FromPhoneButton.test.tsx`  
Expected: FAIL (`expected not to contain "Choose the zip SurveyOS Scan shared"`).

**Step 3: Update `FromPhoneButton.tsx` & `PhoneFolderPickerDialog.tsx`**

- In `FromPhoneButton.tsx`:
  - When `isDriveConnected` is true: clicking "From Phone" directly sets `notesPickerOpen = true` (the `PhoneFolderPickerDialog`).
  - When Drive is disconnected: show clear 1-click "Link Google Drive" with secondary text link "Browse .zip from computer".
- In `PhoneFolderPickerDialog.tsx`:
  - Header: **"Phone Scans & Field Notes"**
  - Displays vehicle card with:
    - 🕒 Last synced: relative time (e.g. "Today, 3:15 PM (5 mins ago)")
    - 📝 Field Notes (Odometer, Driver, Spot remarks)
    - 📸 Inspection Photos & Documents
  - Primary button: **[ Bring Scans & Notes into Claim ]**
  - When clicked: calls `onSelectFolder(folder)`.
  - Also triggers local claim folder selection if not yet connected (Choice 2)!

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/documents/__tests__/FromPhoneButton.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/documents/FromPhoneButton.tsx src/components/documents/PhoneFolderPickerDialog.tsx src/components/documents/__tests__/FromPhoneButton.test.tsx
git commit -m "feat(documents): replace 3-option modal with direct surveyor-friendly Phone Scans dialog"
```

---

### Task 4: Per-Claim Local Folder Selection (Choice 2)

**Files:**
- Modify: `src/lib/storage/claim-folder-store.ts`
- Modify: `src/components/layout/ClaimFolderPromptDialog.tsx`
- Modify: `src/components/tabs/DocumentsTab.tsx`
- Test: `src/components/layout/__tests__/ClaimFolderPromptDialog.test.tsx`

**Step 1: Write test for Per-Claim Folder Selection**

Test that when a surveyor opens a claim with no folder assigned, they can click "Select Claim Folder", choose their desired directory, and have it persistently stored for this claim.

**Step 2: Implementation in `ClaimFolderPromptDialog.tsx`**

Update prompt to:
> 📁 **Select Local Folder for [Vehicle Reg]**  
> *"Choose where all photos, scans, and final reports for this vehicle should be saved on your computer."*  
> Button: **[ Choose Folder on PC ]**

When chosen via `window.showDirectoryPicker()`:
Stores handle in `surveyos_claim_folders` via `storeClaimFolderHandle(claim.id, handle)`.
Sets `claim.documentsFolder` to `handle.name`.

**Step 3: Commit**

```bash
git add src/components/layout/ClaimFolderPromptDialog.tsx src/lib/storage/claim-folder-store.ts
git commit -m "feat(storage): implement Choice 2 per-claim local folder selection"
```

---

### Task 5: Auto-File Generated Reports, Bills, and Photo Sheets into Connected Folder & Drive

**Files:**
- Modify: `src/lib/reports/auto-file-report.ts`
- Modify: `src/components/tabs/report/PrintMenu.tsx`
- Modify: `src/components/tabs/FeesTab.tsx`
- Test: `src/lib/reports/__tests__/auto-file-report.test.ts`

**Step 1: Test Report Auto-Filing**

Verify that `saveReportToClaimFolder` writes the Final Report, Bill Check, Photo Sheet, and Fee Bill to the claim's folder handle and registers it into `claim.documents`.

**Step 2: Implementation**

Ensure that every Print and Download action:
1. Calls `saveReportToClaimFolder(claim, fileName, blob, docType)`.
2. Triggers Drive backup to upload into the connected Drive folder.
3. Shows Sonner toast: `"Saved [Report Name] to vehicle folder: [Folder Name]"`.

**Step 3: Commit**

```bash
git add src/lib/reports/auto-file-report.ts src/components/tabs/report/PrintMenu.tsx src/components/tabs/FeesTab.tsx
git commit -m "feat(reports): auto-file all deliverables into connected vehicle claim folder"
```

---

### Task 6: Full Verification Suite

1. Run vitest: `npx vitest run` (ensure all tests pass 100%).
2. Run typecheck: `npx tsc --noEmit` (ensure 0 errors).
3. Check SurveyOS Scan drift: `cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest` (0 impact).

---
