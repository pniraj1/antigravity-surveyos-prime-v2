# COMPLETE MASTER HANDOVER TO CLAUDE CODE — 2026-11-10

> **Date:** 2026-11-10  
> **From:** Google Antigravity  
> **To:** Claude Code  
> **Coverage:** Every single commit, architectural decision, and feature from Claude's last handover on **2026-11-04 (commit `c0ea3085`) to 2026-11-10 (commit `d5c031d5`)**.  
> **Current Repo State:** Branch `main` is clean, 0 uncommitted changes. **323 Vitest test suites (2,859 tests, 100% green)**, `npx tsc --noEmit` clean (0 errors), Next.js 16 production build succeeded.

---

## 1. 🚨 IMMEDIATE INCIDENT: Oriental Insurance (OIC) Portal Fill Failure

### The Symptom:
The user tested the SurveyOS Portal Fill Chrome extension on the live Oriental Insurance (OIC) surveyor portal. The sidecar panel appeared but immediately displayed:
> **"Couldn't read page / No fields here / Sorry couldn't read"**  
Not a single field was read or filled.

### Root Cause Diagnosis:
1. **Missing `"all_frames": true` in `extension/manifest.json` (Primary Cause):**
   - Indian PSU insurance portals (OIC INLIAS / Core, New India Bancs, UIIC) embed surveyor forms inside an `<iframe>` or `<frameset>` element (e.g. `#mainFrame`, `#contentFrame`).
   - `extension/manifest.json` did **NOT** specify `"all_frames": true` on its content scripts.
   - Therefore, the extension scripts only executed in the top-level parent window shell, where **zero form inputs or claim fields exist**.
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
   - OIC does NOT use AngularJS. If `map.claimNoSelector` (`#claimNumber, input[name='claimNumber']`) fails to find the claim number element (e.g. if OIC renders it in a table cell `<td>` or a different ID), `claimNo` is empty.
   - If `claimNo` is empty, or if `map` is null because the live URL does not match `orientalinsurance.org.in/surveyor-assessment-form`, `probe()` fails with `NO_ANGULAR` or empty claim, throwing `probeFailed` in `card-view.js`.
3. **URL Route Matching Rigidity:**
   - `scripts/portal-map/oic-assessment.overlay.json` specifies:
     `"host": "orientalinsurance.org.in"`, `"route": "/surveyor-assessment-form"`.
   - On the live portal, the URL is often `https://orientalinsurance.org.in/portal/...` or an IP/subdomain with query parameters or session IDs. `pickMap()` in `fill-core.js` requires an exact match on route or hash prefix.

### What Claude Must Do to Fix OIC:
1. **Enable Iframe Injection:**
   In `extension/manifest.json`, add `"all_frames": true` and `"match_about_blank": true` to the portal content scripts.
2. **Relax Non-Angular Probe:**
   In `extension/src/filler.js`, if `map.portal === 'oic'` (or any non-Angular portal), if `#claimNumber` is not found, do not fail with `NO_ANGULAR`. Fall back to probing if input elements exist on the page.
3. **Relax Route Gating:**
   In `extension/src/lib/fill-core.js`, allow flexible route matching on OIC so the panel activates even if the route URL has subpaths or parameters.
4. **Inspect Live DOM:**
   Ask the user for the exact URL or a saved HTML DOM snippet of the OIC claim screen.

---

## 2. 📚 Comprehensive History: Everything Built Since Last Handover (Nov 4 – Nov 10, 2026)

On 2026-11-04 (commit `c0ea3085`), Claude Code handed over with Onboarding Phase 0 and 1 completed, leaving Phase 2, 3, and 4 unstarted. Here is everything built, tested, and shipped by Antigravity since that moment:

---

### Workstream 1: Completion of User Onboarding (Phases 2, 3, 4)
- **Commits:** `92e3af87`, `4f7b0fff`
- **What Was Built:**
  - **Phase 2 (Tab Tips, Help Button & Dashboard Tour):**
    - Built contextual onboarding dismissible tips across tabs (`DetailsTab`, `AssessmentTab`, `ReportCenter`).
    - Added floating Help button triggering `HelpDialog.tsx`.
    - Implemented step-by-step interactive dashboard tour (`src/lib/onboarding/dashboard-tour.ts`).
  - **Phase 3 (Report Section Guide):**
    - Added comprehensive modal in Report Center explaining all 13 standard report sections, statutory deductions, and IMT-23 clauses to new surveyors.
    - Renamed "Power Print" to "Print PDF" across the app for clarity.
  - **Phase 4 (Admin Progress Column):**
    - Added onboarding checklist progress tracking per surveyor in `SurveyorsTab.tsx` in the Admin Panel (`X/4 steps complete`).

