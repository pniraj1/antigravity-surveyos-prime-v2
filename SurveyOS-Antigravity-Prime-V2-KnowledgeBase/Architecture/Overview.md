# Architecture Overview

> Consolidated from README.md and docs/ARCHITECTURE.md. This is the authoritative system architecture reference.

## What Is SurveyOS Prime V2?

An AI-powered insurance survey management platform for Indian motor insurance surveyors. It handles the complete claim lifecycle: document intake, AI extraction, IRDAI-compliant assessment, report generation, and cloud sync.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (static export) + React 19 |
| Language | TypeScript 5 (strict mode) |
| State | Zustand (modular slices) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Firestore (cloud) + IndexedDB (local) |
| Hosting | Firebase Hosting (static SWA) |
| AI | Multi-model routing (Gemini, Groq, NVIDIA NIM) |
| PDF Export | @react-pdf/renderer |
| Word Export | docx library |
| Excel Export | exceljs |

## Data Flow

```
React UI (src/components/)
    ↓
Zustand Stores (src/stores/) — in-memory state
    ↓
IndexedDB (src/lib/storage/) — local encrypted persistence
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
4. **Assessment** — IRDAI-compliant damage assessment grid
5. **Bill Check** — Invoice/estimate reconciliation
6. **Valuation** — Vehicle valuation report
7. **Documents** — Document upload and AI extraction
8. **Reinspection** — Post-repair reinspection
9. **Spot** — Spot survey report
10. **Fees** — Surveyor fee calculation
11. **Report** — Final report generation (PDF/Word/Excel)
12. **Cloud Vault** — Google Drive sync and backup
13. **Profile** — User profile and settings

## Key Subsystems

- **AI Extraction Engine** — see [[AI_Extraction]]
- **IRDAI Calculation Engine** — depreciation, GST, CTL detection (`src/lib/calculations/`)
- **Report Generation** — twin-engine approach: React-PDF for standards, exceljs for UIIC legacy — see [[PDF_Reports]]
- **Cloud Sync** — offline-first with background sync — see [[Cloud_Sync]]
- **Project Bramha** — agentic RAG intelligence (shadow mode) — see `Project_Bramha/Overview.md`

## Persistence Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| L1 | Zustand (in-memory) | Real-time UI state |
| L2 | IndexedDB | Local encrypted storage, works offline |
| L3 | Firestore | Cloud sync, RBAC, cross-device |
| L4 | Google Drive | File backup, photo storage |

## Security Model

- Firebase Auth with Google Sign-In
- Firestore rules: `isAdmin()` role-based access
- New users get `status: 'pending'` → admin approves → `status: 'active'`
- DOMPurify for XSS prevention in report previews
- Environment secrets in `.env.local` (gitignored)

## Deployment

```bash
npm run build          # Static export → out/
firebase deploy        # Deploys out/ to Firebase Hosting
```

GitHub Actions workflow at `.github/workflows/deploy.yml` handles CI/CD.
