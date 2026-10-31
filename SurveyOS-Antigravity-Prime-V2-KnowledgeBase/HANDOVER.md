# HANDOVER — read this before any work on Prime or Scan

> Last updated 2026-10-31 by Antigravity, handing back to Claude Code.
>
> This file condenses everything learned across development sessions between Claude Code and Antigravity.
>
> Keep it current. When you finish a piece of work, update the **Status** section, `Tasks.md`, `Changelog.md`, and a new `Sessions/` log, as `Rules/Handoff_Protocol.md` asks.

## 1. Read order (first session)
1. This file.
2. `../CLAUDE.md` and `../GEMINI.md` in the Prime repo. Every rule in CLAUDE.md applies to you too.
3. `AGENT_PROTOCOL.md`, then `Tasks.md`.
4. The latest `Sessions/` log: `2026-10-31-handover-to-claude.md`.
5. The last 5 entries of `Changelog.md`.
6. Before touching Scan: `../../SurveyOS Scan/CLAUDE.md` and `../../SurveyOS Scan/docs/handover/prime-notes-import.md`.
7. `git status` and `git log --oneline -15` in both repos.

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
- **Live site:** https://motorsurveyos-in.web.app, Firebase project `surveyos-v2-antigravity-in`, hosting site `motorsurveyos-in`. The old `motorsurveyos` site and project are **dead**; always pass `--project`.
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

## 6. Status (2026-10-31)

### Just Shipped & Verified:
1. **Zero-Login Sandbox & Anonymous BYOK Cloud Function Proxy (2026-10-30):**
   - Deployed to `asia-south1` (`aiProxy`, `nvidiaProxy`) and hosting (`surveyos-v2-antigravity-in.web.app`, `motorsurveyos-in--sandbox-izvlcn5z.web.app`).
   - `src/lib/sandbox.ts` runs silent `signInAnonymously(auth)` in the background on sandbox mount; gives valid Firebase ID token without Google login popups.
   - Bypassed GIS OAuth and cloud sync in sandbox mode to eliminate `Error 400: origin_mismatch`.
   - Updated `functions/index.js`: anonymous callers using BYOK (Bring Your Own Key) are exempted from paid subscription checks for Ollama (`gemma4:31b`) and NVIDIA NIM.
   - Owner verified live with Ollama `gemma4:31b` without any `Session expired` or `origin_mismatch` errors.
2. **Multi-Estimate Mode, Start Gap Detection & In-Flight Auto-Split (2026-10-30):**
   - Added "Another estimate (Estimate 2, 3...)" mode in `EstimateModeDialog.tsx` and `aiDataSlice.ts` (`applyEstimate`): keeps existing rows, retains printed serial numbers (1..N), tags with `estimateId` (e.g. `Quote 2`), and enables multi-quotation switching via `EstimateViewSwitcher`.
   - Added start-of-document gap detection (`gapsIn` in `src/lib/ai/row-check.ts` flags serials `1..present[0].sr-1`).
   - Implemented in-flight auto-split in `src/lib/ai/processor.ts`: multi-page chunks failing JSON parse split into 1-page calls automatically.
3. **Claim & Spot Field Unification (2026-10-30):**
   - Deployed to production `https://motorsurveyos-in.web.app`.
   - Bi-directional store sync: Weights (`registeredLoadWeight`/`grossWeight`/`unladenWeight` ↔ `gvw`/`ulw`/`loadCapacity`), Goods (`spotDetails.loadDesc` ↔ `vehicle.natureOfGoods`/`detailsOfGoodsCarried`), HPA (`policy.hpaWith` ↔ `vehicle.hypothecation`/`rcEndorsement`), and Odometer (`vehicle.odometer` ↔ `valuationDetails.odometer`).
   - Consolidated duplicate inputs in `AtAccidentForm.tsx` to single authoritative "Load at Accident (KG)" and "Nature / Description of Goods". Cross-fallbacks in all report builders.
4. **Scan Fee Bill Notes, Mobile Rate Memory & Draft Sync (2026-10-30):**
   - Handover contract `prime-notes-import.md` updated with 16 `feeBill.*` paths.
   - Android Scan app: `FeeBillFields.kt`, `FeeRatesStore.kt` (SharedPreferences rate memory), `FeeBillNotes.kt` screen with live calculation cards, and `SHARED_SYNC_MAP` SQLite cross-section draft sync in `NotesViewModel.kt`.
   - Prime side: `src/lib/scan-import/notes.ts` parses fee bill notes and backfills date/time into Spot, Final, and Valuation.
5. **Browser Storage Exhaustion Fix & IndexedDB Cleaner (2026-10-29):**
   - Photo canvas compression switched from PNG to JPEG 0.85 (~40KB, 95% payload reduction).
   - IndexedDB prune utilities and `StorageCleanerSection.tsx` in Profile tab.
6. **Survey Date & Time Consolidation (2026-10-28):**
   - Unified `datetime-local` input across Spot and Final claims; bi-directional store sync; report cross-fallbacks.
7. **Bill Check Reference Serials (2026-10-27):**
   - `refSrNo`, `refStatus`, `BillCheckGrid` with 400-line review filter, 13-column UIIC report and Standard Report column 9.

### In Progress / Next Up:
- **Auto-Split Multi-Page Row Ordering Bug (Active Investigation):**
  - **Context:** When the owner ran Ollama `gemma4:31b` on the first 2 pages of Pawar Brothers' merged estimate PDF in the sandbox, auto-split triggered as expected upon token overflow (`"trying to read it individually"`).
  - **Symptom:** In the assessment sheet, Page 2's line items appeared before Page 1's line items.
  - **Next Step:** Inspect `processor.ts` (`mergeAIResults`), `aiDataSlice.ts` (`buildEstimateRows`), and `ai-pages.ts`. Sort rows by printed `srNo` (ascending) so sequential items `1, 2, 3...` always render in ascending document order regardless of chunk resolution order or section splitting.
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
