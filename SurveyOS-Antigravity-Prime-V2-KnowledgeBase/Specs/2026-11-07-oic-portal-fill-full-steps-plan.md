# OIC Full Portal Fill (Steps 2, 3, 4, 5) Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand SurveyOS Portal Fill to support the complete Oriental Insurance (OIC) surveyor portal workflow across all steps (Step 2 Basic Details, Step 3 Interim Report, Step 4 Deductibles/Excess/Fees, and Step 5 Document Upload), fix `surveyos.in` extension relay detection, and build the dedicated `buildOicPacket` generator.

**Architecture:** Extend the existing polyglot extension filler and overlay engine with exact DOM IDs extracted from live OIC captures (`Guddu.html`, `guddu 2-1.html`, `guddu 2-.2.html`, and `3096Assessment.xlsx`). Isolate portal plumbing in `src/lib/portal/packet.ts` and `extension/maps/oic-assessment.json` so core SurveyOS claim calculations remain 100% pure.

**Tech Stack:** Chrome Extension Manifest V3, Next.js 16 / TypeScript, Vitest, Python 3 map compiler (`build-ext-map.py`, `build-ext.py`).

---

### Task 1: Fix `surveyos.in` Domain Registration & Extension Relay Bridge

**Files:**
- Modify: `extension/manifest.json:9-25`
- Modify: `scripts/build-ext.py:17-25`
- Test: `extension/__tests__/background.test.js`

**Step 1: Write the failing test**
Verify in `extension/__tests__/background.test.js` that `manifest.json` matches both `https://surveyos.in/*` and `https://motorsurveyos-in.web.app/*`.

**Step 2: Run test to verify it fails**
Run: `npx vitest run extension/__tests__/background.test.js`
Expected: FAIL (missing `surveyos.in`).

**Step 3: Update `extension/manifest.json`**
Add `"https://surveyos.in/*"` to:
1. `host_permissions`
2. `content_scripts[0].matches` (relay script matches)

**Step 4: Run tests and verify they pass**
Run: `npx vitest run extension/__tests__/background.test.js`
Expected: PASS.

**Step 5: Commit**
`git commit -am "fix(extension): add surveyos.in to manifest host permissions and content scripts"`

---

### Task 2: Implement `buildOicPacket` in `src/lib/portal/packet.ts`

**Files:**
- Modify: `src/lib/portal/packet.ts`
- Modify: `src/components/dialogs/OICExportDialog.tsx`
- Test: `src/lib/portal/__tests__/packet.test.ts`

**Step 1: Write the failing test**
In `src/lib/portal/__tests__/packet.test.ts`, add test for `buildOicPacket(claim)`:
- Verifies `portal: 'oic'`, `flow: 'assessment'`
- Verifies flat scalar keys for Step 2 (`regNumber`, `make`, `model`, `chasisNumber`, `engineNumber`, `cubicCapacity`, etc.)
- Verifies Step 3 keys (`placeOfSurvey`, `surveyDate`, `surveyorObservation`, `causeNatureOfAccident`, `particularsOfLossDamage`, `claimantMobile`, `claimantEmail`)
- Verifies Step 4 keys (`salvageAmount`, `excessAmount`, `licenseNumber`, `licenseExpiryDate`, `finalRecommendation`)
- Verifies Step 5 keys (`identificationNumber`, `remarks`)

**Step 2: Run test to verify it fails**
Run: `npx vitest run src/lib/portal/__tests__/packet.test.ts`
Expected: FAIL (`buildOicPacket is not a function`).

**Step 3: Implement `buildOicPacket` and update `OICExportDialog.tsx`**
Define `OicPortalPacket` and `buildOicPacket(claim: ClaimData): OicPortalPacket`.
In `OICExportDialog.tsx`, replace `buildPortalPacket` with `buildOicPacket`.

**Step 4: Run tests and verify they pass**
Run: `npx vitest run src/lib/portal/__tests__/packet.test.ts`
Expected: PASS.

**Step 5: Commit**
`git commit -am "feat(portal): implement buildOicPacket and wire into OICExportDialog"`

---

### Task 3: Expand OIC Portal Overlay with Steps 3, 4, and 5 Field Selectors

**Files:**
- Modify: `scripts/portal-map/oic-assessment.overlay.json`
- Regenerate: `scripts/portal-map/oic-assessment-survey.json`
- Recompile: `extension/maps/oic-assessment.json`, `public/portal-maps/oic-assessment.json`
- Test: `extension/__tests__/map.test.js`

**Step 1: Update `scripts/portal-map/oic-assessment.overlay.json`**
Add the discovered controls from the live HTML captures:
- **Step 3 (Interim Report):**
  - `#whetherVehicleInspected1` (Yes)
  - `#isSurveyCompleted1` (Yes)
  - `#placeOfSurvey` (`placeOfSurvey`)
  - `#isDrivingLicenseApplicable1` (Yes)
  - `#isDrivingLicenseVerified1` (Yes)
  - `#mobileNumberClaimant` (`claimantMobile`)
  - `#claimantEmail` (`claimantEmail`)
  - `#surveyorObservation` (`surveyorObservation`)
  - `#causeNatureOfAccident` (`causeNatureOfAccident`)
  - `#particularsOfLossDamage` (`particularsOfLossDamage`)
- **Step 4 (Assessment of Loss / Deductibles & Fee):**
  - `input[name='amount']` (`excessAmount`)
  - `input[name='salvageAmount']` (`salvageAmount`)
  - `#licenseNumber` (`licenseNumber`)
  - `#finalRecommendation` (`finalRecommendation`)
  - `#declaration1` (`declaration1`, checkbox: true)
- **Step 5 (Document Upload):**
  - `#identificationNumber` (`identificationNumber` / DL number)
  - `#remarks` (`remarks`)

**Step 2: Recompile extension maps**
Run: `python scripts/build-ext.py`
Expected: Maps compiled, fixture generated, extension zip and unpacked folders updated.

**Step 3: Run extension test suite**
Run: `npx vitest run extension/__tests__/`
Expected: PASS (all 10 test files green).

**Step 4: Commit**
`git commit -am "feat(portal): map OIC portal Steps 3, 4, and 5 controls and recompile extension"`

---

### Task 4: End-to-End Verification, TypeScript Check & Cross-Repo Sync

**Files:**
- Test: `npx tsc --noEmit`
- Test: `npx vitest run`
- Test: `SurveyOS Scan` Gradle drift tests (`:app:testDebugUnitTest`)

**Step 1: TypeScript type check**
Run: `npx tsc --noEmit`
Expected: 0 errors.

**Step 2: Vitest full run**
Run: `npx vitest run`
Expected: All 278+ test files pass.

**Step 3: SurveyOS Scan coupling test**
Run: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"; cd "../SurveyOS Scan"; ./gradlew :app:testDebugUnitTest`
Expected: BUILD SUCCESSFUL (0 drift).

**Step 4: KnowledgeBase documentation update**
Update `Tasks.md`, `Changelog.md`, and session log.

**Step 5: Commit on `main`**
`git commit -am "chore(release): complete OIC full-portal workflow verification and documentation"`
