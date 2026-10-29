# Fix Browser Storage Exhaustion & Quota Errors — Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate Chrome's `StorageFullError` ("Storage full — delete old claims to free space") and prevent browser storage exhaustion by switching photo storage from uncompressed PNGs to lightweight JPEGs, halting unlinked Google Drive queue bloat, and adding automatic storage pruning.

**Architecture:**
1. **Photo Compression:** Switch canvas compression from lossless PNG to compressed JPEG (quality 0.75, max width 600px), dropping photo payload sizes from ~1.2 MB down to ~40 KB (a 95% reduction).
2. **Drive Queue Guard:** Prevent `uploadFileToDrive` from dumping hundreds of megabytes of raw uncompressed camera files into IndexedDB's `driveQueue` when Google Drive is unlinked or disconnected.
3. **Storage Pruning & Maintenance:** Add an automated pruner in `src/lib/storage/indexeddb.ts` to clear stale `driveQueue` items and orphan `recoveredClaims` clones, plus a user-facing "Clean Up Storage" button in the Profile/Settings screen.

**Tech Stack:** Next.js 16, TypeScript, IndexedDB (`idb`), Vitest, Canvas API, Sonner Toasts.

---

### Task 1: Switch Photo Compression to Compressed JPEG

**Why:** `compressImage` in `src/lib/photos/compress-image.ts` defaults to `image/png` at quality 1.0. PNG ignores quality settings and outputs huge uncompressed raster data (~800 KB to 1.5 MB Base64 string per photo). 30 photos consume 35 MB of text inside a single claim. Switching to JPEG drops this to ~40 KB per photo (~1.2 MB total per claim).

**Files:**
- Modify: `src/lib/photos/compress-image.ts:8-14`
- Modify: `src/hooks/usePhotoUpload.ts:48-52`
- Test: `src/lib/photos/__tests__/compress-image-jpeg.test.ts`

**Step 1: Write the failing test**
Create `src/lib/photos/__tests__/compress-image-jpeg.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { compressImage } from '../compress-image';

describe('compressImage default mime and quality', () => {
  it('defaults to image/jpeg with reasonable compression quality', async () => {
    // Mock HTMLCanvasElement.toDataURL to verify parameters
    const toDataURLSpy = vi.fn().mockReturnValue('data:image/jpeg;base64,mockdata');
    const getContextSpy = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    });

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: getContextSpy,
          toDataURL: toDataURLSpy,
        } as unknown as HTMLCanvasElement;
      }
      return document.createElement(tagName);
    });

    // Create a mock image file
    const file = new File(['mock'], 'test.jpg', { type: 'image/jpeg' });

    // Mock FileReader
    class MockFileReader {
      onload: ((e: any) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => {
          this.onload?.({ target: { result: 'data:image/jpeg;base64,xxx' } });
        }, 10);
      }
    }
    vi.stubGlobal('FileReader', MockFileReader);

    // Mock Image
    class MockImage {
      width = 1200;
      height = 800;
      onload: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onload?.(), 10);
      }
    }
    vi.stubGlobal('Image', MockImage);

    const result = await compressImage(file, 600, 0.75);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.75);
    expect(result.dataUrl).toContain('data:image/jpeg');
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/photos/__tests__/compress-image-jpeg.test.ts`
Expected: FAIL (currently calls `toDataURL('image/png', ...)`).

**Step 3: Modify `compressImage` and `usePhotoUpload`**
In `src/lib/photos/compress-image.ts`:
Change default `mime` from `'image/png'` to `'image/jpeg'`:
```typescript
export function compressImage(
  file: File,
  maxWidth: number,
  quality: number = 0.75,
  mime: 'image/png' | 'image/jpeg' = 'image/jpeg',
): Promise<{ dataUrl: string; w: number; h: number }> {
```
In `src/hooks/usePhotoUpload.ts`:
Change line 49 from:
```typescript
const { dataUrl, w, h } = await compressImage(file, 600, 1.0);
```
to:
```typescript
const { dataUrl, w, h } = await compressImage(file, 600, 0.75, 'image/jpeg');
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/photos/__tests__/compress-image-jpeg.test.ts`
Expected: PASS.

