# HANDOVER TO CLAUDE CODE — 2026-11-10

> **Date:** 2026-11-10  
> **From:** Google Antigravity  
> **To:** Claude Code  
> **Subject:** Comprehensive 5-Day Developments Briefing (Nov 5 – Nov 10, 2026) & Live OIC Portal Fill Diagnosis

---

## 1. 🚨 IMMEDIATE INCIDENT: OIC Portal Fill Failure ("Couldn't read page")

### The Symptom:
The user tested the SurveyOS Portal Fill extension on the live Oriental Insurance (OIC) surveyor portal. The extension sidecar opened but immediately displayed:
> **"Couldn't read page / No fields here / Sorry couldn't read"**
Not a single field was read or filled.

### Root Cause Diagnosis:
1. **Missing `"all_frames": true` in `manifest.json` (Primary Suspect):**
   - Indian PSU insurance portals (OIC INLIAS, New India Bancs, UIIC) notoriously embed surveyor input forms inside `<iframe>` or `<frameset>` elements (e.g. `#mainFrame`, `#contentFrame`).
   - `extension/manifest.json` did **NOT** specify `"all_frames": true` on its content scripts.
   - Therefore, the extension scripts only executed in the top-level parent window shell, where **zero form fields or claim numbers exist**.
2. **Hardcoded Angular Assumption in `filler.js` Probe:**
   - In `extension/src/filler.js`:
     ```javascript
     function probe(map) {
       if (!ng()) {
         if (map && map.portal === 'oic') {
           const claimNoEl = document.querySelector(map.claimNoSelector || '#claimNumber');
           const claimNo = claimNoEl ? (claimNoEl.value || claimNoEl.textContent || '') : '';
           return { ok: true, claimNo: String(claimNo).trim(), invoices: 1 };
         }
         return { ok: false, reason: NO_ANGULAR };
       }
     ...
     ```
   - OIC does NOT use AngularJS. If `map.claimNoSelector` (`#claimNumber, input[name='claimNumber']`) fails to find the claim number element (e.g., if OIC displays the claim number in a table cell `<td>` or different ID), `claimNo` is empty.
   - If `claimNo` is empty, or if `map` is null because the live URL does not match `orientalinsurance.org.in/surveyor-assessment-form`, `probe()` fails with `NO_ANGULAR` or empty claim, throwing `probeFailed` in `card-view.js`.
3. **URL Route Matching Rigidity:**
   - `scripts/portal-map/oic-assessment.overlay.json` specifies:
     `"host": "orientalinsurance.org.in"`, `"route": "/surveyor-assessment-form"`.
   - On the live portal, the URL is often `https://orientalinsurance.org.in/portal/...` or an IP/subdomain with query parameters or session IDs. `pickMap()` in `fill-core.js` requires an exact match on route or hash prefix.

### What Claude Must Do to Fix OIC:
1. **Enable Iframe Injection:**
   In `extension/manifest.json`, add `"all_frames": true` and `"match_about_blank": true` to the portal content scripts.
2. **Relax Non-Angular Probe:**
   In `extension/src/filler.js`, if `map.portal === 'oic'` (or any non-Angular portal), if `#claimNumber` is not found, do not crash with `NO_ANGULAR`. Search for claim number in any element containing `"Claim"` or fall back to checking if input elements exist on the page.
3. **Support Direct DOM Inspection:**
   Ask the user for the exact URL or a saved HTML DOM snippet of the OIC surveyor page so the exact frame and field selectors can be verified.

---

## 2. 📚 Comprehensive 5-Day Developments (Nov 5 – Nov 10, 2026)

All changes are committed and live on branch `main`. The codebase has **323 test suites (2,859 tests, 100% green)**, `npx tsc --noEmit` clean, and clean Next.js 16 build.

```
Git commit range: 8614cf15 → c68643e1 (last 5 days)
```

---

