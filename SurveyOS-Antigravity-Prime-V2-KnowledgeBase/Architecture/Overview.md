# Architecture Overview

> Consolidated from README.md and docs/ARCHITECTURE.md. This is the authoritative system architecture reference.
> Last updated: 2026-11-17.

## What Is SurveyOS Prime V2?

An AI-powered insurance survey management platform for Indian motor insurance surveyors. It handles the complete claim lifecycle: document intake, AI extraction, IRDAI-compliant assessment, progressive bill-check tallying, report generation, and cloud sync.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (static export) + React 19 |
| Language | TypeScript 5 (strict mode) |
| State | Zustand (modular slices: claim-store, tallySlice, aiDataSlice, uiSlice) |
| Styling | Tailwind CSS 4 + shadcn/ui + Brand Orange Design System (`#F59E0B`) |
| Auth | Firebase Auth (Google Sign-In + Anonymous Sandbox BYOK) |
| Database | Firestore (cloud) + IndexedDB (local tenant-isolated) |
| Hosting | Firebase Hosting (static SWA on `motorsurveyos-in`) |
| AI | Multi-model routing (Gemini 2.5, Groq, NVIDIA NIM, Ollama) |
| PDF Export | @react-pdf/renderer + isolated HTML print shell |
| Word Export | docx library |
| Excel Export | exceljs (UIIC 13-column, OIC 9400ExcelOICL, NIA) |

## Data Flow

```
React UI (src/components/)
    ↓
Modal Dialogs (src/components/dialogs/) — accessible upload & 4-stage wizard
    ↓
Zustand Stores (src/stores/) — in-memory state & tally slices
    ↓
Tally & Calculation Engines (src/lib/tally/, src/lib/calculations/)
    ↓
IndexedDB (src/lib/storage/) — local encrypted tenant persistence
    ↓
Sync Queue (src/hooks/useCloudSync.ts) — offline queue
    ↓
Firestore (src/lib/firebase/sync.ts) — cloud sync + RBAC
```

## 13-Tab Workflow

The main app is organized as a tabbed interface, each tab representing a phase of the survey:

1. **Details** — Claim/policy/vehicle info
2. **Review** — Claim overview and status
3. **Photos** — Photo capture and management
4. **Assessment** — IRDAI-compliant damage assessment grid (DecimalInput, Excel keyboard moves, shared selection)
5. **Bill Check** — Progressive 4-stage tallying cockpit & reconciliation workspace (`BillCheckGrid`, `ReconciliationWizardDialog`)
6. **Valuation** — Vehicle valuation report
7. **Documents** — Document upload and AI extraction
8. **Reinspection** — Post-repair reinspection
9. **Spot** — Spot survey report
10. **Fees** — Surveyor fee calculation
11. **Report** — Final report generation (PDF/Word/Excel)
12. **Cloud Vault** — Google Drive sync and backup
13. **Profile** — User profile and settings

## Key Subsystems

- **AI Extraction Engine** — multi-model routing honoring surveyor choice, deterministic token DMS parsers, and auto-splitting chunk processor — see [[AI_Extraction]]
- **Progressive Tally Engine** — 4-stage reconciliation engine: Stage 1 Part Numbers, Stage 2 Semantic Automotive Matching, Stage 3 Surveyor-Triggered AI with Quoted Rationale, Stage 4 Disallowed Segregation & Insurer Savings — see `src/lib/tally/`
- **IRDAI Calculation Engine** — 2-decimal rupee precision, age depreciation, statutory 12.5% painting split (GR-9), IMT-23 halving, scrap salvage basis, and excess handling (`src/lib/calculations/`)
- **Report Generation** — isolated twin-engine approach: React-PDF and standard 186mm A4 HTML builders (UIIC 13-column with isolated spot dates, OIC, NIA) — see [[PDF_Reports]]
- **Cloud Sync** — offline-first with tenant-isolated IndexedDB and background Firestore sync — see [[Cloud_Sync]]
- **Project Bramha** — agentic RAG intelligence (shadow mode) — see `Project_Bramha/Overview.md`

## Persistence Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| L1 | Zustand (in-memory) | Real-time UI state & tally workflow |
| L2 | IndexedDB | Local encrypted storage (`surveyos-v2-UID`), works offline |
| L3 | Firestore | Cloud sync, RBAC, cross-device |
| L4 | Google Drive | File backup, photo storage |

## Security Model

- Firebase Auth with Google Sign-In & silent anonymous auth in sandbox
- Firestore rules: `isAdmin()` role-based access
- New users get `status: 'pending'` → admin approves → `status: 'active'`
- DOMPurify for XSS prevention in report previews
- Environment secrets in `.env.local` (gitignored)

## Deployment

```bash
npm run build          # Static export → out/
firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in
```
