# Launch Checklist

> Last reviewed: 2026-05-21. Items triaged from original 2026-04-14 checklist.

## Security

- [x] Firebase API key removed from version control
- [x] API key restricted to Firebase APIs in Google Cloud Console
- [x] API key stored in `.env.local` and GitHub Secrets
- [x] Firestore rules hardened — `isAdmin()` role-based
- [x] New user access control — pending state blocks unknown signups
- [x] XSS vulnerability fixed (DOMPurify)
- [x] AI config Firestore rule locked to admin
- [ ] **Rotate old exposed API key** — delete `AIzaSyCimnYVKZ0n-iX8MOHO2f3TP3GoBvNMqpk` from Google Cloud Console
- [ ] Add Firebase App Check to prevent API abuse
- [ ] Enable Firestore automated backups
- [ ] Add CSP headers to `firebase.json`

## Access Control

- [x] Pending status, auto-create on first login, pending screen UI
- [x] New Signups admin tab with one-click approve
- [x] `isAdmin()` role-based Firestore rules
- [ ] Email notification to admin on new signup
- [ ] Email notification to user on approval

## Features — Shipped

- [x] Spot survey workflow
- [x] Final survey report (Standard + UIIC)
- [x] Assessment grid with IRDAI depreciation
- [x] Photo sheet PDF (4/6/9-up layouts)
- [x] Fee bill PDF
- [x] Bill check reconciliation
- [x] AI document extraction (Gemini + Groq + NVIDIA)
- [x] Google Drive sync
- [x] Offline-first (IndexedDB + Firestore)
- [x] Valuation / break-in inspection report
- [x] Subscription lifecycle system
- [x] Excel-style grid paste

## Features — Pending

- [ ] Payment integration (Razorpay) — renewal is manual
- [ ] Cloud photo backup (photos local-only, lost if device wiped)
- [ ] Claim export/import (JSON backup)
- [ ] GDPR data deletion endpoint

## DevOps

- [x] GitHub Actions workflow (`.github/workflows/deploy.yml`)
- [x] TypeScript check on PRs
- [ ] `FIREBASE_SERVICE_ACCOUNT` GitHub Secret for auto-deploy
- [ ] Firebase Hosting preview channels for PRs
- [ ] Error tracking (Sentry or similar)

## Code Quality

- [ ] Unit test coverage to 80% (currently minimal)
- [ ] E2E tests for critical flows
