# Payment Reconciliation & Received Fees Cockpit Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a dedicated, client-side "Payment Reconciliation" cockpit tab in SurveyOS Prime V2 that tracks fee receivables, learns verified insurer email senders, ingests payment advice emails/PDFs and bank statements, and strictly matches payments to claims via Claim Number and Vehicle Number (never by amount alone).

**Architecture:** A dedicated top-level workspace tab (`payment-reconciliation`) mounted via dynamic import in Next.js 16. It operates across all claims using client-side IndexedDB, integrates with the existing Google OAuth token for scoped Gmail advice search, parses payment documents with Gemini 2.0 Flash structured outputs, enforces strict identifier matching, and provides a 3-zone visual cockpit (KPI summary cards, pending matching queue, and a responsive master fee ledger).

**Tech Stack:** Next.js 16 (Static Export), React 19, TypeScript 5, Tailwind CSS with Brand Orange theme (`#F59E0B`), Lucide React icons, Sonner toasts, Vitest for unit testing, Gemini Flash Multimodal Structured Extraction, Google Workspace Gmail API (client-side REST).

---

## Strict Domain & Architectural Constraints
1. **Zero Blind Amount Matching:** Under no circumstance will a payment be matched to a claim based on fee amount alone. Standard fee amounts (e.g. ₹500, ₹1,200, ₹1,500) repeat across dozens of claims. Matching requires **Claim Number** or **Vehicle Registration Number**. Unidentified payments sit in an "Unmatched Payments" queue for surveyor assignment.
2. **Client-Side First & Free:** Uses the surveyor's existing Google OAuth token and BYOK Gemini API keys. No external server, no stored credentials.
3. **Team Privacy Protection:** If an assistant is logged in and `hideEarningsFromTeam: true` is set by the firm owner, the tab is hidden from navigation and URL access is blocked.
4. **SurveyOS Scan Coupler:** This feature touches Prime V2 web client financial tracking only. Claim document types, folder names, and mobile scan coupling points remain 100% untouched (Scan drift impact: 0).

---

### Task 1: Data Model Expansion for Fee Payments & Reconciliations

**Files:**
- Modify: `src/types/assessment.ts` (or `src/types/claim.ts`)
- Create: `src/types/payment-reconciliation.ts`
- Test: `src/types/__tests__/payment-reconciliation.test.ts`

**Step 1: Write the failing test**
Create `src/types/__tests__/payment-reconciliation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type { PaymentAdvice, PaymentAdviceClaimItem, PaymentMatchResult } from '@/types/payment-reconciliation';
import type { FeeBill } from '@/types/assessment';

describe('Payment Reconciliation Types & Model', () => {
  it('supports expanded payment tracking fields on FeeBill', () => {
    const feeBill: FeeBill = {
      billDate: '2026-11-19',
      professionalFee: 1500,
      riFee: 0,
      travelExpenses: 300,
      travelNote: '',
      distanceKm: 30,
      ratePerKm: 10,
      tollCharges: 0,
      tollNote: '',
      photosCount: 12,
      photoRate: 15,
      postalCharges: 0,
      haltageCharges: 0,
      includeGST: false,
      advanceReceipt: '',
      cashReceived: '',
      salvageValue: 0,
      lessExcess: 0,
      compulsoryExcess: 0,
      voluntaryExcess: 0,
      towingCharges: 0,
      feePaid: true,
      // Enhanced fields
      paymentStatus: 'paid',
      amountReceived: 1800,
      tdsDeducted: 180,
      paymentDate: '2026-11-18',
      utrNumber: 'CMS93821019',
      paymentAdviceSource: 'New India Payment Advice',
    };

    expect(feeBill.paymentStatus).toBe('paid');
    expect(feeBill.amountReceived).toBe(1800);
    expect(feeBill.tdsDeducted).toBe(180);
    expect(feeBill.utrNumber).toBe('CMS93821019');
  });

  it('validates PaymentAdvice structure with multiple claims', () => {
    const advice: PaymentAdvice = {
      id: 'adv-123',
      insurerName: 'The New India Assurance Co. Ltd.',
      paymentDate: '2026-11-15',
      utrNumber: 'CMS93821019',
      totalAmount: 4500,
      totalTds: 500,
      netPaid: 4000,
      claims: [
        {
          claimNumber: '31010031240100001234',
          vehicleNumber: 'MH-12-AB-1234',
          grossFee: 2000,
          conveyance: 500,
          tdsAmount: 250,
          netPaid: 2250,
        },
      ],
      rawSource: 'PaymentAdvice_310100.pdf',
    };

    expect(advice.claims.length).toBe(1);
    expect(advice.claims[0].claimNumber).toBe('31010031240100001234');
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/types/__tests__/payment-reconciliation.test.ts`
Expected: FAIL (cannot find module `@/types/payment-reconciliation`).