---

### Workstream 2: SurveyOS Scan v1.3 Release & In-Viewer Photo Stamps
- **Commits:** `8614cf15`, `7f07e1e5`, `5c6900a1`, `16dce008`, `b0f4a3b4`
- **What Was Built:**
  - In Android SurveyOS Scan, built in-viewer gallery photo stamp mode chips (`Original`, `Date/Time`, `GPS & Lat/Long`, `Full Stamp`).
  - Built batch photo stamp application and compression pills with live photo size indicator.
  - Added Gradle release versionCode guard in `SurveyOS Scan/app/build.gradle.kts` preventing Play Console release code rejection (`versionCode <= PLAY_CONSOLE_LAST_USED_CODE`).
  - Bumped `versionCode` to 4 (v1.3) and verified Play Console AAB build.

---

### Workstream 3: Unified Claim Storage Hub, Isolated Directory Handles & Drive Auto-Mirroring
- **Commits:** `7ed523b9`, `03cca639`, `8759fa26`, `1cc8436b`, `8c37d8d8`, `85d5a5d1`, `4073e6ce`, `65dabf2f`, `c2958698`, `70310553`, `9ca1c68b`, `2c2f96f6`, `5848032e`, `9e6ae625`, `1e21a2ef`
- **What Was Built:**
  - **Isolated Directory Handles (`src/lib/storage/`):** Each claim maintains its own isolated File System Directory Handle on disk. Auto-allocates in `NewClaimDialog`.
  - **Auto-Filing of Reports:** Generated HTML and PDF reports are automatically filed into the claim folder upon generation (`src/lib/reports/auto-file-report.ts`).
  - **Silent Auto-Replace:** Single-file document slots (e.g., RC, DL, Policy) silently replace old files without creating duplicate clutter (`folder-silent-replace.ts`).
  - **Drive Background Auto-Mirroring:** Generates and mirrors files to Google Drive in the background without blocking Save-to-Cloud modals.
  - **Storage & Safety Header Pill:** Unified status indicator in the header showing local disk handle status, Drive sync status, and storage health popover.
  - **Secondary Device Banner:** 1-click notification banner allowing surveyors on secondary laptops to pull all Drive photos into local storage.

---

### Workstream 4: Oriental Insurance (OIC) Assessment Excel Generator & 12.5% Statutory Painting Split
- **Commits:** `748cd6d2`, `a978f83b`, `8cc072c4`, `80ff2fc1`, `64a6101f`, `ce8b6567`, `041fef95`, `4402f942`
- **What Was Built:**
  - **OIC Assessment Excel Generator (`src/lib/export/oic-assessment-excel.ts`):** Produces OIC's mandated Excel format with statutory 12.5% painting deduction split.
  - **OIC Export Dialog (`OicExportModal.tsx`):** Added 1-click export dialog in Assessment tab with bill-check verification gate and painting breakdown preview.
  - Initial OIC extension map and fixture (`scripts/portal-map/oic-assessment.overlay.json`).

---

### Workstream 5: Bill Check Complete Workspace Overhaul & Calculation Reconciliation
- **Commits:** `71ad05d2`, `4744d70a`, `511ab333`, `2514cf73`, `54143d7f`, `293a715b`, `71524d45`, `d0d4ccf0`, `a656a6c6`, `12940141`, `f4fb656d`
- **What Was Built:**
  - **Calculation Reconciliation:** Reconciled Standard and UIIC Bill Check net liability calculations derived from assessed loss rather than raw invoice claims.
  - **Interactive Dual Evidence Inspection:** Allows surveyors to inspect invoice line items alongside estimate rows without premature modal dismissal (`ReconciliationModal.tsx`).
  - **Workspace Redesign:** Clean layout with strict invoice verification gate, column resizing, and live preview floating report card.
  - **Navigation Realignment:** Sidebar workflow ordered logically: *Intimation $\rightarrow$ Details $\rightarrow$ Assessment $\rightarrow$ Bill Check $\rightarrow$ Reinspection $\rightarrow$ Deliverables*.
  - **Date Decoupling:** Added `billCheckDate` field in `BillCheckDetails` and summary panels, decoupling bill check report dates from workshop invoice dates in report builders.

