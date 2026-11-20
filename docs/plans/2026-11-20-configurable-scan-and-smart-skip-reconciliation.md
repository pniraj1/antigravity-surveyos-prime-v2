# Configurable Scan Scope & Smart Skip Reconciliation Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement surveyor-controlled scan limits (quick presets: 15d/10, 30d/25, 60d/50, custom up to 100) and an intelligent IndexedDB deduplication engine that skips already settled/dismissed emails, reuses cached payment vouchers with zero redundant AI calls, and displays live progress with cancellation.

**Architecture:** Client-side IndexedDB persistence (`surveyos-reconciliation` database) tracks processed email IDs and cached payment advice vouchers. The sync engine fetches message headers first, prunes already settled/dismissed emails, runs Gemini AI only on new payment vouchers, and caches unmatched advices for instant matching against future claims. A live progress dialog provides real-time stage updates and instant cancellation.

**Tech Stack:** Next.js 16 + React 19 + TypeScript 5 + IndexedDB (`idb`) + Gemini AI Gateway + Vitest + Tailwind CSS (Light Mode tokens).

---

### Task 1: Persistent Reconciliation IndexedDB Cache & Deduplication Store

**Files:**
- Modify: `src/types/payment-reconciliation.ts`
- Create: `src/lib/reconciliation/advice-cache.ts`
- Test: `src/lib/reconciliation/__tests__/advice-cache.test.ts`

**Step 1: Update type definitions in `src/types/payment-reconciliation.ts`**
Add types for processed email records and cached advice items:
```ts
export type EmailProcessingStatus = 'settled' | 'dismissed' | 'unmatched';

export interface ProcessedEmailRecord {
  messageId: string;
  subject: string;
  from: string;
  date: string;
  status: EmailProcessingStatus;
  matchedClaimId?: string;
  utrNumber?: string;
  processedAt: string;
}

export interface CachedPaymentAdviceRecord {
  id: string; // usually messageId or advice UTR
  sourceMessageId: string;
  claims: PaymentAdviceClaimItem[];
  utrNumber?: string;
  paymentDate?: string;
  insurerName?: string;
  extractedAt: string;
}
```

**Step 2: Write failing test in `src/lib/reconciliation/__tests__/advice-cache.test.ts`**
Test:
- Opening database `surveyos-reconciliation` with object stores `processed-emails` and `cached-advices`.
- `isEmailSettledOrDismissed`: returns true for settled/dismissed, false for new or unmatched.
- `saveProcessedEmail` and `getProcessedEmail`.
- `saveCachedAdvice` and `getCachedAdvice`.
- `getAllUnmatchedCachedAdvices`.
- `markEmailSettled`: updates status to `settled` with `matchedClaimId`.
- `clearReconciliationCache`: purges store for "Force Full Rescan".

**Step 3: Implement `src/lib/reconciliation/advice-cache.ts`**
Implement the idb database wrapper using standard `idb` openDB patterns matching `claim-folder-store.ts`.

**Step 4: Run tests**
Run: `npx vitest run src/lib/reconciliation/__tests__/advice-cache.test.ts`
Expected: PASS

**Step 5: Commit**
`git commit -m "feat(reconciliation): implement IndexedDB cache for processed emails and payment vouchers"`

---

### Task 2: Configurable Gmail Search Query & Two-Stage Header Pruning

**Files:**
- Modify: `src/lib/reconciliation/gmail-fetcher.ts`
- Test: `src/lib/reconciliation/__tests__/gmail-fetcher.test.ts`

**Step 1: Write failing tests in `src/lib/reconciliation/__tests__/gmail-fetcher.test.ts`**
Test:
- `buildGmailSearchQuery(senders, daysBack)` correctly generates `newer_than:15d`, `newer_than:60d`, etc.
- `listGmailMessageIds(accessToken, query, maxResults)` fetches message ID and threadId list without downloading heavy payloads.
- `fetchRecentPaymentEmails` handles configurable `maxResults` up to 100.

**Step 2: Implement header listing in `src/lib/reconciliation/gmail-fetcher.ts`**
Add:
```ts
export async function listGmailMessageIds(
  accessToken: string,
  query: string,
  maxResults = 25
): Promise<Array<{ id: string; threadId?: string }>>
```
This enables the sync engine to check 50 message IDs against IndexedDB in milliseconds, skipping settled emails *before* making individual `messages/{id}` payload requests!

**Step 3: Run tests**
Run: `npx vitest run src/lib/reconciliation/__tests__/gmail-fetcher.test.ts`
Expected: PASS

**Step 4: Commit**
`git commit -m "feat(reconciliation): support configurable search scope and two-stage message ID listing"`

---

### Task 3: Smart Reconciliation Sync Engine with Progress & AbortSignal

**Files:**
- Create: `src/lib/reconciliation/smart-sync-service.ts`
- Test: `src/lib/reconciliation/__tests__/smart-sync-service.test.ts`

**Step 1: Write failing tests in `src/lib/reconciliation/__tests__/smart-sync-service.test.ts`**
Test:
- Skips emails marked `settled` in advice-cache.
- Reuses `cached-advices` for known unmatched emails without calling AI.
- Downloads attachments and calls AI only for new messages.
- Reports progress via `onProgress({ current, total, stage, message })`.
- Aborts gracefully when `signal.aborted` is triggered.
- Handles `forceRescan: true` by bypassing the skip check.

