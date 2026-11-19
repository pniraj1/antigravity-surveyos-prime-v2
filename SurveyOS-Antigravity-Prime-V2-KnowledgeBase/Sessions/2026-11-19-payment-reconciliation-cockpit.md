# Session: 2026-11-19 — Payment Reconciliation & Received Fees Cockpit

**Author:** Antigravity (Google DeepMind)
**Date:** 2026-11-19
**Scope:** Received fees tracking, verified insurer email learning, targeted Gmail sync, Gemini multimodal payment advice extractor, identifier-first matching engine, and 3-zone visual financial cockpit.

---

## 1. Context & User Need
Motor insurance surveyors in India invoice insurers (New India, UIIC, Oriental, National, ICICI Lombard, Bajaj Allianz, etc.) for spot surveys, final surveys, and reinspections. Insurers release payments weeks or months later via NEFT/RTGS, often bundling multiple claims into a single transfer and deducting 10% TDS (Section 194J). 

Prior to this work, SurveyOS Prime V2 only had a boolean toggle (`feePaid: boolean`) and a basic modal (`BankReconcileDialog.tsx`) that attempted exact `±₹1` amount matching. This had critical domain gaps:
1. Standard fee amounts (e.g. ₹500, ₹1,200, ₹1,500) repeat across dozens of claims, causing false matches if matched by amount alone.
2. No tracking of partial payments, UTR numbers, payment dates, or TDS deductions (essential for Income Tax Form 26AS reconciliation).
3. No automated ingestion of insurer payment advice emails or PDF disbursement vouchers.

---

## 2. Capabilities Shipped

### 1. Data Model Expansion (`src/types/payment-reconciliation.ts`, `src/types/assessment.ts`)
- Defined `PaymentStatus` ('unpaid' | 'paid' | 'partial').
- Enhanced `FeeBill` in `src/types/assessment.ts` with:
  - `paymentStatus?: PaymentStatus`
  - `amountReceived?: number`
  - `tdsDeducted?: number`
  - `paymentDate?: string`
  - `utrNumber?: string`
  - `paymentAdviceSource?: string`
- Defined `PaymentAdvice`, `PaymentAdviceClaimItem`, and `PaymentMatchResult` types.

### 2. Strict Identifier-First Matching Engine (`src/lib/reconciliation/matcher.ts`)
- `normalizeClaimNumber`: Strips special characters, slashes, and hyphens to create clean uppercase alphanumeric tokens.
- `normalizeVehicleNumber`: Strips spaces and punctuation (e.g. `MH-12-AB-1234` → `MH12AB1234`).
- **Strict Domain Rule Enforced:** Under no circumstances are payments matched by fee amount alone. Matching strictly checks:
  1. Normalized Claim Number (`confidence: 'exact_claim_no'`).
  2. Normalized Vehicle Registration Number (`confidence: 'exact_vehicle_no'`).
  3. If neither matches, marked `status: 'unmatched'` with `matchedClaimId: undefined` for manual surveyor assignment.

### 3. Surveyor Verified Insurer Sender Store (`src/lib/reconciliation/sample-store.ts`)
- Pre-seeded with 7 verified Indian insurer payment advice profiles:
  - The New India Assurance (`payments@newindia.co.in`)
  - United India Insurance (`disbursements@uiic.co.in`)
  - The Oriental Insurance (`claims.settlement@orientalinsurance.co.in`)
  - National Insurance (`surveyor.payment@nic.co.in`)
  - ICICI Lombard GIC (`paymentadvice@icicilombard.com`)
  - Bajaj Allianz GIC (`claims@bajajallianz.co.in`)
  - SBI CMS Gateway (`cms.neft@sbi.co.in`)
- Full persistence in browser storage (`surveyos_payment_senders`), with methods to add, remove, and reset senders.

### 4. Gemini Multimodal Payment Advice Extractor (`src/lib/ai/payment-advice-extractor.ts`)
- Dedicated local prompt `PAYMENT_ADVICE_PROMPT` tailored to Indian motor insurance remittance vouchers (leaving battle-tested `src/lib/ai/prompts.ts` untouched).
- Supports text email bodies as well as PDF and image disbursement vouchers via `fileToImages`.
- Auto-calculates 10% TDS (u/s 194J) when gross fee exceeds net disbursement.
- Resilient JSON fence cleaning and boundary extraction.

