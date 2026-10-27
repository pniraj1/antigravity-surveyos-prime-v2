# Active Tasks

> Last updated: 2026-10-27 by Claude
> Both agents (Claude and Antigravity) MUST read this before starting and update it before stopping.

---

## Surveyor feedback round 1 — built 2026-10-27 (on main, not pushed/deployed)

- [x] Closed the last "Fix estimate reading" gap: repeat copies of a row the re-read *changed* are no longer offered as "missing" (88f1ccd1).
- [ ] Owner in-app check on one real claim: all 9 items (see session log 2026-10-27-surveyor-feedback-round-1).
- [ ] Owner: open a UIIC final + bill-check Word download in Word and confirm page breaks.
- [x] Deployed hosting to motorsurveyos-in 2026-10-27 (verified live). Not pushed to GitHub.

---

## Bramha — Next Steps (Phase 2)

- [ ] **Admin Simulator UI** — hidden admin page to run test RAG queries against `bramha_memories` and tune prompts
- [ ] **Fraud detection UI** — query `bramha_memories` by policyNumber/vehicleRegistration to flag repeat claimants
- [ ] **Hotspot map** — aggregate `placeOfAccident` field from `bramha_memories` and display on map
- [ ] **Node.js runtime check** — `functions/package.json` already declares `"node": "22"`; confirm in the Firebase console that the deployed functions run on Node 22 before 2026-10-30 (Node 20 decommissioned that day).
- [ ] **firebase-functions upgrade** — current version outdated; upgrade has breaking changes, do carefully

## Reported Bugs

- [ ] **Sign-in loop** — Google Auth completes but returns to landing page; no Drive connection request shown. Needs investigation in auth flow + Drive token handling.

## In Progress

- [ ] **Use phone files — browser checks** (2026-10-25). A **Use phone files** button picks imported phone (`'scan'`) files on Assessment → Upload Estimate, Bill Check → invoice, and the Photos tab (**Phone photos** dialog: grouped, Select all, nothing reaches the sheet without **Add to photo sheet**; already-added photos are disabled). On `main`, **NOT pushed, NOT deployed, not tried in a signed-in browser.**
  - **Owner:** run the "Use phone files" checks U1–U12 in `Sessions/2026-10-25-bring-phone-scans.md`.

- [ ] **Bring phone scans — enable Picker API + browser checks** (2026-10-25). Prime imports SurveyOS Scan zips (from Drive or this computer) with a vehicle check, a phone notes review and Phone files ticks. The Documents tab is cleaned up, and Scan no longer syncs to Drive. All on `main` in both repos, **NOT pushed, NOT deployed, not tried in a signed-in browser.**
  - **Owner/controller one-time step:** enable the **Google Picker API** in `surveyos-v2-antigravity-in`. If the Firebase web key is API-restricted, add the Picker API to it, or set `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`. Until then, "From Google Drive" falls back to the local chooser.
  - **Owner:** run checks 1–18 in `Sessions/2026-10-25-bring-phone-scans.md`.
  - **Controller:** run the Scan phone checks.
  - A future CSP must allow `apis.google.com`, `docs.google.com` and `www.googleapis.com`.

- [ ] **Claim Details layout — live check** (2026-10-25) — regrouped by document with dates on the right, vehicle type switch, tax/overload/span fixes; commit ea2a9ed6, deployed to motorsurveyos-in 2026-10-25 10:18. **Owner: open one spot, one final and one valuation claim; flip the vehicle switch once; scan an RC and confirm fields fill.** Session log `Sessions/2026-10-25-claim-details-layout.md`.

- [ ] **Surveyor feedback batch — live check** (2026-10-22) — date/time parsing, AI Review evidence viewer, select/unselect all, Rephrase with AI, page jump: all deployed to motorsurveyos-in 2026-10-22 15:54. **Owner: on one real claim, re-read the claim form → check accident date/time, press Rephrase on the cause, click a field in AI Review/Reconciliation and confirm it opens the right page.** Add more of Vikram's paragraphs to `EXAMPLES` in `src/lib/ai/rephrase-cause.ts` when available (3 so far). Session log `Sessions/2026-10-22-surveyor-feedback-batch.md`.

