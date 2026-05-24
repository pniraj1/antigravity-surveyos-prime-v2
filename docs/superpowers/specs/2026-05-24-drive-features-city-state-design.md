# Drive Features + City/State Fields — Design Spec

## Goal

Add three features to SurveyOS Prime V2:
1. **Duplicate Upload Detection** — prevent re-uploading the same file to Google Drive
2. **Per-Claim Drive File Listing** — show what files are on Drive for the current claim
3. **City/State fields** — add to the access-request form and profile

## Architecture

These three features are independent. They share no state and can be built in any order.

- Features 1 and 2 both interact with the existing Drive integration (`src/lib/drive/index.ts`)
- Feature 3 is purely a form + profile-store change with no Drive involvement

---

## Feature 1: Duplicate Upload Detection

### Problem

`uploadFileToDrive` in `src/lib/drive/index.ts` always creates a new file (POST). If a surveyor re-uploads a document (e.g. re-scans the RC book), Drive accumulates duplicate files in the claim folder. The surveyor has no way to know a file already exists until they check Drive manually.

### Solution

Before uploading, query the claim's Drive folder for a file with the same name. If found, show a dialog with three options: Replace, Keep Both, or Cancel.

### Data Flow

```
DocumentsTab onChange → uploadWithDuplicateCheck(claimId, fileName, blob, label)
  │
  ├─ getOrCreateClaimFolder(claimId, label) → folderId
  ├─ listFilesInFolder(folderId) → existing files
  │
  ├─ No match → uploadFileToDrive(claimId, fileName, blob, label)  [existing path]
  │
  └─ Match found → show DuplicateUploadDialog
       ├─ Replace  → deleteFile(existingFileId) then uploadFileToDrive(...)
       ├─ Keep Both → uploadFileToDrive(claimId, "rc (2).pdf", blob, label)
       └─ Cancel   → no-op
```

### New Files

**`src/lib/drive/upload-with-check.ts`**

Exports `uploadWithDuplicateCheck(claimId, fileName, blob, claimLabel, showDialog)`:

1. Gets the claim folder ID via `getOrCreateClaimFolder`
2. Calls `listFilesInFolder(folderId)` to get current files
3. Filters for a file matching `fileName` (case-insensitive)
4. If no match: delegates to `uploadFileToDrive` directly
5. If match: calls `showDialog(existingFile)` — a callback that returns a Promise resolving to `'replace' | 'keep-both' | 'cancel'`
6. On `'replace'`: calls `deleteFile(existingFileId)` then `uploadFileToDrive`
7. On `'keep-both'`: generates a suffixed name (e.g. `rc (2).pdf` — increments until unique), then calls `uploadFileToDrive` with the new name
8. On `'cancel'`: returns without uploading

The suffix logic: split filename at last `.` → `base (N).ext`. If `rc (2).pdf` also exists, try `rc (3).pdf`, etc.

**`src/components/dialogs/DuplicateUploadDialog.tsx`**

A modal dialog component:

Props:
- `fileName: string` — the name of the file being uploaded
- `onReplace: () => void`
- `onKeepBoth: () => void`
- `onCancel: () => void`

UI:
- Warning icon (amber)
- Title: "File Already Exists"
- Body: `"A file named '{fileName}' already exists in this claim's Drive folder."`
- Three buttons:
  - Replace (primary gold) — "Replace existing file"
  - Keep Both (outline) — "Upload as '{fileName} (2)'"
  - Cancel (text/ghost) — "Don't upload"
- Matches existing dialog style (rounded-2xl, white bg, navy text, gold primary button)

### Modified Files

**`src/lib/drive/index.ts`**

Add one new export:

```typescript
export async function deleteFile(fileId: string): Promise<void> {
  await driveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
  });
}
```

Note: `driveRequest` throws on non-2xx, and DELETE returns 204 (no body). The existing `driveRequest` checks `res.ok` — 204 is ok, so this works without modification.

**`src/components/tabs/DocumentsTab.tsx`**

In the file upload handler (~line 128-136):
- Replace `uploadFileToDrive(...)` with `uploadWithDuplicateCheck(...)`
- Pass a `showDialog` callback that renders `DuplicateUploadDialog` and returns a Promise
- Use React state to control dialog visibility and resolve the Promise on user choice

### Edge Cases

- **Drive not linked (no token):** `uploadWithDuplicateCheck` falls through to `uploadFileToDrive` which handles queuing. No duplicate check needed for queued uploads — they'll be checked when the queue flushes.
- **Network failure during list check:** Catch the error, fall through to direct upload (best-effort duplicate detection, not a hard gate).
- **Multiple files with same name already on Drive:** Replace deletes the first match only. Keep Both increments the suffix until unique.

---

## Feature 2: Per-Claim Drive File Listing

### Problem

