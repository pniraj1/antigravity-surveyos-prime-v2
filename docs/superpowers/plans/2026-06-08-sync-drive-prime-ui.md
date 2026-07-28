# SurveyOS Sync "Drive" — Prime V2 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a surveyor connect SurveyOS Sync to Prime V2 once (entering an 8-char code), then add documents into the Documents tab by browsing their Sync claims by vehicle and picking already-collected files — which then flow through Prime's existing AI extraction exactly like a local upload.

**Architecture:** Add a small bridge client (`src/lib/sync-bridge/`) that talks to the existing Sync Cloudflare Worker using a stored bridge token. Store the token in the existing `SurveyorProfile` (persisted + backed up). A "Connect SurveyOS Sync" dialog redeems the code → token. A "From SurveyOS Sync" picker dialog browses claims → documents and returns a `File`. The Documents tab feeds that `File` into the **same** `storeBlobUrl` + `triggerExtraction` path local uploads already use. Read-only; no Drive dependency.

**Tech Stack:** Next.js 16 (static export) + React 19, Zustand, shadcn/base-ui Dialog, Firebase Auth (for the surveyor's UID), Vitest (already configured).

---

## Prerequisites (must be true before this plan works)

1. **Backend deployed:** the Worker backend plan (`SurveyOS Sync/docs/superpowers/plans/2026-06-08-sync-drive-worker-backend.md`) is implemented and deployed — routes `/api/auth/link`, `/api/bridge/redeem`, `/api/bridge/claims`, `/api/bridge/claims/:id`, `/api/bridge/file/:claimId/:docId` are live.
2. **CORS allows `Authorization`:** the Worker's `cors()` in `worker/src/index.ts` currently sets
   `allowHeaders: ['Content-Type', 'X-Telegram-Init-Data']`. **It must also include `'Authorization'`**,
   or the browser will block Prime's preflight. This is a one-line change in the backend repo:
   `allowHeaders: ['Content-Type', 'X-Telegram-Init-Data', 'Authorization']`. Confirm it's done.
3. **Vitest is already configured** in Prime (`package.json` has `"test": "vitest run"`; existing tests under `src/lib/ai/__tests__/`). No new dependencies needed.

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/types/vehicle.ts` | `SurveyorProfile` type | Modify — add 2 connection fields |
| `src/stores/profile-store.ts` | Profile defaults | Modify — add defaults for the 2 fields |
| `src/lib/sync-bridge/types.ts` | Shared bridge DTOs | Create |
| `src/lib/sync-bridge/client.ts` | Worker API calls (redeem, list, detail, file) | Create |
| `src/lib/sync-bridge/__tests__/client.test.ts` | Unit tests (mocked fetch) | Create |
| `src/components/sync-bridge/ConnectSyncDialog.tsx` | Enter code → redeem → store token | Create |
| `src/components/sync-bridge/SyncDrivePicker.tsx` | Browse claims → docs → return a File | Create |
| `src/components/tabs/DocumentsTab.tsx` | Refactor `handleFile`; add "From SurveyOS Sync" entry | Modify |
| `src/components/tabs/ProfileTab.tsx` | "Connect SurveyOS Sync" entry point | Modify |

---

## Task 1: Add connection fields to the profile

**Files:**
- Modify: `src/types/vehicle.ts` (the `SurveyorProfile` interface)
- Modify: `src/stores/profile-store.ts:30-76` (DEFAULT_PROFILE)

- [ ] **Step 1: Add fields to `SurveyorProfile`**

In `src/types/vehicle.ts`, inside the `SurveyorProfile` interface, add (near the other optional
string fields):
```ts
  /** SurveyOS Sync bridge token — present once the surveyor connects the Sync "drive". */
  syncBridgeToken?: string;
  /** ISO timestamp when SurveyOS Sync was connected; null if never. */
  syncConnectedAt?: string | null;
```

- [ ] **Step 2: Add defaults**

In `src/stores/profile-store.ts`, in `DEFAULT_PROFILE` (after `reportYear`), add:
```ts
  syncBridgeToken: '',
  syncConnectedAt: null,
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/types/vehicle.ts src/stores/profile-store.ts
git commit -m "feat(sync-bridge): add connection fields to surveyor profile"
```

---

## Task 2: Bridge DTO types

**Files:**
- Create: `src/lib/sync-bridge/types.ts`

- [ ] **Step 1: Create the file**

```ts
// ═══════════════════════════════════════════════════════════
// SYNC BRIDGE — shared DTOs (match the Worker's response shapes)
// ═══════════════════════════════════════════════════════════

/** Standard envelope returned by every bridge route. */
export interface BridgeResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

/** A claim shown as a "folder" in the Sync drive picker. */
export interface SyncClaimSummary {
  claimId: string
  label: string            // "MH12AB1234 - HDFC ERGO"
  vehicleNumber: string
  insuranceCompany: string
  modelMake: string
  status: string
  totalDocs: number
  receivedDocs: number
}

/** A single document inside a claim. */
export interface SyncDocMeta {
  docId: string
  docType: string
  status: string
  mimeType: string
  fileSizeKb: number
  uploadedAt: string
  fileCount: number
}

/** Detail payload for one claim. */
export interface SyncClaimDetail {
  claimId: string
  vehicleNumber: string
  insuranceCompany: string
  modelMake: string
  documents: SyncDocMeta[]
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/lib/sync-bridge/types.ts
git commit -m "feat(sync-bridge): add bridge DTO types"
```

---

## Task 3: Bridge client (with mocked-fetch tests)

**Files:**
- Create: `src/lib/sync-bridge/client.ts`
- Test: `src/lib/sync-bridge/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/sync-bridge/__tests__/client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { redeemLinkCode, listSyncClaims, getSyncClaim, fetchSyncDocFile, SYNC_WORKER_URL } from '../client'

const okJson = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) } as Response)