- [ ] **Portal fill extension — multi-portal** (2026-10-16) — **2026-10-17: Stage A done on `main` (v0.4.0: Check page + redesigned card), NOT deployed, card not yet tried in a browser. Next: Stage B on the live NIA portal (owner logs in; Claude in Chrome, read-only). Owner: run the fixture walk-throughs (`extension/README.md`, load `dist/unpacked-dev`) and approve a hosting deploy (map versions moved: NIA 3, UIIC 2).** Earlier: — roadmap `docs/superpowers/plans/2026-10-16-portal-extension-roadmap.md`. Phases 1–2 done on `main` (fcfff741): multi-portal core + **UIIC claim-survey fill**, extension v0.3.0. Hosting deployed to motorsurveyos-in 2026-10-16 (hosted maps NIA v2, UIIC v1 verified live). Extension not tried in a browser. Owner: fixture walk-throughs (NIA + UIIC) on the v0.3.0 zip; Phase 0 in India (NIA + UIIC Stage 0 on closed claims, capture sweep); decide uiicText space-vs-delete. Next code: Phase 3 (NIA tie-ups, needs a spec) or Phase 4 (National Insurance) after captures. Session logs `Sessions/2026-10-16-portal-extension-phase-1.md`, `…-phase-2.md`.

- [ ] **Claim document kit — Phases 1–2** (2026-10-21) — built on `main` (commits 7181ae3c..f510fbae): document types and page labels, per-device fingerprints, free page recognisers, identity checks, portal recipes (NIA non-tieup, NIA KIA tie-up provisional, UIIC), Ready/Check/Missing checklist, upload files in `Portal Upload/`, Review, folder choice, three Documents-tab panels. **NOT deployed, not tried in a browser. Owner: confirm recipe defaults in spec §8(b)–(d). Next: Phases 3–5 (Google Drive online picker, opt-in AI "Guess the rest", extension upload).** Spec `docs/superpowers/specs/2026-10-20-claim-document-kit-design.md`, plan `docs/superpowers/plans/2026-10-20-claim-document-kit.md`.

- [ ] **Phone site capture — phone checks + deploy** (2026-10-03) — P1–P3 deployed to motorsurveyos-in 2026-10-03 (hosting, 93f625b0). Owner: run the phone checklist in `Sessions/2026-10-03-phone-site-capture.md`. Then P4 plan (phone restyle of form tabs + deferred items listed there).
- [ ] **Phase 2-C admin steps + L11** (2026-09-17) — deployed (hosting, 96098c6f). Owner: Admin → Save, then Probe all, review Excluded (L11).
- [ ] **Live check L10** (2026-09-16) — Phase 2-A deployed (hosting, e7c1a997). L10 in `Sessions/2026-09-16-quota-aware-ranking.md`.
- [ ] **Live check L9** (2026-09-16) — Smart Fix deployed (hosting, 56b44714). Run L9 (`npm run dev`, open with `?ai-drop=38`, upload DTC Proforma Invoice-1.PDF as estimate — expect one extra single-page call and a clean dialog).
- [ ] **AI fallback — Phase 1 live checks** (2026-09-16) — code deployed; L0–L8 from `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md` Task 14 still to run in the live app with the owner's AQ. + Ollama keys (`?ai-fault=503|429-minute|429-day|429-zero` for induced failures).
- [ ] **AI fallback — Phase 2-B/D** — 2-B discovery + models.dev deprecation filter + persistent NEW detection (no accuracy benchmark — owner rejected); 2-D Profile provider rows with Test buttons, remove surveyor model pickers + legacy `models`/`defaultModel`/`resolveEnabledModel`/`AIControls` picker; consider a fourth `other` tier for non-Gemini non-gemma models. Carried minors in the 2026-09-16 session logs.

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

- [ ] Insured Report dialog reads policy images from a dead sessionStorage key (`evidence_<claimId>_policy`, nothing writes it) — falls back to an upload, so it works; switch to the evidence store's blob files.