**Step 2: Implement `src/lib/reconciliation/smart-sync-service.ts`**
```ts
export interface SyncProgressUpdate {
  phase: 'listing' | 'filtering' | 'processing' | 'matching' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface SmartSyncOptions {
  daysBack: number;
  maxResults: number;
  forceRescan?: boolean;
  signal?: AbortSignal;
  onProgress?: (update: SyncProgressUpdate) => void;
}

export interface SmartSyncResult {
  matches: PaymentMatchResult[];
  unmatchedAdvices: PaymentAdviceClaimItem[];
  stats: {
    totalFound: number;
    skippedSettled: number;
    cachedReused: number;
    newlyParsed: number;
  };
}
```

**Step 3: Run tests**
Run: `npx vitest run src/lib/reconciliation/__tests__/smart-sync-service.test.ts`
Expected: PASS

**Step 4: Commit**
`git commit -m "feat(reconciliation): implement smart sync service with deduplication and cancellation"`

---

### Task 4: Scan Scope Selector & Quick Presets UI

**Files:**
- Create: `src/components/reconciliation/ScanScopeSelector.tsx`
- Test: `src/components/reconciliation/__tests__/ScanScopeSelector.test.tsx`

**Step 1: Write failing tests in `src/components/reconciliation/__tests__/ScanScopeSelector.test.tsx`**
Test:
- Renders default preset: "Last 30 Days (25 emails)".
- Allows changing preset to 15d (10 emails), 60d (50 emails), 90d (100 emails).
- Allows custom configuration modal/popover (custom days 1-90, custom count 5-100).
- Emits selected configuration to parent.

**Step 2: Implement `src/components/reconciliation/ScanScopeSelector.tsx`**
- Compact dropdown / pill button styled with Executive Platinum theme (white card, amber-500 accents, high contrast text).
- Stores preferred preset in `localStorage` (`surveyos_preferred_scan_scope`).

**Step 3: Run tests**
Run: `npx vitest run src/components/reconciliation/__tests__/ScanScopeSelector.test.tsx`
Expected: PASS

**Step 4: Commit**
`git commit -m "feat(reconciliation): add scan scope selector with presets and custom limits"`

---

### Task 5: Live Scan Progress & Cancellation Modal

**Files:**
- Create: `src/components/reconciliation/ScanProgressModal.tsx`
- Test: `src/components/reconciliation/__tests__/ScanProgressModal.test.tsx`

**Step 1: Write failing tests in `src/components/reconciliation/__tests__/ScanProgressModal.test.tsx`**
Test:
- Renders progress percentage bar, current step count, and phase message.
- Clicking `[ Cancel Scan ]` triggers `onCancel`.
- Shows completion summary when finished.

**Step 2: Implement `src/components/reconciliation/ScanProgressModal.tsx`**
- Light-mode clean modal with animated amber pulse bar.
- Shows live counts: `Total Found: X | Skipped (Settled): Y | Reused: Z | New AI Parsed: N`.
- `[ Cancel ]` button immediately stops further processing.

**Step 3: Run tests**
Run: `npx vitest run src/components/reconciliation/__tests__/ScanProgressModal.test.tsx`
Expected: PASS

**Step 4: Commit**
`git commit -m "feat(reconciliation): add live progress modal with real-time stats and cancellation"`

---

### Task 6: Wire into `PaymentReconciliationTab.tsx` with Force Rescan & Instant Cache Match

**Files:**
- Modify: `src/components/tabs/PaymentReconciliationTab.tsx`
- Test: `src/components/tabs/__tests__/PaymentReconciliationTab.test.tsx`

**Step 1: Update `PaymentReconciliationTab.tsx`**
- Embed `ScanScopeSelector` right alongside `[ Check Gmail ]`.
- Wire `handleCheckGmail` to use `runSmartReconciliationSync`.
- Provide an `AbortController` hooked into `ScanProgressModal`.
- On initial mount or when active claims update, run `checkUnmatchedCachedAdvices` to auto-match previously unmatched advices against any newly created claims instantly!
- When clicking `Confirm & Settle`, call `markEmailSettled(item.messageId, item.matchedClaimId)`.
- Add secondary action menu on `Check Gmail` button: `[ ⚡ Force Full Rescan ]` to bypass skip filters if user ever needs to re-read everything.

**Step 2: Run tests**
Run: `npx vitest run src/components/tabs/__tests__/PaymentReconciliationTab.test.tsx`
Expected: PASS

**Step 3: Commit**
`git commit -m "feat(reconciliation): integrate smart sync, scope selection, and live progress modal in cockpit"`

---

### Task 7: Full Verification, Next.js Build & Firebase Deployment

**Step 1: Run comprehensive tests**
`npx vitest run src/lib/reconciliation/ src/components/reconciliation/ src/components/tabs/__tests__/PaymentReconciliationTab.test.tsx`

**Step 2: TypeScript typecheck**
`npx tsc --noEmit`

**Step 3: Build production assets**
`npm run build`

**Step 4: Deploy to Firebase Hosting**
`npx firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in`

**Step 5: Live verification**
Verify chunk via `curl.exe -I https://surveyos.in` and confirm live bundle contains new scope selector and smart skip cache.