Surveyors have no way to see what files are already on Drive for a claim without opening Google Drive manually. They can't verify uploads succeeded or see what's been uploaded from other devices.

### Solution

A `useClaimDriveFiles` hook that fetches the file list from the claim's Drive folder, caches it in IndexedDB for offline access, and a collapsible UI section in DocumentsTab to display it.

### Data Flow

```
DocumentsTab mounts → useClaimDriveFiles(claimId)
  │
  ├─ Read IDB cache → return cached files immediately (stale-while-revalidate)
  │
  ├─ Fetch from Drive API:
  │    getOrCreateClaimFolder(claimId) → folderId
  │    listFilesInFolder(folderId) → fresh files
  │
  ├─ Update IDB cache with fresh data
  └─ Return { files, loading, error, refresh }
```

### New Files

**`src/hooks/useClaimDriveFiles.ts`**

```typescript
interface DriveFileEntry {
  id: string;
  name: string;
  mimeType: string;
}

interface UseClaimDriveFilesResult {
  files: DriveFileEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
```

Hook behavior:
1. On mount (or when `claimId` changes): read cached files from IDB, set as initial `files`
2. If Drive is connected (`getDriveToken()` returns non-null): fetch fresh list from Drive
3. On success: update `files` state, write to IDB cache
4. On failure: keep cached data, set `error`
5. `refresh()` re-triggers the Drive fetch
6. If Drive is not connected: return cached data only, no error (not an error condition)

**IDB cache schema — added to `src/lib/storage/indexeddb.ts`:**

New object store: `driveFileCache`
- Key: `claimId` (string)
- Value: `{ claimId: string, files: DriveFileEntry[], updatedAt: string }`

New helpers:
- `getDriveFileCache(claimId): Promise<DriveFileEntry[] | null>`
- `setDriveFileCache(claimId, files): Promise<void>`

IDB version must be bumped by 1 in the `openDB` call. The `upgrade` handler adds the new store only if it doesn't exist (`if (!db.objectStoreNames.contains('driveFileCache'))`) so existing stores are preserved.

### Modified Files

**`src/components/tabs/DocumentsTab.tsx`**

Add a collapsible section at the bottom of the tab:

```
┌─────────────────────────────────────────┐
│ ▸ Files on Drive (5)            Refresh │
├─────────────────────────────────────────┤
│ 📄 rc.pdf                    Open ↗     │
│ 📄 dl.pdf                    Open ↗     │
│ 📄 policy.pdf                Open ↗     │
│ 📷 photos.zip                Open ↗     │
│ 📄 claim.pdf                 Open ↗     │
└─────────────────────────────────────────┘
```

- Collapsed by default, expands on click
- Each row: file type icon (based on mimeType), file name, "Open in Drive" link
- "Open in Drive" links to `https://drive.google.com/file/d/{fileId}/view`
- Refresh button calls `refresh()` from the hook
- Shows loading spinner during fetch
- If no files and not loading: "No files uploaded yet"
- If Drive not connected: "Connect Google Drive to see files"

### Edge Cases

- **No Drive folder yet for this claim:** `getOrCreateClaimFolder` returns/creates one. `listFilesInFolder` returns empty array. UI shows "No files uploaded yet."
- **Drive disconnected:** Hook returns cached data. UI shows cached files with a subtle "(cached)" indicator.
- **IDB version upgrade:** Existing users' databases get the new `driveFileCache` store on next open without losing existing data.

---

## Feature 3: City/State in Access Request

### Problem

The access-request form collects name, IRDAI licence, phone, and referral code — but not city or state. The admin has no way to know where a surveyor is located.

### Solution

Add City and State input fields to the Step 2 form. Write them to Firestore `profile/current` on submission. Add defaults to the profile store.

### Modified Files

**`src/app/access-request/page.tsx`**

In the `AccessRequestForm` component (~line 339-346), add two new state variables:

```typescript
const [city, setCity] = useState('');
const [state, setState] = useState('');
```

Add two input fields between the phone field and the referral code field:
- City: text input, optional, placeholder "City (e.g. Mumbai)"
- State: text input, optional, placeholder "State (e.g. Maharashtra)"

In the `handleSubmit` function, include `city` and `state` in the Firestore write:

```typescript
await setDoc(profileRef, {
  ...existingFields,
  city: city.trim(),
  state: state.trim(),
}, { merge: true });
```

These fields are optional — the form remains valid without them. No change to the `isValid` check.

**`src/stores/profile-store.ts`**

Add to `DEFAULT_PROFILE`:
```typescript
city: '',
state: '',
```

### No Type Changes Needed

`SurveyorProfile` in `src/types/vehicle.ts` already has:
```typescript
city?: string;
state?: string;
```

### Admin Visibility — Expandable Surveyor Row

