# Phone Site Capture Implementation Plan (P1–P3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a surveyor capture a whole site survey on a phone — camera, uploads that reach the laptop on their own, an installable app that opens without signal, a Site screen with a still-missing list, and dictated notes that fill fields after review.

**Architecture:** Same Next.js static-export website, no new services. Photos keep flowing phone → surveyor's own Drive → other devices; we add visibility (queue chip) and pick-up (banner). A hand-written service worker caches the app shell. The Site screen is a new additive `AppTab` (`'site'`) built from small pure modules (`site-checklist`, `site-notes`, `visible-nav`) that are unit-tested.

**Tech Stack:** Next.js 16 (static export), React, Zustand, Tailwind, vitest (node env), Google Drive REST, existing `callAIGateway`.

**Spec:** `docs/superpowers/specs/2026-10-02-phone-site-capture-design.md`. This plan covers phases P1–P3. **P4 (phone restyle of form tabs) gets its own plan** once P3 is in surveyors' hands — it is per-tab layout work that needs the real screens on a phone to judge.

## Global Constraints

- Running cost ₹0. **No new npm dependencies.** (`sharp` is used once by an icon script; it is already installed transitively by Next.)
- Do not change report output: no edits to any `src/lib/reports/*`, `src/components/print/*`, or any react-pdf `*Document.tsx`. The only files touched under `src/components/pdf/` are the two `*DownloadButton.tsx` wrappers (Task 5), which change the button, not the PDF.
- `AppTab` ids are a URL contract: add `'site'`, never rename or remove one. Do not edit `src/hooks/useRouteSync.ts`. Do not persist `activeTab`.
- Assessment is surveyor-made only: nothing in this plan writes `assessmentRows` or any amount.
- Phone breakpoint is Tailwind `md` (768 px): phone = `< md`.
- Commit directly on `main`. Commit messages: conventional commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `npx vitest run <path>` (node environment, `@/` → `src/`). Type check: `npx tsc --noEmit` — "no new errors in files this task touched".
- The UI cannot be verified end-to-end here: it is behind Google sign-in + Drive. Each UI task ends with a manual check for the user on a real phone; do not run the dev server as pseudo-verification.

## Spec deviations found while reading the code

1. **Share** is added to the Photo Sheet and Document Annexure PDFs only. The main survey reports are produced by the browser's print dialog, so there is no PDF file to hand to the share sheet; the Insured Report keeps its existing approve-and-download flow.
2. **"Download today's claims" is dropped.** `pullClaimsFromCloud` already writes every claim's full data into IndexedDB on each sync, so any claim synced once on the phone is already available offline. Photos still come via Drive (Task 4).
3. **Site notes review** uses a small dedicated dialog. `AIReviewDialog`'s findings card is typed for estimate rows (`row-check.Finding`), not field conflicts.
4. **Site screen "Document" button** opens the Documents tab (which gets per-card camera buttons in Task 2) instead of re-implementing the slot picker and extraction pipeline on the Site screen.
5. **"Document present"** = `claim.extractedData[slot]` is set. `PhotoItem.tag` values are vehicle angles (`front`, `odometer`, …), not document slots.
6. **Tap-to-call** goes on the Site screen in this plan; Details gets it in the P4 restyle.
7. **Bottom bar** navigates directly; it does not repeat the sidebar's soft "still reading" / "unresolved discrepancies" nudges (extraction state survives tab switches, so nothing is lost).

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/types/assessment.ts` | modify | `PhotoItem.driveName?` |
| `src/types/claim.ts` | modify | `ClaimData.siteNotes?` |
| `src/stores/slices/claimSlice.ts` | modify | `addPhoto(..., driveName?)` |
| `src/lib/photos/cloud-choice-memo.ts` | create | remembers the "save to Drive?" answer per claim |
| `src/hooks/useSaveToCloudPrompt.tsx` | modify | uses the memo when given a claim id |
| `src/hooks/usePhotoUpload.ts` | create | compress + add + upload photos (shared by Photos tab and Site screen) |
| `src/components/tabs/PhotosTab.tsx` | modify | uses the hook; adds Camera button; restore uses the diff |
| `src/components/tabs/DocumentsTab.tsx` | modify | per-card camera button on phones; passes claim id to the prompt |
| `src/lib/drive/queue-events.ts` | create | `surveyos:drive-queue` event |
| `src/lib/drive/index.ts` | modify | fires the event; exports `findClaimFolderId` |
| `src/components/sync/DriveQueueChip.tsx` | create | "N waiting to upload" chip |
| `src/components/layout/ClaimHeader.tsx` | modify | mounts the chip |
| `src/lib/photos/drive-photo-diff.ts` | create | which Drive photos are not on this device |
| `src/lib/photos/download-drive-photos.ts` | create | download + add a list of Drive photos |
| `src/components/layout/NewDrivePhotosBanner.tsx` | create | "N new photos from another device — Add" |
| `src/lib/share/share-pdf.ts` | create | Web Share helpers |
| `src/components/pdf/SharePdfButton.tsx` | create | Share button |
| `src/components/pdf/PhotoSheetDownloadButton.tsx`, `DocumentAnnexureDownloadButton.tsx` | modify | add Share next to Download |
| `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*` | create | installable + offline shell |
| `scripts/make-pwa-icons.mjs` | create | one-off icon generation |
| `src/components/pwa/ServiceWorkerRegistrar.tsx` | create | registers SW, `storage.persist()`, warms tab chunks |
| `src/app/layout.tsx`, `firebase.json` | modify | manifest link, registrar, no-cache headers |
| `src/lib/navigation/visible-nav.ts` | create | survey-type tab visibility (single source) |
| `src/lib/navigation/viewport.ts` | create | `isNarrowViewport()` |
| `src/components/layout/sidebar.tsx` | modify | uses `isNavItemVisible`; Site item |
| `src/lib/site/path.ts` | create | `getAt` / immutable `setAt` |
| `src/lib/site/site-checklist.ts` | create | still-missing / confirm lists |
| `src/lib/site/site-notes.ts` | create | allowed fields, parse, plan, updates |
| `src/lib/ai/prompts.ts` | modify | `buildSiteNotesPrompt` |
| `src/lib/site/read-site-notes.ts` | create | gateway call → plan |
| `src/lib/site/contact-links.ts` | create | Maps / tel links |
| `src/components/site/SiteNotesReviewDialog.tsx` | create | review fills / conflicts / unmapped |
| `src/components/site/SiteChecklistCard.tsx` | create | renders the checklist |
| `src/components/tabs/SiteTab.tsx` | create | the Site screen |
| `src/stores/ui-store.ts` | modify | `'site'` in `AppTab` |
| `src/lib/claims/landing-tab.ts` | modify | phones land on Site |
| `src/components/layout/Dashboard.tsx`, `src/components/dialogs/NewClaimDialog.tsx` | modify | route Site, pass narrow flag, mount banner + bottom bar |
| `src/components/layout/MobileBottomBar.tsx` | create | phone bottom bar |

---

# Phase P1 — Capture and transfer

### Task 1: Camera button, shared photo upload, one Drive prompt per claim

**Files:**
- Modify: `src/types/assessment.ts` (interface `PhotoItem`, ~line 313)
- Modify: `src/stores/slices/claimSlice.ts:53-59` (type) and `:272-284` (impl)
- Create: `src/lib/photos/cloud-choice-memo.ts`
- Create: `src/lib/photos/__tests__/cloud-choice-memo.test.ts`
- Modify: `src/hooks/useSaveToCloudPrompt.tsx`
- Create: `src/hooks/usePhotoUpload.ts`
- Modify: `src/components/tabs/PhotosTab.tsx`

**Interfaces:**
- Produces: `PhotoItem.driveName?: string`; `addPhoto(dataUrl, name, w?, h?, kind?, driveName?)`; `confirmSaveToCloud(fileLabel: string, claimId?: string): Promise<boolean>`; `usePhotoUpload(): { uploadPhotos(files: FileList | File[]): Promise<void>; isProcessing: boolean; saveToCloudDialog: JSX.Element | null }`.

- [ ] **Step 1: Write the failing memo test**

`src/lib/photos/__tests__/cloud-choice-memo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getCloudChoice, rememberCloudChoice, clearCloudChoices } from '../cloud-choice-memo';