**Step 3: Write minimal implementation**
1. Create `src/types/payment-reconciliation.ts`:
```typescript
export type PaymentStatus = 'unpaid' | 'paid' | 'partial';

export interface PaymentAdviceClaimItem {
  claimNumber: string;
  vehicleNumber?: string;
  policyNumber?: string;
  grossFee: number;
  conveyance?: number;
  tdsAmount?: number;
  netPaid: number;
  remarks?: string;
}

export interface PaymentAdvice {
  id: string;
  insurerName: string;
  paymentDate: string;
  utrNumber: string;
  totalAmount: number;
  totalTds: number;
  netPaid: number;
  claims: PaymentAdviceClaimItem[];
  rawSource: string;
  createdAt?: string;
}

export type MatchConfidence = 'exact_claim_no' | 'exact_vehicle_no' | 'manual';

export interface PaymentMatchResult {
  id: string;
  adviceClaim: PaymentAdviceClaimItem;
  matchedClaimId?: string;
  vehicleNo?: string;
  reportNo?: string;
  billedTotal: number;
  status: 'matched' | 'unmatched';
  confidence?: MatchConfidence;
  utrNumber: string;
  paymentDate: string;
  insurerName: string;
}

export interface InsurerSenderConfig {
  email: string;
  insurerName: string;
  subjectKeywords?: string[];
  lastUsed?: string;
}
```

2. Modify `src/types/assessment.ts` to add optional enhanced payment tracking fields to `FeeBill`:
```typescript
export interface FeeBill {
  // ... existing fields ...
  paymentStatus?: 'unpaid' | 'paid' | 'partial';
  amountReceived?: number;
  tdsDeducted?: number;
  paymentDate?: string;
  utrNumber?: string;
  paymentAdviceSource?: string;
}
```

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/types/__tests__/payment-reconciliation.test.ts`
Expected: PASS.

**Step 5: Commit**
Run: `git commit -F -` with message: `feat(reconciliation): add payment reconciliation data types and feeBill tracking fields`

---

### Task 2: Deterministic Identifier-First Matching Engine

**Files:**
- Create: `src/lib/reconciliation/matcher.ts`
- Create: `src/lib/reconciliation/__tests__/matcher.test.ts`

**Step 1: Write the failing test**
Create `src/lib/reconciliation/__tests__/matcher.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { matchPaymentAdvicesToClaims, normalizeClaimNumber, normalizeVehicleNumber } from '../matcher';
import type { PaymentAdviceClaimItem } from '@/types/payment-reconciliation';