describe('redeemLinkCode', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('POSTs code + uid and returns the bridge token', async () => {
    const fetchMock = vi.fn().mockReturnValue(okJson({ bridgeToken: 'tok-123' }))
    vi.stubGlobal('fetch', fetchMock)

    const token = await redeemLinkCode('ABCD1234', 'uid-9')

    expect(token).toBe('tok-123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SYNC_WORKER_URL}/api/bridge/redeem`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ code: 'ABCD1234', firebaseUid: 'uid-9' })
  })

  it('throws the worker error message on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ ok: false, error: 'Code expired — generate a new one' }),
    } as Response))
    await expect(redeemLinkCode('X', 'uid')).rejects.toThrow('Code expired')
  })
})

describe('listSyncClaims', () => {
  it('sends the bridge token as a Bearer and returns claims', async () => {
    const fetchMock = vi.fn().mockReturnValue(okJson([{ claimId: 'c1', label: 'MH12 - HDFC' }]))
    vi.stubGlobal('fetch', fetchMock)

    const claims = await listSyncClaims('tok-123')

    expect(claims).toHaveLength(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${SYNC_WORKER_URL}/api/bridge/claims`)
    expect(init.headers.Authorization).toBe('Bearer tok-123')
  })
})

describe('fetchSyncDocFile', () => {
  it('returns a File built from the streamed blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
      headers: new Headers({ 'Content-Type': 'image/jpeg' }),
    } as unknown as Response))

    const file = await fetchSyncDocFile('tok', 'c1', 'd1', 'RC Book')

    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('image/jpeg')
    expect(file.name).toMatch(/^RC Book\.(jpg|jpeg)$/)
    expect(file.size).toBe(3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- client.test`
Expected: FAIL with "Cannot find module '../client'".

- [ ] **Step 3: Implement the client**

Create `src/lib/sync-bridge/client.ts`:
```ts
// ═══════════════════════════════════════════════════════════
// SYNC BRIDGE CLIENT — calls the SurveyOS Sync Cloudflare Worker.
// Read-only. Auth via the per-surveyor bridge token (Bearer).
// ═══════════════════════════════════════════════════════════

import type { BridgeResponse, SyncClaimSummary, SyncClaimDetail } from './types'

export const SYNC_WORKER_URL = 'https://surveyos-sync-worker.pnirajindia.workers.dev'

function extFor(mimeType: string): string {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('pdf')) return 'pdf'
  return 'jpg'
}

async function parse<T>(resp: Response): Promise<T> {
  const json = (await resp.json()) as BridgeResponse<T>
  if (!json.ok || json.data === undefined) {
    throw new Error(json.error ?? 'SurveyOS Sync request failed')
  }
  return json.data
}

/** Exchange a one-time link code (+ Firebase UID) for a long-lived bridge token. */
export async function redeemLinkCode(code: string, firebaseUid: string): Promise<string> {
  const resp = await fetch(`${SYNC_WORKER_URL}/api/bridge/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, firebaseUid }),
  })
  const data = await parse<{ bridgeToken: string }>(resp)
  return data.bridgeToken
}