---

### Workstream 6: Assessment Grid Formulas, Excel Copy-Paste & Volkswagen DMS Parser
- **Commits:** `a46a381f`, `dcb28e39`, `f89aa01e`, `7093d726`
- **What Was Built:**
  - **Grid Excel Copy-Paste & Fill-Down:** Multi-cell copy-paste from Excel sheets directly into the Assessment table with fill-down keyboard shortcuts.
  - **Inline Formula Calculation:** Assessment grid cells support inline mathematical expressions (e.g. `=1200*1.18`).
  - **Volkswagen Group DMS Parser (`src/lib/ai/row-parser.ts`):** Deterministic parser extracting estimates and invoices from Volkswagen, Skoda, and Audi DMS formats, automatically stripping inline tax noise.

---

### Workstream 7: Towing Charges Integration across FeeBill, Calculations & Reports
- **Commits:** `222f964b`, `ca5c2249`, `01bf6d3f`, `63eecf0c`, `aa84c8d2`, `5ded0d1f`
- **What Was Built:**
  - Added permanent `towingCharges` to `FeeBill` and `AssessmentSummary` calculation engines.
  - Added Towing Charges row in Section 8 Standard report summary and mapped UIIC towing charges directly from fee bill.

---

### Workstream 8: Multi-User Team Workspaces, Claim Presence & Admin Privacy Controls
- **Commits:** `06f899b2`, `ecd777bd`, `95b19a52`, `f7084701`, `1de44281`, `9c70c2ca`, `037e6213`, `3ec637e8`, `62e5f3b1`, `dd36dc11`, `4cf04674`, `dbcca9b1`, `f8239f36`, `c978a4a8`, `cd9c7ae8`, `8ba3c3b1`, `4d9be319`, `e3365f36`
- **What Was Built:**
  - **Firm Workspace Sharing (`teamEmails`, `maxTeamSeats`):** Surveyors can add assistants to work in their firm workspace with individual Google accounts.
  - **Earnings Privacy Toggle (`hideEarningsFromTeam`):** Blocks assistants from viewing fee bills, billing tabs, and surveyor earnings.
  - **Real-Time Claim Presence (`claim_presence`):** Amber banner warns when two users edit the same claim to prevent data collision.
  - **Admin Dashboard Overhaul:** Modernized 6-column surveyor table, bento-grid drawer, "View As" read-only support inspection mode, offline payment recording, accessible preset modals for trial extensions.

---

### Workstream 9: Photosheet Multi-Part Split (<2MB), Orientation Toggle & Access Request Validation
- **Commits:** `9bf730eb`, `efe0fc87`, `07eb9dca`, `e71ae63c`, `7d9ec4ac`
- **What Was Built:**
  - **Multi-Part PDF Split:** Built `splitPdfBySize` using `pdf-lib`. If a photo sheet PDF exceeds 2MB (insurer upload limit), it provides multi-part download buttons (Part 1, Part 2) automatically.
  - **1-Click Photo Orientation Toggle:** Quick rotate between portrait and landscape in the photo engine.
  - **Access Request Validation:** Mandatory 10-digit WhatsApp mobile (`waNumber`) and operating territory (State/City) with a self-healing queue for legacy signups.

---

### Workstream 10: Bill Check Grid Editability (GST, Disposal 50%, Dep%) & Report Projection
- **Commits:** `c655baea`, `a1765e61`, `67f79429`, `b4bd7608`, `1a26119d`
- **What Was Built:**
  - **Interactive Cells in `BillCheckGrid`:** Surveyors can directly adjust `billAllowed` (allowance overriding estimate/billed minimum), `gst` (0/5/12/18/28), `disposal` (scrap/salvage percentage with default 50% deduction), and `depOverride`.
  - **Report Projection:** Standard Bill Check and UIIC Bill Check reports project the surveyor's active allowance, updated GST, disposal status, and depreciation override into item tables and tax summary bands.