describe('cloud choice memo', () => {
  beforeEach(() => clearCloudChoices());

  it('is unknown until answered', () => {
    expect(getCloudChoice('c1')).toBeUndefined();
  });

  it('remembers yes and no per claim', () => {
    rememberCloudChoice('c1', true);
    rememberCloudChoice('c2', false);
    expect(getCloudChoice('c1')).toBe(true);
    expect(getCloudChoice('c2')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run src/lib/photos/__tests__/cloud-choice-memo.test.ts`
Expected: FAIL, cannot resolve `../cloud-choice-memo`.

- [ ] **Step 3: Implement the memo**

`src/lib/photos/cloud-choice-memo.ts`:
```ts
// ponytail: in-memory only — one answer per claim per page session. A reload
// asks again, which is the safe direction for a privacy question.
const choices = new Map<string, boolean>();

export function getCloudChoice(claimId: string): boolean | undefined {
  return choices.get(claimId);
}

export function rememberCloudChoice(claimId: string, ok: boolean): void {
  choices.set(claimId, ok);
}

export function clearCloudChoices(): void {
  choices.clear();
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run src/lib/photos/__tests__/cloud-choice-memo.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Use the memo in the prompt hook**

In `src/hooks/useSaveToCloudPrompt.tsx`, add the import under the existing imports:
```ts
import { getCloudChoice, rememberCloudChoice } from '@/lib/photos/cloud-choice-memo';
```
Replace the `confirmSaveToCloud` callback with:
```ts
  const confirmSaveToCloud = useCallback((fileLabel: string, claimId?: string): Promise<boolean> => {
    if (claimId) {
      const known = getCloudChoice(claimId);
      if (known !== undefined) return Promise.resolve(known);
    }
    return new Promise<boolean>((resolve) => {
      setPending({
        fileLabel,
        resolve: (ok) => {
          if (claimId) rememberCloudChoice(claimId, ok);
          resolve(ok);
        },
      });
    });
  }, []);
```

- [ ] **Step 6: Add `driveName` to the photo type and `addPhoto`**

In `src/types/assessment.ts`, inside `interface PhotoItem`, after the `tag?: PhotoTag;` line add:
```ts
  /**
   * Exact Google Drive filename this photo was uploaded as (or restored from).
   * Lets another device tell which Drive photos it already has. Undefined on
   * photos taken before this field existed or never sent to Drive.
   */
  driveName?: string;
```
In `src/stores/slices/claimSlice.ts`, change the `addPhoto` type (lines 53-59) to:
```ts
  addPhoto: (
    dataUrl: string,
    name: string,
    w?: number,
    h?: number,
    kind?: PhotoItem['kind'],
    driveName?: string,
  ) => void;
```
and the implementation (line 272) to:
```ts
  addPhoto: (dataUrl, name, w, h, kind = 'damage', driveName) => {
    set((state: ClaimSlice) => {
      if (!state.currentClaim) return {};
      const photo: PhotoItem = driveName ? { dataUrl, name, w, h, kind, driveName } : { dataUrl, name, w, h, kind };
      return {
        currentClaim: {
          ...state.currentClaim,
          photos: [...state.currentClaim.photos, photo],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    });
  },
```

- [ ] **Step 7: Create the shared upload hook**

`src/hooks/usePhotoUpload.ts`:
```ts
'use client';

import { useCallback, useState } from 'react';
import { useClaimStore } from '@/stores/claim-store';
import { useProfileStore } from '@/stores/profile-store';
import { uploadFileToDrive } from '@/lib/drive';
import { PHOTO_FILE_PREFIX } from '@/lib/photos/document-annexure';
import { compressImage } from '@/lib/photos/compress-image';
import { saveDocuments } from '@/lib/documents/sink';
import { useSaveToCloudPrompt } from '@/hooks/useSaveToCloudPrompt';

/**
 * Compress, add to the claim, and (if the surveyor agrees) send to Drive.
 * Shared by the Photos tab and the Site screen so both behave identically.
 */
export function usePhotoUpload() {
  const addPhoto = useClaimStore((s) => s.addPhoto);
  const [isProcessing, setIsProcessing] = useState(false);
  const { confirmSaveToCloud, saveToCloudDialog } = useSaveToCloudPrompt();

  const uploadPhotos = useCallback(async (input: FileList | File[]) => {
    // Copy synchronously: callers reset the <input> right after calling us.
    const files = Array.from(input).filter((f) => f.type.startsWith('image/'));
    const claim = useClaimStore.getState().currentClaim;
    if (!claim || files.length === 0) return;

    setIsProcessing(true);
    try {
      const label = claim.vehicle?.registrationNumber || claim.id;
      const { profile } = useProfileStore.getState();
      const saveToDrive = profile.autoUploadDrive !== false
        ? await confirmSaveToCloud(files.length > 1 ? `${files.length} photos` : files[0].name, claim.id)
        : false;

      const saved: File[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const { dataUrl, w, h } = await compressImage(file, 600, 1.0);
          const name = file.name.split('.')[0].substring(0, 30);
          // The index keeps names unique when a phone names every shot "image".
          const driveName = `${PHOTO_FILE_PREFIX}${Date.now()}_${i}_${name}.jpg`;
          addPhoto(dataUrl, name, w, h, 'damage', saveToDrive ? driveName : undefined);
          saved.push(file);
          if (saveToDrive) {
            // uploadFileToDrive queues and toasts on failure itself.
            uploadFileToDrive(claim.id, driveName, file, label).catch(() => {});
          }
        } catch {
          // skip images that fail to compress
        }
      }
      if (saved.length) {
        void saveDocuments('damagePhotos', saved.map((f) => ({ blob: f, name: f.name })), 'photo');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [addPhoto, confirmSaveToCloud]);

  return { uploadPhotos, isProcessing, saveToCloudDialog };
}
```

- [ ] **Step 8: Switch PhotosTab to the hook and add the Camera button**

In `src/components/tabs/PhotosTab.tsx`:

1. Imports: remove `useProfileStore` (line 5), `compressImage` (line 8), `saveDocuments` (line 21) and `useSaveToCloudPrompt` (line 20); change line 6 to `import { listFilesInFolder, downloadFileAsBase64 } from '@/lib/drive';`; add `import { usePhotoUpload } from '@/hooks/usePhotoUpload';` and add `Camera` to the lucide import list.
2. Delete `const [isProcessing, setIsProcessing] = useState(false);` (line 75) and `const { confirmSaveToCloud, saveToCloudDialog } = useSaveToCloudPrompt();` (line 79). In their place, **before** the `if (!currentClaim) return null;` line, add:
```ts
  const { uploadPhotos, isProcessing, saveToCloudDialog } = usePhotoUpload();
```
3. Replace the whole `handleFileUpload` `useCallback` block (lines ~90-126) with:
```ts
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) void uploadPhotos(files);
    event.target.value = '';
  };
```
4. In the upload dropzone card, replace the single `<Label htmlFor="photo-upload" …>Browse Files</Label>` with a two-button row, and add a second hidden input after the existing `#photo-upload` input:
```tsx
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Label
                  htmlFor="photo-camera"
                  className={`md:hidden cursor-pointer inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <Camera size={16} /> Camera
                </Label>
                <Label
                  htmlFor="photo-upload"
                  className={`cursor-pointer inline-flex min-h-[44px] md:min-h-0 md:h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {isProcessing ? 'Compressing…' : 'Gallery / Browse'}
                </Label>
              </div>
```
```tsx
              <input
                id="photo-camera"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
```

Finally, drop `useCallback` from the `react` import at the top of `PhotosTab.tsx` if nothing else in the file uses it.

- [ ] **Step 9: Type check and run the store tests**

Run: `npx tsc --noEmit`
Expected: no new errors in the files above.
Run: `npx vitest run src/stores src/lib/photos`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/types/assessment.ts src/stores/slices/claimSlice.ts src/lib/photos/cloud-choice-memo.ts src/lib/photos/__tests__/cloud-choice-memo.test.ts src/hooks/useSaveToCloudPrompt.tsx src/hooks/usePhotoUpload.ts src/components/tabs/PhotosTab.tsx
git commit -m "feat: camera button for photos, ask about Drive once per claim

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Manual check for the user (phone): Photos tab shows **Camera** and **Gallery / Browse**; Camera opens the phone camera app; the shot appears in the grid; the "save to Drive?" dialog appears for the first photo of a claim only.

---

### Task 2: Camera button on document cards

**Files:**
- Modify: `src/components/tabs/DocumentsTab.tsx`

**Interfaces:**
- Consumes: `confirmSaveToCloud(fileLabel, claimId?)` from Task 1; existing `handleFile(e, key)`.

- [ ] **Step 1: Pass the claim id to the Drive prompt**

In `processFiles` (~line 161) change
`confirmSaveToCloud(files.length > 1 ? \`${files.length} files\` : files[0].name).then(ok => {`
to
`confirmSaveToCloud(files.length > 1 ? \`${files.length} files\` : files[0].name, claimId).then(ok => {`

- [ ] **Step 2: Add a camera button to each card on phones**

Add `Camera` to the lucide import. Inside each card, in the `<div className="flex items-center gap-2">` that holds the Telegram badge (~line 391), insert before the `{syncConnected && (` line:
```tsx
                        <label
                          className="md:hidden relative z-20 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[var(--color-neutral-200)] bg-card"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Photograph ${doc.label}`}
                          title={`Photograph ${doc.label}`}
                        >
                          <Camera size={18} />
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => handleFile(e, doc.id)}
                            disabled={isActive}
                          />
                        </label>
```
(The card itself stays a full-card file input for PDFs and gallery images.)

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: no new errors in `DocumentsTab.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/tabs/DocumentsTab.tsx
git commit -m "feat: camera button on document cards for phones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Manual check (phone): each document card shows a camera button; it opens the camera; the review/crop sheet opens with the shot, same as a picked file.

---

### Task 3: "N waiting to upload" chip

**Files:**
- Create: `src/lib/drive/queue-events.ts`
- Modify: `src/lib/drive/index.ts` (`uploadFileToDrive` ~341, `flushDriveQueue` ~422)
- Create: `src/components/sync/DriveQueueChip.tsx`
- Modify: `src/components/layout/ClaimHeader.tsx`

**Interfaces:**
- Produces: `DRIVE_QUEUE_EVENT: 'surveyos:drive-queue'`, `notifyDriveQueueChanged(): void`, `<DriveQueueChip />`.

- [ ] **Step 1: Create the event module**

`src/lib/drive/queue-events.ts`:
```ts
/** Fired whenever the persistent Drive upload queue may have changed size. */
export const DRIVE_QUEUE_EVENT = 'surveyos:drive-queue';

export function notifyDriveQueueChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DRIVE_QUEUE_EVENT));
}
```

- [ ] **Step 2: Fire it from the Drive module**

In `src/lib/drive/index.ts` add `import { notifyDriveQueueChanged } from './queue-events';` with the other imports. In `uploadFileToDrive`, add `notifyDriveQueueChanged();` immediately after **each** of the two `await addToDriveQueue({...});` lines. In `flushDriveQueue`, add `notifyDriveQueueChanged();` immediately before the final `return successCount;`.

- [ ] **Step 3: Create the chip**

`src/components/sync/DriveQueueChip.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { getDriveQueueCount } from '@/lib/storage/indexeddb';
import { flushDriveQueue } from '@/lib/drive';
import { DRIVE_QUEUE_EVENT } from '@/lib/drive/queue-events';

/** Persistent count of photos/files still waiting for Drive. Hidden at zero. */
export function DriveQueueChip() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      getDriveQueueCount().then((n) => { if (alive) setCount(n); }).catch(() => {});
    };
    refresh();
    window.addEventListener(DRIVE_QUEUE_EVENT, refresh);
    window.addEventListener('online', refresh);
    return () => {
      alive = false;
      window.removeEventListener(DRIVE_QUEUE_EVENT, refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);

  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={() => { void flushDriveQueue().catch(() => {}); }}
      className="flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-lg text-[10px] font-medium uppercase tracking-wide bg-[var(--color-status-warning-tint)] text-[var(--color-status-warning)]"
      title="Tap to retry now. Uploads also resume on their own when signal returns."
    >
      <UploadCloud size={12} />
      {count} waiting to upload
    </button>
  );
}
```

- [ ] **Step 4: Mount it in the claim header**

In `src/components/layout/ClaimHeader.tsx` add `import { DriveQueueChip } from '@/components/sync/DriveQueueChip';` and render `<DriveQueueChip />` immediately before `<SyncStatusBadge />`.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/drive/queue-events.ts src/lib/drive/index.ts src/components/sync/DriveQueueChip.tsx src/components/layout/ClaimHeader.tsx
git commit -m "feat: show photos waiting to upload to Drive

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Manual check (phone): airplane mode → take 2 photos → header shows "2 waiting to upload"; signal back → chip disappears after the automatic flush (or tap it).

---

### Task 4: Pick up photos taken on another device

**Files:**
- Create: `src/lib/photos/drive-photo-diff.ts`
- Create: `src/lib/photos/__tests__/drive-photo-diff.test.ts`
- Create: `src/lib/photos/download-drive-photos.ts`
- Modify: `src/lib/drive/index.ts` (export `findClaimFolderId`, ~line 569)
- Create: `src/components/layout/NewDrivePhotosBanner.tsx`
- Modify: `src/components/layout/Dashboard.tsx` (render banner under `<ClaimHeader />`, ~line 662)
- Modify: `src/components/tabs/PhotosTab.tsx` (`handleRestoreFromDrive`)

**Interfaces:**
- Consumes: `PhotoItem.driveName`, `addPhoto(..., driveName)` (Task 1).
- Produces: `interface DriveFileLite { id: string; name: string; mimeType: string }`; `findNewDrivePhotos(local: readonly PhotoItem[], drive: readonly DriveFileLite[]): DriveFileLite[]`; `downloadDrivePhotos(files: readonly DriveFileLite[], addPhoto: ClaimSlice['addPhoto']): Promise<number>`; `findClaimFolderId(claimId: string): Promise<string | null>` (now exported).

- [ ] **Step 1: Write the failing diff tests**

`src/lib/photos/__tests__/drive-photo-diff.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { findNewDrivePhotos, type DriveFileLite } from '../drive-photo-diff';
import type { PhotoItem } from '@/types';

const f = (name: string): DriveFileLite => ({ id: name, name, mimeType: 'image/jpeg' });
const p = (name: string, driveName?: string): PhotoItem => ({ dataUrl: 'x', name, kind: 'damage', ...(driveName ? { driveName } : {}) });

describe('findNewDrivePhotos', () => {
  it('returns everything when the device has no photos', () => {
    expect(findNewDrivePhotos([], [f('photo_1_0_a.jpg')])).toHaveLength(1);
  });

  it('skips files whose exact Drive name is already local', () => {
    const local = [p('a', 'photo_1_0_a.jpg')];
    expect(findNewDrivePhotos(local, [f('photo_1_0_a.jpg'), f('photo_2_0_b.jpg')]).map(x => x.name))
      .toEqual(['photo_2_0_b.jpg']);
  });

  it('treats same-named iPhone shots as different files when driveName is set', () => {
    const local = [p('image', 'photo_1_0_image.jpg')];
    expect(findNewDrivePhotos(local, [f('photo_1_0_image.jpg'), f('photo_1_1_image.jpg')]).map(x => x.name))
      .toEqual(['photo_1_1_image.jpg']);
  });

  it('matches legacy local photos (no driveName) by stripped name', () => {
    const local = [p('IMG_2041')];
    expect(findNewDrivePhotos(local, [f('photo_1712345678_IMG_2041.jpg')])).toEqual([]);
  });

  it('matches legacy restored photos by base name', () => {
    const local = [p('rc')];
    expect(findNewDrivePhotos(local, [f('rc.jpg')])).toEqual([]);
  });

  it('returns nothing for an empty Drive folder', () => {
    expect(findNewDrivePhotos([p('a', 'photo_1_0_a.jpg')], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/photos/__tests__/drive-photo-diff.test.ts`
Expected: FAIL, cannot resolve `../drive-photo-diff`.

- [ ] **Step 3: Implement the diff**

`src/lib/photos/drive-photo-diff.ts`:
```ts
import type { PhotoItem } from '@/types';

export interface DriveFileLite { id: string; name: string; mimeType: string }

const base = (fileName: string) => fileName.replace(/\.[^.]+$/, '').substring(0, 30);
// Legacy uploads were named photo_<ms>_<name>.jpg; local photos kept just <name>.
const stripped = (fileName: string) => base(fileName.replace(/^photo_\d+_/, ''));

/**
 * Drive photos that this device does not have yet.
 * Exact match on PhotoItem.driveName; photos from before driveName existed
 * fall back to comparing their local name with the Drive name's stem.
 */
export function findNewDrivePhotos(
  local: readonly PhotoItem[],
  drive: readonly DriveFileLite[],
): DriveFileLite[] {
  const driveNames = new Set(local.map((p) => p.driveName).filter((n): n is string => !!n));
  const legacyNames = new Set(local.filter((p) => !p.driveName).map((p) => p.name));
  return drive.filter((file) =>
    !driveNames.has(file.name) &&
    !legacyNames.has(stripped(file.name)) &&
    !legacyNames.has(base(file.name)),
  );
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/photos/__tests__/drive-photo-diff.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Shared downloader (moved out of PhotosTab)**

`src/lib/photos/download-drive-photos.ts`:
```ts
import { downloadFileAsBase64 } from '@/lib/drive';
import { isDocumentFileName } from '@/lib/photos/document-annexure';
import type { ClaimSlice } from '@/stores/slices/claimSlice';
import type { DriveFileLite } from './drive-photo-diff';

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 800, h: 600 });
    img.src = dataUrl;
  });
}