/** List the surveyor's Sync claims (drive "folders"). */
export async function listSyncClaims(token: string): Promise<SyncClaimSummary[]> {
  const resp = await fetch(`${SYNC_WORKER_URL}/api/bridge/claims`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parse<SyncClaimSummary[]>(resp)
}

/** Get one claim's document manifest. */
export async function getSyncClaim(token: string, claimId: string): Promise<SyncClaimDetail> {
  const resp = await fetch(`${SYNC_WORKER_URL}/api/bridge/claims/${encodeURIComponent(claimId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parse<SyncClaimDetail>(resp)
}

/** Stream one document's bytes and wrap them as a File for the existing upload flow. */
export async function fetchSyncDocFile(
  token: string,
  claimId: string,
  docId: string,
  docType: string,
): Promise<File> {
  const resp = await fetch(
    `${SYNC_WORKER_URL}/api/bridge/file/${encodeURIComponent(claimId)}/${encodeURIComponent(docId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!resp.ok) throw new Error('Could not download the document from SurveyOS Sync')
  const blob = await resp.blob()
  const mime = resp.headers.get('Content-Type') ?? blob.type ?? 'application/octet-stream'
  const safeType = docType.replace(/[^\w\- ]+/g, '').trim() || 'document'
  return new File([blob], `${safeType}.${extFor(mime)}`, { type: mime })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- client.test`
Expected: PASS (redeem, list, fetchFile assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync-bridge/client.ts src/lib/sync-bridge/__tests__/client.test.ts
git commit -m "feat(sync-bridge): add worker API client with tests"
```

---

## Task 4: "Connect SurveyOS Sync" dialog

**Files:**
- Create: `src/components/sync-bridge/ConnectSyncDialog.tsx`

- [ ] **Step 1: Implement the dialog**

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { redeemLinkCode } from '@/lib/sync-bridge/client';
import { toast } from 'sonner';
import { Loader2, Plane } from 'lucide-react';

interface ConnectSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectSyncDialog({ open, onOpenChange }: ConnectSyncDialogProps) {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const handleConnect = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 8) {
      toast.error('Enter the 8-character code from SurveyOS Sync.');
      return;
    }
    if (!user?.uid) {
      toast.error('Please sign in first.');
      return;
    }
    setBusy(true);
    try {
      const token = await redeemLinkCode(trimmed, user.uid);
      updateProfile({ syncBridgeToken: token, syncConnectedAt: new Date().toISOString() });
      toast.success('SurveyOS Sync connected.');
      setCode('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect SurveyOS Sync.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane size={16} /> Connect SurveyOS Sync
          </DialogTitle>
          <DialogDescription>
            In the SurveyOS Sync app, open Settings → &ldquo;Connect to motorsurveyos&rdquo; to get an
            8-character code, then enter it here. Valid for 10 minutes.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. K7M4P2QX"
          maxLength={8}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleConnect} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/sync-bridge/ConnectSyncDialog.tsx
git commit -m "feat(sync-bridge): add Connect SurveyOS Sync dialog"
```

---

## Task 5: "From SurveyOS Sync" document picker

**Files:**
- Create: `src/components/sync-bridge/SyncDrivePicker.tsx`

Two-pane flow: list claims → on click, load that claim's documents → on click a document, download
it and hand a `File` back to the caller via `onPick`.

- [ ] **Step 1: Implement the picker**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useProfileStore } from '@/stores/profile-store';
import { listSyncClaims, getSyncClaim, fetchSyncDocFile } from '@/lib/sync-bridge/client';
import type { SyncClaimSummary, SyncClaimDetail } from '@/lib/sync-bridge/types';
import { toast } from 'sonner';
import { Loader2, ChevronLeft, FileText, Car } from 'lucide-react';

interface SyncDrivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (file: File, docType: string) => void;
}

export function SyncDrivePicker({ open, onOpenChange, onPick }: SyncDrivePickerProps) {
  const token = useProfileStore((s) => s.profile.syncBridgeToken) ?? '';
  const [claims, setClaims] = useState<SyncClaimSummary[]>([]);
  const [detail, setDetail] = useState<SyncClaimDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Load the claim list whenever the dialog opens (manual freshness — re-opens re-fetch).
  useEffect(() => {
    if (!open || !token) return;
    setDetail(null);
    setLoading(true);
    listSyncClaims(token)
      .then(setClaims)
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not load Sync claims.'))
      .finally(() => setLoading(false));
  }, [open, token]);

  const openClaim = async (claimId: string) => {
    setLoading(true);
    try {
      setDetail(await getSyncClaim(token, claimId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  };

  const pickDoc = async (docId: string, docType: string) => {
    if (!detail) return;
    setDownloadingId(docId);
    try {
      const file = await fetchSyncDocFile(token, detail.claimId, docId, docType);
      onPick(file, docType);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download the document.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {detail && (
              <button onClick={() => setDetail(null)} className="hover:opacity-70" aria-label="Back">
                <ChevronLeft size={16} />
              </button>
            )}
            {detail ? `${detail.vehicleNumber} - ${detail.insuranceCompany}` : 'SurveyOS Sync — pick a document'}
          </DialogTitle>
          <DialogDescription>
            {detail ? 'Tap a document to add it to this claim.' : 'Choose a vehicle/claim to see its collected documents.'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="animate-spin" size={20} />
          </div>
        )}

        {!loading && !detail && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {claims.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No claims found in SurveyOS Sync.</p>
            ) : claims.map((c) => (
              <button
                key={c.claimId}
                onClick={() => openClaim(c.claimId)}
                className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/50 px-2 rounded-md"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Car size={15} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{c.label}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{c.receivedDocs} docs</span>
              </button>
            ))}
          </div>
        )}

        {!loading && detail && (
          <div className="max-h-80 overflow-y-auto divide-y">
            {detail.documents.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No received documents in this claim.</p>
            ) : detail.documents.map((d) => (
              <button
                key={d.docId}
                onClick={() => pickDoc(d.docId, d.docType)}
                disabled={downloadingId !== null}
                className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/50 px-2 rounded-md disabled:opacity-50"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FileText size={15} className="shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{d.docType}</span>
                </span>
                {downloadingId === d.docId
                  ? <Loader2 size={14} className="animate-spin shrink-0" />
                  : <span className="text-xs text-muted-foreground shrink-0">{d.fileSizeKb} KB</span>}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/sync-bridge/SyncDrivePicker.tsx
git commit -m "feat(sync-bridge): add SurveyOS Sync document picker"
```

---

## Task 6: Wire the picker into the Documents tab

**Files:**
- Modify: `src/components/tabs/DocumentsTab.tsx`

Refactor so a `File` from any source (local input OR Sync) runs the same pipeline, then add a
header button that opens the picker.

- [ ] **Step 1: Extract a source-agnostic `processFile`**

In `DocumentsTab.tsx`, replace the existing `handleFile` function (lines ~127-159) with:
```tsx
  const processFile = (file: File, key: string) => {
    // Register file in EvidenceStore so the Evidence Viewer can display it
    if (currentClaim?.id) {
      storeBlobUrl(currentClaim.id, key, file);
    }

    // AI extraction
    triggerExtraction(key, file);

    // Non-blocking Drive upload with duplicate detection (only if Drive is on)
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
        console.error('[DocumentsTab] Drive upload failed:', err);
      });
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file, key);
    e.target.value = '';
  };
```

- [ ] **Step 2: Add picker state + imports**

At the top of `DocumentsTab.tsx`, add to the lucide import list `Plane`, and add a new import:
```tsx
import { SyncDrivePicker } from '@/components/sync-bridge/SyncDrivePicker';
```
Inside the component (near the other `useState` calls, ~line 80), add:
```tsx
  const [syncPickerOpen, setSyncPickerOpen] = useState(false);
  const syncConnected = !!profile.syncBridgeToken;
```

- [ ] **Step 3: Add a "From SurveyOS Sync" button in the header**

In the header's right-hand controls block (the `flex flex-col items-end gap-2` div around line 194),
add below `<ProviderToggle />`:
```tsx
              {syncConnected && (
                <button
                  onClick={() => setSyncPickerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}
                >
                  <Plane size={12} /> Add from SurveyOS Sync
                </button>
              )}
```

- [ ] **Step 4: Render the picker**

Just before the closing `</div>` of the component (after the `DuplicateUploadDialog` block, ~line 534),
add:
```tsx
      {/* SurveyOS Sync document picker */}
      <SyncDrivePicker
        open={syncPickerOpen}
        onOpenChange={setSyncPickerOpen}
        onPick={(file) => {
          // Map the picked file into a doc slot by its docType, falling back to a generic key.
          // Default to the RC slot is wrong — instead use a slot derived from the file name.
          const key = file.name.toLowerCase().includes('rc') ? 'rc'
            : file.name.toLowerCase().includes('licen') ? 'dl'
            : file.name.toLowerCase().includes('policy') ? 'policy'
            : file.name.toLowerCase().includes('bill') ? 'final-bill'
            : 'claim';
          processFile(file, key);
        }}
      />
```

> Note: the `onPick` slot-mapping above is a deliberately simple heuristic. If a cleaner mapping is
> wanted (e.g. let the user choose which Prime slot the Sync doc fills), that's a follow-up — keep
> this heuristic for the first version so the flow is end-to-end working.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/tabs/DocumentsTab.tsx
git commit -m "feat(sync-bridge): add SurveyOS Sync source to Documents tab"
```

---

## Task 7: "Connect SurveyOS Sync" entry in Profile

**Files:**
- Modify: `src/components/tabs/ProfileTab.tsx`

- [ ] **Step 1: Add state + dialog**

At the top of `ProfileTab.tsx`, add imports:
```tsx
import { useState } from 'react';
import { ConnectSyncDialog } from '@/components/sync-bridge/ConnectSyncDialog';
import { useProfileStore } from '@/stores/profile-store';
import { Plane, CheckCircle2 } from 'lucide-react';
```
(If some of these are already imported, merge — do not duplicate.)

Inside the component body, add:
```tsx
  const [connectOpen, setConnectOpen] = useState(false);
  const syncConnectedAt = useProfileStore((s) => s.profile.syncConnectedAt);
  const updateProfile = useProfileStore((s) => s.updateProfile);
```

- [ ] **Step 2: Add a settings row (place it near other integration/settings cards)**

```tsx
      <div className="rounded-2xl border p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Plane size={18} className="text-[#D4AF37]" />
          <div>
            <div className="text-sm font-bold">SurveyOS Sync</div>
            <div className="text-xs text-muted-foreground">
              {syncConnectedAt
                ? `Connected ${new Date(syncConnectedAt).toLocaleDateString()}`
                : 'Pull documents collected from insureds/garages.'}
            </div>
          </div>
        </div>
        {syncConnectedAt ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-bold text-green-600">
              <CheckCircle2 size={14} /> Connected
            </span>
            <button
              onClick={() => updateProfile({ syncBridgeToken: '', syncConnectedAt: null })}
              className="text-xs font-bold text-red-500 hover:underline"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConnectOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-[#0D1B2A] text-white"
          >
            Connect
          </button>
        )}
      </div>

      <ConnectSyncDialog open={connectOpen} onOpenChange={setConnectOpen} />
```

- [ ] **Step 3: Type-check + commit**

```bash
npx tsc --noEmit
git add src/components/tabs/ProfileTab.tsx
git commit -m "feat(sync-bridge): add Connect/Disconnect entry to Profile"
```

---

## Task 8: End-to-end verification

Requires: backend deployed (with the `Authorization` CORS fix), a verified Sync surveyor with at
least one claim containing a received document, and a Prime account signed in with Firebase.

- [ ] **Step 1: Unit tests + type-check green**

Run: `npm test && npx tsc --noEmit`
Expected: both PASS.

- [ ] **Step 2: Build (static export must still succeed)**

Run: `npm run build`
Expected: Next.js build completes; `out/` produced with no type errors.

- [ ] **Step 3: Manual connect flow**

Run `npm run dev`. In the Sync app, generate a link code (Settings → Connect to motorsurveyos).
In Prime → Profile → SurveyOS Sync → **Connect**, enter the code.
Expected: toast "SurveyOS Sync connected"; the row shows "Connected"; `localStorage['surveyos-profile']`
contains a non-empty `syncBridgeToken`.

- [ ] **Step 4: Manual pick flow**

Open a claim → Documents tab → **Add from SurveyOS Sync** → pick a vehicle → pick a document.
Expected: the AI extraction overlay runs (same as a local upload), and the document appears in the
Evidence Viewer. Confirm with DevTools Network that `GET /api/bridge/file/...` returned 200 with the
file bytes and no CORS error.

- [ ] **Step 5: No-Drive case**

Disconnect Google Drive (or use an account that never linked it). Repeat Step 4.
Expected: the Sync document still loads and extracts (Drive upload is skipped, not required).

- [ ] **Step 6: Commit any fixes + tag**

```bash
git tag sync-drive-prime-v1
```

---

## Self-review notes

- **Spec coverage:** Connect/UID validation → Tasks 1, 4, 7 (token stored in profile; redeem uses
  `user.uid`). Browse-by-vehicle picker → Task 5. Documents appear in Prime + feed AI extraction →
  Task 6 (`processFile` reuses `storeBlobUrl` + `triggerExtraction`). Read-only + Drive-optional →
  Task 6 keeps Drive upload behind the existing `autoUploadDrive` flag; Task 8 Step 5 verifies the
  no-Drive path.
- **Type consistency:** `redeemLinkCode`/`listSyncClaims`/`getSyncClaim`/`fetchSyncDocFile` signatures
  match between `client.ts`, its tests, and the dialog/picker consumers. `SyncClaimSummary` /
  `SyncClaimDetail` / `SyncDocMeta` shapes match the Worker's `bridge.ts` responses (Task 5 of the
  backend plan). `SurveyorProfile.syncBridgeToken` added in Task 1 is read in Tasks 5–7.
- **Follow-ups (not blockers):** (1) smarter Sync-doc → Prime-slot mapping (let the user choose the
  slot); (2) a "Connect" prompt could also live in the Documents tab when not connected; (3) optional
  IndexedDB caching of streamed bytes for offline re-view (current flow relies on the existing
  EvidenceStore blob registration).
```
