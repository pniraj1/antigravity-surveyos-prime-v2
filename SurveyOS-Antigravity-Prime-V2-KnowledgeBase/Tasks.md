# Active Tasks

> Last updated: 2026-09-15 by Claude
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

- [ ] **AI fallback — Phase 1 live checks** (2026-09-16) — code deployed; L0–L8 from `docs/superpowers/plans/2026-09-15-ai-fallback-phase-1.md` Task 14 still to run in the live app with the owner's AQ. + Ollama keys (`?ai-fault=503|429-minute|429-day|429-zero` for induced failures).
- [ ] **AI fallback — Phase 2** — probe verdicts into the request path, models.dev deprecation filter, auto Tier 2, benchmark set, admin ranked lists + Exclude + discovery summary, Profile provider rows, `models`→`excluded` migration. Spec sections 7–9, 11. Carried minors listed in `Sessions/2026-09-16-ai-fallback-phase-1.md`.

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
