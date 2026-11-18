# HANDOVER — read this before any work on Prime or Scan

> Last updated 2026-11-16 by Antigravity, handing back to Claude Code.
>
> 🚨 **PRIMARY HANDOVER FILE:** See [`HANDOVER_2026_11_16_CLAUDE.md`](HANDOVER_2026_11_16_CLAUDE.md) for the complete Bill Check progressive tallying cockpit, Brand Orange theme overhaul, modal dialog architecture, and production deployment.
>
> This file condenses everything learned across development sessions between Claude Code and Antigravity.
>
> Keep it current. When you finish a piece of work, update the **Status** section, `Tasks.md`, `Changelog.md`, and a new `Sessions/` log, as `Rules/Handoff_Protocol.md` asks.

## 1. Read order (first session)
1. [`HANDOVER_2026_11_16_CLAUDE.md`](HANDOVER_2026_11_16_CLAUDE.md) (Crucial: Bill Check tallying cockpit, Orange theme overhaul, modal dialog architecture & production deployment).
2. This file.
3. `../CLAUDE.md` and `../GEMINI.md` in the Prime repo. Every rule in CLAUDE.md applies to you too.
4. `AGENT_PROTOCOL.md`, then `Tasks.md`.
5. The latest `Sessions/` log: `2026-11-16-handover-to-claude.md`.
6. The last 5 entries of `Changelog.md`.
7. Before touching Scan: `../../SurveyOS Scan/CLAUDE.md` and `../../SurveyOS Scan/docs/handover/prime-notes-import.md`.
8. `git status` and `git log --oneline -15` in both repos.

**Trust the code over these docs.** Older vault notes (Architecture/, Features/, the "bible" files) can be stale or aspirational. Read the real source before you assert how something behaves.

## 2. The product and the owner
- **Motor SurveyOS** is a web app for IRDAI-licensed motor insurance surveyors in India. It produces spot, final, reinspection, bill-check and valuation reports, fee bills, photo sheets and insurer-portal packets.
- **Owner:** Niraj Patil. He is a practising surveyor; his father and brother are surveyors too. The product's purpose is to **remove the admin around a surveyor's job**: transcription, chasing papers, rebuilding fee bills, being tied to one desktop. AI is a tool it uses, never the headline. Write peer-to-peer, surveyor to surveyor.
- **The assessment is surveyor-made.** AI may read, check, compute and *propose*, but it must never commit assessment values or policy answers on its own. Every AI write is a proposal the surveyor ticks. No silent rounding or "tidying" in reports.
- **Validity checks are advice, never verdicts.** Examples are a lapsed DL or a policy mismatch. Show them as dismissible advice next to the field, and let the surveyor write the remark.
- **It must stay practically free.** Surveyors bring their own free-tier AI keys. Any proposal needs a cost and resource estimate. Prefer client-side work, no new paid services, and no new dependencies for what a few lines can do (smallest working diff).

## 3. Repos and folders (all under `Antigravity Surveyor V6 fixed/`)

| Folder | What | Git |
|---|---|---|
| `SurveyOS-Prime-V2/` | **Prime**, the main web app. Next.js 16 static export on Firebase Hosting. Vault is inside it. | GitHub `pniraj1/antigravity-surveyos-prime-v2` (**public** repo), branch `main` |
| `SurveyOS Scan/` | **Scan**, a native Android (Kotlin) document scanner and site-notes app. It is Prime's helper. | GitHub `pniraj1/surveyos-scan` (**private**), branch `main` |
| `SurveyOS Sync/` | Telegram bot + Cloudflare Worker that collects insured/garage documents. Prime reads it as a read-only "drive". | its own repo |
| `SurveyOS-Prime-V2/extension/` | **Portal Fill** Chrome extension (v0.4.0). It fills NIA non-tieup and UIIC portal fields from the claim and never submits. | part of Prime |
| `SurveyOS-Prime/`, `legacy_versions/`, `*.html` at top | Old versions | ignore |

