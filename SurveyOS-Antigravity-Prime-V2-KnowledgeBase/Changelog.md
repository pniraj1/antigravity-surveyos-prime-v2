# Changelog

> Most recent entries at the top. Updated by whichever agent makes changes.

## 2026-10-03 (Claude) — Phone site capture (P1–P3)
- feat(photos): Camera button (opens the phone's own camera app) on Photos and on each document card; shared `usePhotoUpload` hook; "save to Drive?" asked once per claim; photos remember their Drive filename (`PhotoItem.driveName`)
- feat(sync): "N waiting to upload" chip for the Drive queue; banner offers photos uploaded from another device (per-device ignore list; deleted photos never re-offered); Restore from Drive no longer duplicates
- feat(pwa): installable (manifest, icons, iPhone icon), hand-written service worker caches the app shell + chunks, opens without signal, 4 s weak-signal fallback, skips `/__/` auth handler
- feat(site): new `AppTab 'site'` — phones land on it: capture buttons, still-missing / confirm checklist per survey type, dictated site notes → allow-listed fields via one AI text call with review (never assessment, amounts or identity; never overwrites), navigate + tap-to-call; phone bottom bar; `isNavItemVisible` is the single tab-visibility rule
- feat(share): Share button for Photo Sheet and Document Annexure PDFs
- tests: 1408 passing. Spec `docs/superpowers/specs/2026-10-02-phone-site-capture-design.md`, plan `docs/superpowers/plans/2026-10-02-phone-site-capture.md`, session log `Sessions/2026-10-03-phone-site-capture.md`. Commits 5db7c5b2..b949bb11. Deployed to motorsurveyos-in.web.app (hosting) 2026-10-03. Phone checks not run — no credentials or device in session.

## 2026-09-17 (Claude) — AI upload PDF page selection
- feat(ai): multi-page PDFs dropped into any AI upload (estimate, final bill, RC/DL/policy, Documents tab, Sync picker) get a page picker — the surveyor unticks pages before the document is sent; unticked pages are never rasterized, so they cost zero tokens
- feat(ai): `ai-pages.ts` — `setAIPages`/`getAIPages` WeakMap carrier tags the selection onto the `File` object itself, four calls deep into the rasterize chain, with no signature change; Re-scan, Smart Fix and the bank-statement extractor inherit it for free. Pure `resolveAIPages` clamps out-of-range picks
- feat(documents): `needsReview` gate now opens the review sheet for a single multi-page PDF too (previously multi-file only); `PdfPageGrid` extracted from the photos annexure picker into a shared component; `DocumentReviewSheet` shows a per-PDF grid, page-aware counts/warnings, survives crop edits, zero-ticked PDF excluded from Send, unreadable PDF falls back to sending whole
- chore(ai): `AssessmentTab`, `BillCheckTab`, `DetailsTab` now route their uploads through the review sheet when the gate says so
- tests: 1239 passing. Spec `docs/superpowers/specs/2026-09-17-ai-pdf-page-selection-design.md`, session log `Sessions/2026-09-17-ai-pdf-page-selection.md`. Not deployed. Manual E2E (spec §5) not run — no credentials in session.

## 2026-09-17 (Claude) — Admin ranked lists (Phase 2-C)
- fix(ai): non-Google models (Groq/NVIDIA/Ollama non-gemma) now rank in an `other` tier after gemma for every job — L11 showed Groq qwen #1 for licences and NVIDIA above gemma4 for estimates; a 429/5xx/timeout in the vision probe keeps the previous verdict (3.6-flash had been recorded text-only). Deployed.
- feat(admin): AI Models tab is veto-based — every probe-ok model is in the surveyor chain unless excluded; guard rails auto-exclude slow / preview / transcribe / robotics / tts / image / embedding / audio / live / omni ids with a visible reason and an Include button
- feat(admin): three ranked lists (Estimates & bills / Licence · RC · policy / Letters & text) computed by the loop's own ranker; per-row editable calls/day (overrides the quota table; 0 = off); Exclude refused on the last eligible model; discovery line per provider
- feat(ai): config schema 2 (`excluded`, `excludedReason`, `keep`, `limits`, `notes`) with pure migration from the tick list; `poolFromProbes` shared by request path and admin; surveyors load `ai_config/model_probes`; legacy `models` field kept as a mirror of the chain for stale tabs (delete in 2-D)
- chore(admin): removed per-model checkbox, ★ default, size buckets, accuracy test, benchmark card, `probe-reconcile.ts`
- tests: 1222 passing. Spec `docs/superpowers/specs/2026-09-17-admin-ranked-lists-design.md`, plan `docs/superpowers/plans/2026-09-17-admin-ranked-lists.md`, session log `Sessions/2026-09-17-admin-ranked-lists.md`. Deployed to motorsurveyos-in.web.app (hosting only) 2026-09-17; admin Save + Probe pending.

## 2026-09-16 (Claude) — Quota-aware ranking (Phase 2-A)
- feat(ai): free-tier budgets drive the model order — Google gives every Flash model 20 calls/day per key, Flash-Lite 500, Pro 0 (`quota.ts`); a per-key spend ledger resets at Pacific midnight (`health.ts`)
- feat(ai): heavy (estimate/bill) runs on the strongest tier whose key can still finish the whole document (budget re-checked per chunk, never a half-read); light (RC/DL/policy) never spends Flash while Flash-Lite or gemma is available
- feat(ai): non-Gemini 429 (Ollama usage window) rests that key:model one hour; day-limit toast also fires when the ledger has spent every key; once-a-day "Flash quota used up" nudge
- chore(ai): surveyor's saved Gemini model pick no longer steers ranking (picker inert until 2-D); status badge shows "Gemini · auto"
- tests: 1184 passing. Spec `docs/superpowers/specs/2026-09-16-quota-aware-ranking-design.md`, plan `docs/superpowers/plans/2026-09-16-quota-aware-ranking.md`, session log `Sessions/2026-09-16-quota-aware-ranking.md`. Deployed to motorsurveyos-in.web.app (hosting only).

## 2026-09-16 (Claude) — Smart Fix
- feat(ai): missed-row detection replaces the subtotal math check — rows carry their page; serial (`sr_no`) gaps and duplicates are found after the merge; the gross is checked against row sums only (text mode: only when its digits are printed); section subtotals are never checked (they cried wolf on a perfect 80-row DTC read)
- feat(ai): a gap is filled with ONE single-page vision call for its page, merged by serial; a whole-document second opinion runs only when the gross is off and no serial gap explains it, and is accepted only when it reconciles. Clean read = zero extra calls.
- feat(ui): Smart Fix moves out of the toast into the review dialog — one amber "Check before applying" card above the fields with the button inside; closing the dialog or re-scanning cancels a running fix; Apply is locked while it runs
- fix(ai): unnumbered bills (model numbers each page 1..n itself) keep every row — duplicates are dropped only when ≤ 10 % of serials
- fix(ai): retry any Gemini 400 once without thinking and remember it per model; retired Gemini ids dropped from the chain; page-level subtotal noise no longer triggers a second read (50c2e994, fd732a06, 2b20fde9)
- chore(ai): dev-only `?ai-drop=<sr_no>` simulates a missed row for live check L9
- tests: 1150 passing (processor flow now driven end-to-end in node via a FileReader stub). Spec `docs/superpowers/specs/2026-09-16-smart-fix-missed-rows-design.md`, plan `docs/superpowers/plans/2026-09-16-smart-fix-missed-rows.md`, session log `Sessions/2026-09-16-smart-fix-missed-rows.md`. deployed to motorsurveyos-in.web.app (hosting only) after a surveyor hit the 3.5-flash-lite 400 on auth/fitness docs.

## 2026-09-16 (Claude)
- feat(ai): job-aware fallback loop — every AI call declares heavy/light/text; the ranker orders every reachable model; on 503/429 the app hops to the next Gemini model before rotating keys or leaving Gemini; no in-place 503 retry; per-call timeouts (heavy 120 s)
- feat(ai): Gemini 429s classified by `quotaId` — per-model/minute hops, per-model/day marks the model dead till Pacific midnight, per-project/day marks the key, day+minute together = zero quota (Pro on a free key)
- feat(ai): Ollama Cloud (Gemma 4 31B, free vision) as a proxied fallback; `nvidiaProxy` generalised to `aiProxy` with a host allowlist; Ollama key row in Profile
- feat(ai): Gemini extraction runs with thinking off (2.5 Flash was truncating at MAX_TOKENS); 400-on-thinking retries once without it
- feat(ai): a document whose extracted rows don't add up is re-run once on the next model; whichever passes the math wins
- feat(probe): Ollama catalogue and ping; 402 recorded as a durable `paid` status
- fix(sync): `nvidiaApiKeys` was reaching Firestore — now stripped and purged (`deleteField`) for one release
- chore(ai): dev-only `?ai-fault=` injection for live fallback tests
- deploy: live at motorsurveyos-in.web.app (project surveyos-v2-antigravity-in); 1105 tests passing. Live checks L0–L8 pending. Session log: `Sessions/2026-09-16-ai-fallback-phase-1.md`

## 2026-09-15 (Claude)
- feat(ri): Reinspection tab now holds every field the RI report prints (RI ref, place, RI/auth/est dates, plus two-way Report No / insurer / offices / accident & survey dates). RI report drops Date of Report, Survey Ref No, Survey Date. Photo sheet Report No editable with "Use RI Ref".

## 2026-08-21 (Claude)
- feat(salvage): `salvageBasis(rows, lens)` in `src/lib/calculations/salvage.ts` — allowed metal parts only, assessed before depreciation, each row's own GST, replacing a basis struck on the unfiltered estimate
- feat(salvage): the Assessment tab's suggested band reads the new basis instead of `estimateMetalBase`
- feat(bill-check): `feeBill.billSalvage` (optional, no default) plus `resolveBillSalvage` — a typed figure wins, otherwise the final report's salvage is rescaled by how far the metal basis moved, both directions, never written back to `salvageValue`
- refactor(claim): `SalvageInput` extracted from `AssessmentSummary.tsx` into `src/components/claim/SalvageInput.tsx`, used by both the Assessment and Bill Check tabs
- feat(bill-check): salvage box added to `BillCheckSummaryPanel`, beside Final Liability, with a note when a figure has been carried over and rescaled
- feat(bill-check): both bill-check report builders print the resolved salvage figure; the standard builder branches on `mode` since it serves the Final Survey Report from the same read, pinned by a regression test
- deploy: live at motorsurveyos-in.web.app (project surveyos-v2-antigravity-in); 863 tests passing

## 2026-08-20 (Claude)
- fix(calc): stop filtering the per-material estimate split — `estimatePartsBase` summed every row while Metal/Plastic/Glass/Fibre summed allowed rows only, so every summary table printing both disagreed with itself
- fix(report): Standard builder reads the engine's estimate figures instead of its own filtered duplicate; §8 column relabelled `Estimated (before GST)`
- feat(report): §9 subtotals the Estimate and Assessed columns — the label used to span six columns and swallow them
- feat(bill-check): §8's Billed total ties to the invoice, deducting rejected-but-billed items on one aggregate line
- feat(bill-check): the billed amount caps the assessment per item (`billCheckAssessed`), bill-check only — the Final Survey Report is never touched
- refactor(bill-check): `billVerified` in, `partial` status out — it changed no arithmetic and compared against the estimate rather than the assessment
- feat(bill-check): `bill-check-flags.ts` — one divergence rule in both directions, diagnosed by the estimate; plus invoice reconciliation, a rejected-item-billed advisory and a low-confidence-match advisory that the screen already detected and never showed
- feat(bill-check): per-row flag mark with an in-place explanation, a two-tier attention banner with bulk actions, and a print gate on blocking flags
- deploy: live at motorsurveyos-in.web.app (project surveyos-v2-antigravity-in); 836 tests passing

## 2026-05-25 (Claude)
- feat: duplicate upload detection for Google Drive (DuplicateUploadDialog + upload-with-check.ts)
- feat: per-claim Drive file listing with IDB cache (useClaimDriveFiles hook, DB_VERSION=4)
- feat: city/state fields in access-request form + profile store
- feat: admin SurveyorsTab expandable detail rows (9 fields: email, mobile, IRDAI, city, state, qualifications, referral, join date)
- feat: admin ApprovalQueueTab Location column
- feat(bramha): gate archive button behind isCompleted in Dashboard.tsx and NewClaimDialog.tsx
- feat(bramha): new Cloud Function `onClaimArchived` — archive-triggered Gemini embedding pipeline
- feat(bramha): `bramha_memories` supports RAG + fraud detection + civic hotspot analysis
- chore(bramha): deleted old `processCompletedClaim` Cloud Function
- chore(bramha): added functions config to SurveyOS-Prime/firebase.json
- deploy: all changes live at motorsurveyos.web.app; functions at us-central1
- chore: pushed 18 commits to GitHub (pniraj1/antigravity-surveyos-prime-v2)

## 2026-05-21 (Claude)
- chore: project reorganization — purged 473+ auto-generated vault files
- chore: restructured vault into Architecture/, Features/, Rules/, Operations/, Specs/, Reference/
- docs: created AGENT_PROTOCOL.md — universal rules for all AI agents
- docs: created Rules/ (File_Placement, Naming_Conventions, Documentation_Protocol, Handoff_Protocol)
- docs: created 10 Feature docs from source code audit
- docs: created HTML project map at docs/project-map.html
- chore: deleted unused IDE configs (.cursorrules, .windsurfrules, .opencode.json)
- chore: deleted stale .claude/worktrees/, Cinematic landing page/, claude_handover.md
- chore: updated .gitignore (added open-design/, ruvector.db, .venv/, functions/node_modules/)
- chore: rewrote CLAUDE.md and GEMINI.md as thin pointers to vault

## 2026-05-17 (Claude)
- fix: move Hide/Show Summary button next to Show Evidence button
- feat: add toggle button to hide/show financial summary panel in AssessmentTab
- feat: implement subscription lifecycle system with trial, payments, and referrals
- fix: add missing bg prop to CHAPTERS and style passthrough to GlassCard
- fix: prompt clarification — CGST+SGST must be summed for gst_percent (9+9=18)

## 2026-05-16 (Claude)
- feat: wire Ctrl+V paste, Escape, and cell highlight ring into AssessmentGrid
- feat: add cell selection state and mouse handler to AssessmentGrid
- feat: add grid-paste utility with parseClipboardValue and buildPasteUpdates
- fix: separate 'approved' from 'safe' category — approved in full vs no damage
- fix: recolor shared DocumentEvidenceViewer to light mode
- chore: exclude open-design from tsconfig to fix build

## 2026-05-15 (Claude)
- feat: wire Pass 2.5 enrichTaggedRows into runAssessmentAnalysis
- refactor: split buildPreClassifiedExplanations into autoClassified + taggedRows
- feat: add buildTaggedRowEnrichmentPrompt for Pass 2.5 enrichment
