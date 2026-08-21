# Changelog

> Most recent entries at the top. Updated by whichever agent makes changes.

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
