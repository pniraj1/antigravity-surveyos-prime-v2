# SurveyOS Prime V2 — Launch Checklist

Last updated: 2026-04-14

---

## Security

- [x] Firebase API key removed from version control
- [x] API key restricted to Firebase APIs in Google Cloud Console
- [x] API key stored in `.env.local` (local) and GitHub Secrets (CI/CD)
- [x] Firestore rules hardened — role-based `isAdmin()`, not hardcoded UID
- [x] New user access control — pending state blocks unknown signups
- [ ] Delete old exposed API key (`AIzaSyCimnYVKZ0n-iX8MOHO2f3TP3GoBvNMqpk`) from Google Cloud Console
- [ ] Review Firestore rules with a security audit (check all edge cases)
- [ ] Add Firebase App Check to prevent API abuse
- [ ] Enable Firestore automated backups

---

## Access Control

- [x] `pending` status added — new signups blocked until approved
- [x] Auto-create pending profile on first login (`useAuth.ts`)
- [x] Pending screen UI (`SubscriptionGuard.tsx`)
- [x] New Signups tab in Admin Dashboard with one-click approve
- [x] `isAdmin()` role-based Firestore rules
- [ ] Email notification to admin when new signup arrives (currently manual check)
- [ ] Email notification to user when approved

---

## Features

- [x] Spot survey workflow (complete)
- [x] Final survey report (Standard + UIIC format)
- [x] Assessment grid with IRDAI depreciation tables
- [x] Photo sheet PDF (A4, 4/6/9-up, portrait/landscape)
- [x] Fee bill PDF
- [x] Bill check reconciliation PDF
- [x] AI document extraction (Gemini + Groq)
- [x] Google Drive sync (partial)
- [x] Offline-first (IndexedDB + Firestore sync)
- [ ] Payment integration (Razorpay) — subscription renewal is manual
- [ ] Learning tab — currently a placeholder
- [ ] Cloud photo backup (photos are local-only, lost if device wiped)
- [ ] Claim export/import (JSON backup)

---

## DevOps

- [x] GitHub Actions workflow created (`.github/workflows/deploy.yml`)
- [x] TypeScript check on all PRs
- [ ] `FIREBASE_SERVICE_ACCOUNT` secret added to GitHub → enables auto-deploy
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY` secret added to GitHub → required for CI builds
- [ ] Firebase Hosting preview channels configured for PRs
- [ ] Error tracking setup (Sentry or similar)

---

## Code Quality

- [ ] Remove all `console.log` from production code
- [ ] Add error boundaries to all tabs (currently only on main page)
- [ ] Unit tests for `lib/calculations/` (assessment, depreciation, GST)
- [ ] Unit tests for report builders
- [ ] E2E tests (Playwright) for login → claim → export flow

---

## Operations

- [x] Admin Dashboard for user management
- [x] Firestore data model documented (`docs/ARCHITECTURE.md`)
- [ ] Runbook for common admin tasks (already drafted in `docs/ADMIN.md`)
- [ ] GDPR data deletion endpoint (user can request full data wipe)
- [ ] Disaster recovery plan documented

---

## Pre-Launch Actions (in order)

1. **Delete old API key** in Google Cloud Console
2. **Add GitHub Secrets** (`NEXT_PUBLIC_FIREBASE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`)
3. **Test new user flow** — sign in with a new Google account, verify pending screen appears, approve from admin dashboard
4. **Test subscription expiry** — set a past date, verify user is blocked
5. **Test all report exports** — PDF, Word, Excel for each report type
6. **Set up error monitoring** — at minimum enable Firebase Crashlytics or add Sentry
7. **Enable Firestore backups** — Firebase Console → Firestore → Backups
8. **Announce to first users** with onboarding instructions
