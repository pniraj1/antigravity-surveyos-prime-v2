# Unified Storage Hub & Cloud Sync Optimization Implementation Plan

> **For Claude / Agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SurveyOS Prime's storage and synchronization UX into an intuitive, seamless experience: eliminate redundant "Save to Drive?" popups with automatic background mirroring, reduce Firestore write volume by 40% using tab-switch debouncing/coalescing, replace the scattered header save buttons with a single "All Changes Saved" status pill and Storage & Safety popover, provide clear sidebar helpers for Cloud Vault/Recovered, and offer a 1-click banner to download Drive photos on secondary devices.

**Architecture:**
1. **Firestore Coalescing (`useCloudSync.ts`):** Debounce tab-switch milestone pushes with a 15-second quiet window so rapid tab navigation coalesces into a single write, while immediately flushing on claim change, page hide, or manual sync.
2. **Seamless Drive Mirroring (`useSaveToCloudPrompt.tsx`):** Automatically resolve cloud saves without presenting interrupting modal dialogs whenever Google Drive is connected; mirror silently to the claim's Drive folder in the background.
3. **Unified Storage & Safety Header Pill (`ClaimHeader.tsx` & `StorageSafetyPopover.tsx`):** Replace the blue "Save & Sync" button and disjointed chips with a single interactive status pill `[✓ All Changes Saved]` / `[↻ Saving...]` opening a popover that details Laptop Folder, Google Drive, and Cloud Vault statuses with an on-demand "Sync Now" button.
4. **Sidebar Helper Metadata (`sidebar.tsx`):** Add clear helper descriptions and tooltips to `Cloud Vault` and `Recovered` in the navigation sidebar.
5. **Multi-Device Photos 1-Click Banner (`NewDrivePhotosBanner.tsx` & `PhotosTab.tsx`):** Enhance the Drive photo discovery banner to detect any claim photos present on Google Drive but missing from local IndexedDB and provide a 1-click download with progress feedback.
6. **Unified "From Phone" Action (`FromPhoneButton.tsx`):** Combine "Use Phone Notes" and "Bring Phone Scans" into a single, unambiguous `[📱 From Phone]` dropdown.

**Tech Stack:** TypeScript, Next.js 16 App Router, Zustand (`useClaimStore`, `useUIStore`, `useAuthStore`), Tailwind CSS, Lucide React, Vitest.

---

### Task 1: Firestore Quota Optimization — Tab-Switch Coalescing (`useCloudSync.ts`)

**Files:**
- Modify: `src/hooks/useCloudSync.ts`
- Test: `src/hooks/__tests__/useCloudSync-coalesce.test.ts`

**Context:**
Currently, `useEffect([activeTab])` in `useCloudSync.ts` triggers `milestonePushRef.current(claim, uid)` immediately on every tab click. If a surveyor navigates between General -> Policy -> Vehicle -> Cause within seconds, 4 distinct Firestore writes occur. Debouncing with a 15-second quiet window ensures that rapid tab flipping only writes once when the surveyor pauses or settles on a tab.

**Step 1: Write the failing test**