/** Downloads each file and adds it to the open claim. Returns how many were added. */
export async function downloadDrivePhotos(
  files: readonly DriveFileLite[],
  addPhoto: ClaimSlice['addPhoto'],
): Promise<number> {
  let added = 0;
  for (const file of files) {
    try {
      const dataUrl = await downloadFileAsBase64(file.id, file.mimeType);
      const { w, h } = await imageSize(dataUrl);
      const name = file.name.replace(/\.[^.]+$/, '').substring(0, 30);
      const kind = isDocumentFileName(file.name) ? 'document' : 'damage';
      addPhoto(dataUrl, name, w, h, kind, file.name);
      added++;
    } catch {
      // skip individual failures; the rest still arrive
    }
  }
  return added;
}
```

- [ ] **Step 6: Export the folder lookup**

In `src/lib/drive/index.ts` change `async function findClaimFolderId(` to `export async function findClaimFolderId(`.

- [ ] **Step 7: The banner**

`src/components/layout/NewDrivePhotosBanner.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Images, Loader2 } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { getDriveToken, listFilesInFolder, findClaimFolderId } from '@/lib/drive';
import { PHOTO_FILE_PREFIX } from '@/lib/photos/document-annexure';
import { findNewDrivePhotos, type DriveFileLite } from '@/lib/photos/drive-photo-diff';
import { downloadDrivePhotos } from '@/lib/photos/download-drive-photos';

/** Offers damage photos uploaded from another device. Never downloads without a tap. */
export function NewDrivePhotosBanner() {
  const claimId = useClaimStore((s) => s.currentClaim?.id);
  const addPhoto = useClaimStore((s) => s.addPhoto);
  const isOnline = useUIStore((s) => s.isOnline);
  const [pending, setPending] = useState<DriveFileLite[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPending([]);
    if (!claimId || !isOnline || !getDriveToken()) return;
    let alive = true;
    (async () => {
      try {
        const claim = useClaimStore.getState().currentClaim;
        if (!claim) return;
        const folderId = claim.gDriveFolderId ?? await findClaimFolderId(claim.id);
        if (!folderId) return;
        const files = (await listFilesInFolder(folderId))
          .filter((f) => f.mimeType.startsWith('image/') && f.name.startsWith(PHOTO_FILE_PREFIX));
        if (alive) setPending(findNewDrivePhotos(claim.photos, files));
      } catch {
        // offline or Drive error — checked again next time the claim opens
      }
    })();
    return () => { alive = false; };
  }, [claimId, isOnline]);

  if (pending.length === 0) return null;

  const add = async () => {
    setBusy(true);
    try {
      const n = await downloadDrivePhotos(pending, addPhoto);
      toast.success(`Added ${n} photo${n === 1 ? '' : 's'} from Drive.`);
    } finally {
      setPending([]);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-2.5 text-sm bg-[var(--color-status-info-tint,var(--color-neutral-50))] border-b border-border">
      <Images size={16} className="shrink-0 text-primary" />
      <span className="flex-1 min-w-[12rem]">
        {pending.length} new photo{pending.length === 1 ? '' : 's'} from another device
      </span>
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy && <Loader2 size={14} className="animate-spin" />} Add
      </button>
      <button type="button" onClick={() => setPending([])} className="min-h-[40px] px-2 text-sm text-muted-foreground">
        Not now
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Mount it**

In `src/components/layout/Dashboard.tsx` import `{ NewDrivePhotosBanner } from '@/components/layout/NewDrivePhotosBanner'` and render `<NewDrivePhotosBanner />` on the line right after `<ClaimHeader />`.

- [ ] **Step 9: Make "Restore from Drive" use the same diff**

In `src/components/tabs/PhotosTab.tsx`: add imports `import { findNewDrivePhotos } from '@/lib/photos/drive-photo-diff';` and `import { downloadDrivePhotos } from '@/lib/photos/download-drive-photos';`; change the drive import to `import { listFilesInFolder } from '@/lib/drive';`; remove `isDocumentFileName` from the document-annexure import if now unused. Replace the body of `handleRestoreFromDrive`'s `try` block with:
```ts
      const files = await listFilesInFolder(currentClaim.gDriveFolderId);
      const imageFiles = findNewDrivePhotos(
        currentClaim.photos,
        files.filter(f => f.mimeType.startsWith('image/')),
      );
      if (imageFiles.length === 0) {
        toast.info('No new photos in the Drive folder for this claim.');
        return;
      }
      const restored = await downloadDrivePhotos(imageFiles, addPhoto);
      toast.success(`Restored ${restored} photo(s) from Google Drive.`);
```

- [ ] **Step 10: Type check + tests**

Run: `npx tsc --noEmit` → no new errors.
Run: `npx vitest run src/lib/photos` → all pass.

- [ ] **Step 11: Commit**

```bash
git add src/lib/photos/drive-photo-diff.ts src/lib/photos/__tests__/drive-photo-diff.test.ts src/lib/photos/download-drive-photos.ts src/lib/drive/index.ts src/components/layout/NewDrivePhotosBanner.tsx src/components/layout/Dashboard.tsx src/components/tabs/PhotosTab.tsx
git commit -m "feat: offer photos uploaded from another device

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Manual check (phone + laptop): take 3 photos on the phone with Drive on → open the claim on the laptop → banner "3 new photos from another device" → Add → exactly 3 appear → reopen the claim → no banner.

---

### Task 5: Share PDF to WhatsApp / email

**Files:**
- Create: `src/lib/share/share-pdf.ts`
- Create: `src/components/pdf/SharePdfButton.tsx`
- Modify: `src/components/pdf/PhotoSheetDownloadButton.tsx`
- Modify: `src/components/pdf/DocumentAnnexureDownloadButton.tsx`

**Interfaces:**
- Produces: `canSharePdf(): boolean`, `sharePdf(blob: Blob, fileName: string): Promise<void>`, `<SharePdfButton blob={Blob | null} fileName={string} />`.

- [ ] **Step 1: Share helpers**

`src/lib/share/share-pdf.ts`:
```ts
/** True when the browser can hand a PDF to the OS share sheet (Android Chrome, iOS Safari, …). */
export function canSharePdf(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], 'check.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

/** Opens the share sheet. Cancelling is not an error. Nothing is sent by the app itself. */
export async function sharePdf(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [file], title: fileName });
  } catch {
    // user cancelled or share target failed — nothing to do
  }
}
```

- [ ] **Step 2: Button**

`src/components/pdf/SharePdfButton.tsx`:
```tsx
'use client';

import { Share2 } from 'lucide-react';
import { canSharePdf, sharePdf } from '@/lib/share/share-pdf';

/**
 * Rendered inside PDFDownloadLink's <a download>, so it must stop the click
 * from also triggering the download.
 */