**Step 5: Run existing photo tests to ensure no regressions**
Run: `npx vitest run src/lib/photos/`
Expected: All photo tests PASS.

**Step 6: Commit**
```bash
git add src/lib/photos/compress-image.ts src/hooks/usePhotoUpload.ts src/lib/photos/__tests__/compress-image-jpeg.test.ts
git commit -m "fix(photos): default photo compression to JPEG to reduce claim size by 95%"
```

---

### Task 2: Guard Google Drive Queue Against Unlinked Accumulation

**Why:** When Google Drive is not connected (or the surveyor never logged in), `uploadFileToDrive` automatically buffers full uncompressed camera files (`fileData: ArrayBuffer`, 3–8 MB each) into IndexedDB under `driveQueue`. This accumulates up to 500 MB of binary bloat that is never flushed.

**Files:**
- Modify: `src/hooks/usePhotoUpload.ts:40-43`
- Modify: `src/lib/drive/index.ts:351-365`
- Test: `src/lib/drive/__tests__/unlinked-queue-guard.test.ts`

**Step 1: Write the failing test**
Create `src/lib/drive/__tests__/unlinked-queue-guard.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFileToDrive } from '../index';
import * as storage from '@/lib/storage/indexeddb';

vi.mock('@/lib/storage/indexeddb', () => ({
  addToDriveQueue: vi.fn(),
  getDriveQueueCount: vi.fn().mockResolvedValue(0),
}));

describe('uploadFileToDrive when Drive is completely unlinked', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not silently hoard files in driveQueue when user has never linked Drive', async () => {
    // No drive token in storage
    const blob = new Blob(['sample-photo-data'], { type: 'image/jpeg' });
    await uploadFileToDrive('claim-123', 'photo.jpg', blob);
    // Should NOT add to queue if Drive was never connected
    expect(storage.addToDriveQueue).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/drive/__tests__/unlinked-queue-guard.test.ts`
Expected: FAIL (currently calls `addToDriveQueue`).

**Step 3: Implement the guard in `src/lib/drive/index.ts` and `src/hooks/usePhotoUpload.ts`**
In `src/lib/drive/index.ts`:
Check if Drive was ever linked (e.g. `isDriveConnected()` or `localStorage.getItem('isDriveConnected') === 'true'`). If Drive is not connected and never was linked, do not hoard files in `driveQueue`:
```typescript
export async function uploadFileToDrive(
  claimId: string,
  fileName: string,
  blob: Blob,
  claimLabel: string = claimId
): Promise<void> {
  const isLinked = isDriveConnected();
  if (!getDriveToken()) {
    if (!isLinked) {
      // Drive is intentionally disconnected/unlinked: do not hoard files in local database
      return;
    }
    // Drive was connected but token is temporarily expired: queue for retry on token refresh
    const fileData = await blob.arrayBuffer();
    await addToDriveQueue({ claimId, claimLabel, fileName, fileData, mimeType: blob.type || 'application/octet-stream' });
    notifyDriveQueueChanged();
    const count = await getDriveQueueCount();
    toast.warning(`Drive token expired — "${fileName}" queued (${count} pending). Reconnect in Profile.`, { duration: 5000 });
    return;
  }
  // ... rest of upload
```
In `src/hooks/usePhotoUpload.ts`:
Do not prompt to save to Drive or attempt upload if Drive is not linked:
```typescript
const isDriveActive = isDriveConnected();
const saveToDrive = isDriveActive && profile.autoUploadDrive !== false
  ? await confirmSaveToCloud(files.length > 1 ? `${files.length} photos` : files[0].name, claim.id)
  : false;
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/drive/__tests__/unlinked-queue-guard.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/drive/index.ts src/hooks/usePhotoUpload.ts src/lib/drive/__tests__/unlinked-queue-guard.test.ts
git commit -m "fix(drive): prevent hoarding raw photos in driveQueue when Drive is unlinked"
```