### 5. Client-Side Targeted Gmail Fetcher (`src/lib/reconciliation/gmail-fetcher.ts`)
- Connects directly to Google Gmail API using the surveyor's active OAuth token (`getDriveToken()`).
- Generates surgical search queries based on verified senders (`from:(...) has:attachment subject:(payment OR disbursement...) newer_than:60d`), eliminating personal email scanning and API token waste.
- Fetches advice email headers, snippets, body text, and downloads PDF attachments directly as Blobs.

### 6. Navigation & Permissions Integration (`src/stores/ui-store.ts`, `sidebar.tsx`, `Dashboard.tsx`)
- Registered `'payment-reconciliation'` as a first-class `AppTab`.
- Added **Payment Reconciliation** to the primary sidebar under `MAIN` with `requiresClaim: false`.
- Enforced `shouldHideFees` security guard so assistants cannot view firm accounts when `hideEarningsFromTeam` is set.
- Re-routed Dashboard's `[ Reconcile bank statement ]` CTA to open the dedicated workspace.

### 7. 3-Zone Financial Cockpit & Master Ledger (`src/components/tabs/PaymentReconciliationTab.tsx`)
- **Zone 1: Top KPI Strip (`ReconciliationKPICards.tsx`):**
  - Displays real-time totals for **Total Billed**, **Received in Bank**, **Pending Outstanding** (with count badge), and **TDS Deducted** (Form 26AS).
  - Quick action buttons for Gmail check, File Drop, and Verified Senders.
- **Zone 2: Matching Inbox (`PaymentMatchQueue.tsx`):**
  - Displays pending remittance items with insurer name, payment date, UTR, net amount, and TDS.
  - Clear match confidence pills (`Exact Claim No`, `Exact Vehicle Reg`, `Manual`).
  - 1-click **[ Confirm & Settle ]** updating IndexedDB and notifying app state via BroadcastChannel and window events.
  - Unmatched payments tray with manual claim picker.
- **Zone 3: Master Claims Fee Ledger (`ClaimsLedgerTable.tsx`):**
  - Responsive table with live multi-field search and filter tabs (`All`, `Unpaid`, `Paid`).
  - Displays vehicle reg, claim number, insurer, bill date with ageing alerts (`⚠️ 45 days overdue`), billed amount, received amount, TDS, UTR, and 1-click status toggle.
- **Verified Senders Modal (`SenderManagerModal.tsx`):**
  - Accessible modal dialog for managing and customizing insurer sender profiles.

---

## 3. Verification & Commits
- **Unit Tests:** 52 passed across all reconciliation and navigation test suites (`matcher.test.ts`, `sample-store.test.ts`, `payment-advice-extractor.test.ts`, `gmail-fetcher.test.ts`, `payment-reconciliation.test.ts`, `sidebar-reconciliation.test.tsx`, `PaymentReconciliationTab.test.tsx`).
- **TypeScript:** `npx tsc --noEmit` exited with code 0 (0 errors).
- **Next.js Production Build:** `npm run build` generated all 25/25 static pages cleanly in 5.2s.
- **SurveyOS Scan Coupler:** 0 impact (isolated to Prime V2 web client financial tracking).

### Git Commits on `main`:
1. `b8b88b4e` - `feat(reconciliation): add payment reconciliation data types and feeBill tracking fields`
2. `8c47d51d` - `feat(reconciliation): implement strict identifier-first payment matching engine`
3. `c43ddece` - `feat(reconciliation): add surveyor verified insurer sender store`
4. `01f7a004` - `feat(reconciliation): add AI multimodal payment advice extractor`
5. `593bf2e9` - `feat(reconciliation): add client-side targeted Gmail payment fetcher`
6. `b88cd20b` - `feat(navigation): register Payment Reconciliation tab in ui-store, sidebar, and dashboard`
7. `17506a12` - `feat(ui): implement Payment Reconciliation 3-zone cockpit and ledger`