## 4. Working rules (owner's, all binding)
- **Work and commit directly on `main`. Never create branches or PRs** unless the owner asks in that request. `master` is dead; ignore any tool that calls it the default.
- Commit messages use conventional commits (`feat:`, `fix:`, `docs:`, …).
- **Prime ↔ Scan rule.** Every change on either side checks its impact on the other, in the same piece of work, and every change report states that impact (even "none").
  - Coupling points:
    - doc types, labels and aliases (`src/types/documents.ts`, `DocumentChecklist.tsx`);
    - the insurer table and claim folder naming;
    - the Drive folder layout (e.g. "Final Photos");
    - spot and valuation field labels (`SpotPrintReport.tsx`, `SpotTab.tsx`, `ValuationTab.tsx`, `valuation-report-builder.ts`);
    - claim paths `spotDetails.*` and `valuationDetails.*`;
    - the manifest `_surveyos-scan.json`;
    - `src/lib/scan-import/`.
  - After touching any coupling point, run Scan's drift tests in Git Bash, with `JAVA_HOME` set to Android Studio's `jbr`:
    `cd "../SurveyOS Scan" && ./gradlew :app:testDebugUnitTest`
- **Tests.** Run `npx vitest run` (227 files, 1,999 tests, all green) and `npx tsc --noEmit` (clean) before every commit. Write the test first for logic changes.
- **Next.js 16** has breaking changes; check `node_modules/next/dist/docs/` before writing Next-specific code.
- **The app is a static export.** For URL sync use `window.history.pushState`, never `router.push` (that causes full reloads). `useRouteSync.ts` and the `AppTab` ids in `src/stores/ui-store.ts` are a URL contract; rename nothing.
- **Never start the dev server or a browser to "verify" auth-gated screens.** It needs the owner's real login and data, and the owner has corrected this several times. Make the change, run the tests and tsc, say plainly what is unverified, and deploy when asked. The owner verifies on the real site.
- **UTF-8.** Files contain `₹`, `→`, `—`. Never rewrite them with PowerShell or Python round-trips that re-encode.
- `.superpowers/` is git-ignored scratch; never commit it.
- **Report builders** (`src/lib/reports/*`, `src/components/print/*`, `src/components/pdf/*`) are isolated from app styling. A UI restyle must not touch them.
- **Public repo:** never commit keys. `.env.local` is ignored and `.env.example` holds placeholders only.

## 5. Deploy (production)
- **Live site:** **https://surveyos.in** (primary custom domain) / https://motorsurveyos-in.web.app (Firebase default), Firebase project `surveyos-v2-antigravity-in`, hosting site `motorsurveyos-in`. The old `motorsurveyos` site and project are **dead**; always pass `--project`.
- Build first: hosting serves the prebuilt `out/` folder, and skipping the build silently redeploys the old one. Then:
  ```
  npm run build
  firebase deploy --only hosting:motorsurveyos-in --project surveyos-v2-antigravity-in
  ```
  Add `,firestore:rules` (and indexes) only when `firestore.rules` changed.
- **Sandbox site:** `https://surveyos-v2-antigravity-in.web.app` (Firebase hosting target `surveyos-v2-antigravity-in`).
  ```
  npm run build
  firebase deploy --only hosting:surveyos-v2-antigravity-in --project surveyos-v2-antigravity-in
  ```
- **Verify** without logging in: `grep -rl "<new UI text>" out/_next/static/chunks/`, then curl that chunk from the live site and grep the same text. "Deploy complete!" alone has lied before.
- Deploy only when the owner asks. The public pre-sign-in redesign in `design/landing-v2/` must **never** be deployed without explicit approval.

## 6. Status (2026-11-17)

### Just Shipped & Verified:
1. **Deploy of main at f2a0452b to Production (2026-11-17):**
   - Deployed hosting (`surveyos-v2-antigravity-in`, site `motorsurveyos-in`, custom domain `https://surveyos.in`). Live chunks verified with `curl.exe`.
2. **UIIC Spot Survey Dates, Universal AI Model Pick & "Done by" Note (DEPLOYED 2026-11-17):**
   - UIIC final report spot survey column now reads `reinspection.spotAppointmentDate/spotSurveyDate/spotReportDate` asked in UIIC "Before printing" dialog (no longer mirrors final survey dates into the spot column).
   - `callAIGateway` defaults a session for sessionless callers (rephrase cause, bill-check AI match, insured report, bank statement), honouring the surveyor's active model pick.
   - `lastUsedModelLabel()` feedback added beside Undo after rephrase, in extraction review ("Read by ..."), and as toast detail.