### Theme 1: AI SurveyOS Portal Fill Architecture (Phases 1, 2, 3)
- **Commits:** `306b74db`, `7c5e1d82`, `3c83a3e2`, `0cbef575`, `c68643e1`
- **Phase 1: Deterministic Learning & OIC 3-Box DL Splitter:**
  - `extension/src/lib/observer.js`: Passive `blur` listener generating multi-attribute semantic fingerprints (`label`, `name`, `inputType`, `nearbyText`, `idHint`). Strict skip-list on passwords, logins, OTPs, CAPTCHAs.
  - `extension/src/lib/inverter.js`: Reverses typed values against `PortalPacket` claim fields via exact, alphanumeric, numeric equivalence, date formats, and prefix/suffix split fields.
  - `extension/src/lib/learned-store.js`: Manages local bindings under `learned:<portal>-<flow>` with a 2-claim promotion gate (`matchCount >= 2`) and Rule D4 static priority.
  - `src/lib/portal/packet.ts`: Added `splitIndianDl` to partition Indian Driving Licences into Box 1 (4-char prefix), Box 2 (middle digits), Box 3 (last 4 digits) for OIC.
- **Phase 2: Universal Portal Activation & Cloud-Synced Intelligence:**
  - `extension/manifest.json`, `popup.html`, `popup.js`: Pre-authorized top 15 Indian motor insurers in `host_permissions`. Added `optional_host_permissions: ["https://*/*", "http://*/*"]` and dynamic 1-click `[Enable SurveyOS on this Portal]` popup.
  - `src/lib/firebase/portal-sync.ts`: Cloud sync for surveyor learned overlays under `users/{uid}/portalLearnings/{portal}` in Firestore.
  - Anonymous consensus engine (`submitConsensusTelemetry`): Aggregates structural fingerprints (zero PII) into `portalConsensus/{portal}_{flow}`. Promotes to verified community rule at $\ge 3$ surveyor confirmations.
  - `firestore.rules`: Added authenticated access for `portalConsensus`.
  - In-panel UI: Added `.sx-learned-bar` with `[Undo]` button and `.sx-disambig` single-click card for multi-field candidates.
- **Phase 3: Semantic AI Engine & Agent Skill:**
  - `extension/src/lib/semantic-ai.js`:
    - `normalizeDropdownOption()`: Maps canonical values to portal option codes (e.g. `fuel: "Petrol"` $\leftrightarrow$ `"01 - MOTOR SPIRIT (PETROL)"`, `policy: "Comprehensive"` $\leftrightarrow$ `"PKG - PACKAGE POLICY"`).
    - `draftPortalObservations()` & `sanitizeUiicRemarks()`: Generates structured remarks strictly capped to insurer limits (UIIC 500 chars, NIA 1000 chars, OIC 2000 chars). UIIC sanitizer strictly enforces `[a-zA-Z0-9. \n]` and strips crash-inducing punctuation (`,`, `;`, `'`, `"`, `&`, `/`, `-`).
    - `predictFieldMapping()`: Zero-shot matcher scoring input labels, placeholders, and names against canonical fields.
  - `panel.js` & `panel.css`: Added `#sx-ai-draft` with `[✦ AI Draft Remarks]` button, character count badge, and 1-click clipboard copy.
  - Agent Skill: Authored `.claude/skills/portal-fill-semantic-ai/SKILL.md` under `/writing-skills` standards.