- [ ] AI PDF page selection — auto-suggest junk pages from the local text layer (heuristic pre-ticking). Follow-up from `docs/superpowers/specs/2026-09-17-ai-pdf-page-selection-design.md` Non-Goals.
- [ ] AI PDF page selection — text-instead-of-image optimisation for digital PDFs (skip rasterizing pages with a clean text layer). Separate investigation, same spec's Non-Goals.
- [ ] AI upload PDF page selection — deployed to motorsurveyos-in 2026-09-17 (d13d28fc). Manual E2E (spec §5) still pending on live site.
- [ ] Should report numbers sync to Firestore for multi-device access?
- [ ] Should Standard and UIIC report formats get parity enforcement?
- [ ] Update ANTIGRAVITY_BIBLE.md (AI model reference is outdated)

---

## Blocked

- (none)

---

## Recently Completed

- [x] Portal fill extension Phase 1 — multi-portal core, v0.2.0 (2026-10-16) — maps chosen by host + exact route, one map per flow in storage (v0.1.0 `map` key migrated), wrong-portal packets refused, controller-less scope lookup, build/test over every overlay. 1424 tests.
- [x] Portal fill extension v0.1.0 (2026-09-21) — NIA non-tieup filler, `extension/`; spec `docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md`. Stage 0 on live portal pending.
- [x] Claim Documents (2026-09-21) + vehicle/insurer folder names, folder scan, one-time tidy-up (2026-09-22/23).
- [x] NIA Assessment Excel generator (2026-09-18) — spec `docs/superpowers/specs/2026-09-18-nia-assessment-excel-design.md`.
- [x] UIIC portal summary panel (2026-08-31) — spec `docs/superpowers/specs/2026-08-31-uiic-portal-summary-design.md`.