3. **Bill Check: Final Bill / Estimate Switch Restored (DEPLOYED 2026-11-17):**
   - `[Final bill]` and `[Estimate]` toggle buttons restored in `BillCheckHeader.tsx` with tooltips. Switches document kind in place without re-read, preserving assessed amounts and allowed flags.
4. **Bill Check Column Order & Allowed-Only View (DEPLOYED 2026-11-17):**
   - Unified column order across Case 1 (Claim from Estimate) and Case 2 (Claim from Bill): base | Assessed | uploaded | item no. | Status | GST | Disposal | Dep% | Net | Price+GST | Remarks.
   - Allowed rows only shown by default with "Allowed only" toggle; counts and footer totals follow visible rows via `sectionFooterTotals`.
5. **Bill Check Progressive Tallying Cockpit & Reconciliation Wizard (DEPLOYED 2026-11-16 / 2026-11-17):**
   - 4-Stage Progressive Tally Engine (`src/lib/tally/`): Stage 1 Part Numbers, Stage 2 Semantic Automotive Matcher, Stage 3 Surveyor-Triggered AI Matching, Stage 4 Disallowed Isolation with ₹0 liability & insurer savings.
   - Accessible Modal Dialog Architecture (`BillCheckUploadDialog.tsx`, `ReconciliationWizardDialog.tsx`).
   - 100% Brand Orange Theme (`#F59E0B`, `amber-500`) compliance. Main spreadsheet workspace (`BillCheckGrid.tsx`) remains permanently mounted.
6. **Assessment & Grid Usability (DEPLOYED 2026-11-14 / 2026-11-16):**
   - `DecimalInput` without arrow/wheel stepping, retains decimal precision.
   - Shared cell selection (`useGridSelection`) with copy/paste and fill capabilities across Assessment and Bill Check.
7. **BharatBenz Digital DMS Invoices (DEPLOYED 2026-11-14):**
   - Deterministic parsing via `row-parser.ts` handles 13-page BharatBenz invoices with 0 row AI token calls.
8. **Comprehensive Codebase Architecture Map (2026-11-14 / 2026-11-17):**
   - Published permanent authoritative map to `Architecture/Codebase_Architecture_Map.md`.
9. **Zero-Login Sandbox & Anonymous BYOK Cloud Function Proxy (2026-10-30):**
   - Deployed to `asia-south1` and hosting; silent `signInAnonymously(auth)` in sandbox mode for BYOK Ollama and NVIDIA NIM.

### In Progress / Next Up:
- **Auto-Split Multi-Page Row Ordering Bug (Active Investigation):**
  - Order sequential items `1, 2, 3...` ascending in `processor.ts` / `aiDataSlice.ts`.
- **Claim Document Kit:** Phases 3–5 pending.
- **Portal Fill Extension v0.4.0:** Phase 0 (live portal checks from India, no VPN).

---

## 7. Gotchas worth knowing
- **Ollama / NVIDIA in Sandbox:** Works via silent anonymous Firebase auth (`signInAnonymously(auth)`) and Cloud Function BYOK proxy exemption (`asia-south1`). No login popups or Google credentials required in sandbox.
- **Multi-page Auto-Split:** When dense pages truncate JSON output tokens, `processor.ts` catches `SyntaxError` and splits the 2-page chunk into 1-page calls.
- **AI Prompts Integrity:** `src/lib/ai/prompts.ts` is in its battle-tested state (`RAW_PROMPTS`). Never edit extraction prompts without explicit instruction.
- **Gemini Free Tier:** Flash 20 requests/day per key, Flash-Lite 500. Extraction falls back across providers by job.
- **Text PDFs vs Vision:** Text PDFs are read one page per AI call; vision chunks process 2 pages at a time unless auto-split triggers.
- **UTF-8 & Static Export:** Always use `window.history.pushState` for URL sync, never `router.push`. Never rewrite files with encoding-mangling scripts.
- **PowerShell 5.1:** Write long commit messages to a file and use `git commit -F`.
