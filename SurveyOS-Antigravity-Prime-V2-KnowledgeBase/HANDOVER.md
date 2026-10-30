# HANDOVER — read this before any work on Prime or Scan

> Last updated 2026-10-27 by Claude Code, at the switch to Antigravity.
>
> This file condenses everything Claude learned over months of sessions. Most of it sat in Claude's private memory, which no other agent can see.
>
> Keep it current. When you finish a piece of work, update the **Status** section, `Tasks.md`, `Changelog.md`, and a new `Sessions/` log, as `Rules/Handoff_Protocol.md` asks.

## 1. Read order (first session)
1. This file.
2. `../CLAUDE.md` and `../GEMINI.md` in the Prime repo. Every rule in CLAUDE.md applies to you too.
3. `AGENT_PROTOCOL.md`, then `Tasks.md`.
4. The latest `Sessions/` log: `2026-10-27-surveyor-feedback-round-1.md`.
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
- **Tests.** Run `npx vitest run` (about 1865 tests, all green) and `npx tsc --noEmit` (clean) before every commit. Write the test first for logic changes.
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
- **Verify** without logging in: `grep -rl "<new UI text>" out/_next/static/chunks/`, then curl that chunk from the live site and grep the same text. "Deploy complete!" alone has lied before.
- Deploy only when the owner asks. The public pre-sign-in redesign in `design/landing-v2/` must **never** be deployed without explicit approval.

## 6. Status (2026-10-30)

**Just shipped: Claim & Spot Field Unification (Weights, Load, Goods Description, HPA, Odometer).** Deployed to https://motorsurveyos-in.web.app and pushed to `origin/main`.
- Spec and plan: `docs/superpowers/{specs,plans}/2026-10-30-unify-goods-hpa-odometer-workflow*`
- Session logs: `Sessions/2026-10-29-unify-gvw-ulw-accident-load.md` and `Sessions/2026-10-30-unify-goods-hpa-odometer.md`
- What it includes:
  - **Option A (Weights & Load):** Bi-directional store sync between `vehicle.registeredLoadWeight`/`grossWeight`/`unladenWeight` and `spotDetails.gvw`/`spotDetails.ulw`/`spotDetails.loadCapacity` (`gvw - ulw`); consolidated duplicate accident load in `AtAccidentForm.tsx` into a single authoritative "Load at Accident (KG)" input; synchronized AI document extraction and report builders.
  - **Option B (Goods, HPA & Odometer):** Bi-directional store sync between `spotDetails.loadDesc` and `vehicle.natureOfGoods`/`vehicle.detailsOfGoodsCarried`; bi-directional sync between `policy.hpaWith` and `vehicle.hypothecation`/`vehicle.rcEndorsement`; bi-directional sync between `vehicle.odometer` and `valuationDetails.odometer`; single unified "Nature / Description of Goods" input in `AtAccidentForm.tsx`; AI extraction dual-field update; cross-builder fallbacks in all reports.
  - **Surveyor Rulings:** Kept Place of Survey (`accident.placeOfSurvey`) and Workshop Name (`accident.workshopName`) separate and distinct.
  - **Scan Coupling:** Zero drift in `src/lib/scan-import/notes.ts`.
- **Live verification:** Static chunk curl on `https://motorsurveyos-in.web.app` verified live content string `"Nature / Description of Goods"`. All 226 Vitest test suites (1,987 tests) passed; `npx tsc --noEmit` clean.

**Earlier Shipped (2026-10-29):** Scan fee bill notes import + Survey Date & Time normalization.
**Earlier Shipped (2026-10-27):** Surveyor feedback round 1 (Fix estimate reading dialog, Site tab retired, Dashboard Survey Date + Last Edited, policy check card, estimate/bill continuation uploads, Recovered list vehicle no., Add row below, Word export UIIC page breaks, UIIC repair dates).

**Other workstreams:**
- **SurveyOS Scan** (Android, private GitHub repo `pniraj1/surveyos-scan`, on `main`). Never commit `local.properties`, `keystore.properties`, `*.jks` or real AdMob ids; all are git-ignored or read from those files.
  - Built: scanning, merge/split, PDF tools, photo stamp, claim tabs, Spot and Valuation Notes, the "safe copy" of captures, and a zip export.
  - Prime side: "Bring phone scans" imports the zip, notes are reviewed into empty fields, and "Use phone files" picks from it.
  - **The redesign and newer builds have not been checked on a phone.** See `SurveyOS Scan/docs/release/phone-checklist.md` and `owner-steps.md` (package name, OAuth client, keystore, AdMob, Play listing).
  - Open risk D-59: an already-adopted claim may show each Final photo twice after a re-sync.
  - Rulings live in `SurveyOS Scan/docs/build-notes.md`.
- **Portal Fill extension v0.4.0:** never run on a live portal. Phase 0 (owner live checks, which must be done from India, no VPN) is next. Roadmap: `docs/superpowers/plans/2026-10-16-portal-extension-roadmap.md`.
- **Claim Document Kit:** phases 1–2 on main; not browser-tested. Phases 3–5 next. Log: `Sessions/2026-10-21-claim-document-kit.md`.
- **AI fallback:** "jobs, not models". Every AI call names a job; ranking and fallback live in `src/lib/ai/service.ts`, `rank.ts` and `pool.ts`. Phases 1, 2-A and 2-C are live; 2-B/2-D and live checks L2–L11 are pending. All on free tiers.
- **DPDP / IRDAI compliance:** `docs/compliance/`. Still open:
  - de-identify `bramha_memories`;
  - India data residency;
  - a signup consent/attestation;
  - disclosing Telegram/Cloudflare as sub-processors.
- **Bramha** (AI memory from completed claims): shadow mode only; the admin simulator is broken. The core app must not depend on it.
- **Public site Rev B** (`design/landing-v2/`): gated phases, not live, do not deploy.

## 7. Gotchas worth knowing
- Gemini free tier is tight: Flash 20 requests/day per key, Flash-Lite 500. Extraction falls back across providers by job.
- Text PDFs are read **one page per AI call**. With feedback, every page gets the whole sheet as context, so pages can return duplicate rows. `src/lib/ai/estimate-fix.ts` guards against this.
- `renderToStaticMarkup` tests read zustand's *initial* state. Test components through their exported pure `…View` components (see `src/components/policy/`).
- Firestore rejects `undefined` field values in config docs; claims sync as JSON, which is fine.
- PowerShell 5.1: write long commit messages to a file and use `git commit -F`.
