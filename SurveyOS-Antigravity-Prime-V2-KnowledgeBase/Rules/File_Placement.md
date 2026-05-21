# File Placement Rules

> Detailed rules for where every type of file belongs. Summary is in [[AGENT_PROTOCOL]].

## Source Code (`src/`)

### Components (`src/components/`)

Organized by **domain** — each feature has its own subfolder:

| Folder | Purpose | Example Files |
|--------|---------|---------------|
| `ui/` | shadcn/ui primitives (button, card, input, dialog, etc.) | `button.tsx`, `card.tsx` |
| `auth/` | Authentication UI | `AuthGate.tsx`, `DriveGateScreen.tsx` |
| `claim/` | Claim forms and data entry | `AssessmentGrid.tsx`, `VehicleForm.tsx` |
| `tabs/` | Main app tab content | `ReviewTab.tsx`, `PhotosTab.tsx` |
| `tabs/{sub}/` | Tab sub-components | `tabs/bill-check/BillCheckGrid.tsx` |
| `pdf/` | React-PDF document renderers | `BillCheckDocument.tsx` |
| `print/` | Print-specific HTML reports | `UIICPrintReport.tsx` |
| `dialogs/` | Modal/dialog components | `AIReviewDialog.tsx` |
| `layout/` | Layout wrappers, error boundaries | `Dashboard.tsx`, `sidebar.tsx` |
| `landing/` | Landing page sections | `LandingClient.tsx`, `DemoSection.tsx` |
| `admin/` | Admin-only components | `AdminDashboard.tsx` |
| `ai/` | AI control interfaces | `AIControls.tsx` |
| `chat/` | Chat interfaces | `AssessmentChatbot.tsx` |
| `evidence/` | Document evidence viewer | `DocumentEvidenceViewer.tsx` |
| `subscription/` | Subscription/payment UI | `SubscriptionGuard.tsx` |
| `shared/` | Cross-domain shared components | Components used by 3+ domains |
| `insured-report/` | Insured report components | Report generation for insured party |

**When to create a new subfolder:** When you have 3+ related components that serve a distinct feature.

### Libraries (`src/lib/`)

Business logic and utilities, organized by domain:

| Folder | Purpose |
|--------|---------|
| `ai/` | AI extraction, prompts, reconciliation engine |
| `auth/` | Auth state reset logic |
| `calculations/` | IRDAI assessment (depreciation, GST, fees, CTL) |
| `constants/` | Business constants (deduction categories) |
| `drive/` | Google Drive API integration |
| `email/` | Email templates and sending |
| `firebase/` | Firebase config, auth, sync service, payments |
| `reports/` | Report builders (UIIC, valuation, spot, reinspection) |
| `storage/` | IndexedDB abstraction |
| `subscription/` | Subscription status checking |
| `utils/` | General utilities (logger, vehicle helpers) |

**Tests** go in `src/lib/{domain}/__tests__/` (e.g., `src/lib/calculations/__tests__/assessment.test.ts`).

### Other `src/` Folders

| Folder | Purpose |
|--------|---------|
| `src/hooks/` | Custom React hooks (`useCloudSync.ts`, `useAutoSave.ts`) |
| `src/stores/` | Zustand stores (`claim-store.ts`, `auth-store.ts`) |
| `src/stores/slices/` | Store slices (`assessmentSlice.ts`, `vehicleSlice.ts`) |
| `src/types/` | TypeScript type definitions (`claim.ts`, `assessment.ts`) |
| `src/styles/` | CSS files (`print-report.css`) |
| `src/app/` | Next.js App Router pages and layouts |

## Non-Source Files

| File Type | Location |
|-----------|----------|
| Static images/SVGs | `public/images/` |
| Logo files | `public/` (root of public) |
| Build/utility scripts | `scripts/` |
| Python scripts | `scripts/tools/` or `scripts/tests/` |
| Documentation | Obsidian vault (NOT `docs/`) |
| Design specs | `vault → Specs/` |
| Sample files | `docs/samples/` (gitignored) |
| Environment vars | `.env.example` + `.env.local` |

## What Goes Where — Quick Decision Tree

```
Is it a React component?
  → Yes → src/components/{domain}/
Is it business logic or a utility?
  → Yes → src/lib/{domain}/
Is it a React hook?
  → Yes → src/hooks/
Is it a TypeScript type?
  → Yes → src/types/
Is it a Zustand store?
  → Yes → src/stores/
Is it a test?
  → Yes → src/lib/{domain}/__tests__/
Is it documentation?
  → Yes → Obsidian vault (appropriate subfolder)
Is it a static asset?
  → Yes → public/ or public/images/
Is it a script?
  → Yes → scripts/
None of the above?
  → Ask before creating. Never dump in project root.
```