**Problem:** Once a user moves from the Approval Queue to the Surveyors list, their email, phone, IRDAI licence, and (new) city/state become invisible to the admin. The SurveyorsTab table only shows name + subscription info.

**Solution:** Add an expandable detail card to each surveyor row. Click the row → an inline detail card expands below it showing all collected user information.

**Detail card fields:**

| Field | Source |
|-------|--------|
| Email | `profile/current.email` |
| Mobile | `profile/current.mobile` |
| IRDAI Licence | `profile/current.irdaiLicence` |
| City | `profile/current.city` |
| State | `profile/current.state` |
| Qualifications | `profile/current.qualifications` |
| Referral Code | `profile/current.referralCode` |
| Referred By | `profile/current.referredBy` |
| Join Date | `profile/current.createdAt` |
| Firebase UID | `profile id` (already available as `surveyor.id`) |

**UI layout:** A subtle card below the expanded row with a 2-column grid of label/value pairs. Light gray background (`bg-[#FAFBFC]`), border-top dashed. Collapse on second click or when another row is expanded.

### Modified Files for Admin Visibility

**`src/components/admin/types.ts`**

Extend `SurveyorAdminProfile` with the missing fields:

```typescript
export interface SurveyorAdminProfile {
  // existing fields...
  id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  licenceNumber?: string;
  subscriptionStatus: 'active' | 'suspended' | 'pending' | 'trial' | 'readonly';
  subscriptionExpiry: string;
  surveyorId: string;
  lastSync?: unknown;
  isAdmin?: boolean;
  trialStartDate?: string;
  trialEndDate?: string;
  lastPaymentDate?: string;
  // NEW — for expandable detail card
  mobile?: string;
  irdaiLicence?: string;
  city?: string;
  state?: string;
  qualifications?: string;
  referralCode?: string;
  referredBy?: string | null;
  createdAt?: unknown; // Firestore Timestamp or ISO string
}
```

Also extend `NewSignup` to include city/state:

```typescript
export interface NewSignup {
  // existing fields...
  // NEW
  profileCity: string;
  profileState: string;
}
```

**`src/components/admin/hooks/useAdminData.ts`**

In `fetchAllProfiles`, ensure the Firestore read includes the new fields. The current code likely reads the full `profile/current` document — verify that `mobile`, `irdaiLicence`, `city`, `state`, `qualifications`, `referralCode`, `referredBy`, `createdAt` are mapped into `SurveyorAdminProfile`.

In `fetchSignups` enrichment, also read `city` and `state` from `profile/current` and map to `profileCity` / `profileState`.

**`src/components/admin/tabs/SurveyorsTab.tsx`**

- Add `expandedId` state (string | null) — which row is expanded
- On row click: toggle `expandedId`
- When expanded, render a `<tr>` below the surveyor row containing the detail card
- Detail card: 2-column grid with all fields listed above
- Empty fields show "—"
- Email shows as a `mailto:` link
- Mobile shows as a `tel:` link

**`src/components/admin/tabs/ApprovalQueueTab.tsx`**

Add City and State to the signup row display (below the existing phone field), reading from `profileCity` / `profileState`.

---

## Files Summary

| File | Action | Feature |
|------|--------|---------|
| `src/lib/drive/upload-with-check.ts` | CREATE | 1 |
| `src/components/dialogs/DuplicateUploadDialog.tsx` | CREATE | 1 |
| `src/lib/drive/index.ts` | MODIFY — add `deleteFile` | 1 |
| `src/components/tabs/DocumentsTab.tsx` | MODIFY — swap upload call + add file list UI | 1, 2 |
| `src/hooks/useClaimDriveFiles.ts` | CREATE | 2 |
| `src/lib/storage/indexeddb.ts` | MODIFY — add `driveFileCache` store + helpers | 2 |
| `src/app/access-request/page.tsx` | MODIFY — add city/state inputs | 3 |
| `src/stores/profile-store.ts` | MODIFY — add defaults | 3 |
| `src/components/admin/types.ts` | MODIFY — extend SurveyorAdminProfile + NewSignup | 3 |
| `src/components/admin/hooks/useAdminData.ts` | MODIFY — fetch new fields from Firestore | 3 |
| `src/components/admin/tabs/SurveyorsTab.tsx` | MODIFY — add expandable detail row | 3 |
| `src/components/admin/tabs/ApprovalQueueTab.tsx` | MODIFY — show city/state | 3 |

## Testing

Each feature can be verified independently:

**Feature 1:** Upload a document → upload the same document again → dialog appears → test Replace, Keep Both, Cancel

**Feature 2:** Upload files to a claim → check "Files on Drive" section shows them → disconnect internet → reload → cached list still shows

**Feature 3:** Create a new account → access-request form shows City/State fields → submit → check Firestore profile/current has the values → admin logs in → clicks the surveyor row → detail card shows email, phone, IRDAI, city, state, qualifications, referral code, join date
