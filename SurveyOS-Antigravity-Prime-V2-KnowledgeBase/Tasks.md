# Active Tasks

> Last updated: 2026-05-25 by Claude
> Both agents (Claude and Antigravity) MUST read this before starting and update it before stopping.

---

## Bramha — Next Steps (Phase 2)

- [ ] **Admin Simulator UI** — hidden admin page to run test RAG queries against `bramha_memories` and tune prompts
- [ ] **Fraud detection UI** — query `bramha_memories` by policyNumber/vehicleRegistration to flag repeat claimants
- [ ] **Hotspot map** — aggregate `placeOfAccident` field from `bramha_memories` and display on map
- [ ] **Node.js runtime upgrade** — Cloud Functions on Node 20 (deprecated 2026-04-30, decommissioned 2026-10-30). Upgrade to Node 22 in `SurveyOS-Prime/functions/package.json` before October 2026.
- [ ] **firebase-functions upgrade** — current version outdated; upgrade has breaking changes, do carefully

## Reported Bugs

- [ ] **Sign-in loop** — Google Auth completes but returns to landing page; no Drive connection request shown. Needs investigation in auth flow + Drive token handling.

## In Progress

- [ ] **IndexedDB memory optimization** — 40 MB photo storage bloat
  - **Plan:** Client-side compression + schema splitting + soft archiving (50 claim limit)
  - **Status:** Planning complete, no code changes yet
  - **Next step:** Implement compression in `src/stores/claim-store.ts`
  - **Key files:** `claim-store.ts`, `src/lib/storage/indexeddb.ts`, `src/types/claim.ts`, `PhotosTab.tsx`

---

## Pending — High Priority

- [ ] Rotate Firebase API key (leaked in git history — see [[Security_Audit]])
  1. Firebase Console → Project Settings → Regenerate Web API Key
  2. Update `.env.local` and `.env.production`
  3. `npm run build && firebase deploy --only hosting`
- [ ] Move Google Drive OAuth token from localStorage to secure storage
- [ ] Add CSP headers to `firebase.json`
- [ ] Sanitize claim text before injecting into AI prompts (H-3)

## Pending — Medium Priority

- [ ] Firebase App Check integration
- [ ] GDPR data deletion endpoint
- [ ] Unit test coverage to 80% (currently 3 test files)
- [ ] Client-side rate limiting for AI extraction (free-tier: 10 RPM gemini-2.5-flash)
- [ ] Session timeout for authentication (currently no expiry)
- [ ] Role-based access beyond active/pending/dismissed
- [ ] Fix profile path — sync.ts writes `profile/main`, AdminDashboard reads `profile/current` (M-4)
- [ ] Firestore field-level validation + doc size limits (M-3)

## Pending — Low Priority / Open Questions

- [ ] Should report numbers sync to Firestore for multi-device access?
- [ ] Should Standard and UIIC report formats get parity enforcement?
- [ ] Update ANTIGRAVITY_BIBLE.md (AI model reference is outdated)

---

## Blocked

- (none)

---

## Recently Completed

- [x] Project reorganization and vault restructure (2026-05-21)
- [x] Excel-style grid paste for AssessmentGrid (2026-05-16)
- [x] Pass 2.5 AI enrichment for insured reports (2026-05-15)
- [x] Subscription lifecycle system (2026-05-17)
- [x] Hide/Show financial summary toggle (2026-05-17)
- [x] Dashboard navigation race condition fix (2026-05-12)
- [x] DL expiry reporting fix (2026-05-12)
- [x] GVW/RLW & seating capacity regression fix (2026-05-12)
- [x] Valuation / break-in inspection report (2026-04-26)

---

## Key Decisions (Carry Forward)

1. All 3 spot report formats must stay identical — SpotPrintReport.tsx is source of truth
2. 4 report renderers exist (UIIC, Standard, Word, PDF) — only spot reports have parity enforcement
3. Admin access = `isAdmin` flag OR master UID — prevents lockout if Firestore resets
4. Report numbers are local (localStorage only, not synced, reset yearly)
5. Cloud sync distinction: "Auto Push Files" = photos/docs only; profile backup always syncs
6. Photo Sheet Generation feature MUST be kept (not deleted)