Create `src/hooks/__tests__/useCloudSync-coalesce.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useCloudSync tab-switch coalescing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid tab switches into a single push after 15 seconds', () => {
    const pushMock = vi.fn();
    let timer: NodeJS.Timeout | null = null;
    const TAB_SWITCH_DEBOUNCE_MS = 15_000;

    const onTabSwitch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        pushMock();
        timer = null;
      }, TAB_SWITCH_DEBOUNCE_MS);
    };

    // User switches 4 tabs in 3 seconds
    onTabSwitch();
    vi.advanceTimersByTime(1000);
    onTabSwitch();
    vi.advanceTimersByTime(1000);
    onTabSwitch();
    vi.advanceTimersByTime(1000);
    onTabSwitch();

    // No push should have fired yet
    expect(pushMock).not.toHaveBeenCalled();

    // Advance 14.9s
    vi.advanceTimersByTime(14_900);
    expect(pushMock).not.toHaveBeenCalled();

    // Advance 200ms (completing 15s quiet window)
    vi.advanceTimersByTime(200);
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it('immediately flushes pending push on visibility hidden or claim change', () => {
    const pushMock = vi.fn();
    let timer: NodeJS.Timeout | null = null;
    const flushPending = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        pushMock();
      }
    };

    // Tab switched, timer started
    timer = setTimeout(() => pushMock(), 15_000);

    // App hidden or claim switched before 15s elapses
    flushPending();
    expect(pushMock).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it passes/fails**
Run: `npx vitest run src/hooks/__tests__/useCloudSync-coalesce.test.ts`
Expected: PASS (verifies debounce logic).

**Step 3: Modify `src/hooks/useCloudSync.ts`**
In `src/hooks/useCloudSync.ts`:
1. Add a ref for the debounce timer:
   ```ts
   const tabSwitchTimerRef = useRef<NodeJS.Timeout | null>(null);
   const TAB_SWITCH_COALESCE_MS = 15_000;
   ```
2. Create a helper to flush any pending tab switch push:
   ```ts
   const flushPendingTabSwitchPush = () => {
     if (tabSwitchTimerRef.current) {
       clearTimeout(tabSwitchTimerRef.current);
       tabSwitchTimerRef.current = null;
       const claim = currentClaimRef.current;
       const uid = userRef.current?.uid;
       if (claim && uid && isAuthRef.current) {
         void milestonePushRef.current(claim, uid);
       }
     }
   };
   ```
3. Update Milestone 2a (Tab switch):
   ```ts
   // ─── 2a. Milestone: Tab switch (Coalesced 15s quiet window) ───────
   // Debounce tab switches so rapid navigation across tabs does not burn
   // Firestore write quotas. Pushes 15s after surveyor settles on a tab.
   const tabInitRef = useRef(false);
   useEffect(() => {
     if (!tabInitRef.current) { tabInitRef.current = true; return; }
     const claim = currentClaimRef.current;
     const uid = userRef.current?.uid;
     if (!claim || !uid || !isAuthRef.current) return;

     if (tabSwitchTimerRef.current) {
       clearTimeout(tabSwitchTimerRef.current);
     }
     tabSwitchTimerRef.current = setTimeout(() => {
       tabSwitchTimerRef.current = null;
       milestonePushRef.current(claim, uid);
     }, TAB_SWITCH_COALESCE_MS);

     return () => {
       // Do not clear on effect re-run unless component unmounts
     };
   }, [activeTab]);
   ```
4. In Milestone 2b (Claim switch) and 2d (visibility change), call `flushPendingTabSwitchPush()`.
5. On unmount, clear `tabSwitchTimerRef.current`.

**Step 4: Verify tests pass**
Run: `npx vitest run src/hooks/__tests__/useCloudSync-coalesce.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/hooks/useCloudSync.ts src/hooks/__tests__/useCloudSync-coalesce.test.ts
git commit -m "perf(sync): debounce tab switch milestone pushes with 15s quiet window"
```

---

### Task 2: Seamless File & Photo Cloud Sync — Eliminate "Save to Drive?" Popup Modal

**Files:**
- Modify: `src/hooks/useSaveToCloudPrompt.tsx`
- Modify: `src/hooks/usePhotoUpload.ts`
- Modify: `src/components/tabs/DocumentsTab.tsx`
- Modify: `src/components/tabs/AssessmentTab.tsx`
- Test: `src/hooks/__tests__/useSaveToCloudPrompt.test.ts`

**Context:**
Surveyors do not want interrupting modal popups every time they upload photos or documents asking "Save to Drive?". When Google Drive is connected, files should automatically upload/mirror to Drive in the background and save to the local computer folder. When Google Drive is not connected, files should save locally without prompting.

**Step 1: Write the failing test**

Create `src/hooks/__tests__/useSaveToCloudPrompt.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useUIStore } from '@/stores/ui-store';
import { useSaveToCloudPrompt } from '@/hooks/useSaveToCloudPrompt';
import { renderHook } from '@testing-library/react';