export function SharePdfButton({ blob, fileName }: { blob: Blob | null; fileName: string }) {
  if (!blob || !canSharePdf()) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void sharePdf(blob, fileName);
      }}
      className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md font-semibold text-sm border border-border bg-card hover:bg-muted shadow-sm"
    >
      <Share2 size={16} /> Share
    </button>
  );
}
```

- [ ] **Step 3: Wire into both download wrappers**

In `src/components/pdf/PhotoSheetDownloadButton.tsx`: add `import { SharePdfButton } from './SharePdfButton';`; change the render prop signature from `{({ loading, error }) => {` to `{({ blob, loading, error }) => {`; wrap the **success** return (the final `return ( <button …>…</button> );`) as:
```tsx
        return (
          <span className="flex flex-wrap items-center gap-2">
            {/* existing Download <button> unchanged */}
            <SharePdfButton blob={loading ? null : blob} fileName={fileName} />
          </span>
        );
```
Make the identical change in `src/components/pdf/DocumentAnnexureDownloadButton.tsx`.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/share/share-pdf.ts src/components/pdf/SharePdfButton.tsx src/components/pdf/PhotoSheetDownloadButton.tsx src/components/pdf/DocumentAnnexureDownloadButton.tsx
git commit -m "feat: share photo sheet and annexure PDFs from the phone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Manual check (phone): Photos tab → Share next to Download PDF → share sheet lists WhatsApp/Gmail with the PDF attached; Download still downloads.

---

# Phase P2 — Installable, opens without signal

### Task 6: Manifest, icons, service worker, registration

**Files:**
- Create: `scripts/make-pwa-icons.mjs`, `public/icons/icon-192.png`, `public/icons/icon-512.png` (generated)
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `src/components/pwa/ServiceWorkerRegistrar.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `firebase.json`

**Interfaces:**
- Produces: `<ServiceWorkerRegistrar />` with a `WARM_TABS` list that Task 12 extends.

- [ ] **Step 1: Icon script and icons**

`scripts/make-pwa-icons.mjs`:
```js
// One-off: renders the app icon to the PNG sizes the web manifest needs.
// Run: node scripts/make-pwa-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  await sharp('src/app/icon.svg').resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
  console.log(`public/icons/icon-${size}.png`);
}
```
Run: `node scripts/make-pwa-icons.mjs`
Expected: prints both paths; files exist.

- [ ] **Step 2: Manifest**

`public/manifest.webmanifest`:
```json
{
  "name": "Motor SurveyOS",
  "short_name": "SurveyOS",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 3: Service worker**

`public/sw.js`:
```js
// SurveyOS app-shell service worker. Hand-written on purpose: it caches the
// shell and hashed static chunks only. Every cross-origin call (Firestore,
// Drive, Google APIs, AI providers, the Sync Worker) is left untouched.
// ponytail: no update prompt — an online load always fetches the fresh shell;
// add a "new version, reload" toast only if stale shells cause support calls.
const CACHE = 'surveyos-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network first. Only the app root ('/') refreshes the cached shell —
    // marketing pages (/landing, /blog…) are separate HTML files.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (url.pathname === '/' && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    // Content-hashed filenames never change, so cache first is safe.
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })),
    );
  }
});
```

- [ ] **Step 4: Registrar**

`src/components/pwa/ServiceWorkerRegistrar.tsx`:
```tsx
'use client';

import { useEffect } from 'react';

// Tabs a surveyor needs at the vehicle. Importing them once while online puts
// their chunks in the service-worker cache so they open without signal later.
const WARM_TABS: Array<() => Promise<unknown>> = [
  () => import('@/components/tabs/DetailsTab'),
  () => import('@/components/tabs/PhotosTab'),
  () => import('@/components/tabs/DocumentsTab'),
];

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => Promise.all(WARM_TABS.map((load) => load().catch(() => null))))
      .catch(() => { /* app keeps working exactly as before without a SW */ });
    // Asks the browser not to evict unsynced photos under storage pressure.
    void navigator.storage?.persist?.().catch(() => false);
  }, []);
  return null;
}
```

- [ ] **Step 5: Link manifest + mount registrar**

In `src/app/layout.tsx`: add `manifest: '/manifest.webmanifest',` inside the `metadata` object (after `metadataBase`); add `import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';` next to the other component imports; render `<ServiceWorkerRegistrar />` as the first child of `<body>`.

- [ ] **Step 6: No-cache headers**

In `firebase.json`, inside the hosting entry (after `"rewrites": [...]`), add:
```json
      ,
      "headers": [
        { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
        { "source": "/manifest.webmanifest", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
      ]
```
(Keep the JSON valid: the comma goes after the closing `]` of `rewrites`.)

- [ ] **Step 7: Build and inspect locally (no sign-in needed)**

Run: `npm run build`
Expected: build succeeds; `out/sw.js`, `out/manifest.webmanifest`, `out/icons/icon-192.png` exist.
Serve `out/` (e.g. `npx serve out -s -l 4173`), open `http://localhost:4173/` in the Browser pane, then run in the page:
```js
await navigator.serviceWorker.ready; (await caches.keys())
```
Expected: `["surveyos-shell-v1"]`.

- [ ] **Step 8: Commit**

```bash
git add scripts/make-pwa-icons.mjs public/icons public/manifest.webmanifest public/sw.js src/components/pwa/ServiceWorkerRegistrar.tsx src/app/layout.tsx firebase.json
git commit -m "feat: installable app that opens without signal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Manual check (phone, after deploy): Chrome menu → Add to Home screen → icon appears; open it, open a claim and the Photos tab; airplane mode; close and reopen from the icon → app opens signed in, claim list shows, the claim and Photos open. iPhone Safari: Share → Add to Home Screen, same check.

---

# Phase P3 — Site screen

### Task 7: Single source for survey-type tab visibility

**Files:**
- Create: `src/lib/navigation/visible-nav.ts`
- Create: `src/lib/navigation/__tests__/visible-nav.test.ts`
- Modify: `src/components/layout/sidebar.tsx:264-285`

**Interfaces:**
- Produces: `isNavItemVisible(id: AppTab, surveyType: SurveyType | undefined): boolean` — `surveyType` undefined means no claim is open.

- [ ] **Step 1: Write the failing parity test (locks today's sidebar behaviour)**

`src/lib/navigation/__tests__/visible-nav.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isNavItemVisible } from '../visible-nav';
import type { AppTab } from '@/stores/ui-store';

const visible = (survey: 'spot' | 'final' | 'valuation' | undefined, ids: AppTab[]) =>
  ids.filter((id) => isNavItemVisible(id, survey));

const ALL: AppTab[] = ['dashboard', 'documents', 'review', 'details', 'valuation', 'assessment',
  'reports', 'insured-report', 'bill-check', 'photos', 'fees', 'reinspection'];

