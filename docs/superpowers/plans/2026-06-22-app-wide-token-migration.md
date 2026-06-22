# App-Wide Token Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Migrate the remaining app screens to the design-token system, one file per implementer, wave by wave.

**Goal:** Remove every raw hex / `rgba()` / `linear-gradient()` literal and every heavy font weight (`font-black/extrabold/bold/semibold`) from the remaining in-scope app component files, replacing them with the established design tokens — presentation only, no logic changes.

**Architecture:** The token system (`--color-neutral-50/100/200/400/600/900`, `--color-status-success/warning/danger` + `-tint`, `--primary`) is already in `globals.css` and proven across the sidebar, dashboard, and details tab. Each remaining file is migrated with the same mechanical contract.

## Global Constraints (every file)

- Presentation only — NO logic, state, data-shape, handler, persistence, or routing changes.
- Replace raw hex / rgba / linear-gradient literals with neutral/status/primary tokens (CSS-var classes `text-[var(--color-neutral-600)]` etc., or theme utilities `bg-card`, `border-border`, `text-muted-foreground`, `text-primary`).
- Two font weights only: 400 default, 500 (`font-medium`). No font-black/extrabold/bold/semibold.
- One accent: gold (`text-primary`/`bg-primary`) for primary actions + single active accents only.
- Sentence case for labels; uppercase only for short ≤2-word micro-labels.
- Preserve dynamic inline styles that carry runtime values (widths, positions, transforms).
- Keep `'use client'`, all imports, all conditionals.
- NEVER edit `src/components/pdf/*`, `src/components/print/*`, `src/lib/reports/*`, `src/components/landing/*`, brand SVGs (`icons/*`, `ui/Logo.tsx`).
- Per-file: build must stay green; logic byte-identical.

## Out of scope

- `src/components/landing/*` (marketing site — separate design language, user redesign in progress).
- Report renderers (`pdf/`, `print/`, `lib/reports/`) — isolated by design.
- Brand SVG icons.

## Waves

**Wave A — Shared claim forms / assessment:** `claim/AssessmentSummary.tsx`, `claim/AssessmentGrid.tsx`, `claim/DriverForm.tsx`, `claim/TotalLossForm.tsx`.

**Wave B — Claim output tabs:** `tabs/DocumentsTab.tsx`, `tabs/ReviewTab.tsx`, `tabs/InsuredReportTab.tsx`, `tabs/FeesTab.tsx`, `tabs/ReinspectionTab.tsx`, `tabs/AssessmentTab.tsx`, `tabs/PhotosTab.tsx`, `tabs/BillCheckTab.tsx`, `tabs/ReportTab.tsx`, `tabs/CloudVaultTab.tsx`.

**Wave C — Bill-check + report subcomponents:** `tabs/bill-check/BillCheckGrid.tsx`, `BillCheckUploadPanel.tsx`, `ExtraBillItemsPanel.tsx`, `BillCheckSummaryPanel.tsx`, `BillCheckHeader.tsx`, `tabs/report/SurveyActions.tsx`, `tabs/report/SpotActions.tsx`.

**Wave D — Dialogs:** `dialogs/InsuredReportReviewDialog.tsx`, `dialogs/BankReconcileDialog.tsx`, `dialogs/IRDAISummaryDialog.tsx`, `dialogs/NewClaimDialog.tsx`, `dialogs/DuplicateUploadDialog.tsx`.

**Wave E — Admin:** `admin/AdminDashboard.tsx`, `admin/tabs/SurveyorsTab.tsx`, `DevNotesTab.tsx`, `ApprovalQueueTab.tsx`, `PaymentsTab.tsx`, `AIModelsTab.tsx`, `admin/modals/DismissModal.tsx`, `EmailComposerModal.tsx`, `VerifyPaymentModal.tsx`, `DeleteAccountModal.tsx`, `RejectPaymentModal.tsx`.

**Wave F — Shared/layout/misc:** `ai/AIControls.tsx`, `layout/FloatingReportPreview.tsx`, `ui/ProcessingProgressOverlay.tsx`, `evidence/DocumentEvidenceViewer.tsx`, `auth/DriveGateScreen.tsx`, `layout/SaveStatusBar.tsx`, `shared/ReportPreviewPanel.tsx`, `layout/ClaimHeader.tsx`, `sync-bridge/SyncDrivePicker.tsx`, `subscription/PaymentSubmissionForm.tsx`, `layout/SubscriptionGuard.tsx`, `auth/AuthGate.tsx` (preserve public-route bypass logic), `sync/SaveProgressButton.tsx`.

## Per-wave process

1. Dispatch one implementer per file (parallel within a wave; each edits ONE file, NO build, NO commit, terse report).
2. Central `npm run build` after the wave; fix any breakage.
3. Commit the wave.
4. Dispatch one reviewer over the wave diff (spec + logic-preservation).
5. Fix findings; re-build; record in ledger.

Phase 4 (de-dazzle: trim any remaining heavy shadows/animations surfaced during migration) and Phase 5 (a11y/device: sub-12px label bump, contrast, focus states) run as a final sweep after Wave F.