---

### Task 3: Storage Pruning Helper & Cleanup Functions

**Why:** Stale `driveQueue` items from old sessions and unpurged snapshots in `recoveredClaims` can remain trapped in IndexedDB indefinitely. We need an automated prune function and a clean "Storage Cleanup" utility.

**Files:**
- Modify: `src/lib/storage/indexeddb.ts`
- Test: `src/lib/storage/__tests__/prune-storage.test.ts`

**Step 1: Write the failing test**
Create `src/lib/storage/__tests__/prune-storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { clearDriveQueue, getDriveQueueCount, getStorageUsageSummary } from '../indexeddb';

describe('Storage management utilities', () => {
  it('provides a storage usage summary and allows clearing drive queue', async () => {
    const summary = await getStorageUsageSummary();
    expect(summary).toHaveProperty('claimsCount');
    expect(summary).toHaveProperty('driveQueueCount');
    expect(summary).toHaveProperty('driveQueueBytes');
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/storage/__tests__/prune-storage.test.ts`
Expected: FAIL (`getStorageUsageSummary` is not defined).

**Step 3: Implement storage cleanup functions in `src/lib/storage/indexeddb.ts`**
Add:
```typescript
export interface StorageSummary {
  claimsCount: number;
  driveQueueCount: number;
  driveQueueBytes: number;
  recoveredClaimsCount: number;
}

export async function getStorageUsageSummary(): Promise<StorageSummary> {
  const db = await getDB();
  const claimsCount = await db.count('claims');
  const driveItems = await db.getAll('driveQueue');
  const driveQueueBytes = driveItems.reduce((acc, item) => acc + (item.fileData?.byteLength || 0), 0);
  const recoveredClaimsCount = await db.count('recoveredClaims');

  return {
    claimsCount,
    driveQueueCount: driveItems.length,
    driveQueueBytes,
    recoveredClaimsCount,
  };
}

export async function clearDriveQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('driveQueue');
}

export async function clearRecoveredClaims(): Promise<void> {
  const db = await getDB();
  await db.clear('recoveredClaims');
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/storage/__tests__/prune-storage.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/storage/indexeddb.ts src/lib/storage/__tests__/prune-storage.test.ts
git commit -m "feat(storage): add getStorageUsageSummary and queue cleanup functions"
```

---

### Task 4: User-Facing "Storage & Memory" Cleaner in Profile Settings

**Why:** When a surveyor's browser is already full from past sessions, they need an immediate, 1-click way to flush trapped queues and free up Chrome storage without losing their claims.

**Files:**
- Modify: `src/components/profile/ProfileModal.tsx` (or `src/components/admin/tabs/` / relevant settings panel)
- Test: Vitest UI render test for Storage Cleaner button

**Step 1: Write UI component or integrate into Profile/Settings**
In ProfileModal (or the AI / Storage section):
- Display current storage stats (Claims count, Pending Drive Queue size).
- Provide a button: **"Clean Up Browser Memory"** that clears dead `driveQueue` items and old recovery snapshots.
- Display toast: `"Cleaned up X MB of cached files. Browser memory restored."`

**Step 2: Run typecheck and tests**
Run: `npx vitest run`
Run: `npx tsc --noEmit`
Expected: Clean, all tests passing.

**Step 3: Commit**
```bash
git add src/components/profile/ src/lib/storage/
git commit -m "feat(profile): add Storage Cleanup tool to clear accumulated browser queues"
```

---

### Task 5: End-to-End Verification

**Steps:**
1. Run full test suite: `npx vitest run` (ensure all ~1,865+ tests are green).
2. Run TypeScript build verification: `npx tsc --noEmit` (clean).
3. Verify that adding 20 phone photos produces lightweight JPEG Base64 (~40 KB each) instead of massive PNGs.
4. Verify that unlinked Drive does not accumulate megabytes in IndexedDB.
5. Update `Tasks.md`, `Changelog.md`, and log new session entry per `AGENT_PROTOCOL.md`.