---

### Workstream 11: AI SurveyOS Portal Fill (Phases 1, 2, 3 & Official Branding)
- **Commits:** `306b74db`, `7c5e1d82`, `3c83a3e2`, `0cbef575`, `c68643e1`
- **What Was Built:**
  - **Phase 1: Deterministic Learning & OIC 3-Box DL Splitter:**
    - `observer.js`: Passive `blur` observer building multi-attribute semantic fingerprints (`label`, `name`, `nearbyText`, `idHint`).
    - `inverter.js`: Reverses typed values against `PortalPacket` claim fields via exact, alphanumeric, numeric equivalence, date formats, and prefix/suffix split fields.
    - `learned-store.js`: Manages local bindings under `learned:<portal>-<flow>` with a 2-claim promotion gate (`matchCount >= 2`).
    - `src/lib/portal/packet.ts`: Added `splitIndianDl` to partition Indian DLs into Box 1 (4-char prefix), Box 2 (middle digits), Box 3 (last 4 digits) for OIC.
  - **Phase 2: Universal Portal Activation & Cloud-Synced Intelligence:**
    - `manifest.json`, `popup.html`, `popup.js`: Pre-authorized top 15 Indian motor insurers. Added `optional_host_permissions: ["https://*/*", "http://*/*"]` and dynamic 1-click `[Enable SurveyOS on this Portal]` popup.
    - `src/lib/firebase/portal-sync.ts`: Cloud sync for surveyor learned overlays under `users/{uid}/portalLearnings/{portal}` in Firestore.
    - Anonymous consensus engine (`submitConsensusTelemetry`): Aggregates structural fingerprints (zero PII) into `portalConsensus/{portal}_{flow}`. Promotes to verified community rule at $\ge 3$ surveyor confirmations.
    - In-panel UI: Added `.sx-learned-bar` with `[Undo]` button and `.sx-disambig` single-click card for multi-field candidates.
  - **Phase 3: Semantic AI Engine & Agent Skill:**
    - `extension/src/lib/semantic-ai.js`:
      - `normalizeDropdownOption()`: Maps canonical values to portal option codes (e.g. `fuel: "Petrol"` $\leftrightarrow$ `"01 - MOTOR SPIRIT (PETROL)"`, `policy: "Comprehensive"` $\leftrightarrow$ `"PKG - PACKAGE POLICY"`).
      - `draftPortalObservations()` & `sanitizeUiicRemarks()`: Generates structured remarks strictly capped to insurer limits (UIIC 500 chars, NIA 1000 chars, OIC 2000 chars). UIIC sanitizer strictly enforces `[a-zA-Z0-9. \n]` and strips crash-inducing punctuation (`,`, `;`, `'`, `"`, `&`, `/`, `-`).
      - `predictFieldMapping()`: Zero-shot matcher scoring input labels, placeholders, and names against canonical fields.
    - `panel.js` & `panel.css`: Added `#sx-ai-draft` with `[✦ AI Draft Remarks]` button, character count badge, and 1-click clipboard copy.
    - Agent Skill: Authored `.claude/skills/portal-fill-semantic-ai/SKILL.md` under `/writing-skills` standards.
  - **Official Branding:**
    - Generated high-resolution official SurveyOS icons: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` in `extension/icons/`.

---

## 3. 🎯 Claude's Action Plan (Immediate Next Steps)

1. **Fix Oriental Insurance (OIC) Extension Injection & Probing:**
   - In `extension/manifest.json`: add `"all_frames": true` and `"match_about_blank": true` to `content_scripts`.
   - In `extension/src/filler.js`: make `probe()` resilient on non-Angular pages (do not fail with `NO_ANGULAR` when `#claimNumber` is missing).
   - In `extension/src/lib/fill-core.js`: relax route matching for OIC.
   - Run `python scripts/build-ext.py` to regenerate the extension packages in `extension/dist/`.
2. **Verify coupling with SurveyOS Scan:**
   - Always run Scan's drift tests if touching coupling points (`DocumentChecklist.tsx`, `scan-import`, fee bill fields).
3. **Keep `main` Green:**
   - Run `npx vitest run` (323 test suites, 2,859 tests) and `npx tsc --noEmit` before any commit.
