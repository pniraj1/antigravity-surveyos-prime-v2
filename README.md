# SurveyOS Prime V2 — Motor Insurance Survey Platform

A professional motor insurance survey management platform for IRDAI-licensed surveyors. Built for the Indian insurance market, deployed on Firebase.

**Live:** https://surveyos-v2-antigravity.web.app  
**GitHub:** https://github.com/pniraj1/antigravity-surveyos-prime-v2

---

## What It Does

- Create and manage motor insurance survey claims (spot, final, reinspection, bill-check)
- AI-powered document extraction (RC, DL, policy, claim documents via Gemini/Groq)
- Generate IRDAI-compliant survey reports in PDF, Word, and Excel formats
- Photo sheet management with A4 print layouts (4/6/9-up, portrait/landscape)
- Assessment grids with IRDAI depreciation tables and GST calculations
- Fee bill generation and bill-check reconciliation
- Subscription-based access control with admin dashboard
- Offline-first: works without internet, syncs to Firebase when online

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.2 (static export) |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| State | Zustand 5 |
| Local Storage | IndexedDB (via `idb`) |
| Cloud | Firebase Auth + Firestore |
| PDF Export | @react-pdf/renderer 4 |
| Word Export | docx 9 |
| Excel Export | exceljs 4 |
| AI Extraction | Gemini / Groq APIs |

---

## Project Structure

```
src/
├── app/                    # Next.js app router (single page)
├── components/
│   ├── admin/              # AdminDashboard (surveyor + signup management)
│   ├── auth/               # AuthGate, SignInScreen
│   ├── dialogs/            # NewClaim, AIReview, BankReconcile dialogs
│   ├── layout/             # Sidebar, SubscriptionGuard, SaveStatusBar
│   ├── pdf/                # PDF document builders (5 types)
│   ├── tabs/               # 11 survey workflow tabs
│   └── claim/              # Claim creation forms
├── hooks/                  # useAuth, useAutoSave, useCloudSync
├── lib/
│   ├── firebase/           # config, auth, sync
│   ├── storage/            # IndexedDB lifecycle (per-user DB)
│   ├── calculations/       # assessment, depreciation, fees, GST
│   ├── reports/            # 8 report builders
│   └── ai/                 # processor, service, prompts
├── stores/                 # auth, claim, profile, ui (Zustand)
└── types/                  # claim, vehicle, assessment, report
```

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/pniraj1/antigravity-surveyos-prime-v2.git
cd SurveyOS-Prime-V2
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in your Firebase API key:

```bash
cp .env.example .env.local
```

Get your API key from:
https://console.cloud.google.com/apis/credentials?project=surveyos-v2-antigravity

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 4. Build & Deploy

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

---

## Authentication & Access Control

All users sign in with Google. New signups land on a **pending** screen until an admin approves them.

| Status | Access |
|---|---|
| `pending` | Blocked — yellow "awaiting approval" screen |
| `active` | Full app access |
| `suspended` | Blocked — red suspended screen |
| `expired` | Blocked — renewal screen |

**Admin approval flow:**
1. New user signs in → pending screen
2. Admin opens **Admin Dashboard → New Signups tab**
3. Click **Approve** → user gets access immediately

See `docs/ARCHITECTURE.md` for full auth details.

---

## Survey Workflow

```
New Claim → Details (AI extraction) → Spot Survey → Assessment
         → Photos → Final Report → Fee Bill → Bill Check → Export
```

### Report Types

| Report | Formats | Description |
|---|---|---|
| Spot Survey Report | PDF | Preliminary scene inspection |
| Final Motor Survey | PDF, Word | Full assessment (Standard or UIIC format) |
| UIIC Excel Report | Excel | UIIC-specific submission format |
| Photo Sheet | PDF | A4 photo layout (4/6/9-up) |
| Fee Bill | PDF | Professional fee invoice with GST |
| Bill Check | PDF | Repair bill vs assessment comparison |
| IRDAI Annual Summary | Excel | Annual statistics for IRDAI submission |

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `.env.local` / CI secret | Firebase web API key — never commit |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `.env.production` | Pre-filled |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `.env.production` | Pre-filled |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `.env.production` | Pre-filled |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `.env.production` | Pre-filled |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `.env.production` | Pre-filled |
| `NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` | `.env.production` | Pre-filled |
| `NEXT_PUBLIC_SANDBOX_MODE` | Optional | `true` bypasses auth (preview only) |

---

## CI/CD

GitHub Actions at `.github/workflows/deploy.yml`:
- TypeScript check on all pushes/PRs
- Build + deploy to Firebase Hosting on `master` merge

**Required GitHub Secrets:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT` (download from Firebase Console → Service Accounts)

---

## Firebase Project

- **Project:** `surveyos-v2-antigravity`
- **Hosting:** https://surveyos-v2-antigravity.web.app
- **Console:** https://console.firebase.google.com/project/surveyos-v2-antigravity

---

## Docs

| File | Contents |
|---|---|
| `docs/ARCHITECTURE.md` | Full architecture, data model, auth flow |
| `docs/ADMIN.md` | Admin dashboard usage and user management |
| `docs/LAUNCH_CHECKLIST.md` | Pre-launch readiness checklist |
| `docs/access-control-improvements.md` | Auth hardening (completed) |