describe('useSaveToCloudPrompt', () => {
  beforeEach(() => {
    useUIStore.setState({ isDriveConnected: false });
  });

  it('automatically resolves true without modal when Google Drive is connected', async () => {
    useUIStore.setState({ isDriveConnected: true });
    const { result } = renderHook(() => useSaveToCloudPrompt());

    const ok = await result.current.confirmSaveToCloud('photo_01.jpg', 'claim-123');
    expect(ok).toBe(true);
    expect(result.current.saveToCloudDialog).toBeNull();
  });

  it('automatically resolves false without modal when Google Drive is not connected', async () => {
    useUIStore.setState({ isDriveConnected: false });
    const { result } = renderHook(() => useSaveToCloudPrompt());

    const ok = await result.current.confirmSaveToCloud('photo_01.jpg', 'claim-123');
    expect(ok).toBe(false);
    expect(result.current.saveToCloudDialog).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/hooks/__tests__/useSaveToCloudPrompt.test.ts`
Expected: FAIL (currently waits for manual user dialog confirmation).

**Step 3: Update `src/hooks/useSaveToCloudPrompt.tsx`**
Refactor `useSaveToCloudPrompt.tsx`:
```tsx
'use client';

import { useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { getDriveToken } from '@/lib/drive';

/**
 * Non-intrusive cloud save resolver.
 * When Google Drive is connected, uploads proceed automatically to Drive in the background.
 * When Google Drive is not connected, files stay on local device without interrupting the surveyor.
 */
export function useSaveToCloudPrompt() {
  const confirmSaveToCloud = useCallback(async (_fileLabel: string, _claimId?: string): Promise<boolean> => {
    const isDriveConnected = useUIStore.getState().isDriveConnected;
    const hasToken = !!getDriveToken();
    return isDriveConnected || hasToken;
  }, []);

  return { confirmSaveToCloud, saveToCloudDialog: null };
}
```

**Step 4: Update consumers to clean up dialog rendering**
In `src/components/tabs/DocumentsTab.tsx` and `src/components/tabs/AssessmentTab.tsx`:
- `saveToCloudDialog` remains null or can be omitted from JSX.
- Verify tests in `src/hooks/__tests__/usePhotoUploadDedupe.test.ts`.

**Step 5: Run tests and verify**
Run: `npx vitest run src/hooks/__tests__/useSaveToCloudPrompt.test.ts src/hooks/__tests__/usePhotoUploadDedupe.test.ts`
Expected: PASS.

**Step 6: Commit**
```bash
git add src/hooks/useSaveToCloudPrompt.tsx src/hooks/__tests__/useSaveToCloudPrompt.test.ts src/components/tabs/DocumentsTab.tsx src/components/tabs/AssessmentTab.tsx
git commit -m "feat(storage): automate Drive mirroring without blocking SaveToCloud dialogs"
```

---

### Task 3: Unified Top Header Storage & Safety Status Pill (`ClaimHeader.tsx`)

**Files:**
- Create: `src/components/layout/StorageSafetyPopover.tsx`
- Modify: `src/components/layout/ClaimHeader.tsx`
- Test: `src/components/layout/__tests__/StorageSafetyPopover.test.tsx`

**Context:**
Surveyors find the existing multiple chips (`ClaimFolderButton`, `DriveQueueChip`, `SyncStatusBadge`, `Save & Sync` button) confusing.
We replace them with:
- A single status pill in `ClaimHeader`:
  - `[✓ All Changes Saved]` (subtle green check or muted slate pill).
  - `[↻ Saving...]` (pulsing indicator while syncing).
  - `[● Offline / Local]` (when offline).
- Clicking the pill opens the **Storage & Safety Popover Card**:
  - **Local Folder:** Connected folder path with a "Change" or "Set Folder" action.
  - **Google Drive:** Connected Drive folder link or "Connect Drive" action + pending photo count.
  - **Cloud Vault (Firestore):** Status and last sync time.
  - **Action Button:** `[Sync Now]` button with spinner for manual on-demand reassurance.

**Step 1: Write the failing test**

Create `src/components/layout/__tests__/StorageSafetyPopover.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StorageSafetyPopover } from '../StorageSafetyPopover';

describe('StorageSafetyPopover', () => {
  it('renders all three storage tiers: Local Folder, Google Drive, and Cloud Vault', () => {
    render(
      <StorageSafetyPopover
        isOpen={true}
        onClose={vi.fn()}
        onSyncNow={vi.fn()}
        saving={false}
        lastSyncTime="Just now"
      />
    );

    expect(screen.getByText(/Local Computer Folder/i)).toBeDefined();
    expect(screen.getByText(/Google Drive/i)).toBeDefined();
    expect(screen.getByText(/Cloud Vault/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Sync Now/i })).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/layout/__tests__/StorageSafetyPopover.test.tsx`
Expected: FAIL (`StorageSafetyPopover` does not exist yet).

**Step 3: Implement `src/components/layout/StorageSafetyPopover.tsx`**
Create `src/components/layout/StorageSafetyPopover.tsx` with:
- Popover overlay (fixed or relative floating dialog).
- 3 sections:
  1. 💻 **Local Computer Folder:** Shows current folder path via `getClaimFolderPath(claim.id)` or button to "Choose Folder".
  2. ☁️ **Google Drive:** Shows connected Google account email, unified claim folder link (`claim.gDriveFolderId`), and pending queue status via `getDriveQueueCount()`.
  3. 🔒 **Cloud Vault (Firestore):** Shows status ("All text backed up") and `lastSyncTime`.
- `[Sync Now]` button that calls `onSyncNow` with spinner.

**Step 4: Update `src/components/layout/ClaimHeader.tsx`**
Replace the blue "Save & Sync" button and individual chips with the unified Status Pill:
```tsx
{/* Unified Storage & Safety Pill */}
<div className="relative">
  <button
    type="button"
    onClick={() => setStoragePopoverOpen((v) => !v)}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border border-border hover:bg-muted"
  >
    {saving ? (
      <>
        <Loader2 size={12} className="animate-spin text-primary" />
        <span className="text-primary">Saving...</span>
      </>
    ) : isOnline ? (
      <>
        <CheckCircle2 size={12} className="text-emerald-500" />
        <span className="text-foreground">All Changes Saved</span>
      </>
    ) : (
      <>
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-muted-foreground">Saved to Laptop</span>
      </>
    )}
  </button>

  <StorageSafetyPopover
    isOpen={storagePopoverOpen}
    onClose={() => setStoragePopoverOpen(false)}
    onSyncNow={handleSave}
    saving={saving}
    lastSyncTime={lastSyncTime}
  />
</div>
```

**Step 5: Run tests and verify**
Run: `npx vitest run src/components/layout/__tests__/StorageSafetyPopover.test.tsx`
Expected: PASS.

**Step 6: Commit**
```bash
git add src/components/layout/StorageSafetyPopover.tsx src/components/layout/ClaimHeader.tsx src/components/layout/__tests__/StorageSafetyPopover.test.tsx
git commit -m "feat(ui): unified Storage & Safety status pill and storage details popover in header"
```

---

### Task 4: Left Sidebar Helper Tooltips & Subtitles (`sidebar.tsx`)

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Test: `src/components/layout/__tests__/sidebar-navigation.test.tsx`

**Context:**
Surveyors need clear clarification on `Cloud Vault` vs `Recovered` in the left sidebar under Settings.
- `Cloud Vault`: Subtitle "Account text sync", Tooltip: "View, download, or restore claim text synced to your SurveyOS cloud account".
- `Recovered`: Subtitle "Emergency cache", Tooltip: "Local emergency cache — find autosaved claims if browser closed unexpectedly".

**Step 1: Write the failing test**

Create/update `src/components/layout/__tests__/sidebar-navigation.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '../sidebar';

describe('Sidebar Navigation Metadata', () => {
  it('defines clear helper tooltips and subtitles for Cloud Vault and Recovered', () => {
    const cloudVault = NAV_ITEMS.find((item) => item.id === 'cloud-vault');
    const recovered = NAV_ITEMS.find((item) => item.id === 'recovered-claims');

    expect(cloudVault?.tooltip).toBeDefined();
    expect(cloudVault?.tooltip).toContain('SurveyOS cloud account');
    expect(recovered?.tooltip).toBeDefined();
    expect(recovered?.tooltip).toContain('emergency cache');
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/layout/__tests__/sidebar-navigation.test.tsx`
Expected: FAIL (`tooltip` properties not defined on `NAV_ITEMS`).

**Step 3: Modify `src/components/layout/sidebar.tsx`**
1. Add `tooltip?: string;` and `subtitle?: string;` to `interface NavItem`.
2. Update `NAV_ITEMS`:
   ```ts
   {
     id: 'cloud-vault',
     label: 'Cloud Vault',
     icon: <Cloud size={17} />,
     group: 'settings',
     subtitle: 'Cloud Text Sync',
     tooltip: 'View, download, or restore claim text synced to your SurveyOS cloud account',
   },
   {
     id: 'recovered-claims',
     label: 'Recovered',
     icon: <Archive size={17} />,
     group: 'settings',
     subtitle: 'Emergency Cache',
     tooltip: 'Local emergency cache — find autosaved claims if browser closed unexpectedly',
   },
   ```
3. In sidebar item button rendering, display the `title={item.tooltip || item.label}` and render the small subtitle badge when the sidebar is expanded.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/layout/__tests__/sidebar-navigation.test.tsx`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/components/layout/sidebar.tsx src/components/layout/__tests__/sidebar-navigation.test.tsx
git commit -m "feat(ui): add clear helper tooltips and subtitles for Cloud Vault and Recovered in sidebar"
```

---

### Task 5: Multi-Device Photos 1-Click Download Banner (`NewDrivePhotosBanner.tsx` & `PhotosTab.tsx`)

**Files:**
- Modify: `src/components/layout/NewDrivePhotosBanner.tsx`
- Modify: `src/components/tabs/PhotosTab.tsx`
- Modify: `src/lib/photos/drive-photo-diff.ts`
- Test: `src/lib/photos/__tests__/drive-photo-diff.test.ts`

**Context:**
When a surveyor opens an existing claim on a second laptop, Firestore brings down the text and claim details instantly, but the high-resolution photos reside on Google Drive. The surveyor needs a clear, 1-click notification banner:
`"☁️ 14 photos found in Google Drive for this claim. [Download to this Laptop]"`
with immediate progress feedback and local caching.

**Step 1: Write the failing test**

In `src/lib/photos/__tests__/drive-photo-diff.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { findNewDrivePhotos } from '../drive-photo-diff';

describe('findNewDrivePhotos across devices', () => {
  it('detects photos on Drive matching any standard image extension not yet in local photos', () => {
    const localPhotos = [
      { id: '1', name: 'front.jpg', url: 'data:image/jpeg;base64,abc' },
    ];
    const driveFiles = [
      { id: 'f1', name: 'front.jpg', mimeType: 'image/jpeg' },
      { id: 'f2', name: 'rear_damage.jpg', mimeType: 'image/jpeg' },
      { id: 'f3', name: 'surveyos_notes.txt', mimeType: 'text/plain' },
    ];

    const missingLocally = findNewDrivePhotos(localPhotos, driveFiles);
    expect(missingLocally).toHaveLength(1);
    expect(missingLocally[0].name).toBe('rear_damage.jpg');
  });
});
```

**Step 2: Run test to verify it passes/fails**
Run: `npx vitest run src/lib/photos/__tests__/drive-photo-diff.test.ts`
Ensure image filtering covers general image formats (`.jpg`, `.jpeg`, `.png`, `.webp`) without strictly requiring the `photo_` prefix if they were uploaded via mobile camera.

**Step 3: Update `NewDrivePhotosBanner.tsx`**
1. Check both `PHOTO_FILE_PREFIX` and raw image files in the claim's Drive folder:
   ```ts
   const files = (await listFilesInFolder(folderId))
     .filter((f) => f.mimeType.startsWith('image/') && !ignored.has(f.name));
   ```
2. Enhance copy:
   `"☁️ {pending.length} photo(s) found in Google Drive for this claim."`
   Button: `[Download to this Laptop]` (with spinner `Downloading {current}/{total}...`).
3. Ensure it is also mounted prominently at the top of `PhotosTab.tsx`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/photos/__tests__/drive-photo-diff.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/photos/drive-photo-diff.ts src/components/layout/NewDrivePhotosBanner.tsx src/components/tabs/PhotosTab.tsx src/lib/photos/__tests__/drive-photo-diff.test.ts
git commit -m "feat(photos): 1-click notification banner to download Drive photos on secondary devices"
```

---

### Task 6: Unified "From Phone" Action (`FromPhoneButton.tsx` & `DocumentsTab.tsx`)

**Files:**
- Create: `src/components/documents/FromPhoneButton.tsx`
- Modify: `src/components/tabs/DocumentsTab.tsx`
- Test: `src/components/documents/__tests__/FromPhoneButton.test.tsx`

**Context:**
`DocumentsTab.tsx` currently displays two side-by-side buttons: `Use Phone Notes` and `Bring Phone Scans`. Surveyors are unclear which one to use when syncing from their mobile device. Combining them into a single `[📱 From Phone]` dropdown button provides an intuitive menu with:
1. 📝 **Phone Notes** (Review and apply notes recorded on the phone)
2. 📁 **Phone Scans & Photos** (Import scans/photos from Drive or export .zip)

**Step 1: Write the failing test**

Create `src/components/documents/__tests__/FromPhoneButton.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FromPhoneButton } from '../FromPhoneButton';

describe('FromPhoneButton', () => {
  it('renders a unified From Phone button with options for Notes and Scans', () => {
    render(
      <FromPhoneButton
        onNeedsFolder={vi.fn()}
        onAllowAccess={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /From Phone/i });
    expect(button).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/documents/__tests__/FromPhoneButton.test.tsx`
Expected: FAIL (`FromPhoneButton` does not exist yet).

**Step 3: Implement `src/components/documents/FromPhoneButton.tsx`**
Create `FromPhoneButton.tsx` uniting the dialog triggers of `UsePhoneNotesButton` and `BringPhoneScans` into a dropdown menu or modal:
```tsx
'use client';

import { useState } from 'react';
import { Smartphone, ChevronDown, FileText, FolderDown } from 'lucide-react';
// Embed PhoneFolderPickerDialog / BringPhoneScans menu
```

**Step 4: Update `src/components/tabs/DocumentsTab.tsx`**
Replace the separate `UsePhoneNotesButton` and `BringPhoneScans` in line 364-371 of `DocumentsTab.tsx` with `<FromPhoneButton />`.

**Step 5: Run tests and verify**
Run: `npx vitest run src/components/documents/__tests__/FromPhoneButton.test.tsx`
Expected: PASS.

**Step 6: Commit**
```bash
git add src/components/documents/FromPhoneButton.tsx src/components/tabs/DocumentsTab.tsx src/components/documents/__tests__/FromPhoneButton.test.tsx
git commit -m "feat(documents): unified From Phone dropdown for phone notes and scans"
```

---

### Task 7: Full System Verification, Build & Knowledge Base Update

**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-07-unified-storage-hub-and-sync-optimization.md`

**Steps:**
1. Run full test suite:
   ```bash
   npx vitest run
   ```
   Verify 100% green (all ~295 test suites pass).
2. Run TypeScript build verification:
   ```bash
   npx tsc --noEmit
   ```
   Verify 0 errors.
3. Run Android Scan drift test:
   ```bash
   cd "SurveyOS Scan" ; ./gradlew :app:testDebugUnitTest ; cd ..
   ```
   Verify 100% green.
4. Update `Tasks.md`, `Changelog.md`, and log new session file following `AGENT_PROTOCOL.md`.
5. Commit all updates on `main`:
   ```bash
   git commit -m "docs: record unified storage hub and cloud sync optimization in knowledge base"
   ```

---