- [x] AI upload PDF page selection (2026-09-17) — multi-page PDFs into any AI upload (estimate, final bill, RC/DL/policy, Documents, Sync) get a page picker; unticked pages are never rasterized (zero tokens). `ai-pages.ts` WeakMap carrier, shared `PdfPageGrid`, `needsReview` gate extended. 1239 tests. deployed to motorsurveyos-in 2026-09-17. Manual E2E (spec §5) not run — no credentials in session. Session log: `Sessions/2026-09-17-ai-pdf-page-selection.md`.
- [x] AI fallback — Phase 2-C admin ranked lists + veto (2026-09-17) — schema 2, guard rails, shared `poolFromProbes`, editable limits, tab split. 1222 tests. Session log: `Sessions/2026-09-17-admin-ranked-lists.md`.
- [x] AI fallback — Phase 2-A quota-aware ranking (2026-09-16) — tier + per-key daily budget ordering, Pacific-day ledger, Ollama 1 h rest, Flash reserved for estimates. 1184 tests. Session log: `Sessions/2026-09-16-quota-aware-ranking.md`.
- [x] Smart Fix — missed-row detection (2026-09-16) — serial-gap + printed-gross check, page-targeted gap fill, gross-only second opinion, review-dialog card. Spec/plan `2026-09-16-smart-fix-missed-rows*`. 1150 tests. Session log: `Sessions/2026-09-16-smart-fix-missed-rows.md`.
- [x] AI fallback — Phase 1 (2026-09-16) — Google's AQ. keys broke extraction (fixed 2026-09-15, 7b1ff921); the follow-up redesign makes model choice automatic: every call declares a job (heavy/light/text), a pure ranker orders every reachable model, the loop hops models before keys and never retries a 503 in place (measured: a 503 takes up to 194 s to return). Gemini 429s are classified by `quotaId`; Ollama Cloud's free Gemma 4 is a proxied fallback (measured Δ0.01 % on a 5-page estimate); thinking is off for extraction (2.5 Flash was truncating); a document whose rows don't add up is re-run once on the next model. NVIDIA keys had been leaking to Firestore — stripped and purged. Spec: `docs/superpowers/specs/2026-09-15-ai-fallback-and-job-routing-design.md`; plan: `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md`. 1105 tests. Session log: `Sessions/2026-09-16-ai-fallback-phase-1.md`.
- [x] Reinspection fields — sync all RI/print data to Reinspection tab (2026-09-15) — Reinspection tab now captures every field the RI report prints: RI ref, place of survey, RI/authority/estimate dates. Two-way sync with Report No, insurer, offices, accident and survey dates. Photo sheet Report No is session-local (never persisted). RI report drops Date of Report, Survey Ref No, Survey Date. Place of survey fallback: `ri.placeOfSurvey || accident.placeOfSurvey`. Dead fields `ri.surveyRef` and `ri.surveyDate` remain on type for old data but nothing reads them. Session log: `Sessions/2026-09-15-reinspection-fields.md`.
- [x] Salvage — basis and a Bill Check figure of its own (2026-08-21) — the suggested salvage range was struck on the garage's estimate for metal parts, pre-GST, over every metal row including ones the surveyor rejected; new `salvageBasis(rows, lens)` in `src/lib/calculations/salvage.ts` strikes it on allowed metal parts only, at their assessed amount, with each row's own GST. The Bill Check shared the final report's `salvageValue` with no box to change it, so a part the workshop never replaced kept earning salvage the insurer never receives; new optional `feeBill.billSalvage` is bill-check-only — a typed figure wins outright, otherwise `resolveBillSalvage` rescales the final report's salvage by how far the metal basis moved (both directions, never written back to `salvageValue`). One `SalvageInput` component now serves both tabs; the Bill Check tab renders it beside Final Liability. Both bill-check report builders print the resolved figure — the standard builder branches on `mode`, since it serves the Final Survey Report from the same salvage read, and a regression test pins that the filed report never prints a bill-check figure. Every figure is a suggestion; nothing overrides a number the surveyor has typed. Spec: `Specs/2026-08-21-salvage-basis-and-bill-check-salvage-design.md`; plan: `docs/superpowers/plans/2026-08-21-salvage-basis-and-bill-check-salvage.md`. 863 tests passing. Screen behaviour (the box, the carried-over note, the live band) not verifiable without a real login — needs exercising on a live claim.
- [x] Bill Check — the cap, the flags and the estimate figures (2026-08-20) — three parts, ten tasks, deployed. **Estimates:** `calculateAssessmentSummary` summed `estimatePartsBase` over every row but split it by material over allowed rows only, so every summary table printing both showed a heading its own breakdown did not add up to; the `allowed` guard is gone from the split and the Standard builder's private duplicate of that maths is deleted in favour of the engine's. §8 column now reads `Estimated (before GST)`; §9 gained Estimate and Assessed subtotals (its label used to span six columns and swallow them); §8's Billed total ties to the invoice, deducting rejected-but-billed items on one aggregate line. **Cap:** `billCheckAssessed` returns `min(assessed, billedTaxable)` — the bill caps the claim per item, bill-check only, never touching the Final Survey Report. **Flags:** new `bill-check-flags.ts` derives one rule in both directions (billed under over-claims against the insurer, billed over leaves the insured paying), diagnosed by the estimate as the third number; a mark per row opens an in-place explanation, a two-tier banner carries bulk actions, and blocking flags gate printing. `partial` status retired (it changed no arithmetic and compared against the wrong number); `billVerified` added. Spec: `Specs/2026-08-18-bill-check-cap-and-flags-design.md`; plan: `docs/superpowers/plans/2026-08-18-bill-check-cap-and-flags.md`. 836 tests passing. Screen behaviour not verifiable without a real login — needs exercising on a live claim.
- [x] UIIC report — Depreciation Amount column (2026-08-18) — rupee value beside `Part Depreciation` %, in both the UIIC final report and the UIIC bill check item table. Shipped alongside the labour/paint column split ("Part with GST" / "Labour with GST" / Paint) and per-line tax and depreciation throughout.
- [x] Standard Bill Check report + grid alignment (2026-08-18) — new `mode: 'bill-check'` on the Standard Final Survey builder (row projection, no new calculations); Standard | UIIC toggle on the Bill Check tab; `billAllowed` field + AllowanceScopeDialog so a bill-check allowance can't silently rewrite an issued Final Survey Report; PendingRowsDialog blocks printing on unchecked items; MissingRemarkDialog warns (non-blocking) on undocumented rows; Bill Check grid gained Dep%/Net/Price+GST and corrected column labels via a shared `grid-columns.ts`. Spec: `Specs/2026-08-18-standard-bill-check-design.md`; plan: `docs/superpowers/plans/2026-08-18-standard-bill-check.md`. 742 tests passing.
- [x] Fixed UIIC "Repairs As Per Assessment" defaulting to YES with no reinspection on record (2026-08-18)
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