- **Branding:**
  - Generated high-resolution official SurveyOS icons: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` in `extension/icons/`.

---

### Theme 2: Bill Check Overhaul & Grid Parity
- **Commits:** `d0d4ccf0`, `12940141`, `ca5c2249`, `aa84c8d2`, `f4fb656d`, `a1765e61`, `67f79429`, `1a26119d`
- **Editable Bill Check Columns:**
  - In `BillCheckGrid.tsx`, surveyors can now directly edit `billAllowed` (replaces hardcoded estimate-matching), `gst` (dropdown 0/5/12/18/28), `disposal` (scrap/salvage value deduction), and `depOverride`.
  - Added dedicated Disposal column in grid configuration (`columnConfigs.ts`).
- **Date Decoupling:**
  - Added `billCheckDate` field in `BillCheckDetails` (`src/types/assessment.ts`).
  - Added "Date of Bill Check Report" inputs in `BillCheckSummaryPanel.tsx` and `BillCheckUploadPanel.tsx`.
  - Decoupled bill check report dates from workshop invoice dates in `standard-report-builder.ts` and `uiic-final-builder.ts`.
- **Towing Charges:**
  - Added `towingCharges` to `FeeBill` and `AssessmentSummary` calculation engines.
  - Added Towing Charges row in Standard report summary and mapped UIIC towing charges.
- **Volkswagen DMS Parser:**
  - Added deterministic estimate and invoice parser for Volkswagen Group DMS formats in `src/lib/ai/row-parser.ts`.

---

### Theme 3: Multi-User Team Workspaces & Admin Privacy Controls
- **Commits:** `06f899b2`, `95b19a52`, `f7084701`, `1de44281`, `9c70c2ca`, `037e6213`, `3ec637e8`, `62e5f3b1`, `dd36dc11`, `4cf04674`
- **Firm Workspaces for Assistants:**
  - Surveyors can add team member email addresses (`teamEmails`) up to a seat limit (`maxTeamSeats`) in their profile.
  - Assistants log in with their own Google accounts and seamlessly operate within the firm's shared workspace.
- **Earnings Privacy Toggle:**
  - Added `hideEarningsFromTeam` toggle in Profile tab. When enabled, assistant logins are blocked from viewing the Fee Bill tab, billing analytics, and surveyor earnings.
- **Real-Time Claim Presence:**
  - Implemented `claim_presence` in Firestore. Shows an amber warning banner if another team member is actively editing the same claim to prevent data overwrite collisions.
- **Admin Dashboard Overhaul:**
  - "View As" Support Mode: Allows master admin to inspect a surveyor's workspace in read-only mode for support.
  - Offline Payments: Admin can record offline/UPI cash payments directly in `SurveyorsTab.tsx`.
  - Accessible trial extension presets modal (7 days, 14 days, 1 month, custom).

---

### Theme 4: Unified Document Storage & Drive Auto-Mirroring
- **Commits:** `7ed523b9`, `03cca639`, `8759fa26`, `1cc8436b`, `8c37d8d8`, `85d5a5d1`, `4073e6ce`, `65dabf2f`, `c2958698`, `5848032e`, `96fbf5ac`
- **Directory Handle Isolation:**
  - Each claim has its own dedicated File System Directory Handle (`src/lib/storage/`). Reports and documents auto-file into the claim folder.
- **Drive Auto-Mirroring:**
  - Auto-mirrors generated PDFs and photos to Google Drive in the background without blocking the surveyor.
- **SurveyOS Scan Integration:**
  - `src/lib/scan-import/notes.ts`: Imports survey site notes, fee bill rates, and photos from Android SurveyOS Scan via Google Drive.

---

### Theme 5: Photo Sheet Multi-Part Split & Orientation Toggle
- **Commits:** `9bf730eb`, `efe0fc87`, `07eb9dca`, `7d9ec4ac`
- **Multi-Part PDF Split:**
  - Added `splitPdfBySize` using `pdf-lib`. If a photo sheet exceeds 2MB (insurer upload limit), it provides multi-part download buttons (Part 1, Part 2) automatically.
- **Orientation Toggle:**
  - 1-click portrait/landscape orientation toggle button in the photo sheet engine.
- **Access Request Validation:**
  - Mandatory 10-digit WhatsApp mobile (`waNumber`) and operating territory.
  - Self-healing prompt on `access-request/page.tsx` for incomplete applicant profiles.

---

## 3. 🎯 Current Codebase Health & Verification

| Check | Status | Details |
|---|---|---|
| **Vitest Test Suite** | **323 / 323 PASSED** | **2,859 tests green (0 failures)** |
| **Extension Unit Tests** | **15 / 15 PASSED** | **186 tests green** |
| **TypeScript (`npx tsc --noEmit`)** | **0 errors** | Strict compliance |
| **Next.js Production Build** | **Succeeded** | 25 / 25 static pages generated |
| **Git Branch** | **`main`** | Up to date with origin, clean working tree |

---

## 4. 📋 Priority Action List for Claude Code

1. **Fix Oriental Insurance (OIC) Extension Injection & Probing:**
   - [ ] Add `"all_frames": true` to content scripts in `extension/manifest.json`.
   - [ ] In `extension/src/filler.js`, make `probe()` resilient on non-Angular pages: do not return `NO_ANGULAR` if `#claimNumber` is missing; probe for input fields or table rows.
   - [ ] In `extension/src/lib/fill-core.js`, allow flexible route matching on OIC so the panel activates even if the route URL has subpaths or parameters.
   - [ ] Ask the user for the exact URL or HTML snippet of the OIC claim screen.
2. **Re-package Extension:**
   - Run `python scripts/build-ext.py` to regenerate `extension/dist/surveyos-portal-fill-0.4.0.zip` and unpacked directories.
3. **Verify coupling with SurveyOS Scan:**
   - Any changes to documents, claim schemas, or fee bill fields must check `SurveyOS Scan/app/build.gradle.kts` and coupling rules.