describe('Payment Matcher', () => {
  it('normalizes claim numbers by stripping special characters and spaces', () => {
    expect(normalizeClaimNumber('310100/31/24/01/00001234')).toBe('31010031240100001234');
    expect(normalizeClaimNumber('CL-2024-9988')).toBe('CL20249988');
  });

  it('normalizes vehicle numbers to uppercase alphanumeric', () => {
    expect(normalizeVehicleNumber('mh-12-ab-1234')).toBe('MH12AB1234');
    expect(normalizeVehicleNumber('DL 1C AA 9999')).toBe('DL1CAA9999');
  });

  it('matches by exact normalized claim number', () => {
    const claims = [
      { id: 'c1', claimNo: '310100/31/24/01/00001234', vehicleNo: 'MH-12-AB-1234', feeTotal: 2000 },
      { id: 'c2', claimNo: '310100/31/24/01/00005678', vehicleNo: 'MH-14-CD-5678', feeTotal: 2500 },
    ];
    const item: PaymentAdviceClaimItem = {
      claimNumber: '31010031240100001234',
      vehicleNumber: '',
      grossFee: 2000,
      netPaid: 1800,
    };

    const matches = matchPaymentAdvicesToClaims([item], claims as any, 'CMS123', '2026-11-15', 'New India');
    expect(matches[0].status).toBe('matched');
    expect(matches[0].matchedClaimId).toBe('c1');
    expect(matches[0].confidence).toBe('exact_claim_no');
  });

  it('matches by exact vehicle number when claim number is absent', () => {
    const claims = [
      { id: 'c1', claimNo: '310100/31/24/01/00001234', vehicleNo: 'MH-12-AB-1234', feeTotal: 2000 },
    ];
    const item: PaymentAdviceClaimItem = {
      claimNumber: '',
      vehicleNumber: 'MH12 AB 1234',
      grossFee: 2000,
      netPaid: 1800,
    };

    const matches = matchPaymentAdvicesToClaims([item], claims as any, 'CMS123', '2026-11-15', 'New India');
    expect(matches[0].status).toBe('matched');
    expect(matches[0].matchedClaimId).toBe('c1');
    expect(matches[0].confidence).toBe('exact_vehicle_no');
  });

  it('NEVER matches by amount alone — leaves transaction as unmatched', () => {
    const claims = [
      { id: 'c1', claimNo: '310100/31/24/01/00001234', vehicleNo: 'MH-12-AB-1234', feeTotal: 1500 },
      { id: 'c2', claimNo: '310100/31/24/01/00005678', vehicleNo: 'MH-14-CD-5678', feeTotal: 1500 },
    ];
    // Payment advice has matching amount but unknown/unrecognized claim and vehicle
    const item: PaymentAdviceClaimItem = {
      claimNumber: 'UNKNOWN/9999',
      vehicleNumber: 'KA-01-XX-0000',
      grossFee: 1500,
      netPaid: 1350,
    };

    const matches = matchPaymentAdvicesToClaims([item], claims as any, 'CMS123', '2026-11-15', 'New India');
    expect(matches[0].status).toBe('unmatched');
    expect(matches[0].matchedClaimId).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/reconciliation/__tests__/matcher.test.ts`
Expected: FAIL (module not found).

**Step 3: Write minimal implementation**
Create `src/lib/reconciliation/matcher.ts`:
- `normalizeClaimNumber(val: string): string`
- `normalizeVehicleNumber(val: string): string`
- `matchPaymentAdvicesToClaims(items: PaymentAdviceClaimItem[], claimsList: ClaimSummary[], utrNumber: string, paymentDate: string, insurerName: string): PaymentMatchResult[]`

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/reconciliation/__tests__/matcher.test.ts`
Expected: PASS.

**Step 5: Commit**
Run: `git commit -F -` with message: `feat(reconciliation): implement strict identifier-first payment matching engine`

---

### Task 3: Sample Sender Store & Config (Learn From Verified Senders)

**Files:**
- Create: `src/lib/reconciliation/sample-store.ts`
- Create: `src/lib/reconciliation/__tests__/sample-store.test.ts`

**Step 1: Write the failing test**
Create `src/lib/reconciliation/__tests__/sample-store.test.ts` testing:
- Default pre-seeded insurer senders (NIA, UIIC, OIC, NIC, ICICI Lombard, etc.).
- Saving a new surveyor-provided sender email address.
- Removing a sender.
- Loading stored senders from `localStorage`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/reconciliation/__tests__/sample-store.test.ts`

**Step 3: Write minimal implementation**
Implement `sample-store.ts` with:
- `DEFAULT_INSURER_SENDERS: InsurerSenderConfig[]`
- `loadSavedSenders(): InsurerSenderConfig[]`
- `saveSender(sender: InsurerSenderConfig): void`
- `removeSender(email: string): void`

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/reconciliation/__tests__/sample-store.test.ts`
Expected: PASS.

**Step 5: Commit**
Run: `git commit -F -` with message: `feat(reconciliation): add surveyor verified insurer sender store`

---

### Task 4: Gemini Multimodal Payment Advice Extractor

**Files:**
- Create: `src/lib/ai/payment-advice-extractor.ts`
- Create: `src/lib/ai/__tests__/payment-advice-extractor.test.ts`

**Step 1: Write the failing test**
Create `src/lib/ai/__tests__/payment-advice-extractor.test.ts` validating:
- Structured JSON prompt construction for payment advice.
- Extraction from text email bodies.
- Parsing of multi-claim tabular layouts.
- Auto-calculation of 10% TDS deduction if omitted in advice text.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/ai/__tests__/payment-advice-extractor.test.ts`

**Step 3: Write minimal implementation**
Implement `payment-advice-extractor.ts` using `callAIGateway` with `type: 'json', tier: 'heavy'` (or Gemini 2.0 Flash) and `PAYMENT_ADVICE_PROMPT`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/ai/__tests__/payment-advice-extractor.test.ts`
Expected: PASS.

**Step 5: Commit**
Run: `git commit -F -` with message: `feat(reconciliation): add AI multimodal payment advice extractor`

---

### Task 5: Client-Side Gmail Scoped Fetcher

**Files:**
- Create: `src/lib/reconciliation/gmail-fetcher.ts`
- Create: `src/lib/reconciliation/__tests__/gmail-fetcher.test.ts`

**Step 1: Write the failing test**
Create `src/lib/reconciliation/__tests__/gmail-fetcher.test.ts` testing:
- Query builder: creates precise Gmail search string from verified senders list (`from:(...) has:attachment`).
- Parses Gmail message payload headers and attachments.
- Handles empty or unauthorized states gracefully.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/reconciliation/__tests__/gmail-fetcher.test.ts`

**Step 3: Write minimal implementation**
Implement `gmail-fetcher.ts` connecting to `https://gmail.googleapis.com/gmail/v1/users/me/messages` using client-side OAuth token with read-only scope.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/lib/reconciliation/__tests__/gmail-fetcher.test.ts`
Expected: PASS.

**Step 5: Commit**
Run: `git commit -F -` with message: `feat(reconciliation): add client-side targeted Gmail payment fetcher`

---

### Task 6: UI Store & Sidebar Navigation Integration

**Files:**
- Modify: `src/stores/ui-store.ts` (add `'payment-reconciliation'` to `AppTab`)
- Modify: `src/components/layout/sidebar.tsx` (add nav item under `MAIN`, respect `hideEarnings`)
- Modify: `src/components/layout/Dashboard.tsx` (update `[ Reconcile bank statement ]` to open tab)
- Test: `src/components/layout/__tests__/sidebar-reconciliation.test.tsx`

**Step 1: Write the failing test**
Verify sidebar displays "Payment Reconciliation" for firm owner and hides it when `hideEarningsFromTeam: true` for assistants.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/layout/__tests__/sidebar-reconciliation.test.tsx`

**Step 3: Write minimal implementation**
1. Add `'payment-reconciliation'` to `AppTab` in `src/stores/ui-store.ts`.
2. Add NAV item to `src/components/layout/sidebar.tsx`:
```tsx
{
  id: 'payment-reconciliation',
  label: 'Payment Reconciliation',
  icon: <Banknote size={17} />,
  group: 'main',
  requiresClaim: false,
}
```
3. Guard rendering if `hideEarnings` is true.
4. Route Dashboard reconcile button to `setActiveTab('payment-reconciliation')`.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/layout/__tests__/sidebar-reconciliation.test.tsx`
Expected: PASS.

**Step 5: Commit**
Run: `git commit -F -` with message: `feat(navigation): register Payment Reconciliation tab in ui-store and sidebar`

---

### Task 7: Build the Payment Reconciliation Tab (3-Zone Financial Cockpit)

**Files:**
- Create: `src/components/tabs/PaymentReconciliationTab.tsx`
- Create: `src/components/reconciliation/ReconciliationKPICards.tsx`
- Create: `src/components/reconciliation/PaymentMatchQueue.tsx`
- Create: `src/components/reconciliation/ClaimsLedgerTable.tsx`
- Create: `src/components/reconciliation/SenderManagerModal.tsx`
- Test: `src/components/tabs/__tests__/PaymentReconciliationTab.test.tsx`

**Step 1: Write the failing test**
Create `src/components/tabs/__tests__/PaymentReconciliationTab.test.tsx` testing:
- Renders 4 KPI metrics: Total Billed, Total Received, Pending Outstanding, TDS Withheld.
- Renders pending matched cards with 1-click **[Confirm & Settle]**.
- Settle action updates IndexedDB claim `feeBill` with `paymentStatus: 'paid'`, `amountReceived`, `tdsDeducted`, and `utrNumber`.
- Search & filter on Claims Ledger by Insurer / Status.

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/tabs/__tests__/PaymentReconciliationTab.test.tsx`

**Step 3: Write minimal implementation**
Implement modular components following Brand Orange (`#F59E0B`, `amber-500`) and Modern Web Guidance (accessible tables, keyboard focus, semantic HTML, native dialog for sender management):
1. `ReconciliationKPICards.tsx`: Top visual financial summary.
2. `PaymentMatchQueue.tsx`: Cards for extracted advice items showing matched claims and unassigned payments.
3. `ClaimsLedgerTable.tsx`: Full responsive table with sorting, search, days overdue badge, and quick manual status toggle.
4. `SenderManagerModal.tsx`: Clean UI to add/remove verified insurer sender emails and drop sample `.eml` / PDF formats.
5. `PaymentReconciliationTab.tsx`: Main cockpit coordinating state, Gmail fetch, manual drop zone, and IndexedDB persistence.

**Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/tabs/__tests__/PaymentReconciliationTab.test.tsx`
Expected: PASS.

**Step 5: Commit**
Run: `git commit -F -` with message: `feat(ui): implement Payment Reconciliation 3-zone cockpit and ledger`

---

### Task 8: End-to-End Verification & Coupler Check

**Files:**
- Run Vitest: `npx vitest run` (ensure all ~3,370+ tests pass)
- Run TypeScript: `npx tsc --noEmit`
- Run Scan drift test: `cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`
- Run Next.js build: `npm run build`

**Step 1: Execute all checks**
Confirm 0 TypeScript errors, 100% green tests, and clean static export.

**Step 2: Commit & Log**
- Document in `Changelog.md`.
- Update `Tasks.md`.
- Record session log in `Sessions/2026-11-19-payment-reconciliation-cockpit.md`.
- Commit with conventional commit `feat(reconciliation): ship payment reconciliation and received fees cockpit`.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-11-19-payment-reconciliation-tab.md`.

Two execution options:
1. **Subagent-Driven (this session)** — Dispatch fresh subagents per task, review between tasks, fast iteration.
2. **Parallel Session (separate)** — Open new session with `executing-plans`, batch execution with checkpoints.

Which approach would you like to take?