describe('isNavItemVisible (matches sidebar.tsx as of 2026-10-02)', () => {
  it('spot hides assessment, bill check, reinspection, valuation', () => {
    expect(visible('spot', ALL)).toEqual(['dashboard', 'documents', 'review', 'details',
      'reports', 'insured-report', 'photos', 'fees']);
  });

  it('final hides only valuation', () => {
    expect(visible('final', ALL)).toEqual(ALL.filter((id) => id !== 'valuation'));
  });

  it('valuation hides assessment, bill check, reinspection, review, documents', () => {
    expect(visible('valuation', ALL)).toEqual(['dashboard', 'details', 'valuation',
      'reports', 'insured-report', 'photos', 'fees']);
  });

  it('with no claim open only valuation is hidden', () => {
    expect(visible(undefined, ALL)).toEqual(ALL.filter((id) => id !== 'valuation'));
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/navigation/__tests__/visible-nav.test.ts`
Expected: FAIL, cannot resolve `../visible-nav`.

- [ ] **Step 3: Implement**

`src/lib/navigation/visible-nav.ts`:
```ts
import type { AppTab } from '@/stores/ui-store';
import type { SurveyType } from '@/types/report';

/**
 * Tabs each survey type never shows. The ONE place this rule lives — the
 * sidebar and the phone bottom bar both read it, so they cannot drift apart.
 * landing-tab.ts depends on 'documents' being hidden for valuation.
 */
const HIDDEN_BY_SURVEY: Record<SurveyType, readonly AppTab[]> = {
  spot: ['assessment', 'bill-check', 'reinspection', 'valuation'],
  final: ['valuation'],
  valuation: ['assessment', 'bill-check', 'reinspection', 'review', 'documents'],
};

/** `surveyType` undefined = no claim open. */
export function isNavItemVisible(id: AppTab, surveyType: SurveyType | undefined): boolean {
  if (!surveyType) return id !== 'valuation';
  return !HIDDEN_BY_SURVEY[surveyType].includes(id);
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/navigation/__tests__/visible-nav.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Sidebar uses it**

In `src/components/layout/sidebar.tsx` add `import { isNavItemVisible } from '@/lib/navigation/visible-nav';`. Replace everything inside the `NAV_ITEMS.filter((item) => { … })` callback after the `if (item.group !== group) return false;` line, up to and including `return true;`, with:
```ts
              return isNavItemVisible(item.id, currentClaim?.surveyType);
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit` → no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/navigation/visible-nav.ts src/lib/navigation/__tests__/visible-nav.test.ts src/components/layout/sidebar.tsx
git commit -m "refactor: move survey-type tab visibility into one tested helper

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Path helpers and the still-missing checklist

**Files:**
- Create: `src/lib/site/path.ts`
- Create: `src/lib/site/__tests__/path.test.ts`
- Create: `src/lib/site/site-checklist.ts`
- Create: `src/lib/site/__tests__/site-checklist.test.ts`

**Interfaces:**
- Produces: `getAt(obj: unknown, path: string): unknown`; `setAt<T>(obj: T, path: string, value: unknown): T` (returns a new object, never mutates); `type ChecklistTarget = AppTab | 'camera'`; `interface ChecklistItem { id: string; label: string; target: ChecklistTarget; value?: string }`; `siteChecklist(claim: ClaimData): { missing: ChecklistItem[]; confirm: ChecklistItem[] }`.

- [ ] **Step 1: Failing path tests**

`src/lib/site/__tests__/path.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getAt, setAt } from '../path';

describe('getAt / setAt', () => {
  it('reads nested values and missing paths', () => {
    expect(getAt({ a: { b: 'x' } }, 'a.b')).toBe('x');
    expect(getAt({ a: {} }, 'a.b.c')).toBeUndefined();
  });

  it('sets nested values without mutating the input', () => {
    const src = { a: { b: 'x', keep: 1 }, other: { z: 2 } };
    const out = setAt(src, 'a.b', 'y');
    expect(out).toEqual({ a: { b: 'y', keep: 1 }, other: { z: 2 } });
    expect(src.a.b).toBe('x');
    expect(out.other).toBe(src.other);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/site/__tests__/path.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement path helpers**

`src/lib/site/path.ts`:
```ts
/** Reads `a.b.c` from an object; undefined when any step is missing. */
export function getAt(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (cur, key) => (cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

/** Returns a copy of `obj` with `a.b.c` set. Untouched branches are shared, never mutated. */
export function setAt<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const src = (obj ?? {}) as Record<string, unknown>;
  return { ...src, [head]: rest.length ? setAt(src[head], rest.join('.'), value) : value } as T;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/site/__tests__/path.test.ts` → 2 passed.

- [ ] **Step 5: Failing checklist tests**

`src/lib/site/__tests__/site-checklist.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types';
import { siteChecklist } from '../site-checklist';

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('siteChecklist', () => {
  it('lists everything for a blank spot claim', () => {
    const { missing, confirm } = siteChecklist(createBlankClaim('spot'));
    expect(ids(missing)).toEqual([
      'doc:rc', 'doc:dl', 'doc:policy',
      'vehicle.registrationNumber', 'vehicle.odometer', 'accident.dateAndTime',
      'accident.placeOfAccident', 'accident.causeOfAccident', 'accident.placeOfSurvey',
      'photo:damage',
    ]);
    expect(ids(confirm)).toEqual([
      'spotDetails.drivable', 'spotDetails.airbags', 'spotDetails.policeReported',
      'spotDetails.tpInvolved', 'spotDetails.panchanama', 'spotDetails.damageSeverity',
    ]);
    expect(confirm[0].value).toBe('yes');
  });

  it('drops documents that have been extracted and fields that are filled', () => {
    const c = createBlankClaim('spot');
    const claim = {
      ...c,
      extractedData: { rc: { any: 1 } },
      vehicle: { ...c.vehicle, odometer: '45320' },
      photos: [{ dataUrl: 'x', name: 'a', kind: 'damage' as const }],
    };
    const missing = ids(siteChecklist(claim).missing);
    expect(missing).not.toContain('doc:rc');
    expect(missing).not.toContain('vehicle.odometer');
    expect(missing).not.toContain('photo:damage');
  });

  it('does not count document photos as damage photos', () => {
    const c = createBlankClaim('spot');
    const claim = { ...c, photos: [{ dataUrl: 'x', name: 'rc', kind: 'document' as const }] };
    expect(ids(siteChecklist(claim).missing)).toContain('photo:damage');
  });

  it('final asks for the estimate and the workshop', () => {
    const missing = ids(siteChecklist(createBlankClaim('final')).missing);
    expect(missing).toContain('doc:estimate');
    expect(missing).toContain('accident.workshopName');
    expect(siteChecklist(createBlankClaim('final')).confirm).toEqual([]);
  });

  it('valuation points condition fields at the Valuation tab and shows insurable as Yes', () => {
    const { missing, confirm } = siteChecklist(createBlankClaim('valuation'));
    expect(missing.find((i) => i.id === 'valuationDetails.tyreCondition')?.target).toBe('valuation');
    expect(confirm).toEqual([{ id: 'valuationDetails.isInsurable', label: 'Insurable', target: 'valuation', value: 'Yes' }]);
  });
});
```

- [ ] **Step 6: Run — expect FAIL**

Run: `npx vitest run src/lib/site/__tests__/site-checklist.test.ts` → FAIL (module missing).

- [ ] **Step 7: Implement the checklist**

`src/lib/site/site-checklist.ts`:
```ts
import type { ClaimData } from '@/types';
import type { SurveyType } from '@/types/report';
import type { AppTab } from '@/stores/ui-store';
import { partitionPhotos } from '@/lib/photos/document-annexure';
import { getAt } from './path';

export type ChecklistTarget = AppTab | 'camera';
export interface ChecklistItem { id: string; label: string; target: ChecklistTarget; value?: string }
export interface SiteChecklist { missing: ChecklistItem[]; confirm: ChecklistItem[] }

interface FieldRule { path: string; label: string; target: AppTab }
interface SurveyRules {
  docs: string[];
  fields: FieldRule[];
  photo: { kind: 'damage' | 'any'; label: string };
  confirm: FieldRule[];
}

const DOC_LABELS: Record<string, string> = {
  rc: 'RC copy', dl: 'DL copy', policy: 'Policy copy', estimate: 'Estimate',
};

const d = (path: string, label: string): FieldRule => ({ path, label, target: 'details' });
const v = (path: string, label: string): FieldRule => ({ path, label, target: 'valuation' });

// Edit these lists to change what the Site screen asks for — not the UI.
const RULES: Record<SurveyType, SurveyRules> = {
  spot: {
    docs: ['rc', 'dl', 'policy'],
    fields: [
      d('vehicle.registrationNumber', 'Registration number'),
      d('vehicle.odometer', 'Odometer reading'),
      d('accident.dateAndTime', 'Accident date and time'),
      d('accident.placeOfAccident', 'Place of accident'),
      d('accident.causeOfAccident', 'Cause of accident'),
      d('accident.placeOfSurvey', 'Place of survey'),
    ],
    photo: { kind: 'damage', label: 'At least one damage photo' },
    confirm: [
      d('spotDetails.drivable', 'Drivable'),
      d('spotDetails.airbags', 'Airbags'),
      d('spotDetails.policeReported', 'Police reported'),
      d('spotDetails.tpInvolved', 'Third party involved'),
      d('spotDetails.panchanama', 'Panchanama'),
      d('spotDetails.damageSeverity', 'Damage severity'),
    ],
  },
  valuation: {
    docs: ['rc', 'policy'],
    fields: [
      d('vehicle.registrationNumber', 'Registration number'),
      v('valuationDetails.odometer', 'Odometer reading'),
      v('valuationDetails.inspectionDate', 'Inspection date'),
      v('valuationDetails.inspectionPlace', 'Inspection place'),
      v('valuationDetails.tyreCondition', 'Tyre condition'),
      v('valuationDetails.batteryCondition', 'Battery condition'),
      v('valuationDetails.glassCondition', 'Glass condition'),
    ],
    photo: { kind: 'any', label: 'At least one photo' },
    confirm: [v('valuationDetails.isInsurable', 'Insurable')],
  },
  final: {
    docs: ['rc', 'dl', 'policy', 'estimate'],
    fields: [
      d('vehicle.registrationNumber', 'Registration number'),
      d('vehicle.odometer', 'Odometer reading'),
      d('accident.causeOfAccident', 'Cause of accident'),
      d('accident.workshopName', 'Workshop name'),
      d('accident.dateOfSurvey', 'Date of survey'),
      d('accident.placeOfSurvey', 'Place of survey'),
    ],
    photo: { kind: 'damage', label: 'At least one damage photo' },
    confirm: [],
  },
};

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';
const show = (value: unknown) => (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? ''));

export function siteChecklist(claim: ClaimData): SiteChecklist {
  const rules = RULES[claim.surveyType] ?? RULES.final;
  const missing: ChecklistItem[] = [];

  for (const doc of rules.docs) {
    if (!claim.extractedData?.[doc]) {
      missing.push({ id: `doc:${doc}`, label: DOC_LABELS[doc] ?? doc, target: 'documents' });
    }
  }
  for (const f of rules.fields) {
    if (isBlank(getAt(claim, f.path))) missing.push({ id: f.path, label: f.label, target: f.target });
  }
  const photoCount = rules.photo.kind === 'damage'
    ? partitionPhotos(claim.photos ?? []).damage.length
    : (claim.photos ?? []).length;
  if (photoCount === 0) missing.push({ id: `photo:${rules.photo.kind}`, label: rules.photo.label, target: 'camera' });

  const confirm = rules.confirm.map((f) => ({
    id: f.path, label: f.label, target: f.target, value: show(getAt(claim, f.path)),
  }));
  return { missing, confirm };
}
```

- [ ] **Step 8: Run — expect PASS**

Run: `npx vitest run src/lib/site` → all pass.
If `'estimate'` turns out not to be the `extractedData` key the Assessment tab's estimate scan writes, check `setExtractedData(key, …)` callers in `src/hooks/useAIExtraction.ts` and use that key in `RULES.final.docs` (keep the label "Estimate").

- [ ] **Step 9: Commit**

```bash
git add src/lib/site/path.ts src/lib/site/site-checklist.ts src/lib/site/__tests__/path.test.ts src/lib/site/__tests__/site-checklist.test.ts
git commit -m "feat: still-missing and confirm lists for the site screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Site notes logic — allowed fields, parsing, plan, updates

**Files:**
- Modify: `src/types/claim.ts` (add `siteNotes?` to `ClaimData`, after `reportPreamble?`)
- Create: `src/lib/site/site-notes.ts`
- Create: `src/lib/site/__tests__/site-notes.test.ts`

**Interfaces:**
- Consumes: `getAt`, `setAt` (Task 8).
- Produces:
  - `interface FieldSpec { path: string; label: string; enum?: readonly string[] }`
  - `siteNoteFields(surveyType: SurveyType): FieldSpec[]`, `allowsDamageRows(surveyType: SurveyType): boolean`
  - `interface SiteNotesExtraction { fields: { path: string; value: string; evidence: string }[]; damageRows: { component: string; damage: string; evidence: string }[]; unmapped: string[] }`
  - `interface SiteNotesPlan { fills: { path: string; label: string; value: string; evidence: string }[]; conflicts: { path: string; label: string; current: string; proposed: string; evidence: string }[]; damageRows: { component: string; damage: string; evidence: string }[]; unmapped: string[] }`
  - `parseSiteNotesExtraction(raw: string): SiteNotesExtraction` (throws on invalid JSON)
  - `planSiteNotes(claim: ClaimData, extraction: SiteNotesExtraction): SiteNotesPlan`
  - `siteNotesUpdates(claim: ClaimData, plan: SiteNotesPlan, makeId?: (i: number) => string): Partial<ClaimData>`
  - `isEmptyPlan(plan: SiteNotesPlan): boolean`

- [ ] **Step 1: Add the claim field**

In `src/types/claim.ts`, inside `ClaimData`, directly after the `reportPreamble?: string;` line add:
```ts
  /** Free text the surveyor dictates on the Site screen (keyboard mic). "Fill
   *  fields from notes" reads it; it is kept as the record of what was said. */
  siteNotes?: string;
```

- [ ] **Step 2: Failing tests**

`src/lib/site/__tests__/site-notes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createBlankClaim } from '@/types';
import {
  parseSiteNotesExtraction, planSiteNotes, siteNotesUpdates, siteNoteFields, isEmptyPlan,
  type SiteNotesExtraction,
} from '../site-notes';

const ex = (over: Partial<SiteNotesExtraction>): SiteNotesExtraction => ({ fields: [], damageRows: [], unmapped: [], ...over });

describe('parseSiteNotesExtraction', () => {
  it('fills missing arrays and drops malformed entries', () => {
    const out = parseSiteNotesExtraction(JSON.stringify({
      fields: [{ path: 'vehicle.odometer', value: 45320, evidence: 'odometer 45320' }, { nope: 1 }],
    }));
    expect(out).toEqual({
      fields: [{ path: 'vehicle.odometer', value: '45320', evidence: 'odometer 45320' }],
      damageRows: [],
      unmapped: [],
    });
  });

  it('throws on non-JSON', () => {
    expect(() => parseSiteNotesExtraction('not json')).toThrow();
  });
});

describe('planSiteNotes', () => {
  it('fills empty fields and fields still at their blank default', () => {
    const claim = createBlankClaim('spot');
    const plan = planSiteNotes(claim, ex({ fields: [
      { path: 'vehicle.odometer', value: '45320', evidence: 'odometer 45320' },
      { path: 'spotDetails.drivable', value: 'no', evidence: 'towed' },
    ] }));
    expect(plan.fills.map((f) => [f.path, f.value])).toEqual([
      ['vehicle.odometer', '45320'], ['spotDetails.drivable', 'no'],
    ]);
    expect(plan.conflicts).toEqual([]);
  });

  it('never overwrites a filled field — it becomes a conflict', () => {
    const c = createBlankClaim('spot');
    const claim = { ...c, vehicle: { ...c.vehicle, odometer: '40000' } };
    const plan = planSiteNotes(claim, ex({ fields: [{ path: 'vehicle.odometer', value: '45320', evidence: 'e' }] }));
    expect(plan.fills).toEqual([]);
    expect(plan.conflicts).toEqual([{ path: 'vehicle.odometer', label: 'Odometer', current: '40000', proposed: '45320', evidence: 'e' }]);
  });

  it('drops paths that are not allowed (insured details, amounts)', () => {
    const plan = planSiteNotes(createBlankClaim('spot'), ex({ fields: [
      { path: 'policy.insuredName', value: 'Ramesh', evidence: 'e' },
      { path: 'assessmentRows', value: '5000', evidence: 'e' },
    ] }));
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it('sends invalid enum values to unmapped', () => {
    const plan = planSiteNotes(createBlankClaim('spot'), ex({ fields: [
      { path: 'spotDetails.airbags', value: 'maybe', evidence: 'airbags maybe' },
    ] }));
    expect(plan.fills).toEqual([]);
    expect(plan.unmapped).toEqual(['airbags maybe']);
  });

  it('keeps damage rows only for spot surveys', () => {
    const rows = [{ component: 'Front bumper', damage: 'cracked - replace', evidence: 'e' }];
    expect(planSiteNotes(createBlankClaim('spot'), ex({ damageRows: rows })).damageRows).toHaveLength(1);
    expect(planSiteNotes(createBlankClaim('final'), ex({ damageRows: rows })).damageRows).toEqual([]);
  });

  it('allows reinspection fields on final surveys only', () => {
    const paths = (t: 'spot' | 'final' | 'valuation') => siteNoteFields(t).map((f) => f.path);
    expect(paths('final')).toContain('reinspection.observations');
    expect(paths('spot')).not.toContain('reinspection.observations');
  });
});

describe('siteNotesUpdates', () => {
  it('returns whole updated sections and appends damage rows', () => {
    const c = createBlankClaim('spot');
    const claim = { ...c, spotDamageRows: [{ id: 'old', component: 'Bonnet', damage: 'dent' }] };
    const plan = planSiteNotes(claim, ex({
      fields: [{ path: 'vehicle.odometer', value: '45320', evidence: 'e' }],
      damageRows: [{ component: 'Front bumper', damage: 'cracked', evidence: 'e' }],
    }));
    const updates = siteNotesUpdates(claim, plan, (i) => `new-${i}`);
    expect(updates.vehicle?.odometer).toBe('45320');
    expect(updates.vehicle?.make).toBe(c.vehicle.make);
    expect(updates.spotDamageRows).toEqual([
      { id: 'old', component: 'Bonnet', damage: 'dent' },
      { id: 'new-0', component: 'Front bumper', damage: 'cracked' },
    ]);
    expect(updates.assessmentRows).toBeUndefined();
    expect(claim.vehicle.odometer).toBe('');
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `npx vitest run src/lib/site/__tests__/site-notes.test.ts` → FAIL (module missing).

- [ ] **Step 4: Implement**

`src/lib/site/site-notes.ts`:
```ts
import type { ClaimData } from '@/types';
import type { SurveyType } from '@/types/report';
import { createBlankClaim } from '@/types';
import { getAt, setAt } from './path';

export interface FieldSpec { path: string; label: string; enum?: readonly string[] }

const COMMON: FieldSpec[] = [
  { path: 'vehicle.registrationNumber', label: 'Registration number' },
  { path: 'vehicle.odometer', label: 'Odometer' },
  { path: 'vehicle.preAccidentCondition', label: 'Pre-accident condition' },
  { path: 'accident.dateAndTime', label: 'Accident date and time' },
  { path: 'accident.placeOfAccident', label: 'Place of accident' },
  { path: 'accident.causeOfAccident', label: 'Cause of accident' },
  { path: 'accident.placeOfSurvey', label: 'Place of survey' },
  { path: 'accident.workshopName', label: 'Workshop name' },
  { path: 'accident.remarks', label: 'Remarks' },
];

// Enum values mirror the <option> values in SpotTab.tsx and the RI types.
const SPOT: FieldSpec[] = [
  { path: 'spotDetails.drivable', label: 'Drivable', enum: ['yes', 'no'] },
  { path: 'spotDetails.airbags', label: 'Airbags', enum: ['no', 'yes', 'na'] },
  { path: 'spotDetails.policeReported', label: 'Police reported', enum: ['yes', 'no'] },
  { path: 'spotDetails.tpInvolved', label: 'Third party involved', enum: ['no', 'tppd', 'tppi', 'both'] },
  { path: 'spotDetails.panchanama', label: 'Panchanama', enum: ['yes', 'no'] },
  { path: 'spotDetails.damageSeverity', label: 'Damage severity', enum: ['minor', 'moderate', 'major'] },
  { path: 'spotDetails.comments', label: 'Spot comments' },
  { path: 'spotDetails.repairs', label: 'Repairs' },
];

const VALUATION: FieldSpec[] = [
  { path: 'valuationDetails.inspectionPlace', label: 'Inspection place' },
  { path: 'valuationDetails.odometer', label: 'Odometer (valuation)' },
  { path: 'valuationDetails.tyreCondition', label: 'Tyre condition' },
  { path: 'valuationDetails.batteryCondition', label: 'Battery condition' },
  { path: 'valuationDetails.glassCondition', label: 'Glass condition' },
  { path: 'valuationDetails.electricals', label: 'Electricals' },
  { path: 'valuationDetails.remarks', label: 'Valuation remarks' },
];

const REINSPECTION: FieldSpec[] = [
  { path: 'reinspection.observations', label: 'Reinspection observations' },
  { path: 'reinspection.repairQuality', label: 'Repair quality', enum: ['satisfactory', 'good', 'partial', 'unsatisfactory'] },
  { path: 'reinspection.vehicleCondition', label: 'Vehicle condition', enum: ['roadworthy', 'needs-attention', 'not-roadworthy'] },
  { path: 'reinspection.salvageStatus', label: 'Salvage status', enum: ['collected', 'not-collected', 'partial', 'na'] },
];

/**
 * The ONLY fields dictated notes may fill. Never assessment rows or amounts
 * (assessment is surveyor-made), never insured / policy / driver identity.
 */
export function siteNoteFields(surveyType: SurveyType): FieldSpec[] {
  if (surveyType === 'spot') return [...COMMON, ...SPOT];
  if (surveyType === 'valuation') return [...COMMON, ...VALUATION];
  return [...COMMON, ...REINSPECTION];
}

export const allowsDamageRows = (surveyType: SurveyType) => surveyType === 'spot';

export interface ExtractedField { path: string; value: string; evidence: string }
export interface ExtractedDamageRow { component: string; damage: string; evidence: string }
export interface SiteNotesExtraction { fields: ExtractedField[]; damageRows: ExtractedDamageRow[]; unmapped: string[] }

export interface SiteNotesFill extends ExtractedField { label: string }
export interface SiteNotesConflict { path: string; label: string; current: string; proposed: string; evidence: string }
export interface SiteNotesPlan {
  fills: SiteNotesFill[];
  conflicts: SiteNotesConflict[];
  damageRows: ExtractedDamageRow[];
  unmapped: string[];
}

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

/** Tolerant reader of the model's JSON. Throws only when it is not JSON at all. */
export function parseSiteNotesExtraction(raw: string): SiteNotesExtraction {
  const data: unknown = JSON.parse(raw);
  const obj = isObj(data) ? data : {};
  const list = (key: string) => (Array.isArray(obj[key]) ? (obj[key] as unknown[]) : []);
  return {
    fields: list('fields').filter(isObj)
      .map((f) => ({ path: str(f.path), value: str(f.value), evidence: str(f.evidence) }))
      .filter((f) => f.path && f.value),
    damageRows: list('damageRows').filter(isObj)
      .map((r) => ({ component: str(r.component), damage: str(r.damage), evidence: str(r.evidence) }))
      .filter((r) => r.component),
    unmapped: list('unmapped').map(str).filter(Boolean),
  };
}

export function planSiteNotes(claim: ClaimData, extraction: SiteNotesExtraction): SiteNotesPlan {
  const specs = new Map(siteNoteFields(claim.surveyType).map((s) => [s.path, s]));
  const blank = createBlankClaim(claim.surveyType, claim.vehicleType);
  const seen = new Set<string>();
  const fills: SiteNotesFill[] = [];
  const conflicts: SiteNotesConflict[] = [];
  const unmapped = [...extraction.unmapped];

  for (const f of extraction.fields) {
    const spec = specs.get(f.path);
    const value = str(f.value);
    if (!spec || !value || seen.has(f.path)) continue; // not allowed, empty, or duplicate → dropped
    seen.add(f.path);
    if (spec.enum && !spec.enum.includes(value)) {
      unmapped.push(f.evidence || value);
      continue;
    }
    const current = str(getAt(claim, f.path));
    const blankValue = str(getAt(blank, f.path));
    if (current === '' || current === blankValue) {
      fills.push({ path: f.path, value, evidence: f.evidence, label: spec.label });
    } else if (current !== value) {
      conflicts.push({ path: f.path, label: spec.label, current, proposed: value, evidence: f.evidence });
    }
  }

  return {
    fills,
    conflicts,
    damageRows: allowsDamageRows(claim.surveyType) ? extraction.damageRows : [],
    unmapped,
  };
}

export const isEmptyPlan = (p: SiteNotesPlan) =>
  p.fills.length + p.conflicts.length + p.damageRows.length + p.unmapped.length === 0;

/** The claim changes for the approved plan: whole updated sections + appended damage rows. */
export function siteNotesUpdates(
  claim: ClaimData,
  plan: SiteNotesPlan,
  makeId: (i: number) => string = (i) => `notes-${Date.now()}-${i}`,
): Partial<ClaimData> {
  const next = plan.fills.reduce<ClaimData>((acc, f) => setAt(acc, f.path, f.value), claim);
  const updates: Record<string, unknown> = {};
  for (const section of new Set(plan.fills.map((f) => f.path.split('.')[0]))) {
    updates[section] = (next as unknown as Record<string, unknown>)[section];
  }
  if (plan.damageRows.length) {
    updates.spotDamageRows = [
      ...claim.spotDamageRows,
      ...plan.damageRows.map((r, i) => ({ id: makeId(i), component: r.component, damage: r.damage })),
    ];
  }
  return updates as Partial<ClaimData>;
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run src/lib/site` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/claim.ts src/lib/site/site-notes.ts src/lib/site/__tests__/site-notes.test.ts
git commit -m "feat: plan which fields dictated site notes may fill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Site notes prompt, gateway call, review dialog

**Files:**
- Modify: `src/lib/ai/prompts.ts` (append `buildSiteNotesPrompt`)
- Create: `src/lib/ai/__tests__/site-notes-prompt.test.ts`
- Create: `src/lib/site/read-site-notes.ts`
- Create: `src/components/site/SiteNotesReviewDialog.tsx`

**Interfaces:**
- Consumes: `siteNoteFields`, `allowsDamageRows`, `parseSiteNotesExtraction`, `planSiteNotes`, `SiteNotesPlan`, `FieldSpec` (Task 9); `callAIGateway(prompt, images, 'json', 'text')`.
- Produces: `buildSiteNotesPrompt(notes: string, fields: readonly FieldSpec[], allowDamageRows: boolean): string`; `readSiteNotes(claim: ClaimData): Promise<SiteNotesPlan>`; `<SiteNotesReviewDialog plan={SiteNotesPlan} onApply={() => void} onClose={() => void} />`.

- [ ] **Step 1: Failing prompt test**

`src/lib/ai/__tests__/site-notes-prompt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildSiteNotesPrompt } from '../prompts';

describe('buildSiteNotesPrompt', () => {
  const fields = [
    { path: 'vehicle.odometer', label: 'Odometer' },
    { path: 'spotDetails.airbags', label: 'Airbags', enum: ['no', 'yes', 'na'] as const },
  ];

  it('lists allowed paths with their fixed values and embeds the notes', () => {
    const p = buildSiteNotesPrompt('odometer 45320 airbags nahi khule', fields, true);
    expect(p).toContain('- vehicle.odometer (Odometer)');
    expect(p).toContain('- spotDetails.airbags (Airbags) — one of: no, yes, na');
    expect(p).toContain('odometer 45320 airbags nahi khule');
    expect(p).toContain('damageRows');
  });

  it('asks for an empty damageRows array when rows are not allowed', () => {
    expect(buildSiteNotesPrompt('x', fields, false)).toContain('Return damageRows as an empty array.');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/ai/__tests__/site-notes-prompt.test.ts` → FAIL (`buildSiteNotesPrompt` not exported).

- [ ] **Step 3: Implement the prompt**

Append to `src/lib/ai/prompts.ts`:
```ts
/**
 * Dictated site notes → field values. Notes come from phone keyboard voice
 * typing (Gboard / Apple dictation), so expect mixed English/Hindi/Marathi and
 * misheard words. The caller restricts `fields`; planSiteNotes re-checks.
 */
export function buildSiteNotesPrompt(
  notes: string,
  fields: readonly { path: string; label: string; enum?: readonly string[] }[],
  allowDamageRows: boolean,
): string {
  const fieldLines = fields
    .map((f) => `- ${f.path} (${f.label})${f.enum ? ` — one of: ${f.enum.join(', ')}` : ''}`)
    .join('\n');
  const rowShape = allowDamageRows
    ? '{"component":"<part name>","damage":"<damage and job, e.g. cracked - replace>","evidence":"<exact words>"}'
    : '';
  return `You are reading a motor insurance surveyor's dictated site notes. They may mix English, Hindi and Marathi and come from voice typing, so expect missing punctuation and misheard words.

Extract ONLY what the surveyor actually said. Never guess, never infer, never add advice.

Allowed fields:
${fieldLines}

Return JSON exactly in this shape:
{"fields":[{"path":"<allowed path>","value":"<value>","evidence":"<the exact words from the notes>"}],"damageRows":[${rowShape}],"unmapped":["<phrases you could not place in any allowed field>"]}

Rules:
- Use only the allowed paths above. Leave a field out if the notes do not mention it.
- For fields with a fixed list, use one of the listed values exactly, in lower case.
- Odometer: digits only (e.g. "forty five thousand three twenty" → "45320").
- ${allowDamageRows ? 'Each damaged part the surveyor names becomes one damageRows entry.' : 'Return damageRows as an empty array.'}
- Do not output amounts or prices, or the insured's or driver's personal details, even if mentioned; put such phrases in unmapped.

Notes:
"""
${notes}
"""`;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/ai/__tests__/site-notes-prompt.test.ts` → 2 passed.

- [ ] **Step 5: Gateway call**

`src/lib/site/read-site-notes.ts`:
```ts
import type { ClaimData } from '@/types';
import { callAIGateway } from '@/lib/ai/service';
import { buildSiteNotesPrompt } from '@/lib/ai/prompts';
import {
  siteNoteFields, allowsDamageRows, parseSiteNotesExtraction, planSiteNotes, type SiteNotesPlan,
} from './site-notes';

const EMPTY: SiteNotesPlan = { fills: [], conflicts: [], damageRows: [], unmapped: [] };

/** One text call on the surveyor's own key (~2K tokens). Throws if every provider fails. */
export async function readSiteNotes(claim: ClaimData): Promise<SiteNotesPlan> {
  const notes = (claim.siteNotes ?? '').trim();
  if (!notes) return EMPTY;
  const prompt = buildSiteNotesPrompt(notes, siteNoteFields(claim.surveyType), allowsDamageRows(claim.surveyType));
  const raw = await callAIGateway(prompt, [], 'json', 'text');
  return planSiteNotes(claim, parseSiteNotesExtraction(raw));
}
```

- [ ] **Step 6: Review dialog**

`src/components/site/SiteNotesReviewDialog.tsx`:
```tsx
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { SiteNotesPlan } from '@/lib/site/site-notes';

interface Props { plan: SiteNotesPlan; onApply: () => void; onClose: () => void }

/** Shows what the notes would fill. Only `fills` and new damage rows are applied. */
export function SiteNotesReviewDialog({ plan, onApply, onClose }: Props) {
  const applyCount = plan.fills.length + plan.damageRows.length;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fill fields from notes</DialogTitle>
        </DialogHeader>

        {plan.fills.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Will be filled</h3>
            {plan.fills.map((f) => (
              <div key={f.path} className="rounded-md border border-border p-2 text-sm">
                <div className="font-medium">{f.label}: {f.value}</div>
                {f.evidence && <div className="text-xs text-muted-foreground">“{f.evidence}”</div>}
              </div>
            ))}
          </section>
        )}

        {plan.damageRows.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Damage rows to add</h3>
            {plan.damageRows.map((r, i) => (
              <div key={i} className="rounded-md border border-border p-2 text-sm">
                {r.component} — {r.damage}
              </div>
            ))}
          </section>
        )}

        {plan.conflicts.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Already filled — not changed</h3>
            <p className="text-xs text-muted-foreground">Edit these by hand if the note is right.</p>
            {plan.conflicts.map((c) => (
              <div key={c.path} className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                {c.label}: kept “{c.current}”, notes say “{c.proposed}”
              </div>
            ))}
          </section>
        )}

        {plan.unmapped.length > 0 && (
          <section className="space-y-1">
            <h3 className="text-sm font-medium">Not understood</h3>
            {plan.unmapped.map((u, i) => (
              <div key={i} className="text-sm text-muted-foreground">“{u}”</div>
            ))}
          </section>
        )}

        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className="min-h-[44px] rounded-md border border-border px-4 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={applyCount === 0}
            className="min-h-[44px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Apply {applyCount}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```
If `Dialog` in `src/components/ui/dialog.tsx` (base-ui) names its open-change prop differently, match that file's `DialogPrimitive.Root.Props`.

- [ ] **Step 7: Type check + tests**

Run: `npx tsc --noEmit` → no new errors.
Run: `npx vitest run src/lib/ai src/lib/site` → all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/ai/__tests__/site-notes-prompt.test.ts src/lib/site/read-site-notes.ts src/components/site/SiteNotesReviewDialog.tsx
git commit -m "feat: read dictated site notes through the AI gateway with review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Navigate and call links

**Files:**
- Create: `src/lib/site/contact-links.ts`
- Create: `src/lib/site/__tests__/contact-links.test.ts`

**Interfaces:**
- Produces: `mapsDirectionsUrl(destination: string): string | null`; `telHref(phone: string): string | null`.

- [ ] **Step 1: Failing tests**

`src/lib/site/__tests__/contact-links.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mapsDirectionsUrl, telHref } from '../contact-links';

describe('contact links', () => {
  it('builds an encoded Google Maps directions URL', () => {
    expect(mapsDirectionsUrl(' Sharma Motors, Hadapsar ')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Sharma%20Motors%2C%20Hadapsar',
    );
    expect(mapsDirectionsUrl('  ')).toBeNull();
  });

  it('builds tel: links from messy numbers', () => {
    expect(telHref('+91 98220-12345')).toBe('tel:+919822012345');
    expect(telHref('n/a')).toBeNull();
    expect(telHref('123')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/site/__tests__/contact-links.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lib/site/contact-links.ts`:
```ts
/** Opens the Maps app on phones, Google Maps in a tab on laptops. */
export function mapsDirectionsUrl(destination: string): string | null {
  const d = destination.trim();
  return d ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d)}` : null;
}

/** tel: link, or null when the text is not a plausible phone number. */
export function telHref(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.replace(/\D/g, '').length >= 6 ? `tel:${cleaned}` : null;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/site/__tests__/contact-links.test.ts` → 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/site/contact-links.ts src/lib/site/__tests__/contact-links.test.ts
git commit -m "feat: maps and tap-to-call link helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The Site screen, routing, and phone landing

**Files:**
- Modify: `src/stores/ui-store.ts` (`AppTab`)
- Create: `src/lib/navigation/viewport.ts`
- Modify: `src/lib/claims/landing-tab.ts`, `src/lib/claims/__tests__/landing-tab.test.ts`
- Create: `src/components/site/SiteChecklistCard.tsx`
- Create: `src/components/tabs/SiteTab.tsx`
- Modify: `src/components/layout/Dashboard.tsx` (dynamic import, `TabPlaceholder`, landing call ~line 360)
- Modify: `src/components/dialogs/NewClaimDialog.tsx:285`
- Modify: `src/components/layout/sidebar.tsx` (`NAV_ITEMS`)
- Modify: `src/components/pwa/ServiceWorkerRegistrar.tsx` (`WARM_TABS`)

**Interfaces:**
- Consumes: `usePhotoUpload` (T1), `DriveQueueChip` (T3), `siteChecklist`/`ChecklistItem` (T8), `readSiteNotes` (T10), `siteNotesUpdates`/`isEmptyPlan`/`SiteNotesPlan` (T9), `SiteNotesReviewDialog` (T10), `mapsDirectionsUrl`/`telHref` (T11).
- Produces: `AppTab` includes `'site'`; `isNarrowViewport(): boolean`; `claimLandingTab(surveyType, narrow?: boolean): AppTab`.

- [ ] **Step 1: Failing landing test**

Append to `src/lib/claims/__tests__/landing-tab.test.ts` inside the `describe`:
```ts
  it('lands every survey type on the Site screen on a phone', () => {
    expect(claimLandingTab('spot', true)).toBe('site');
    expect(claimLandingTab('final', true)).toBe('site');
    expect(claimLandingTab('valuation', true)).toBe('site');
  });
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run src/lib/claims/__tests__/landing-tab.test.ts` → FAIL (type error / wrong value).

- [ ] **Step 3: Add the tab id and the landing rule**

In `src/stores/ui-store.ts`, add `| 'site'` as the first member after `'dashboard'` in the `AppTab` union.
In `src/lib/claims/landing-tab.ts` replace the function with:
```ts
export function claimLandingTab(surveyType: SurveyType | undefined, narrow = false): AppTab {
  // On a phone the Site screen is the start of the workflow for every survey type.
  if (narrow) return 'site';
  return surveyType === 'valuation' ? 'details' : 'documents';
}
```
Create `src/lib/navigation/viewport.ts`:
```ts
/** Phone layout: below Tailwind's `md` breakpoint (768 px). */
export function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/claims/__tests__/landing-tab.test.ts` → all pass.

- [ ] **Step 5: Pass the flag at both call sites**

`src/components/layout/Dashboard.tsx` ~line 360: `useUIStore.getState().setActiveTab(claimLandingTab(fullClaim.surveyType, isNarrowViewport()));` and add `import { isNarrowViewport } from '@/lib/navigation/viewport';`.
`src/components/dialogs/NewClaimDialog.tsx:285`: `setActiveTab(claimLandingTab(surveyType, isNarrowViewport()));` with the same import.
(A `?tab=` in the URL still wins on reload — `useRouteSync` is untouched.)

- [ ] **Step 6: Checklist card**

`src/components/site/SiteChecklistCard.tsx`:
```tsx
'use client';

import { ChevronRight, Camera } from 'lucide-react';
import type { ChecklistItem } from '@/lib/site/site-checklist';

interface Props {
  title: string;
  items: ChecklistItem[];
  onPick: (item: ChecklistItem) => void;
}

export function SiteChecklistCard({ title, items, onPick }: Props) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item)}
            className="flex w-full min-h-[48px] items-center justify-between gap-3 px-3 text-left text-sm"
          >
            <span>{item.label}</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {item.value && <span className="font-medium text-foreground">{item.value}</span>}
              {item.target === 'camera' ? <Camera size={16} /> : <ChevronRight size={16} />}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: The Site screen**

`src/components/tabs/SiteTab.tsx`:
```tsx
'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Camera, FileText, Images, MapPin, Phone, Loader2, Sparkles } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore } from '@/stores/ui-store';
import { usePhotoUpload } from '@/hooks/usePhotoUpload';
import { DriveQueueChip } from '@/components/sync/DriveQueueChip';
import { SiteChecklistCard } from '@/components/site/SiteChecklistCard';
import { SiteNotesReviewDialog } from '@/components/site/SiteNotesReviewDialog';
import { siteChecklist, type ChecklistItem } from '@/lib/site/site-checklist';
import { readSiteNotes } from '@/lib/site/read-site-notes';
import { siteNotesUpdates, isEmptyPlan, type SiteNotesPlan } from '@/lib/site/site-notes';
import { mapsDirectionsUrl, telHref } from '@/lib/site/contact-links';

const BIG_BUTTON = 'flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card p-4 min-h-[96px] text-sm font-medium';

export function SiteTab() {
  const claim = useClaimStore((s) => s.currentClaim);
  const updateClaim = useClaimStore((s) => s.updateClaim);
  const { setActiveTab, isOnline } = useUIStore();
  const { uploadPhotos, isProcessing, saveToCloudDialog } = usePhotoUpload();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [plan, setPlan] = useState<SiteNotesPlan | null>(null);

  if (!claim) return null;

  const { missing, confirm } = siteChecklist(claim);
  const navigate = mapsDirectionsUrl(claim.accident.workshopAddress || claim.accident.workshopName || '');
  const callWorkshop = telHref(claim.accident.workshopPhone || '');
  const callInsured = telHref(claim.policy.insuredMobile || '');

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void uploadPhotos(e.target.files);
    e.target.value = '';
  };

  const pick = (item: ChecklistItem) => {
    if (item.target === 'camera') cameraRef.current?.click();
    else setActiveTab(item.target);
  };

  const fillFromNotes = async () => {
    setReading(true);
    try {
      const result = await readSiteNotes(claim);
      if (isEmptyPlan(result)) toast.info('Nothing to fill from these notes.');
      else setPlan(result);
    } catch {
      toast.error("Couldn't read the notes — try again. Your notes are saved.");
    } finally {
      setReading(false);
    }
  };

  const apply = () => {
    const current = useClaimStore.getState().currentClaim;
    if (current && plan) updateClaim(siteNotesUpdates(current, plan));
    setPlan(null);
    toast.success('Fields filled from notes.');
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-4 pb-24">
      {saveToCloudDialog}
      {plan && <SiteNotesReviewDialog plan={plan} onApply={apply} onClose={() => setPlan(null)} />}

      <header className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="truncate text-base font-medium">{claim.vehicle.registrationNumber || 'New claim'}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {claim.surveyType} survey{claim.policy.insurerName ? ` · ${claim.policy.insurerName}` : ''}
          </p>
        </div>
        <DriveQueueChip />
      </header>

      <div className="grid grid-cols-3 gap-3">
        <button type="button" className={BIG_BUTTON} onClick={() => cameraRef.current?.click()} disabled={isProcessing}>
          {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
          Damage photo
        </button>
        <button type="button" className={BIG_BUTTON} onClick={() => setActiveTab('documents')}>
          <FileText size={24} /> Documents
        </button>
        <button type="button" className={BIG_BUTTON} onClick={() => galleryRef.current?.click()} disabled={isProcessing}>
          <Images size={24} /> Gallery
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />

      <SiteChecklistCard title="Still missing before you leave" items={missing} onPick={pick} />
      <SiteChecklistCard title="Confirm before you leave" items={confirm} onPick={pick} />

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Site notes</h3>
        <textarea
          value={claim.siteNotes ?? ''}
          onChange={(e) => updateClaim({ siteNotes: e.target.value })}
          rows={6}
          placeholder="Tap the mic on your keyboard and speak — damage, odometer, airbags, police, workshop…"
          className="w-full rounded-lg border border-border bg-card p-3 text-base"
        />
        <button
          type="button"
          onClick={fillFromNotes}
          disabled={!isOnline || reading || !(claim.siteNotes ?? '').trim()}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {reading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Fill fields from notes
        </button>
        {!isOnline && <p className="text-xs text-muted-foreground">Needs signal — your notes are saved.</p>}
      </section>

      {(navigate || callWorkshop || callInsured) && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contacts</h3>
          <div className="flex flex-wrap gap-2">
            {navigate && (
              <a href={navigate} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 text-sm">
                <MapPin size={16} /> Navigate to workshop
              </a>
            )}
            {callWorkshop && (
              <a href={callWorkshop} className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 text-sm">
                <Phone size={16} /> Call workshop
              </a>
            )}
            {callInsured && (
              <a href={callInsured} className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 text-sm">
                <Phone size={16} /> Call insured
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Route it, list it in the sidebar, warm its chunk**

`src/components/layout/Dashboard.tsx`: next to the other dynamic tab imports add
```ts
const SiteTab = dynamicImport(() => import('@/components/tabs/SiteTab').then(m => ({ default: m.SiteTab })), { ssr: false });
```
and in `TabPlaceholder`, before `if (tab === 'review')`, add `if (tab === 'site') return <SiteTab />;`.

`src/components/layout/sidebar.tsx`: add `MapPin` to the lucide import, and add as the first `'claim'` entry in `NAV_ITEMS`:
```ts
  { id: 'site', label: 'Site', icon: <MapPin size={17} />, group: 'claim', requiresClaim: true },
```

`src/components/pwa/ServiceWorkerRegistrar.tsx`: add `() => import('@/components/tabs/SiteTab'),` as the first entry of `WARM_TABS`.

- [ ] **Step 9: Type check + all unit tests**

Run: `npx tsc --noEmit` → no new errors.
Run: `npx vitest run src/lib src/stores` → all pass.

- [ ] **Step 10: Commit**

```bash
git add src/stores/ui-store.ts src/lib/navigation/viewport.ts src/lib/claims/landing-tab.ts src/lib/claims/__tests__/landing-tab.test.ts src/components/site/SiteChecklistCard.tsx src/components/tabs/SiteTab.tsx src/components/layout/Dashboard.tsx src/components/dialogs/NewClaimDialog.tsx src/components/layout/sidebar.tsx src/components/pwa/ServiceWorkerRegistrar.tsx
git commit -m "feat: site screen for phones with checklist, notes, and contacts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Manual check (phone): open a spot claim from the dashboard → lands on Site; reload keeps Site (`?tab=site`); on the laptop the same claim still lands on Documents and Site is in the sidebar; checklist rows jump to the right tab / open the camera; dictate notes with the Gboard mic → "Fill fields from notes" → dialog lists fills, conflicts, not-understood → Apply → fields and damage rows appear in Details; airplane mode → button disabled with the hint, notes still editable.

---

### Task 13: Phone bottom bar

**Files:**
- Create: `src/components/layout/MobileBottomBar.tsx`
- Modify: `src/components/layout/Dashboard.tsx` (`Dashboard` component)

**Interfaces:**
- Consumes: `isNavItemVisible` (T7), `'site'` tab (T12), existing `setSidebarMobileOpen`.

- [ ] **Step 1: The bar**

`src/components/layout/MobileBottomBar.tsx`:
```tsx
'use client';

import type { ReactNode } from 'react';
import { MapPin, ClipboardList, Camera, Printer, MoreHorizontal } from 'lucide-react';
import { useClaimStore } from '@/stores/claim-store';
import { useUIStore, type AppTab } from '@/stores/ui-store';
import { isNavItemVisible } from '@/lib/navigation/visible-nav';
import { cn } from '@/lib/utils';

const ITEMS: { id: AppTab; label: string; icon: ReactNode }[] = [
  { id: 'site', label: 'Site', icon: <MapPin size={20} /> },
  { id: 'details', label: 'Details', icon: <ClipboardList size={20} /> },
  { id: 'photos', label: 'Photos', icon: <Camera size={20} /> },
  { id: 'reports', label: 'Report', icon: <Printer size={20} /> },
];

/** Phone-only. "More" opens the existing drawer, which holds every other tab. */
export function MobileBottomBar() {
  const claim = useClaimStore((s) => s.currentClaim);
  const { activeTab, setActiveTab, setSidebarMobileOpen } = useUIStore();
  if (!claim) return null;

  const items = ITEMS.filter((i) => isNavItemVisible(i.id, claim.surveyType));
  const base = 'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px]';

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setActiveTab(item.id)}
          className={cn(base, activeTab === item.id ? 'text-primary font-medium' : 'text-muted-foreground')}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
      <button type="button" onClick={() => setSidebarMobileOpen(true)} className={cn(base, 'text-muted-foreground')}>
        <MoreHorizontal size={20} />
        More
      </button>
    </nav>
  );
}
```

- [ ] **Step 2: Mount it and leave room for it**

In `src/components/layout/Dashboard.tsx`, in the `Dashboard` component: add `const hasClaim = useClaimStore((s) => !!s.currentClaim);` after `const { activeTab } = useUIStore();`; import `{ MobileBottomBar } from '@/components/layout/MobileBottomBar'`; change `<main className="flex-1 overflow-y-auto bg-background">` to
```tsx
      <main className={`flex-1 overflow-y-auto bg-background ${hasClaim ? 'pb-16 md:pb-0' : ''}`}>
```
and render `<MobileBottomBar />` right after `</main>`.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit` → no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/MobileBottomBar.tsx src/components/layout/Dashboard.tsx
git commit -m "feat: bottom navigation bar on phones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Manual check (phone): with a claim open, the bar shows Site / Details / Photos / Report / More (a valuation claim shows the same set; tabs hidden for the survey type never appear); More opens the drawer; nothing on the last row of any tab is hidden behind the bar; the floating report preview does not cover the bar (if it does, note it for the P4 plan).

---

## Final verification (after Task 13)

- [ ] `npx vitest run` — whole suite; expected: everything that passed before still passes, plus the new tests. (Known unrelated failures in vendored `open-design/` are excluded by `vitest.config.ts`.)
- [ ] `npx tsc --noEmit` — no new errors.
- [ ] `npm run build` — succeeds; `out/sw.js` and `out/manifest.webmanifest` present.
- [ ] Report guardrail: generate a Final and a Spot report (PDF + print preview) on a test claim before and after the series; they must look identical (no report files were touched).
- [ ] Hand the user the phone checklist: the manual checks under Tasks 1–6 and 12–13, on one Android phone and, if available, one iPhone.
- [ ] Deploy only with the user's go-ahead, to the `-in` target (`motorsurveyos-in`), never the dead `motorsurveyos` site.
