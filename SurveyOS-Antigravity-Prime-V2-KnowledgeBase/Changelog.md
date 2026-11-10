## 2026-11-10 (Antigravity) — SurveyOS Scan Direct Share Photos (Spot/Final/RI) & Document Field Naming
- feat(scan-share): Added direct photo ingestion targets (**Final Photos**, **RI Photos**, and **Spot Photos**) to `ShareSlotPicker` in `ShareInScreens.kt` when shared intent holds images (`hasImages = true`), displaying current photo counts and camera icons.
- feat(scan-vm): Implemented `importSharedPhotos(kind, items)` in `ClaimViewModel.kt`, ingesting images with `Quality.PHOTO` (`PageFilter.NATURAL`, EXIF/GPS metadata preserved) directly into `repo.photoDoc(claimId, kind)` (`spotPhotos`, `damagePhotos`, `riPhotos`).
- feat(scan-share): Replaced blind `"Imported document"` generation on `+ New document` with interactive `NameSheet` chooser populated with `vm.neededTypes()` suggestions, categorized document groups, and custom name input.
- feat(scan-vm): Implemented `importSharedAsNamedDoc(type, title, items)` in `ClaimViewModel.kt`, safely provisioning the chosen document slot via `repo.docForScan(claimId, type, title, null)` or `repo.addOtherDoc(claimId, title)` with document scanning quality (`prefs.quality(claimId)`).
- fix(scan-share): Updated `shareSlotOrder` in `SharePickOrder.kt` to filter out photo documents (`!it.doc.isPhotos`), keeping the document list strictly focused on non-photo documents.
- test(scan): Added unit test `photoDocsExcludedFromSlots` in `SharePickOrderTest.kt`.
- verification: Android test suite (`./gradlew.bat :app:testDebugUnitTest`) 100% green; Prime Vitest suite (327 files / 2,915 tests) 100% green; `npx tsc --noEmit` clean (0 errors). Prime ↔ Scan coupling: None.

## 2026-11-10 (Claude Code) — OIC live check fixes + estimate floor (not deployed)
- fix(portal-fill): live OIC step 2/3 fixes: licence type in OIC's wording, paced writes (OIC's handler dropped one of two same-tick writes), InputNumber via onChange, DD-MM-YYYY placeholder counts as empty, RTO from the DL's first 4 characters, date/place of survey, always-Yes defaults replace OIC's saved-blank "No".
- fix(extension-build): Chrome injects a script file once per frame, so libs shared by the panel and the MAIN-world filler never ran in MAIN ("The portal page didn't answer" on every portal since 0cbef575). Build copies them to `src/main/`; the card re-asks the page until it starts.
- feat(assessment): estimate may not be below assessed (Assessment) or allowed/billed (Bill Check): red cell, every print/Word export and the OIC Excel are held (`estimate-floor.ts`, `usePrintGate`). Prime never changes the estimate.
- fix(oic-excel): Item Amount = Bill Check allowed amount, else assessed.
- verification: 327 files / 2915 tests, tsc clean. Grid/dialog changes not browser-checked. Prime ↔ Scan coupling: none.

## 2026-11-10 (Claude Code) — OIC Portal Fill rebuild (not deployed)
- fix(oic-excel): rows that are not billed, not allowed or zero-assessed are left out of the OIC Excel (`inOicExcel`).
- feat(oic-packet): DL split MH / middle / last 4, reg number spacing, DL dates and DOB, licence class by vehicle, step 3 answers, initial loss amount = net liability over the Excel's rows.
- feat(portal-fill): React writes for PrimeReact/MUI (`react-write.js`), radioPick, DD-MM-YYYY dates, ₹0 counts as empty, step 3 claim gate, OIC map v2 for steps 2–4, "Fill this step", pushState route poll.
- fix(portal-fill): final-review hardening: only radio inputs are clicked, disabled dropdowns are skipped, `2W`, unreadable dates are skipped, `check()` is read-only.
- verification: 326 test files / 2905 tests pass, tsc clean. Live OIC check pending with the owner. Prime ↔ Scan coupling: none.

## 2026-11-10 (Antigravity) — UIIC Reports Table Nomenclature Clarification (Assessed Amount)
- feat(uiic-report): Added small subtitle `(Assessed Amount)` beneath "Part List W/o Tax" in UIIC Final Survey Report and beneath "Part List Without Tax" in UIIC Bill Check Report.
- fix(uiic-bill-check): Reconciled Bill Check table cells: Column 5 displays assessed amount without tax (`r.assessed`) for parts, labour, and paint, and Column 8 displays net assessed amount after depreciation (`afterDep` / `netBeforeGst`).
- fix(uiic-bill-check): Updated Subtotal and Total rows so Column 5 reflects total assessed amounts and Column 8 reflects total net assessed liability after depreciation.
- test: Updated report test suites (`bill-check-format.test.ts` and `labour-paint-depreciation.test.ts`) to assert on official UIIC assessed amounts.
- verification: 325 Vitest test files passed (2,866 tests, 100% green), `npx tsc --noEmit` clean (0 errors). Prime ↔ Scan coupling: None.

## 2026-11-10 (Antigravity) — Handover to Claude Code & 5-Day Developments Briefing
- docs(handover): Authored comprehensive handover document `HANDOVER_2026_11_10_CLAUDE.md` and updated `HANDOVER.md` for Claude Code.
- triage(extension): Investigated OIC live portal fill failure ("Couldn't read page"), documenting root causes in `manifest.json` (`all_frames: true` missing), `filler.js` (`NO_ANGULAR` probe fallback), and `fill-core.js` (route gating).
- docs(vault): Recorded detailed technical summary across 5 themes (Portal Fill AI Evolution, Bill Check Grid Editability, Multi-User Team Workspaces, Storage Hub Auto-Mirroring, and Photosheet Multi-Part Split) in KnowledgeBase.

## 2026-11-09 (Antigravity) — Bill Check Tab Editability (GST, Disposal, Dep%) & Report Integration
- feat(bill-check): Added `'disposal'` column to `OptionalColumn`, `OPTIONAL_COLUMN_ORDER`, and `GRID_COLUMNS` in `src/components/tabs/bill-check/config.ts` (default visible).
- feat(bill-check-grid): Replaced static text div for GST in `BillCheckGrid.tsx` with interactive `FormulaNumericInput`, editing `row.gst` directly and synchronizing `billedAmount = Math.round(row.billedTaxable * (1 + newGst / 100))` when `billedTaxable` is present.
- feat(bill-check-grid): Added interactive disposal checkbox and percentage input for `row.disposalPercent` in `BillCheckGrid.tsx`. Toggling disposal off resets `isDisposal: false`, restores default `gst: 18%`, and synchronizes `billedAmount`. Toggling disposal on sets `isDisposal: true` and `gst: 0%`.
- feat(bill-check-grid): Replaced static text div for Dep% in `BillCheckGrid.tsx` with interactive numeric input for `row.depOverride`, styled with amber highlight and asterisk indicator.
- fix(reports): In `standard-report-builder.ts`, projected rows in `'bill-check'` mode with `row.billAllowed ?? row.assessed`, ensuring Section 8 and Section 9 items and subtotals reflect active allowances, updated GST, disposal status, and depOverride. Final survey report mode remains strictly unaffected.
- fix(reports): In `uiic-final-builder.ts`, projected `rows` in `buildUIICBillCheckHTML` with `row.billAllowed !== undefined ? { ...r, assessed: r.billAllowed } : r`, updating `rawParts`, `effParts`, `computeRowNet`, `aggregateGst` bands, and Page 1 `asum`.
- fix(calculations): Updated `computeRowLiability` (`row-net.ts`) and `calculateBillCheckSummary` (`assessment.ts`) to recognize `row.billAllowed`, overriding the `min(assessed, billed)` cap in either direction.
- test: Added `BillCheckGridEditability.test.tsx` (3 tests) and `bill-check-gst-disposal-override.test.ts` (4 tests).
- verification: 325 Vitest test files passed (2,866 tests, 100% green), `npx tsc --noEmit` clean (0 errors). Prime ↔ Scan coupling: None.

## 2026-11-09 (Antigravity) — AI SurveyOS Portal Fill (Phase 3): Semantic AI Engine & Agent Skill
- feat(skill): Authored `.claude/skills/portal-fill-semantic-ai/SKILL.md` and synced with local runtime config under `/writing-skills` standards, outlining anti-rationalization rules, Indian motor taxonomy, and testing requirements.
- feat(semantic-ai): Implemented `extension/src/lib/semantic-ai.js` featuring multi-stage dropdown normalization (`normalizeDropdownOption`), Indian insurance synonym taxonomy (fuel, policy, vehicle class, loss cause, settlement basis, garage type), and prefix stripping.
- feat(observations): Added surveyor remarks and loss observations auto-drafter (`draftPortalObservations`) with strict character limits and UIIC punctuation sanitization (`[a-zA-Z0-9. \n]`), preventing UIIC ASP.NET session crashes.
- feat(zero-shot): Added zero-shot DOM semantic field matcher (`predictFieldMapping`) scoring candidate claim fields from label, placeholder, name, and id context.
- feat(integration): Integrated dropdown normalization into `extension/src/lib/fill-core.js` (`planCheck`) and `extension/src/filler.js` (`fill`), enabling automatic resolution of coded portal `<select>` options.
- feat(ui): Added `#sx-ai-draft` card in `panel.js` and `panel.css` with `[✦ AI Draft Remarks]` button, character count badge (`UIIC Safe`), and 1-click clipboard copy.
- test: Added comprehensive test suite in `extension/__tests__/semantic-ai.test.js` (15 unit tests covering exact, coded, synonym, UIIC punctuation sanitization, and zero-shot matching).
- verification: 323 Vitest test files (2,859 tests) passed (100% green), `npx tsc --noEmit` clean (0 errors), Next.js production build (`npm run build`) succeeded with 25/25 static routes, extension build (`python scripts/build-ext.py`) produced zip + unpacked distributions cleanly.

## 2026-11-09 (Antigravity) — AI SurveyOS Portal Fill (Phase 2): Universal Portal Activation & Cloud-Synced Intelligence
- feat(extension): Added `popup.html` and `popup.js` supporting dynamic 1-click activation on any unlisted or custom insurer portal via `optional_host_permissions` and `activeTab`.
- feat(manifest): Pre-authorized top 15 Indian motor insurers (NIC, ICICI Lombard, Bajaj Allianz, HDFC ERGO, Tata AIG, Go Digit, SBI General, Chola MS, Reliance General, IFFCO Tokio, Future Generali, Royal Sundaram) in `host_permissions`.
- feat(cloud-sync): Implemented `src/lib/firebase/portal-sync.ts` saving per-surveyor learned overlays in Firestore under `users/{uid}/portalLearnings/{portal}`, making learned bindings permanent across devices and browser resets.
- feat(consensus): Built anonymous community consensus pipeline (`submitConsensusTelemetry`) aggregating structural fingerprints to auto-verify field bindings across the surveyor fleet without ever touching customer PII.
- feat(relay): Upgraded `extension/src/relay.js` and `extension-bridge.ts` with bidirectional sync messages (`surveyos:portal-sync-push` and `surveyos:portal-sync-pull`).
- feat(ui): Added in-panel `.sx-learned-bar` with 1-click `[Undo]` button and `.sx-disambig` single-click disambiguation card in `panel.js` and `panel.css`.
- test: Added test cases in `src/lib/portal/__tests__/extension-bridge.test.ts`. Verified 14 extension test files (171 tests) passed (100% green).
- verification: `npx tsc --noEmit` clean (0 errors), Next.js production build (`npm run build`) succeeded with 25/25 static routes, extension build (`python scripts/build-ext.py`) produced zip + unpacked distributions cleanly.

## 2026-11-09 (Antigravity) — AI SurveyOS Portal Fill (Phase 1) & OIC 3-Box DL Splitter
- feat(ai-portal-fill): Implemented passive `blur` observer in `extension/src/lib/observer.js` building multi-attribute semantic fingerprints (`label`, `name`, `inputType`, `maxLength`, `nearbyText`, `placeholder`, `ariaLabel`, `idHint`, `siblingIndex`) while enforcing zero-touch security on passwords, logins, OTPs, and CAPTCHAs.
- feat(ai-portal-fill): Built value inverter in `extension/src/lib/inverter.js` correlating typed values to `PortalPacket` claim fields via exact, alphanumeric, numeric equivalence, date format variations, and prefix/suffix/substr matching, with built-in ambiguity detection.
- feat(ai-portal-fill): Built learned overlay manager in `extension/src/lib/learned-store.js` with 2-claim promotion gate (`matchCount >= 2`), zero PII storage guarantee, and static map priority (Rule D4).
- feat(ai-portal-fill): Wired learning engine into `extension/src/panel.js` (dynamic merge and passive observation), `extension/src/lib/fill-core.js` (`learnedTransform` application), `extension/manifest.json`, and `scripts/build-ext.py`.
- feat(oic): Added `splitIndianDl` helper in `src/lib/portal/packet.ts` to split Indian driving licences into Box 1 (4-char State/RTO prefix), Box 2 (middle digits), and Box 3 (last 4 digits). Populated `driverLicenseNoOne`, `driverLicenseNoTwo`, and `driverLicenseNoThree` in `OIC_FIELDS` and `buildOicPacket`.
- test: Added 40 new extension unit tests across `extension/__tests__/inverter.test.js`, `learned-store.test.js`, and `observer.test.js`. Updated `src/lib/portal/__tests__/packet.test.ts`.
- verification: 322 Vitest test files passed (2,842 tests, 100% green), `npx tsc --noEmit` clean (0 errors), Next.js production build (`npm run build`) succeeded with 25/25 static routes, extension build (`python scripts/build-ext.py`) produced zip + unpacked distributions cleanly.

## 2026-11-08 (Antigravity) — Mandatory Contact & Operating Territory on Access Request + Existing Applicant Self-Healing
- feat(access-request): Made `Mobile / WhatsApp Number` strictly mandatory with 10-digit Indian mobile regex validation (`waNumber`). Normalized to `+91 XXXXXXXXXX`.
- feat(access-request): Made `Operating City` and `Operating State` mandatory fields in a sleek 2-column responsive grid layout with required asterisks and descriptive hints.
- feat(self-healing): Implemented interactive self-healing card in `ConfirmationPanel` (`src/app/access-request/page.tsx`) for existing applicants who previously submitted access requests without mobile or location details, eliminating the silent deadlock where neither admin nor user could proceed.
- feat(admin): Polished `ApprovalQueueTab.tsx` with high-visibility `Missing phone` and `Not provided` badges for incomplete applications, plus a 1-click `[Request Phone]` action in the approval queue that pre-fills an activation email template.
- feat(admin): Enhanced `EmailComposerModal.tsx` and `AdminDashboard.tsx` to accept optional `initialSubject` and `initialBody`.
- test: Added 5 unit tests in `src/app/access-request/__tests__/access-request.test.tsx` and 1 unit test in `src/components/admin/__tests__/approval-queue-polish.test.tsx`.
- verification: 319 Vitest test files (2,802 tests) passed (100% green), `npx tsc --noEmit` clean (0 errors), Next.js production build (`npm run build`) succeeded (25/25 static routes).

## 2026-11-08 (Antigravity) — Bill Check Report Date Field & Report Builder Separation
- feat(bill-check): Added `billCheckDate?: string` to `BillCheckDetails` in `src/types/assessment.ts` and `src/types/claim.ts`.
- feat(ui): Added "Date of Bill Check Report" input field in `BillCheckSummaryPanel.tsx` and `BillCheckUploadPanel.tsx`.
- fix(reports): In Standard Bill Check report (`standard-report-builder.ts`), decoupled "Date of report" from `claim.reportDate`, prioritizing `claim.billCheck?.billCheckDate`.
- fix(reports): In UIIC Bill Check and Final reports (`uiic-final-builder.ts`), updated "Report Date", "Bill Check Date", and "Bill Check finalisation date" to render `claim.billCheck?.billCheckDate`, stopping duplicate rendering of the workshop invoice date.
- test: Added test cases in `BillCheckSummaryPanel.test.tsx` verifying input rendering and binding.
- verification: 48 Vitest test files (445 tests) passed (100% green).

## 2026-11-07 (Antigravity) — Photo Sheet PDF Splitting (<2MB) & Photo Engine Orientation Toggle
- feat(pdf): Implemented client-side `splitPdfBySize(pdfBlob, maxSizeBytes = 1.95MB)` in `src/lib/pdf/split-pdf.ts` using `pdf-lib`. Accurately checks generated PDF size and partitions pages into $<1.95\text{ MB}$ parts with 1-indexed page boundaries (`pageStart`, `pageEnd`).
- feat(photosheet): Updated `PhotoSheetDownloadButton.tsx` to detect when a generated photo sheet PDF exceeds 1.95 MB, automatically rendering individual download buttons: `[Download Part 1 (Pages 1–4 · X.X MB)]`, `[Download Part 2 (Pages 5–8 · Y.Y MB)]`. Each part downloads as `{regNum}-Photo-Sheet-Part{N}.pdf`, saves to the claim folder via `saveReportToClaimFolder(claim, fileName, blob, 'damagePhotos')`, and provides a dedicated `SharePdfButton`.
- feat(photos): Converted static orientation indicator (`▯` / `▭`) in `PhotosTab.tsx` into an interactive `<PhotoOrientationButton>` that rotates damage photos 90° clockwise via `rotateImage90` and `replacePhotoImage`, seamlessly flipping portrait $\leftrightarrow$ landscape in both the gallery and generated PDF.
- test: Added 4 unit tests in `src/lib/pdf/__tests__/split-pdf.test.ts`, 8 unit tests in `src/components/pdf/__tests__/PhotoSheetDownloadButton.test.tsx`, and 7 unit tests in `src/components/tabs/__tests__/PhotosTab-rotate.test.tsx`.
- verification: 318 Vitest test files passed (2,795 tests, 100% green), `npx tsc --noEmit` clean (0 errors), Next.js production build (`npm run build`) succeeded (25/25 static routes), Android Scan drift tests (`:app:testDebugUnitTest`) 28 tasks passed (100% green).

## 2026-11-07 (Antigravity) — Admin Panel UI/UX Pro Max Overhaul, Table Consolidation & Read-Only Support Mode
- feat(admin-nav): Reorganized Admin navigation into Primary Operations (`Surveyors`, `New Signups`, `Payments`) and System Tools (`AI Models`, `Fee Schedule`, `Announcements`, `Dev Notes`) with badge counters (`expiringSoonCount`, `signups.length`, `pendingPaymentsCount`). Replaced `alert(...)` with Sonner `toast.success(...)`. Added universal search with `aria-label`.
- feat(surveyors-table): Consolidated 9 cluttered columns into 6 high-density, accessible columns (`Surveyor & Identity`, `Licence & Platform ID`, `Status & Plan`, `Claims & Onboarding`, `Expiry`, `Actions`) with `scope="col"`. Eliminated click-hijacking inline `<input>` tags from table cells.
- feat(bento-drawer): Redesigned expanded drawer into a 3-column Bento Grid:
  1) `IdentityEditorCard`: Clean Full Name and Platform ID inputs with explicit `[Save Identity Changes]` button and `Quals/Referral/City` metadata.
  2) `FirmTeamSeatsCard`: Accessible `[-][+][seats]` stepper with bounds checking (1–50) and active team assistant email chips.
  3) `PaymentLedgerCard`: Current status, subscription expiry datepicker, total lifetime revenue sum badge, and scrollable payment history with admin verification notes and payment modes.
- feat(extend-modal): Replaced cramped inline `[ 30 ] d [✓] [✕]` with accessible `ExtendSubscriptionModal.tsx` featuring quick preset pills (`+30d`, `+90d`, `+180d`, `+365d`), custom numeric input, and live new expiry date preview with Escape/backdrop dismiss and ARIA dialog semantics.
- feat(approval-queue): Polished `ApprovalQueueTab.tsx` by raising typography floor (eliminated `text-[9px]/[10px]`), standardizing icons to 12-14px, adding accessible trial duration input with `aria-label`, and providing clear `[Approve (30d)]` button with loading feedback.
- feat(support-mode): Implemented View-As Read-Only Support Mode ("View Workspace"):
  - Added `viewAsSurveyor` and `setViewAsSurveyor` to `useAuthStore.ts`.
  - Built `ViewAsSupportBanner.tsx`: High-contrast amber top banner (`"👁️ SUPPORT MODE: Viewing workspace of {name} ({licence}) — STRICT READ-ONLY ACCESS [ Exit to Admin Panel ]"`).
  - In `Dashboard.tsx` and `DashboardContent`, mounted support banner, loaded surveyor's cloud claims from Firestore directly into the claims list without mutating local IndexedDB, and disabled new claim/delete/archive actions.
  - In `openClaim.ts`, added fallback to fetch claim document from Firestore `users/{viewAs.uid}/claims/{id}` into in-memory store.
  - In `useCloudSync.ts`, strictly blocked milestone pushes, delta syncs, and deletions while in support mode.
  - In `SurveyorsTab.tsx`, added `[ 👁️ View Workspace ]` button in both table row and drawer.
- verification: 315 Vitest test files passed (2,776 tests, 100% green), `npx tsc --noEmit` clean (0 errors), Next.js production build (`npm run build`) succeeded with 25/25 static routes, Android Scan drift tests (`:app:testDebugUnitTest`) 28 tasks passed (100% green), deployed to Firebase Hosting (`https://surveyos.in` & `https://motorsurveyos-in.web.app`) verified `HTTP 200 OK`.

# Changelog

> Most recent entries at the top. Updated by whichever agent makes changes.

## 2026-11-07 (Antigravity) — OIC Portal Auto-Fill Strengthening, Safe Step 2 Field Mapping & Painting 12.5% Statutory Fix
- feat(portal): Implemented `buildOicPacket` in `src/lib/portal/packet.ts` generating canonical, type-safe `OicPortalPacket` for Oriental Insurance assessment flow with 23 safe Step 2 fields (`regNumber`, `make`, `model`, `chasisNumber`, `engineNumber`, `cubicCapacity`, `manufacturingYear`, `colorOfVehicle`, `typeOfFuel`, `typeOfBody`, `classOfVehicle`, `unladenWeight`, `registeredLadenWeight`, `seatingCapacity`, `lossDescription`, `driverName`, `driverLicenseNoTwo`, `driverBadgeNo`, `driverAddress`, `workshopName`, `workshopEstimateAmount`).
- feat(extension): Added `https://surveyos.in/*` to `extension/manifest.json` under `host_permissions` and `content_scripts[0].matches`, resolving the relay bridge disconnection on production domain `surveyos.in`.
- fix(extension): Fixed potential non-Angular runtime crash in `extension/src/filler.js` by checking `ng()` availability in `ctrlScope` and `fill.read.current` before querying AngularJS elements, guaranteeing robust execution on non-Angular portal frameworks like PrimeVue/React on OIC.
- feat(reports): Fixed painting 12.5% statutory depreciation problem in `src/lib/reports/oic-assessment-excel.ts` by introducing `OicPaintingMode` ('split' vs 'net_single'). Standard policies now support:
  1) `split` (default): Statutory 2-line split: 75% Labour (0% dep) + 25% Material (50% dep) = 12.5% net deduction.
  2) `net_single`: Single net pre-deducted line under `Labour Charge` (`Painting charges (Net 12.5% Dep)` @ 0% dep, HSN 9987) matching real live OIC assessment reports. Both methods eliminate the portal 0% depreciation bug.
- feat(ui): Enhanced `OICExportDialog.tsx` with a painting mode selector for standard policies, wired `buildOicPacket` into the extension bridge button, and preserved Step 4 assessment grid boundaries (handled strictly via Excel upload).
- test: Added comprehensive unit tests in `src/lib/reports/__tests__/oic-assessment-excel.test.ts` and `src/lib/portal/__tests__/packet.test.ts`. Rebuilt extension zip and unpacked targets via `scripts/build-ext.py`.
- verification: 310 Vitest test files passed (2,720 tests, 100% green), `npx tsc --noEmit` clean (0 errors), Next.js production build (`npm run build`) succeeded, SurveyOS Scan coupling test (`:app:testDebugUnitTest`) 28 tasks passed (100% green).

## 2026-11-07 (Antigravity) — Multi-User Team Workspaces, Active Editing Conflict Warnings & Admin Payment Controls
- feat(team): Added `maxTeamSeats`, `teamEmails`, and `hideEarningsFromTeam` to `SurveyorProfile` and `SurveyorAdminProfile` in `src/types/vehicle.ts` and `src/components/admin/types.ts`.
- feat(admin): Implemented Master Admin seat quota management in `src/components/admin/tabs/SurveyorsTab.tsx` and `useAdminActions.ts` (`handleUpdateTeamSeats`). Enhanced search filter to match assistant emails within `surveyor.teamEmails`.
- feat(profile): Created `TeamManagementSection.tsx` in `src/components/profile/` allowing senior surveyors to add/remove team members up to their admin seat quota and toggle earnings privacy.
- feat(security): Scoped Firestore security rules (`firestore.rules`) to allow authorized team members (`isTeamMember`) to read/write claims under `users/{ownerUid}/claims` while keeping per-user independent single-session heartbeats, eliminating cross-device kickouts.
- feat(auth): Implemented `src/lib/auth/workspace-resolver.ts`, automatically resolving team workspaces on login and syncing claims to the firm owner's account without allowing assistant logins to overwrite senior surveyor credentials.
- feat(presence): Implemented live claim active editing detection in `src/hooks/useClaimPresence.ts` and `ClaimPresenceBanner.tsx`, displaying an animated amber warning when a colleague is currently editing the same claim.
- feat(privacy): Gated the `'fees'` tab in `sidebar.tsx` and Fees Overview in `Dashboard.tsx` when `hideEarnings` is enabled. Restricted permanent claim deletion to primary surveyors.
- feat(admin): Added `adminNotes`, `paymentMode`, and `planName` to `PaymentRecord`. Enhanced `VerifyPaymentModal.tsx` with an Admin Notes input, and created `RecordOfflinePaymentModal.tsx` for manual offline payment recording. Added payment history and notes drawer in `SurveyorsTab.tsx`.
- feat(billing): Enhanced `SubscriptionSection.tsx` to render firm workspace plan/seat stats, payment modes, and admin verification notes, hiding sensitive financial data from assistants when privacy is enabled.
- docs(contract): Updated `docs/handover/prime-notes-import.md` to document the team shared Google Drive folder contract for SurveyOS Scan and Prime.
- verification: 310 Vitest test files passed (2,717 tests, 100% green), `npx tsc --noEmit` clean (0 errors), SurveyOS Scan drift tests (`:app:testDebugUnitTest`) 28 tasks passed (100% green).

## 2026-11-07 (Antigravity) — Unified Storage Hub, Firestore Quota Optimization & Cloud Sync UX
- perf(sync): Added 15-second tab-switch coalescing window (`TAB_SWITCH_COALESCE_MS = 15_000`) in `src/hooks/useCloudSync.ts`, debouncing milestone pushes during rapid tab navigation while immediately flushing on claim switch, app backgrounding, and window beforeunload.
- feat(storage): Automated Google Drive mirroring in `src/hooks/useSaveToCloudPrompt.tsx` without blocking modal popups. Files automatically sync in the background when Drive is connected and save locally on laptop when disconnected.
- feat(ui): Implemented unified Top Header Storage & Safety Status Pill in `src/components/layout/ClaimHeader.tsx` (`[✓ All Changes Saved]`, `[↻ Saving...]`, `[● Saved to Laptop]`) replacing scattered chips and the manual "Save & Sync" button.
- feat(ui): Added `StorageSafetyPopover.tsx` displaying interactive status for Local Computer Folder, Google Drive, and Cloud Vault (Firestore) with an on-demand `[Sync Now]` button.
- feat(ui): Added helper subtitles and tooltips for `Cloud Vault` (*"Cloud Text Sync"*) and `Recovered` (*"Emergency Cache"*) in `src/components/layout/sidebar.tsx`.
- feat(photos): Enhanced multi-device Drive photo discovery in `drive-photo-diff.ts` and `NewDrivePhotosBanner.tsx` to detect camera photos without `photo_` prefix, providing a 1-click notification banner (`"☁️ {pending.length} photo(s) found in Google Drive for this claim. [Download to this Laptop]"`) with dynamic progress feedback.
- feat(documents): Created unified `[📱 From Phone]` dropdown button in `src/components/documents/FromPhoneButton.tsx` and integrated it into `DocumentsTab.tsx`, consolidating "Phone Notes" and "Phone Scans & Photos" into a clean, single control.
- test: Added comprehensive unit tests in `useCloudSync-coalesce.test.ts`, `useSaveToCloudPrompt.test.ts`, `StorageSafetyPopover.test.tsx`, `ClaimHeader.test.tsx`, `sidebar-navigation.test.tsx`, `drive-photo-diff.test.ts`, `NewDrivePhotosBanner.test.tsx`, and `FromPhoneButton.test.tsx`.
- verification: Full Vitest suite passing (302 test files, 2,638 tests, 100% green), `npx tsc --noEmit` clean (0 errors), Android Scan drift test passed (28 tasks green).

## 2026-11-07 (Antigravity) — Single Unified Google Drive Claim Folder & Manual Surveyor Linking
- feat(drive): Updated `getOrCreateClaimFolder` in `index.ts` to check `claim.gDriveFolderId` before creating a new Drive folder, preventing duplicate folder creation when a folder is already linked.
- feat(scan-notes): Wired `UsePhoneNotesButton.tsx` to bind `claim.gDriveFolderId` to the selected Drive folder, save it in `localStorage` and `surveyos_index.json`, and toast `Linked claim to Drive folder: ${folder.name}`.
- feat(scan-notes): Updated `listScanDriveFolders` in `drive-notes.ts` to list claim folders from both `SurveyOS/Phone Scans/` and root `SurveyOS/`, filtering container folders and deduplicating by ID.
- test: Added test in `index-hygiene.test.ts` verifying that `getOrCreateClaimFolder` respects pre-existing `gDriveFolderId` and updates the index without POSTing new folder requests.
- tests: Vitest suite 294 passed (2,598 tests, 100% green). TypeScript clean (`npx tsc --noEmit`). Scan drift tests (`:app:testDebugUnitTest`) 28 tasks passed (100% green).

## 2026-11-07 (Antigravity) — Admin Panel Surveyor Claims Count & Trial Activity Tracking
- feat(admin): Implemented server-side claim aggregation helper `getSurveyorClaimCount(uid: string)` in `src/lib/firebase/claims-count.ts` using Firestore `getCountFromServer`.
- feat(admin): Added lazy, on-demand claim count fetching and in-memory caching to `SurveyorsTab.tsx` when a surveyor row is expanded.
- feat(ui): Added `Claims Created` metric in the expanded surveyor card (`SurveyorsTab.tsx`) with UI/UX Pro Max standards:
  - Inline skeleton placeholder during asynchronous loading.
  - Amber badge `0 (Untested)` for trial surveyors who have not yet created claims.
  - Emerald badge `{count} {claims}` with `FileText` icon for surveyors who have tested/created claims.
  - Subtle muted `0 claims` for non-trial accounts without claims.
- tests: Added unit tests in `src/lib/firebase/__tests__/claims-count.test.ts` (4 tests) and comprehensive component test coverage in `src/components/admin/tabs/__tests__/SurveyorsTab.test.tsx` (7 tests).
- verification: Full Vitest suite (294 test files, 2,597 tests, 100% green), `npx tsc --noEmit` (0 errors), Next.js production build (`npm run build`) completed cleanly with 25 static routes prerendered.

## 2026-11-07 (Antigravity) — Surveyor Report Fixes: Workshop Name Isolation, Dual DL Validity, and Bill Check Zero Excess Preservation
- fix(reports): Prevented Final Survey Report (`uiic-final-builder.ts`) from silently falling back to Spot Survey repair workshop (`sd.repairWorkshop`). Final reports now strictly print the repairer/dealership workshop (`accident.workshopName`).
- feat(reports): Added dual DL validity display (`NT: <date> | TR: <date>`) to UIIC Final Report and `UIICPrintReport.tsx` when both private/non-transport and commercial/transport validities are recorded on the licence, preventing insurance hub rejections.
- fix(bill-check): In `BillCheckSummaryPanel.tsx`, replaced logical OR `||` with nullish coalescing `??` for `excess`, `labourOnlyBase`, `labourOnlyTotal`, and `grandTotal`. A typed `0` Policy Excess is now strictly preserved as `0.00` rather than falling back to assessment excess.
- feat(bill-check): Added `Includes Towing Charges (+ ₹X)` callout in Bill Check Financial Summary above Net Final Liability when towing charges are admissible.
- tests: Added test suite `src/lib/reports/__tests__/uiic-workshop-and-dl-validity.test.ts` and updated `BillCheckSummaryPanel.test.tsx`.
- verification: Full Vitest suite (293 test files, 2,587 tests, 100% green), `npx tsc --noEmit` (0 errors), Next.js production build cleanly compiled.

## 2026-11-07 (Antigravity) — SurveyOS Scan Notes Import: Drive Folder Picker, Normalizer & Cross-Tab Integration
- feat(scan-notes): Implemented `UsePhoneNotesButton.tsx` offering on-demand notes import from Google Drive or local computer export (.zip).
- feat(scan-notes): Implemented `PhoneFolderPickerDialog.tsx` displaying claim folders from `My Drive/SurveyOS/Phone Scans/` with vehicle match indicators (`Recommended: MH12AB1234`), 48px touch targets, and inline Google Drive connection flow.
- feat(scan-notes): Added vehicle mismatch confirmation dialog (`Different Vehicle Number`) guarding against cross-claim data contamination when the selected phone notes belong to a different vehicle.
- feat(scan-notes): Built `normalizer.ts` (`normalizeScanNotes`) converting both manifest notes (`_surveyos-scan.json`) and lightweight Scan text-only backups (`_surveyos-backup.json`) into the unified Prime notes shape.
- feat(scan-notes): Updated `drive-source.ts` to seamlessly fall back to `_surveyos-backup.json` when `_surveyos-scan.json` is missing, unblocking Scan's lightweight "Text only" Drive sync.
- feat(ui): Embedded `UsePhoneNotesButton` into headers of `SpotTab.tsx`, `ValuationTab.tsx`, `FeesTab.tsx`, and `DocumentsTab.tsx` so surveyors can pull notes directly where they work.
- tests: Added test suites in `normalizer.test.ts` and `drive-notes.test.ts`. Full Vitest suite: 293 passed (2,587 tests, 100% green).
- verification: `npx tsc --noEmit` passed with 0 errors. Scan drift tests (`:app:testDebugUnitTest`) passed (100% green).

## 2026-11-06 (Antigravity) — Disconnect Surveyor Travel Expenses from Assessment Vehicle Towing & Permanent Towing Line
- feat(assessment): Disconnected surveyor travel expenses (`feeBill.travelExpenses`) from assessment vehicle towing charges.
- fix(model): `feeBill.travelExpenses` strictly remains the surveyor's conveyance fee. Dedicated `feeBill.towingCharges` added for admissible vehicle towing.
- feat(ui): Added "Towing charges (admissible)" input in Assessment tab financial summary (`AssessmentSummary.tsx`).
- fix(reports): Updated `uiic-final-builder.ts` to map Towing Charges from `feeBill.towingCharges`.
- feat(reports): Added permanent "Add: Towing Charges" line in Section 8 assessment summary table in `standard-report-builder.ts` and `SurveyReportDocument.tsx`.
- feat(engine): Updated `assessment.ts` (`calculateAssessmentSummary` and `calculateBillCheckSummary`) to factor towing charges into `netAssessedLoss` and `netLiability`.
- feat(assessment): Aligned all remaining assessment call sites (`ReportTab.tsx`, `irdai-summary-builder.ts`, `insured-report.ts`, `AssessmentGrid.tsx`) to pass `towingCharges`.
- tests: Added test coverage in `src/lib/calculations/__tests__/assessment-towing.test.ts` covering assessment math, zero-flooring, salvage/excess offsets, and bill check consistency.
- verification: Full Vitest suite passed (100% green). `npx tsc --noEmit` clean (0 errors). Next.js production build (`npm run build`) passed with all routes prerendered. Prime ↔ Scan impact: None (0 drift).

## 2026-11-06 (Antigravity) — Bill Check Financial Summary: Realignment to Assessment Tab Format
- feat(bill-check): Realigned `BillCheckSummaryPanel.tsx` to adapt the proven `AssessmentSummary.tsx` financial table structure, placing primary emphasis on the **Assessed Amount** and step-by-step calculation deriving the statutory **Net Final Liability**.
- feat(bill-check): Rendered explicit breakdown: Parts taxable base, material subtypes (Metal, Plastic/Rubber, Glass, Fibreglass), Parts GST (CGST + SGST), Final parts assessed, Labour taxable base, Labour GST, Final labour assessed, Painting charges, Total GST, and GROSS ASSESSED LOSS banner.
- feat(bill-check): Retained interactive `SalvageInput` (with dynamic metal basis rescaling) and Less Policy Excess deductions.
- feat(bill-check): Maintained prominent hero **TOTAL LIABILITY** block with tabular figures and full Indian currency words (`RUPEES ... ONLY`).
- feat(bill-check): Moved secondary audit metrics (Workshop Invoice Total vs. Verified in Bill, Difference, and Items Not in Bill / Capped Variance) below the core assessment calculation engine.
- tests: Added comprehensive test coverage in `src/components/tabs/__tests__/BillCheckSummaryPanel.test.tsx` verifying all assessment calculation rows, hero liability display, and audit reconciliation.
- verification: Full Vitest suite passed: 287 test files, 2,556 tests (100% green). `npx tsc --noEmit` clean (0 errors). Next.js production build (`npm run build`) passed with 25 routes prerendered. Prime ↔ Scan impact: None (0 drift).


## 2026-11-06 (Antigravity) — Sidebar Navigation Realignment: Bill Check & Reinspection into Claim Workflow
- feat(nav): Moved `Bill Check` and `Reinspection` from `OUTPUT` into `CLAIM WORKFLOW` in `src/components/layout/sidebar.tsx`, sequenced directly after `Assessment` (`Assessment` → `Bill Check` → `Reinspection`).
- feat(nav): Renamed sidebar group label `OUTPUT` to `DELIVERABLES` (`Report Center`, `Photo Sheet`, `Survey Fees Bill`, `Insured Report`).
- feat(nav): Added uncluttered Ponytail micro-status indicators on sidebar items: discrepancy count on `AI Review` and subtle green `✓` on `Bill Check` when invoice is verified.
- feat(nav): Synchronized `CLAIM_TAB_ORDER` in `src/lib/onboarding/tab-help.ts` so keyboard navigation and step progression flow seamlessly: `assessment` → `bill-check` → `reinspection` → `reports`.
- feat(reports): Added rapid jump links (`[Assessment ↗]`, `[Bill Check ↗]`) in `ReportTab.tsx` header for instant 1-click teleporting to working tabs from the live preview.
- tests: Updated `src/lib/onboarding/__tests__/tab-help.test.ts` and `src/lib/navigation/__tests__/visible-nav.test.ts`. Full Vitest suite: 287 passed, 2,555 tests (100% green).


## 2026-11-06 (Antigravity) — Fix Report Center Bill Check Report Switcher Glitch
- fix(reports): Fixed report switcher in `ReportTab.tsx` reverting `activeReport` back to `'survey'` whenever `'bill-check'` was clicked. The sync `useEffect` now correctly preserves `'bill-check'` on final claims (`activeReport !== 'survey' && activeReport !== 'bill-check'`).
- refactor(reports): Memoized live report HTML preview with `useMemo` and wrapped in `try...catch` with graceful error fallback.
- fix(reports): Added SSR-safe `sanitizeReport(html)` helper in `ReportTab.tsx` guarding against missing DOM window during static rendering / test runs.
- perf(reports): Initialized `mounted` state with `() => typeof window !== 'undefined' || process.env.NODE_ENV === 'test'` to eliminate 1-frame PDF loading fallback flicker when mounting Report Center.
- tests: Added test suite in `src/components/tabs/__tests__/ReportTabBillCheck.test.tsx` (6 tests) covering Report Center report switcher, active report persistence, claim switching, and `BillCheckActions`.
- tests: Fixed invalid vehicle type (`'4w'` -> `'private'`) in `src/hooks/__tests__/useBillCheckPrintGate.test.ts`.
- verification: Full Vitest suite passed: 287 test files, 2,555 tests (100% green). `npx tsc --noEmit` clean (0 errors). Next.js production build (`npm run build`) passed with 25 routes prerendered. Prime ↔ Scan impact: None (0 drift).


## 2026-11-06 (Antigravity) — Bill Check Workspace Redesign, Strict Invoice Verification Gate & Excel Column Resizing
- feat(bill-check): Redesigned `BillCheckTab.tsx` into a wholesome, desktop-grade workspace matching `AssessmentTab.tsx`: fixed viewport `h-[calc(100dvh-140px)]`, internal scroll, and zero outer page jumping.
- feat(bill-check): Replaced oversized 140px indigo hero header (`#EEF2FF`) with a lean 42px toolbar (`BillCheckHeader.tsx`) featuring Title, verification status badge, liability mini-pill, AI controls pill, and action buttons (`Upload Bill`, `Phone Files`, `Evidence`, `Summary`, `Save Progress`).
- feat(bill-check): Redesigned `BillCheckSummaryPanel.tsx` into a sticky sidebar card hosting:
  1. Workshop Invoice Details (`billNo`, `billDate`, `billTotal`) with surveyor verification toggle (`verifiedBySurveyor`). Editing fields resets verification.
  2. Invoice Reconciliation math (Workshop Total vs. Allowed in Bill = Variance).
  3. Metric breakdown, Deductions (with `SalvageInput`), and Net Final Liability.
  4. Quick navigation link: `[View & Print in Report Center ↗]`.
- feat(reports): Unified all deliverable generation into **Report Center** (`ReportTab.tsx`). Added `'bill-check'` to `REPORT_TYPES`, rendered live report preview (`buildUIICBillCheckHTML` or `buildStandardFinalSurveyHTML`), and added `BillCheckActions.tsx` (Standard vs. UIIC toggle, zoom controls, Word export, Print PDF).
- feat(reports): Built strict pre-print compliance gate `useBillCheckPrintGate.tsx` and interactive `VerifyInvoiceDetailsDialog.tsx`. Prevents issuing reports with blank invoice numbers, unverified totals, pending items, or blocking flags.
- feat(claim): Created zero-dependency Excel-style column resizer hook `useColumnResize.ts` with drag handling (`cursor: col-resize`), width clamping (`180px` to `750px`), double-click reset, and `localStorage` persistence.
- feat(claim): Wired `useColumnResize` into `AssessmentSectionTable.tsx` (resizing Parts, Labour, and Painting columns in lockstep) and `BillCheckGrid.tsx`.
- tests: Added unit tests in `src/hooks/__tests__/useColumnResize.test.tsx` (2 tests), `src/hooks/__tests__/useBillCheckPrintGate.test.ts` (2 tests), and `src/components/tabs/__tests__/BillCheckSummaryPanel.test.tsx` (2 tests).
- verification: Full Vitest suite passed: 286 test files, 2,549 tests (100% green). `npx tsc --noEmit` clean (0 errors). Next.js production build (`npm run build`) completed in 22.0s with all 25 static routes prerendered. Prime ↔ Scan impact: None (0 drift).

## 2026-11-06 (Antigravity) — Production Deployment of Volkswagen Group DMS Estimate & Invoice Parser
- deploy: Built Next.js static export (`npm run build`) and deployed to Firebase Hosting (`motorsurveyos-in` and `surveyos-v2-antigravity-in`) on project `surveyos-v2-antigravity-in`.
- verify: Verified deployed chunk `0g48r3-g3sb-v.js` via curl directly on `https://motorsurveyos-in.web.app`, confirming `gst base amount`, `amount incl. tax`, `final amount`, `type`, and inline CGST/SGST description stripping are live in production.

## 2026-11-06 (Antigravity) — Assessment Grid Excel Copy/Paste, Fill-Down & Inline Formula Calculations
- feat(claim): Added native React `onPaste` handler on `tbody` in `AssessmentSectionTable` and `AssessmentGrid` reading `e.clipboardData.getData('text/plain')`. Replaced permissions-blocked `navigator.clipboard.readText()`.
- feat(claim): Implemented multi-cell range fill: copying a single value (e.g. `18` or `18%`) and pasting into a column selection fills all cells in that range.
- feat(claim): Implemented multi-line paste: copying rows from Excel applies line-by-line down the active section in `AssessmentGrid`.
- feat(claim): Added native React `onCopy` handler on `tbody` copying selected cell(s) as newline-delimited text to system clipboard.
- feat(claim): Added classic Excel Fill Down (`Ctrl+D` / `Cmd+D`) in `handleGridNavigation` duplicating the top cell's value down into all selected cells in the section.
- feat(claim): Built safe recursive descent arithmetic evaluator `evaluateFormula` in `src/lib/utils/formula-eval.ts` supporting `+`, `-`, `*`, `/`, `()`, unary minus, decimals, and `=`. Safe from code injection (zero `eval()` or `Function()`).
- feat(claim): Built `FormulaNumericInput` (`src/components/claim/FormulaNumericInput.tsx`) and wired into `assessed`, `estimated`, `quantity`, and `gst` cells. Allows typing math expressions (e.g. `=150+200` or `150+200`), evaluating automatically on `Enter` or `blur`.
- tests: Added unit tests in `src/lib/utils/__tests__/formula-eval.test.ts` (15 tests), `src/components/claim/__tests__/FormulaNumericInput.test.tsx` (5 tests), and expanded `src/lib/utils/__tests__/grid-paste.test.ts` to 30 tests.
- verification: Full Vitest suite passed: 283 test files, 2,543 tests (100% green). `npx tsc --noEmit` clean (0 errors). Next.js production build (`npm run build`) passed with 25 routes prerendered.

## 2026-11-06 (Antigravity) — Volkswagen Group DMS Estimate & Invoice Zero-Token Parser Support
- feat(ai): Added deterministic zero-token parsing support for Volkswagen Group DMS estimates and invoices in `src/lib/ai/row-parser.ts`.
- feat(ai): Extended table header detection in `findHeader` to recognize unnumbered column schemas containing `Type` + `Description` + `Qty` + `Amount` (as printed by Volkswagen/Skoda/Audi dealership software).
- feat(ai): Implemented row anchoring on `Type` column values (`Item` vs `Labor`) with synthetic sequential `sr_no` generation (1..N).
- feat(ai): Handled unnumbered pre-tax estimates where `Amount` is taxable base without row-level GST% column. Settled via `footerTax` using multi-point tie-out against printed `Summary Details` (Parts Amount, Labor Amount, and Grand Total).
- feat(ai): Added column synonyms for Volkswagen final tax invoices: `GST Base Amount`, `Base Amount`, `Amount Incl. Tax`, `Total GST`, `Final Amount`.
- tests: Added comprehensive test fixtures in `src/lib/ai/__tests__/row-parser.test.ts` covering both minimal VW items and the complete 33-row 2-page Volkswagen estimate (`SOA2600192`), verifying exact mathematical tie-out to ₹118,321.06 in <40ms.
- verification: Full Vitest suite passed: 281 test files, 2,515 tests (100% green). `npx tsc --noEmit` clean (0 errors). Prime ↔ SurveyOS Scan impact: None.

## 2026-11-06 (Antigravity) — Production Deployment of Data Reconciliation Interactive Dual Evidence & No Auto-Close
- deploy: Built Next.js static export (`npm run build`) and deployed to Firebase Hosting (`motorsurveyos-in` and `surveyos-v2-antigravity-in`) on project `surveyos-v2-antigravity-in`.
- verify: Verified deployed chunk `0n1i3q1dzc0gx.js` via curl directly on `https://motorsurveyos-in.web.app` and `https://surveyos.in`, confirming live dual evidence switcher ("Click to flip document & select"), live claim updates, and explicit finish reconciliation are live in production.

## 2026-11-06 (Antigravity) — Data Reconciliation Interactive Dual Evidence & No Auto-Close
- feat(ui): Implemented interactive dual document evidence inspection in `ReconciliationDialog.tsx`. Surveyors can now click between conflicting document options (e.g. RC Book vs Insurance Policy) to flip the right-side evidence viewer in real time without premature dismissal.
- feat(ui): Added a persistent active field source comparison switcher at the top of the evidence panel, allowing instant 1-click toggling between source documents, pages, and OCR context snippets.
- fix(ui): Removed premature auto-close `useEffect` in `DocumentsTab.tsx` that closed the dialog instantly when `conflicts.length === 0`. The dialog now stays open until the surveyor explicitly clicks "Finish Reconciliation".
- fix(ui): Added `getAllConflictFields` in `src/lib/ai/reconciliation.ts` to supply `ReconciliationDialog` with all conflicting fields throughout the session. Resolving a conflict marks the row as `✓ Resolved` with green accenting instead of causing it to abruptly vanish.
- tests: Added regression test in `src/lib/ai/__tests__/reconciliation.test.ts` for `getAllConflictFields`. Full Vitest suite: 281 test files passed, 2,513 tests passed (100% green). `npx tsc --noEmit` clean (0 errors).

## 2026-11-06 (Antigravity) — Production Deployment of Floating Preview Bill Check Parity & Clean Bill Check Header
- deploy: Built Next.js static export (`npm run build`) and deployed to Firebase Hosting (`motorsurveyos-in` and `surveyos-v2-antigravity-in`) on project `surveyos-v2-antigravity-in`.
- verify: Verified deployed chunk `02eq3bw-3li1l.js` via curl directly on `https://surveyos.in` and `https://motorsurveyos-in.web.app`, confirming 5-pill preview selector with `Std Bill` / `UIIC Bill` and clean `Bill Check Report` header are live in production.

## 2026-11-06 (Antigravity) — Floating Preview Bill Check Parity & Clean Bill Check Header
- feat(ui): Added Standard Bill Check preview support to `FloatingReportPreview.tsx` (`buildStandardFinalSurveyHTML(..., 'bill-check')`) with gated print trigger (`gate('bill-check', ...)`).
- feat(ui): Implemented 5-pill format selector in floating report preview toolbar: `Std` | `UIIC` | `Std Bill` | `UIIC Bill` | `Fees`.
- feat(ui): Added smart insurer-aware auto-selection when navigating to the Bill Check tab: auto-selects `UIIC Bill` for United India claims and `Std Bill` for other insurers.
- refactor(ui): Removed the clunky 48px height minimise button from `FloatingReportPreview.tsx`, keeping the clean Close (`X`) button that docks back into the floating bubble pill.
- refactor(ui): Updated `BillCheckHeader.tsx` to display universal "Bill Check Report" title instead of hardcoded "UIIC Bill Check Report".
- tests: Added unit test in `src/components/layout/__tests__/FloatingReportPreview.test.tsx`. Vitest suite: 281 test files passed, 2,512 tests passed (100% green). `npx tsc --noEmit` clean (0 errors).

## 2026-11-06 (Antigravity) — Production Deployment of Standard Bill Check Net Liability Fix
- deploy: Built Next.js static export (`npm run build`) and deployed to Firebase Hosting (`motorsurveyos-in` and `surveyos-v2-antigravity-in`) on project `surveyos-v2-antigravity-in`.
- verify: Verified deployed chunk `0es4-_7.7_kel.js` via curl directly on `https://surveyos.in` and `https://motorsurveyos-in.web.app`, confirming `NET LIABILITY` row and reconciled assessed loss calculation are live in production.

## 2026-11-06 (Antigravity) — Standard Bill Check Net Liability Calculation Reconciliation
- fix(reports): Reconciled Standard Bill Check Report (`buildStandardFinalSurveyHTML` in `bill-check` mode in `src/lib/reports/standard-report-builder.ts`). Disconnected assessment rows from `projectForBillCheck` so Column 3 (`Assessed (after Dep.)`), Column 4 (`Incl. GST`), `grand`, and `net` are derived strictly from the surveyor's true assessed loss instead of capped workshop billed amounts.
- fix(reports): Wired Column 2 (`Billed`) in Section 8 to explicit workshop billed taxable base totals (`col2PartsBase`, `col2LabBase`, `col2Metal`, `col2Plastic`, `col2Glass`, `col2Fbr`, `col2LabOnly`, `col2PaintOnly`), providing a clear comparison between workshop billing and surveyor assessment.
- fix(reports): Labeled Section 8 final total as `NET LIABILITY` in bill check mode, and guaranteed $grand - salvage - excess = net$ without deducting salvage/excess from billed figures.
- fix(reports): In Section 9 item table, preserved the surveyor's true assessment in the `Assessed ₹` column, and populated the `Bill ₹` column with `r.billedTaxable ?? r.estimated` (or `No Bill` for `not-in-bill`).
- fix(calculations): In `src/lib/calculations/assessment.ts` (`calculateBillCheckSummary`), accumulated `assessedGrandTotal += assessedNet` across allowed items, updated `netLiability = Math.max(0, assessedGrandTotal - salvage - totalExcess)`, and set `grandTotalAssessed: assessedGrandTotal`. This ensures the Bill Check tab summary card displays final liability based on assessed loss.
- tests: Added regression unit test in `src/lib/reports/__tests__/standard-bill-check.test.ts`. Full Vitest suite: 280 test files passed, 2,509 tests passed (100% green). `npx tsc --noEmit` clean (0 errors).

## 2026-11-06 (Antigravity) — Production Deployment of UIIC Bill Check Net Liability Fix
- deploy: Built Next.js static export (`npm run build`) and deployed to Firebase Hosting (`motorsurveyos-in` and `surveyos-v2-antigravity-in`) on project `surveyos-v2-antigravity-in`.
- verify: Verified deployed chunk `0ggmzt3b_5lsd.js` via curl directly on `https://surveyos.in` and `https://motorsurveyos-in.web.app`, confirming `Towing Charges` row and reconciled `Less: Voluntary / Imposed Excess` deduction stack are live in production.

## 2026-11-06 (Antigravity) — UIIC Bill Check Net Liability Calculation Reconciliation
- fix(reports): Reconciled UIIC Bill Check Net Liability calculation in `src/lib/reports/uiic-final-builder.ts` (`buildUIICBillCheckHTML`). Net Liability is now strictly derived as $\text{Total Assessed (After Dep + GST)} - \text{Salvage} - \text{Voluntary Excess} - \text{Compulsory Excess}$.
- fix(reports): Removed misleading `Total Billed by Workshop` row from the Page 2 bottom summary table so the vertical deduction stack cleanly balances from the Assessed gross figure to Net Liability. Updated words amount and Service Hub confirmation block to match `net` exactly.
- fix(reports): Corrected Page 1 summary table: left column now displays `Towing Charges: ${fa(tow)}` instead of duplicate billed total, and right column displays `Net Liability: ${fa(net)}` reconciling $gross - salvage - excess = net$ without arithmetic discrepancy.
- tests: Added regression test in `src/lib/reports/__tests__/bill-check-report.test.ts`. Full Vitest suite: 280 test files passed, 2,508 tests passed (100% green). `npx tsc --noEmit` clean (0 errors).

## 2026-11-06 (Antigravity) — Claim Folder Deduplication, Silent Auto-Replace & 3-Touchpoint Allocation
- feat(documents): Implemented silent auto-replace for single-file document slots (`rc`, `dl`, `policy`, `permit`, `fitness`, `reinspectionReport`, `surveyReport`, etc.) in `src/lib/documents/folder.ts`. Eliminates `(old)`, `(old 2)` file clutter by overwriting files under clean canonical names (`RC Book.pdf`).
- feat(documents): Added in-folder deduplication in `folder.ts` that checks existing file size and name to skip redundant writes when an identical file already exists on disk. Automatically removes discarded files with previous extensions (e.g. replaced `.html` report with `.pdf`).
- feat(ui): Added proactive folder allocation in `NewClaimDialog.tsx` (Touchpoint 1), allowing surveyors to optionally select a local claim folder right at claim creation.
- feat(ui): Created `ClaimFolderPromptDialog.tsx` (Touchpoint 3) providing a non-blocking, accessible `/ui-ux-pro-max` dialog prompting for folder allocation when triggering folder actions (`Bring phone scans`, `Use phone files`, `Print PDF`) on unallocated claims.
- refactor(ui): Streamlined `DocumentsTab.tsx` (Option A) by removing the redundant legacy `<FolderLine>` (`No claim folder · Connect`) from below the reconciliation hub. Cleaned top actions row to host `AskForDocumentsButton` and `BringPhoneScans`.
- tests: Added 16 new unit tests across `folder-silent-replace.test.ts` (8 tests) and `ClaimFolderPromptDialog.test.tsx` (8 tests). Full Vitest suite: 280 test files passed, 2,507 tests passed (100% green). TypeScript check clean (0 errors).
- Scan coupling: Verified Android sibling app `../SurveyOS Scan` with `./gradlew :app:testDebugUnitTest` (BUILD SUCCESSFUL, 0 drift).


## 2026-11-06 (Antigravity) — Production Deployment of OIC Excel Generator & Portal Mapping
- deploy: Built Next.js static export (`npm run build`) and deployed to Firebase Hosting (`motorsurveyos-in`) on project `surveyos-v2-antigravity-in`. Verified live chunk `0e3uv-_6it7cw.js` directly on `https://surveyos.in` and `https://motorsurveyos-in.web.app`.

## 2026-11-05 (Antigravity) — Oriental Insurance (OIC) Assessment Excel Generator & Portal Mapping
- feat(reports): Implemented OIC assessment Excel workbook builder (`src/lib/reports/oic-assessment-excel.ts`) generating 2-sheet workbook (`Invoice` and `Items`) matching `9400ExcelOICL.xlsx` and official sample report. Implemented statutory painting adapter: splits standard painting into 75% Labour (0% dep) and 25% Plastic (50% dep) yielding the exact statutory 12.5% deduction, while keeping SurveyOS Final Survey Reports 100% pure. Injected exact OIC formula `=ROUND((E{row}-(E{row}*F{row}/100))*(G{row}/100),2)` in Column K.
- feat(ui): Added `OICExportDialog.tsx` with bill-check verification gate, statutory painting translation preview chip, and auto-filing directly into the claim folder via `saveOrDownloadReport`.
- feat(claim): Added indigo-themed `OIC Excel` export button in `AssessmentGrid.tsx` toolbar alongside UIIC and NIA. Registered `oicAssessmentExcel` in `src/types/documents.ts` and `src/lib/portal/extension-bridge.ts`.
- feat(portal): Created `scripts/portal-map/oic-assessment.overlay.json` mapping 25+ fields from OIC portal Step 2 ("Basic Details"). Compiled to `extension/maps/oic-assessment.json` and `public/portal-maps/oic-assessment.json`.
- feat(extension): Updated `extension/manifest.json`, `extension/src/background.js`, and `extension/src/lib/packet-validate.js` for OIC portal (`oic: ['assessment']`). Enhanced `panel.js` and `filler.js` to support ID selector matching (`#<id>`), HTML5 pushState path matching, and React Synthetic Event tracking (`_valueTracker`).
- contract(scan): Updated Android sibling app `../SurveyOS Scan` (`PrimeContract.kt`) with `OIC_ASSESSMENT_EXCEL` to maintain 100% contract parity with zero drift. All Scan unit tests pass (`:app:testDebugUnitTest`).
- tests: Full Vitest suite: 278 test files passed, 2,491 tests passed (100% green). Extension tests: 10 test files passed, 124 tests passed (100% green). TypeScript check clean (0 errors).
- feat(storage): Implemented per-claim directory handle isolation store (`src/lib/storage/claim-folder-store.ts`) under IndexedDB `surveyos-local-sync` (version 2, store `claim-handles`). Allows surveyors complete freedom to allocate any local folder on their PC per claim (Spot, Final, Valuation, or custom hierarchy) with zero folder guessing or name collisions.
- feat(ui): Added `ClaimFolderButton.tsx` in `ClaimHeader.tsx` displaying the current allocated folder name, folder picker ("Set Folder"), and permission status ("Grant Folder Access") with 1-click synchronous Chromium user-gesture handling.
- feat(documents): Built universal document ingestion pipeline (`src/lib/documents/ingest.ts`) orchestrating: Disk write -> Evidence Viewer registration (`storeFiles`) -> AI optical extraction -> Google Drive sync (`uploadWithDuplicateCheck`).
- fix(details-tab): Wired `handleFileChange` in `DetailsTab.tsx` to `ingestDocument` so raw files from "Scan RC", "Scan DL", and "Scan Policy" are never lost in memory. Added "Use phone files" pickers (`UsePhoneFiles`) to `VehicleDetailsForm`, `DriverDetailsForm`, and `PolicyDetailsForm`.
- feat(reports): Built `auto-file-report.ts` and integrated automatic output filing across all report builders (`reinspection-report-builder.ts`, `standard-report-builder.ts`, `uiic-final-builder.ts`, `spot-fee-bill-builder.ts`, `valuation-report-builder.ts`, `PhotoSheetDownloadButton.tsx`). Reports auto-write directly into the claim folder with canonical filenames (`Final_Survey_Report_<ReportNo>.html`, `Reinspection_Report_<ReportNo>.html`, `Spot_Fee_Bill_<ReportNo>.html`, `Valuation_Report_<ReportNo>.html`, `Bill_Check_<ReportNo>.html`, and `Photo_Sheet.pdf`).
- fix(photos): Replaced `Date.now()` photo naming in `usePhotoUpload.ts` with deterministic indexed names (`final_photo_01_<name>.jpg`). Integrated `uploadWithDuplicateCheck`.
- fix(drive): Hardened `saveDriveIndex` and `getOrCreateClaimFolder` in `src/lib/drive/index.ts` to abort before overwriting the index file with an empty map on network or authentication flakes.
- tests: Added 58 new unit tests across `claim-folder-store.test.ts`, `ClaimFolderButton.test.tsx`, `folder-per-claim.test.ts`, `ingest.test.ts`, `DetailsTabUploads.test.tsx`, `auto-file-report.test.ts`, `usePhotoUploadDedupe.test.ts`, and `index-hygiene.test.ts`. Full Vitest suite: 276 test files passed, 2,475 tests passed (100% green).
- typecheck: `npx tsc --noEmit` clean (0 errors).
- Scan coupling: Verified Android sibling app `../SurveyOS Scan` with `./gradlew :app:testDebugUnitTest` (BUILD SUCCESSFUL, 0 drift).


## 2026-11-05 (Antigravity) — SurveyOS Scan In-Viewer Gallery Photo Stamp Modes & 1-Tap Compression
- chore(scan/release): Bumped `versionCode` to 4 (`versionName = "1.3"`) for Google Play Store release. Built and signed production bundle `app-release.aab` (12.18 MB). Commit `f633e78`.
- feat(scan/photo): In-viewer photo stamp mode chips (`[ Full ]`, `[ No Date ]`, `[ No Stamp ]`) in `PhotoViewer.kt` and `PageStamp.kt`. `No Date` omits timestamp for pre-stamped gallery imports. When GPS coordinates are absent, zero blank lines or empty text boxes are rendered.
- feat(scan/compress): Live photo file size display in `PhotoViewer` header (`sizeText(item.page.sizeBytes)`). Added 1-tap `[ Compress ]` button opening dialog with target pills:
  - `~100 KB · Photo Sheet / Email Friendly (1280px · 60% quality · Optimal for 6-up A4 report sheets)`
  - `~250 KB · Balanced (1600px · 70% quality)`
  - `Original Full Resolution (1920px · 75% quality · Full survey detail)`
- feat(scan/batch): Safe batch application confirmation dialog when editing gallery photos (`source == "GALLERY"`), prompting to apply to all gallery photos in the claim or just this one. On-site camera photos retain original evidence.
- feat(scan/engine): Lossless re-render architecture in `PageFileEdits.kt` and `JpegEncoder.kt` rebuilds working JPEG from untouched `originalFile`. Added `photoQualityForSize` to preserve chosen compression preset across stamp/time edits without database migration.
- tests(scan): Unit tests added in `StampTextTest.kt` verifying stamp mode detection, transitions, zero-line generation on missing GPS, and quality range boundaries. All 28 tasks passed. Commit `8ddf370` on `main`.
- Prime impact: None. SurveyOS Prime V2 is 100% compatible without changes.

## 2026-11-05 (Antigravity) — User Onboarding Phase 3 & 4 + "Power Print" renamed to "Print PDF"
- refactor(ui): Renamed legacy "Power Print" buttons and labels across the app to "Print PDF" (`SpotActions.tsx`, `SurveyActions.tsx`, `BillCheckTab.tsx`, `FeesTab.tsx`, `ReinspectionTab.tsx`) per surveyor request.
- feat(onboarding): Phase 3 Report Section Guide in Report Center (`ReportTab.tsx`, `ReportSectionGuide.tsx`, `report-guide.ts`). Collapsible executive guide explaining what insurers inspect in each section across Final Survey (Standard & UIIC), Spot Survey, and Valuation reports, with direct 1-click jump-to-fix navigation to source tabs (`details`, `assessment`, `profile`). Carries `print:hidden` to protect exported PDFs.
- feat(admin): Phase 4 Admin Onboarding Progress column in `SurveyorsTab.tsx` with `getSurveyorOnboardingProgress` helper (`admin-progress.ts`, `useAdminData.ts`). Displays milestone badge (`0/5`, `3/5`, `Ready 5/5`) in table and full interactive milestone checklist in expanded surveyor row.
- tests: Added 11 new unit tests across `ReportSectionGuide.test.tsx`, `report-guide.test.ts`, `admin-progress.test.ts`, and `SurveyorsTab.test.tsx`. All 268 test files (2,393 tests) pass; TypeScript check 100% clean.
- Scan impact: None. Sibling repo `../SurveyOS Scan` is unaffected.

## 2026-11-04 (Antigravity) — User Onboarding Phase 2 (Tips, Help button, Dashboard tour)
- feat(onboarding): Phase 2A first-visit tips (`TabTip.tsx`, `tab-help.ts`) with digital garage PDF guidance on estimate and bill tabs, next-tab workflow navigation, and deep-merge safe acknowledgment tracking in `profile.onboarding.tipsSeen`.
- feat(onboarding): Phase 2B always-available Help button (`HelpDialog.tsx`) in sidebar footer and claim header, featuring screen-specific advice, 1-click setup guide replay, FAQ link, and direct surveyor support email.
- feat(onboarding): Phase 2C desktop Dashboard tour (`dashboard-tour.ts`) using lightweight `driver.js` (~5 KB gzipped, MIT, ₹0), highlighting New Claim, Open Saved, Claims Registry, and Profile. Guarded against mobile, reduced motion, and open dialogs.
- tests: Added 24 new unit tests across `tab-help.test.ts`, `TabTip.test.tsx`, `HelpDialog.test.tsx`, and `dashboard-tour.test.ts`. All 263 test files (2,376 tests) passing; type check clean.
- Scan impact: None.

## 2026-11-04 (Antigravity) — Live check guide & Phase 2C tour confirmation
- docs: Formulated structured verification checklist for the owner covering all Phase 0 and Phase 1 changes on the live site.
- design: Logged owner confirmation for Phase 2C (Dashboard Tour); planned implementation using `driver.js` (~5 KB, MIT licence, ₹0).
- Scan impact: None.

## 2026-11-04 (Antigravity) — Onboarding design review & digital PDF recommendation
- design: Incorporated owner's instruction to prompt surveyors for original digital PDFs from garages/workshops.
- ui/ux: Applied `ui-ux-pro-max` guidelines (Executive Platinum system alignment, slim ergonomic banner height, 44px touch targets, 4.5:1 contrast, no emojis).
- review: Executed `multi-agent-brainstorming` structured design review across Skeptic, Constraint Guardian, User Advocate, and Arbiter roles.
- Scan impact: None.

## 2026-11-04 (Antigravity) — User onboarding handover takeover & Phase 2 plan
- docs: Antigravity assumed responsibility for User Onboarding workstream from Claude Code. Read all handover briefs, design specs, and codebase files in `src/lib/onboarding` and `src/components/onboarding`.
- docs: Formulated Phase 2 implementation plan (first-visit tab tips in 2A, permanent Help button in 2B, tour inquiry for 2C) with cost/resource estimate (₹0 / 0 dependencies) and proposed tab copy.
- ops: Verified git working tree is on `main`; commit `11790138` (reinspection) verified already live and pushed.
- Scan impact: None.

## 2026-11-04 (Claude Code) — Reinspection remarks deployed, GitHub brought up to date
- ops: deployed `main` to motorsurveyos-in at 22:12 IST (hosting only); the reinspection chunk checked on both motorsurveyos-in.web.app and surveyos.in. 2358 tests pass, type check clean. Not browser-tested.
- ops: pushed `main` to GitHub `origin/main`. Older "not pushed" notes in `Tasks.md` no longer apply to anything committed up to this entry.
- Scan impact: none.

## 2026-11-04 (Antigravity) — Custom domain (surveyos.in) Google/Firebase sign-in operational
- ops(auth): Diagnosed and resolved authentication failures on newly mapped custom domain `https://surveyos.in`.
- ops(firebase): Authorized `surveyos.in` and `www.surveyos.in` in Firebase Authentication settings and Google Cloud OAuth 2.0 Web Client credentials.
- Verified: User sign-in and trial onboarding flows verified operational live by owner.
- Scan impact: None.

## 2026-11-04 (Antigravity) — Re-inspection conclusion & remarks default and editable field
- feat(reinspection): pre-filled standard surveyor conclusion in sentence case: "We have re-inspected the captioned vehicle and have found that the repairs / replacement made there were strictly followed as per our final survey report. The salvage of the replaced parts was also verified by me." (`DEFAULT_REINSPECTION_REMARKS` in `src/types/assessment.ts`).
- fix(reinspection): `observations` is no longer merely a placeholder that disappears and forces retyping. It is pre-populated in `createBlankClaim()` and seeded into existing claims on opening `ReinspectionTab` if blank, rendering as actual editable text.
- feat(reinspection): added "Reset to default" button in `ReinspectionTab.tsx` so surveyors can instantly revert customized remarks back to the standard text.
- fix(reports): `reinspection-report-builder.ts` falls back to `DEFAULT_REINSPECTION_REMARKS` when `observations` is empty, ensuring printable Re-inspection reports always include surveyor verification.
- tests: Added test coverage in `src/lib/reports/__tests__/reinspection-report.test.ts` for default vs overridden observations. All 2358 tests pass. Next.js production build clean.
- Scan impact: None (Prime-only field; no Scan coupling points or manifest touched).

## 2026-11-04 (Claude Code) — User onboarding, Phases 0 and 1
- feat(onboarding): once-only welcome, 3-step profile setup (report details, signature and stamp, AI key with a test button), and a self-ticking Getting Started checklist on the Dashboard. Progress is on `profile.onboarding`, carried by the existing profile sync. "Show setup guide" on Profile replays it.
- fix(onboarding): disabled tabs say why; AI key headings explain themselves with provider names still hidden; better empty state; New claim explains Spot and Final; Report Center warns when name, licence, signature or stamp are missing.
- fix: "Open saved" and the sidebar folder button did nothing (`isClaimsListOpen` had no reader). They now scroll to the claims table. `openClaim` extracted to `lib/claims/open-claim.ts`.
- Blank name prefilled from the Google name and licence from `irdaiLicence` after sync, so reports stop printing "SURVEYOR NAME".
- Checklist limit: "Check what was read" and "See your first report" tick on opening those screens; the app does not record review or report generation.
- Stack/cost: none. No new dependency, no AI calls except the optional key test, one small field on the profile doc.
- Not browser-tested (needs login). Deployed 2026-11-04 to motorsurveyos-in (hosting only, live chunk checked). Not pushed.
- Scan impact: none (no doc types, insurer table, folder layout, field labels, claim paths or manifest touched; Scan's drift tests not run).

## 2026-11-04 (Claude Code) — Simple documents try Gemma first
- fix(ai): `light` job (RC, DL, policy and other non-estimate documents) now ranks Gemma, then Flash-Lite, then Flash (`LIGHT_TIER` in `lib/ai/rank.ts`). Gemma on Google (direct, 14 400/day) goes before Ollama Gemma (via `aiProxy`). `heavy` and `text` order unchanged. With no Gemma reachable the order is as before.
- fix(ai): after the parser reads an estimate or bill, the header call runs as `light`, not `heavy`, so it no longer spends Flash (20/day).
- Finding, no code: the sandbox site has no extra parsing to port. `src/lib/ai` is identical between its build (2026-11-01 23:36) and live, and both serve the same parser chunk. The `sandbox` preview channel (2026-10-30, expires 2026-11-06) is older and has no parser.
- Stack/cost: no new provider, no extra calls per document. Gemma has not been benched on RC/DL (the bench reads estimates only). Google Gemma has not been tried with JSON mode; a rejection hops to the next model.
- Not browser-tested. Deployed 2026-11-04 to motorsurveyos-in (live chunk checked).
- Scan impact: none (model choice is Prime-only; no coupling file touched).

## 2026-11-03 (Claude Code) — Bill Check: match score and review of doubtful matches
- fix(bill-check): matcher (`matchBillItemsToRows`) now scores every estimate row against every bill line, 0–100 with reasons (`lib/reports/bill-match-score.ts`), best pairs first. Was: row-by-row passes where an amount-only match, LH vs RH, or front vs rear came out "clean".
  - LH/RH, front/rear, upper/lower, inner/outer clashes cap the score below "sure". Short names no longer fully match longer ones (Dice, not overlap-of-smaller). "Assy" ignored.
  - Bands: ≥85 sure, 40–84 check (`refStatus: 'ambiguous'`), <40 not matched (goes to unmatched bill items). A runner-up within 10 points also makes it "check".
  - Row keeps `refMatch` (bill line snapshot + score + reasons). "Ambiguous match — please verify" is no longer written into `billRemarks`.
- feat(bill-check): the amber "?" card for a doubtful match shows estimate row and bill line side by side, clashing words in red, score and reasons, next-best unmatched lines with "Use this", and "Right line" / "Wrong line — unlink". Prev/Next steps through flagged rows. Link list in unmatched items is ranked by score.
  - `linkExtraBillItem` sets refSrNo + `refStatus: 'manual'` and returns the row's previous line to unmatched; new `unlinkBillMatch`.
  - Doubtful matches stay amber (never block print), per the banner's existing rule; the match flag shows before the price flag.
- Stack/cost: none. Plain code, no AI calls. 400×400 match ≈ 0.35 s.
- Not browser-tested (needs login + real claim). Not deployed.
- Scan impact: none (bill matching is Prime-only; no coupling file touched).

## 2026-11-03 (Claude Code) — Past prices for a part (assessment grid)
- feat(assessment): clock icon next to each row's part name (shows on hover, like the Evidence icon). Click opens a popup with the surveyor's own past claims for the same part on the same make/model: date, workshop, estimate, assessed (or "Disallowed"), newest first, 5 at a time. Click a line to open that claim (current claim saved first). Esc / click outside closes.
- Matching (`lib/claims/part-history.ts`): OEM part number when both rows have one, else a part-name key (case, word order, punctuation, F/Frt/R/Rr, "assy" ignored). Variant and year ignored. Read-only: never flags, never writes a figure.
- Stack/cost: none. Reads IndexedDB claims already on the device; no server, AI or Firestore reads.
- Not browser-tested (grid needs login + real claims). Deployed 2026-11-03 to motorsurveyos-in (live chunk checked).
- Scan impact: none (reads Prime claim data only; no coupling file touched).

## 2026-11-02 (Antigravity) — SurveyOS Scan Play Store Launch Playbook & Marketing Video Strategy
- docs(marketing): Added comprehensive blueprint and strategy in `docs/marketing/2026-11-02-surveyos-scan-marketing-video-plan.md`.
  - Full Google Play Store launch process for SurveyOS Scan (`in.surveyos.scan`): developer accounts, AdMob release guards, upload signing keys, `ad_free` IAP product, privacy policy hosting, and 14-day Closed Testing requirements.
  - Up-to-date Scan feature dossier: WhatsApp/Email document chasing in EN/HI/MR, document rejection states with reasons, "Waiting for" filter chip, Drive text/full sync with Prime, mobile fee bill notes & rate memory, geo-stamped damage photos.
  - 5-Act problem-first marketing video narrative structure (Current chaos -> Core bottleneck -> Prominent SurveyOS brand reveal -> Step-by-step transformation -> Life after SurveyOS & CTA).
- docs(vault): Session log `Sessions/2026-11-02-scan-launch-and-marketing-video.md` and `Tasks.md` updated for handoff.
- Scan impact: None to Scan code.

## 2026-11-01 (Claude Code) — Plan 4 final fixes (status time, reconcile, cleanup lookup)
- fix(drive): Scan's status file gains `statusAt` (Prime-only, written with `status` on Mark completed / Reopen). `ClaimData.statusChangedAt` stores that time. On claim open, `syncScanStatus` rewrites `status`/`statusAt` when the file disagrees with the claim (`reconcileCompletion`): repairs an offline write or one lost to a concurrent Scan merge; a newer `statusAt` in the file is left alone.
- Reopen clears `driveTrashedAt` (`completionPatch`), so a re-completed claim shows in Drive cleanup again.
- Cleanup lookup is read-only: `findRootFolder` (find, never create) and Phone Scans resolved once for all claims.
- Scan impact: Scan reads `statusAt` (newer than its own Done/Reopen and its restored marker wins); contract `SurveyOS Scan/docs/handover/scan-drive-status.md` updated in the same wave.

## 2026-11-01 (Claude Code) — Drive cleanup (Plan 4 Task 4)
- feat(drive): Profile tab, "Drive cleanup" (`components/profile/DriveCleanupSection.tsx`, shown when Drive is linked). Lists completed claims (`completedAt`, not yet trashed) by year then month, newest first, with vehicle, insurer, and Prime folder (Drive index) / Scan folder (by `scanClaimId`) each "found" or "not on Drive". Tick a claim or a year; two confirmations (dialog, then type the number of claims); then `trashed=true` PATCH on each folder (`lib/drive/cleanup.ts`, never DELETE).
- `ClaimData.driveTrashedAt` (ISO) set on success; the claim stays in Prime and drops off the list. Nothing local is deleted.
- Scan impact: none. Scan folders are trashed on Drive (recoverable ~30 days); Scan's local copy and Drive copy rules are unchanged.

## 2026-11-01 (Claude Code) — Import phone scans from Drive (Plan 4 Task 2)
- feat(scan-import): "Import from Drive" (Documents tab, shown when Drive is connected) imports the claim's SurveyOS Scan folder (`SurveyOS/Phone Scans/<folder>`, Scan's Full mode) like a zip, then moves each file into Prime's claim folder (`moveFile`: PATCH addParents/removeParents, same file id). Contract: `SurveyOS Scan/docs/handover/scan-drive-status.md`.
  - `import.ts`: core is `importScanFiles(Map<path, Blob>)`; the zip path builds the map as before. A Drive source skips manifest files already moved ("nothing new" when none are left); a single-file type with moved pages is rewritten whole from the claim's own copies.
  - `drive-source.ts`: folder by `scanClaimId`, else by manifest vehicle (the surveyor picks when several match); newest same-name file wins; bytes must match the manifest `sha256` or the file waits for the next import.
  - `ClaimDocument.driveFileId`: set on imported files; `isOnDrive` stops the estimate and phone-photo paths from uploading them again. A failed move keeps the document ("Saved, but couldn't move on Drive") and is retried on the next import.

## 2026-11-01 (Claude Code) — Shipped model defaults refreshed
- fix(ai): built-in backup list and defaults moved to live-checked models: Gemini `gemini-3.5-flash-lite` (pinned), `gemini-3.1-flash-lite`, `gemini-3.5-flash`; Groq `qwen/qwen3.8-27b` (vision), `openai/gpt-oss-120b` (text); NVIDIA `nvidia/nemotron-3.5-super-vl-120b-a12b`. Saved profiles using now-dead ids (gemini-2.5-flash, qwen3.6, llama-3.3-70b, llama-3.1-8b) migrate. Commit `b4bc3469`. Not deployed.
- Finding: the Admin probe (manual, ~20–30 min) last ran 2026-10-28 from the owner's account. NVIDIA was skipped ("No admin key for this provider"), so its results date from 2026-08-11 and include models that now 404/410. Ollama's probe failed (key rejected during rollout), so Ollama uses the backup list.
- Scan impact: none.

## 2026-11-01 (Claude Code) — Scan Drive status sync
- feat(drive): Prime reads and writes SurveyOS Scan's `_surveyos-status.json` in `SurveyOS/Phone Scans/<folder>/` (folder found by `appProperties.claimId`, oldest first). Contract: `SurveyOS Scan/docs/handover/scan-drive-status.md`.
  - `scan-status.ts`: codec + merge ported from Scan's `StatusFile.kt` (newest `at` wins per slot/contact field, ties keep local, asks union by at+to, `status` from remote only, whole-second IST times).
  - On claim open: `scanChase` (slots, contacts, asks) refreshed from the file, unless a later manifest import is fresher.
  - On a document upload into a claim with `scanClaimId`: slot `<DocType>` = `{state:"received", by:"prime", at}` merged and written (PATCH in place, else create).
  - No token, no folder or a network error: nothing happens, one console warning per session, no toast. Prime never writes `status: "completed"` yet (Plan 4).
  - `driveRequest` and `findFolder` in `src/lib/drive/index.ts` are now exported.
- Not pushed, not deployed. Session log `Sessions/2026-11-01-scan-drive-status.md`.
- Scan impact: none to Scan code; Prime now follows the existing contract `scan-drive-status.md`. A change to Scan's `StatusFile` merge rules needs the same change in `scan-status.ts`.

## 2026-11-01 (Claude Code) — Parser reads Maruti and Tata
- feat(ai): `row-parser.ts` now reads Maruti estimates and final bills, and Tata DTC / INTRA / Consolidated invoices.
  - Total labels "Net Estimate Amounts", "Net Bill Amount", "Gross Amount"; serial heading "Srl.".
  - Maruti rows that print no tax rate: the one GST rate whose with-tax subtotal is printed is applied; otherwise the rows are taken as tax-inclusive (rate left blank, app default 18%).
  - Tata headings over several lines: amount columns found by where the amounts right-align, named by the heading words above (fallback reading, only after the normal one declines).
  - Quantities like "2.000" were read as 1; fixed.
- Real-PDF check: all 23 sample PDFs (owner's 18 + 5 new) read with 0 calls, every gross = printed total. Deployed to the sandbox (hosting `surveyos-v2-antigravity-in` + `aiProxy`); not prod, not pushed.
- Scan impact: none.

## 2026-11-01 (Claude Code) — Scan chase import and Ask for documents
- feat(scan-import): `planChase` (`src/lib/scan-import/chase.ts`) reads the manifest `chase` object. It fills blank insured name/mobile and workshop name/phone/email only (Prime's value wins), stores `scanChase` and `scanClaimId`, and refuses a zip from a different phone claim.
- feat(chase): `src/lib/chase/ask-message.ts` ports Scan's EN/HI/MR ask templates. `ASK_COPY` is exported and pinned by Scan's `AskTemplatesTest`.
- feat(documents): "Ask for documents" dialog on the Documents tab (WhatsApp or email). Logs each ask to `scanChase.asks` in the manifest shape.
- Commits `155e618c`, `a46ee91b`, `7fbd16aa`, `8dc3b150`, `77bd5faa`. Not pushed, not deployed. Session log `Sessions/2026-11-01-prime-chase-import.md`.
- Scan impact: Scan's contract doc `docs/handover/scan-manifest-chase.md` has a matching changelog line. Changing the ASK_COPY strings needs a Scan change too.

## 2026-11-01 (Claude Code) — Parser-first extraction for digital estimates and bills
- feat(ai): `row-parser.ts` reads estimate/final-bill rows from pdf.js text positions with **no AI call**, and accepts them only when every section ties to a labelled subtotal (₹1) and the grand total ties; otherwise the AI path runs unchanged.
  - Merged PDFs (a second estimate after the first grand total) always decline.
  - A bare Tax figure is used only when it implies a standard GST rate.
- feat(ai): one small header-only AI call (page 1 + last page) fills the header fields. `source: 'parser' | 'ai'` lives on `ExtractionResult` only; the review dialog notes "Read from the PDF text — totals match".
- feat(bench): `/bench` has a "Row parser (no AI)" method.
- Real-PDF check (owner's 18 PDFs): 9 read with 0 calls, 0 accepted wrongly. Maruti and Tata layouts decline to AI for now.
- Commits `b8a18753..c17346e3` (spec, plan, 15 code commits). Not pushed, not deployed. Session log `Sessions/2026-11-01-parser-first-extraction.md`.

## 2026-10-31 (Claude Code) — Extraction bench, page-order fix, per-page text/image
- fix(ai): gap-filled rows keep page order (`orderByPage`). This was the cause of page 2's rows showing before page 1's.
- feat(ai): digital PDF text keeps lines and columns; text or image is decided per page; grouping by model limits from `page-limits.ts` (empty, so no change yet).
- feat(bench): sandbox-only `/bench`: call meter, per-call pacer, scoring, agreement, IndexedDB v8 store, step-up runner, limits export.
- fix(sandbox): `?sandbox=true` is ignored on `motorsurveyos-in.*`.
- Commits `78ea329e..c8f01875`; 2125 tests pass. Not deployed or pushed. Session log `Sessions/2026-10-31-extraction-bench.md`.

## 2026-10-31 (Antigravity) — Comprehensive Handover to Claude Code
- docs(kb): **Comprehensive Handover Document & Knowledge Base Synchronization** (`HANDOVER.md`, `Tasks.md`, `Sessions/2026-10-31-handover-to-claude.md`).
  - Documented all 7 workstreams completed between 2026-10-27 and 2026-10-31.
  - Recorded active investigation on auto-split multi-page row ordering (Page 2 appearing before Page 1 during individual chunk fallback on dense multi-page PDFs with Ollama `gemma4:31b`).
  - Synced git status, test status (227 Vitest test suites, 1,999 tests passing, `tsc` clean), and deployment status across production (`motorsurveyos-in.web.app`), dedicated sandbox (`surveyos-v2-antigravity-in.web.app`), and Cloud Functions in `asia-south1`.

## 2026-10-30 (Antigravity) — Anonymous Firebase Auth & BYOK Proxy Exemption for Sandbox
- feat(ai): **BYOK Proxy Access for Anonymous Sandbox Sessions** (`functions/index.js`, `src/lib/sandbox.ts`).
  - Added anonymous caller exemption in Cloud Functions `aiProxy` and `nvidiaProxy`: anonymous sessions bringing their own API key (BYOK) are permitted without requiring an active paid subscription record in Firestore.
  - In `initSandboxSession()` (`src/lib/sandbox.ts`): calls `signInAnonymously(auth)` in the background so the browser obtains a genuine Firebase Auth ID token automatically without any Google login prompt or account popup.
  - Enables all AI providers (Ollama `gemma4:31b`, NVIDIA NIM, Gemini, Groq) to work seamlessly in the sandbox testing environment.
  - Deployed `aiProxy` and `nvidiaProxy` to `asia-south1`; re-deployed sandbox hosting builds.

## 2026-10-30 (Antigravity) — Zero-Login Sandbox & OAuth Bypass for Multi-Estimate Testing
- feat(sandbox): **Zero-Login Bypass for Sandbox Environments** (`src/lib/sandbox.ts`, `src/hooks/useAuth.ts`, `src/app/page.tsx`, `src/components/layout/SubscriptionGuard.tsx`, `src/components/auth/AuthGate.tsx`, `src/hooks/useRouteSync.ts`).
  - Implemented `isSandbox()` to auto-detect preview/sandbox URLs (`motorsurveyos-in--sandbox-*.web.app`, `surveyos-v2-antigravity-in.web.app`, or `?sandbox=true`).
  - Implemented `initSandboxSession()`: seeds virtual surveyor session (`sandbox-surveyor`), sets Google Drive connected with mock email, marks profile subscription active & compliant with legal consent, seeds/persists isolated working claim (`SANDBOX-TEST-01`, `MH-12-AB-1234`, Pawar Brothers), and drops the surveyor directly into the live **Assessment Tab**.
  - Bypasses landing page, drive gate, and subscription guards.
- fix(auth): **Eliminated Google OAuth Origin Mismatch (`Error 400: origin_mismatch`)** (`src/lib/drive/index.ts`, `src/hooks/useCloudSync.ts`, `src/hooks/useSessionHeartbeat.ts`, `src/lib/firebase/auth.ts`, `src/components/layout/ClaimHeader.tsx`).
  - Guarded `silentlyRestoreDriveToken()` and `linkGoogleDrive()` in `src/lib/drive/index.ts` to skip GIS `google.accounts.oauth2.initTokenClient` calls when in sandbox mode.
  - Guarded `useCloudSync()` and `useSessionHeartbeat()` to avoid background Firestore sync or Drive token requests during sandbox sessions.
  - Guarded `signInWithGoogle()` and `signOutUser()` in `src/lib/firebase/auth.ts` to seamlessly initialize sandbox sessions without triggering Firebase Google OAuth popups.
  - Added sandbox visual indicator in `ClaimHeader.tsx`: `SANDBOX (NO LOGIN REQUIRED)` badge; made Save button save locally without cloud sync errors.
- ops(deploy): **Deployed to Sandbox Channels** (`motorsurveyos-in--sandbox-izvlcn5z.web.app` and `surveyos-v2-antigravity-in.web.app`).
  - Production (`motorsurveyos-in.web.app`) remains untouched.

## 2026-10-30 (Antigravity) — Multi-Estimate Mode, Start Gap Detection & Auto-Split Fallback (Sandbox)
- feat(assessment): **"Another Estimate (Estimate 2, 3...)" Mode** (`src/components/dialogs/EstimateModeDialog.tsx`, `src/stores/slices/aiDataSlice.ts`).
  - Added 4th option in `EstimateModeDialog` when an existing assessment is on the sheet: "Another estimate (Estimate 2, 3...)".
  - In `applyEstimate`: keeps all existing rows intact, preserves printed document serial numbers (`1..N`), and tags new rows with a distinct `estimateId` (e.g. `Quote 2`). Existing rows are tagged as `Quote 1` if previously untagged, enabling instant lens switching via `EstimateViewSwitcher`.
  - Added unit test suite in `src/stores/slices/__tests__/aiDataSlice.test.ts`.
- feat(ai): **Start-of-Document Gap Detection** (`src/lib/ai/row-check.ts`, `src/lib/ai/__tests__/row-check.test.ts`).
  - Updated `gapsIn` to detect missing opening serials when the first extracted item starts at `sr > 1`.
  - Missing serials `1..present[0].sr-1` are flagged and attributed to candidate pages `0..minPage`, triggering Smart Fix gap fill and surfacing to the surveyor.
  - Added unit test in `src/lib/ai/__tests__/row-check.test.ts`.
- feat(ai): **In-Flight Auto-Split Fallback on JSON Parse Failures** (`src/lib/ai/processor.ts`).
  - When a multi-page chunk (2 pages) fails `JSON.parse` (due to dense 70+ item pages truncating JSON output tokens), `mergeResponse` auto-splits the chunk and calls each page individually.
  - Recovers dense pages without dropping items or requiring surveyor intervention.
- ops(deploy): **Isolated Firebase Hosting Sandbox Deploy** (`firebase.json`, `npx firebase deploy --only hosting:surveyos-v2-antigravity-in`).
  - Added multi-site hosting definition in `firebase.json` for secondary site `surveyos-v2-antigravity-in`.
  - Deployed sandbox build to: `https://surveyos-v2-antigravity-in.web.app`.
  - Solves the `Error 400: origin_mismatch` caused by dynamic preview channels: `surveyos-v2-antigravity-in.web.app` is pre-registered as an Authorized Domain and JavaScript Origin in Google Cloud Console OAuth 2.0.
  - Live production site (`https://motorsurveyos-in.web.app`) remains 100% untouched.

## 2026-10-30 (Antigravity) — Revert Over-engineered Estimate/Bill Extraction Prompts
- revert(ai): **Restored Battle-Tested Estimate & Final Bill Prompts** (`src/lib/ai/prompts.ts`, `src/lib/ai/__tests__/prompts-estimate.test.ts`).
  - Reverted experimental footer-first deduction rule, top-level `_audit` envelope, and extra per-row fields that had caused token limit blowouts and unparseable truncated JSON on dense bills (e.g. Pawar quotation pages 1–2).
  - Restored clean, direct row extraction into `spare_parts`, `labour_items`, and `painting_items` with standard fields (`sr_no`, `description`, `part_number`, `hsn_sac`, `taxable_amount`, `cgst_amount`, `sgst_amount`, `total_amount`, `gst_percent`, `category`).
  - All 227 test files (1,997 tests) passing; `next build` static export clean; deployed live to Firebase Hosting.

## 2026-10-30 (Antigravity) — Scan Fee Bill Notes & Unified Inspection Date/Time
- feat(store): **Store-Level Bi-Directional Sync for Shared Inspection Metadata** (`src/stores/slices/claimSlice.ts`, `src/stores/slices/vehicleSlice.ts`).
  - Added two-way state synchronization between `accident.dateOfSurvey` & `accident.timeOfSurvey`, `spotDetails.surveyDatetime`, and `valuationDetails.inspectionDate`.
  - Added two-way state synchronization between `accident.placeOfSurvey`, `spotDetails.placeOfSurvey`, and `valuationDetails.inspectionPlace`.
  - Added two-way state synchronization between `accident.dateOfAllotment` and `valuationDetails.allotmentDate`, and `accident.dateOfReport` and `valuationDetails.reportDate`.
  - Added two-way state synchronization between `spotDetails.enclosures` and `valuationDetails.enclosures`.
  - Added unit test suite in `src/stores/slices/__tests__/inspection-fields-unification.test.ts` (22 tests).
- feat(ui): **Valuation Tab Datetime Upgrade & Report Fallbacks** (`src/components/tabs/ValuationTab.tsx`, `src/components/claim/SurveyForm.tsx`, `src/lib/reports/valuation-report-builder.ts`, `src/lib/reports/spot-fee-bill-builder.ts`).
  - Upgraded Valuation Inspection Date input to `type="datetime-local"` labeled "Date & Time of Inspection".
  - Wired robust cross-fallbacks for inspection date, place, odometer, and enclosures in Valuation Report builder and Spot Fee Bill builder.
  - Added unit test suite in `src/lib/reports/__tests__/valuation-report-fallbacks.test.ts` (4 tests).
- feat(scan-import): **Handover Contract & Fee Bill Notes Import** (`SurveyOS Scan/docs/handover/prime-notes-import.md`, `src/lib/scan-import/notes.ts`).
  - Added specification for 16 `feeBill.*` fields and `Fee Bill Notes.txt` format.
  - Allow-listed 16 `feeBill.*` paths, added boolean/number parsing, and auto-backfilled survey datetime/place across Spot, Final, and Valuation claim state.
  - Added unit tests in `src/lib/scan-import/__tests__/notes.test.ts` (16 tests).
- feat(scan-android): **SurveyOS Scan: Valuation Datetime & Cross-Section Draft Sync** (`ValuationFields.kt`, `ValuationExport.kt`, `NotesViewModel.kt`, `ValuationNotes.kt`).
  - Upgraded Valuation inspection date control to `NoteControl.DATE_TIME` ("Date & Time of Inspection").
  - Implemented `SHARED_SYNC_MAP` cross-section draft sync in Room SQLite for date/time, place, odometer, and enclosures.
  - Added unit tests in `ValuationFieldsTest.kt` and `ValuationExportTest.kt`.
- feat(scan-android): **SurveyOS Scan: Fee Bill Fields, Sticky Rates, and Export** (`FeeBillFields.kt`, `FeeRatesStore.kt`, `FeeBillExport.kt`, `NotesExport.kt`, `ValuationExport.kt`, `Exporter.kt`, `SafExport.kt`, `Repository.kt`).
  - Defined 16 fee billing fields across 6 sections (`BILL`, `FEES`, `TRAVEL`, `PHOTOS`, `EXPENSES`, `TAX`) plus calculation helpers.
  - Implemented sticky rate preferences (`ratePerKm: "10"`, `photoRate: "15"`, `includeGST: "yes"`) via SharedPreferences.
  - Exported `Fee Bill Notes.txt` and `notes.feeBill` snapshot in `_surveyos-scan.json`.
  - Added unit tests in `FeeBillFieldsTest.kt`, `FeeBillExportTest.kt`, and `NotesExportTest.kt`.
- feat(scan-android): **SurveyOS Scan: Fee Bill Notes UI & Live Calculations** (`FeeBillNotes.kt`, `NoteFields.kt`, `NotesTab.kt`, `ClaimScreen.kt`).
  - Added 3-way chips (`Spot`, `Valuation`, `Fee Bill`) with horizontal scrolling.
  - Built `FeeBillNotes.kt` screen with live calculation cards (`TravelLiveCard`, `PhotosLiveCard`, `TaxLiveCard`), photo count suggestion chip, and guarded sticky rate persistence.
- tests: Full test suites passing in both projects: Prime Vitest (227 files, 1,998 tests) and Scan Gradle (`:app:testDebugUnitTest`, 337 tests); `npx tsc --noEmit` clean (0 errors); 100% coupling verified.

## 2026-10-30 (Antigravity) — Unify Goods Nature/Description, HPA/Financier, and Valuation Odometer
- feat(store): **Bi-Directional Store Sync for Goods, HPA, and Odometer** (`src/stores/slices/claimSlice.ts`, `src/stores/slices/vehicleSlice.ts`).
  - Added two-way state synchronization between `spotDetails.loadDesc` and `vehicle.natureOfGoods` / `vehicle.detailsOfGoodsCarried`.
  - Added two-way state synchronization between `policy.hpaWith` and `vehicle.hypothecation` / `vehicle.rcEndorsement`.
  - Added two-way state synchronization between `vehicle.odometer` and `valuationDetails.odometer`.
  - Added unit test suite in `src/stores/slices/__tests__/goods-hpa-odometer-sync.test.ts` (8 tests).
- fix(claim): **Form Consolidation & Fallbacks across Claims and Valuation** (`src/components/claim/AtAccidentForm.tsx`, `src/components/claim/PolicyForm.tsx`, `src/components/claim/VehicleForm.tsx`, `src/components/claim/SurveyForm.tsx`, `src/components/tabs/ValuationTab.tsx`).
  - Replaced separate "Nature of Goods" and "Description of Goods" inputs in `AtAccidentForm.tsx` with a single unified input: "Nature / Description of Goods" (`c-goods`).
  - Wired cross-fallbacks for HPA / Financier across `PolicyForm.tsx` and `VehicleForm.tsx`.
  - Wired cross-fallbacks for Odometer across `SurveyForm.tsx` and `ValuationTab.tsx`.
  - Added unit tests in `src/components/claim/__tests__/AtAccidentForm.test.tsx` and `src/components/claim/__tests__/HpaAndOdometerFormSync.test.tsx` (16 tests).
- feat(ai): **AI Extraction Alignment for HPA, Goods, and Odometer** (`src/stores/slices/aiDataSlice.ts`).
  - `applyRC`: sets `vehicle.hypothecation`, `vehicle.rcEndorsement`, `policy.hpaWith`, and synchronizes odometer to both `vehicle` and `valuationDetails`.
  - `applyPolicy`: propagates `hpa_with` to `policy.hpaWith`, `vehicle.hypothecation`, and `vehicle.rcEndorsement`.
  - `applyLokChallan`: synchronizes `data.goods_description` across `spotDetails.loadDesc`, `vehicle.natureOfGoods`, and `vehicle.detailsOfGoodsCarried`.
  - Added unit tests in `src/stores/slices/__tests__/aiDataSlice.test.ts`.
- fix(reports): **Robust Cross-Fallbacks in Report Builders** (`src/components/print/SpotPrintReport.tsx`, `src/lib/reports/standard-report-builder.ts`, `src/lib/reports/uiic-final-builder.ts`, `src/components/print/UIICPrintReport.tsx`, `src/lib/reports/valuation-report-builder.ts`).
  - Spot Report & Standard Final Report fall back across `spotDetails.loadDesc`, `vehicle.natureOfGoods`, and `vehicle.detailsOfGoodsCarried`.
  - HPA / Financier falls back across `policy.hpaWith`, `vehicle.hypothecation`, and `vehicle.rcEndorsement` in Spot, Standard, UIIC Final, and UIIC Print.
  - Valuation Report builder falls back to `vehicle.odometer` when `valuationDetails.odometer` is blank.
  - Added unit tests in `src/lib/reports/__tests__/tp-and-load-challan.test.ts` (23 tests).
- tests: Full test suite passing (226 files, 1,987 tests); `npx tsc --noEmit` clean (0 errors); zero drift on SurveyOS Scan coupling.

## 2026-10-29 (Antigravity) — Unify GVW, ULW, and Accident Load
- feat(store): **Store-Level Bi-Directional Synchronization** (`src/stores/slices/vehicleSlice.ts`, `src/stores/slices/claimSlice.ts`).
  - Added two-way state synchronization between `vehicle.registeredLoadWeight`/`vehicle.grossWeight`/`vehicle.unladenWeight` and `spotDetails.gvw`/`spotDetails.ulw`/`spotDetails.loadCapacity`.
  - Automatically calculates Legal Load Capacity (`(gvw > ulw && ulw > 0) ? gvw - ulw : (gvw || 0)`) whenever either weight changes in either slice.
  - Synchronizes `spotDetails.actualLoad` (number) and `vehicle.goodsWeightAtAccident` / `vehicle.actualPayload` (string).
  - Added unit test suite in `src/stores/slices/__tests__/weights-and-load-unification.test.ts` (11 tests).
- fix(claim): **Deduplicate Accident Load in AtAccidentForm** (`src/components/claim/AtAccidentForm.tsx`).
  - Removed redundant "Goods Weight at Accident" input (`v-goods-weight`), leaving a single authoritative "Load at Accident (KG)" input (`c-actual-load`).
  - Synchronizes changes to both `spotDetails.actualLoad` and `vehicle.goodsWeightAtAccident`/`vehicle.actualPayload`.
  - Added unit tests in `src/components/claim/__tests__/AtAccidentForm.test.tsx` (4 tests).
- feat(claim): **Cross-Tab Weight Reflection** (`src/components/tabs/SpotTab.tsx`, `src/components/claim/VehicleForm.tsx`).
  - `SpotTab` Load Capacity card now displays fallback values from `vehicle.registeredLoadWeight` and `vehicle.unladenWeight` and automatically computes payload capacity.
  - Updates in `SpotTab` synchronize back to `vehicle` and vice versa.
  - Added unit tests in `src/components/tabs/__tests__/SpotTabWeights.test.tsx` (7 tests).
- fix(reports): **Robust Cross-Fallbacks Across All Report Builders** (`src/components/print/SpotPrintReport.tsx`, `src/lib/reports/standard-report-builder.ts`, `src/lib/reports/uiic-final-builder.ts`, `src/components/print/UIICPrintReport.tsx`).
  - Spot Report Section C and Section E now cross-fallback across `spotDetails` and `vehicle` for GVW, ULW, legal capacity, and actual load.
  - Standard Final Report Section 2 and Section 5 cross-fallback to `spotDetails.gvw` and `vehicle.goodsWeightAtAccident`.
  - UIIC Final and UIIC Print reports cross-fallback across `registeredLoadWeight`, `grossWeight`, and `spotDetails.gvw`.
  - Added test cases in `src/lib/reports/__tests__/tp-and-load-challan.test.ts` and `src/components/print/__tests__/spot-report-sections.test.tsx`.
- feat(ai): **AI Document Extraction Alignment** (`src/stores/slices/aiDataSlice.ts`).
  - `applyRC`, `applyFitness`, and `applyLokChallan` now uniformly populate both `vehicle.*` and `spotDetails.*` pairs.
  - Added unit tests in `src/stores/slices/__tests__/aiDataSlice.test.ts`.
- tests: Full test suite passing (223 files, 1,937 tests); `npx tsc --noEmit` clean (0 errors); zero drift on SurveyOS Scan coupling.

## 2026-10-29 (Antigravity) — Fix Browser Storage Exhaustion & Memory Cleaner
- fix(photos): **Default Photo Compression to JPEG 0.85** (`src/lib/photos/compress-image.ts`, `src/hooks/usePhotoUpload.ts`).
  - Switched default canvas export format from lossless `image/png` to high-quality `image/jpeg` with quality `0.85`.
  - Drops base64 payload size from ~1.6 MB down to ~40 KB per photo (~95% reduction), eliminating rapid IndexedDB quota exhaustion when importing 20–30 claim photos.
  - Added unit test in `src/lib/photos/__tests__/compress-image-jpeg.test.ts`.
- fix(drive): **Guard Drive Queue Against Unlinked Accumulation** (`src/lib/drive/index.ts`, `src/hooks/usePhotoUpload.ts`).
  - Prevents `uploadFileToDrive` and `usePhotoUpload` from dumping uncompressed raw camera blobs into IndexedDB `driveQueue` (which accumulated up to 500 MB) when Google Drive is disconnected or never linked.
  - Added unit test in `src/lib/drive/__tests__/unlinked-queue-guard.test.ts`.
- feat(storage): **Storage Usage Summary & Queue Pruning** (`src/lib/storage/indexeddb.ts`).
  - Added `StorageSummary` interface and exported `getStorageUsageSummary()`, `clearDriveQueue()`, and `clearRecoveredClaims()`.
  - Added unit tests in `src/lib/storage/__tests__/prune-storage.test.ts` verifying counts and byte aggregation.
- feat(profile): **Storage & Memory Cleaner Section & Modular Profile** (`src/components/profile/StorageCleanerSection.tsx`, `src/components/profile/SubscriptionSection.tsx`, `src/components/tabs/ProfileTab.tsx`).
  - Added live storage metrics card in Profile Settings displaying active claims, pending Drive queue size (MB), and recovery snapshots.
  - Added 1-click "Clean Up Storage" button with toast notification to immediately flush stuck queues and restore Chrome quota without deleting saved claims.
  - Factored out `SubscriptionSection.tsx` (217 lines), shrinking `ProfileTab.tsx` from 950 lines down to 729 lines (strict ≤ 800 line rule compliance).
  - Added unit tests in `src/components/profile/__tests__/StorageCleanerSection.test.tsx`.
- tests: All 220 test files (1,906 tests) passing; `tsc --noEmit` clean; zero impact on SurveyOS Scan coupling.

## 2026-10-28 (Antigravity) — Unify Survey Date & Time in Claim Details
- fix(claim): **Unified Survey Date & Time Input** (`src/components/claim/SurveyForm.tsx`).
  - Replaced separate "Date of Survey" and "Time of Survey" inputs (and the duplicate spot-only "Survey Datetime (Actual)") with a single unified `datetime-local` input labeled **"Date & Time of Survey"**.
  - Synchronizes changes to both `accident.dateOfSurvey` / `accident.timeOfSurvey` (used by Final reports) and `spotDetails.surveyDatetime` (used by Spot reports and Scan coupling).
  - Eliminates data entry discrepancies where one field was filled while the other remained empty or default.
- fix(print): **Spot Print Report Dual Fallback** (`src/components/print/SpotPrintReport.tsx`).
  - Line 172 (Header table) and Line 346 (Section C table) now both cross-fallback between `spotDetails.surveyDatetime` and `accident.dateOfSurvey` + `accident.timeOfSurvey`.
  - Guarantees both print locations show matching, non-blank values regardless of whether the claim was populated via Spot flow, Final flow, or mobile Scan.
- fix(lib): `claimSurveyDate` (`src/lib/claims/survey-date.ts`) falls back to `accident.dateOfSurvey` for spot claims if `spotDetails.surveyDatetime` is empty.
- tests: Added `src/components/claim/__tests__/SurveyForm.test.tsx` verifying single unified input on both Final and Spot claims, and updated `src/lib/claims/__tests__/survey-date.test.ts`. All 216 test files (1,894 tests) passing.
- Scan impact: None — Spot schema fields preserved with bidirectional syncing; Scan Android unit tests passing (`./gradlew :app:testDebugUnitTest`).

## 2026-10-28 (Antigravity) — Estimate View Lenses, Prompt Overhaul & Lean Header
- feat(ai): **Footer-First Deductive Reconciliation** prompt overhaul for estimates and final bills (`src/lib/ai/prompts.ts`).
  - Eliminates blind `÷ 1.18` division bugs on tax-exclusive quotations (e.g. Dhanashree, Schwing Stetter).
  - Footer reconciliation checks whether item amounts sum to Subtotal (exclusive base) or Grand Total (inclusive gross).
  - Captures full assessment fields: `part_number`, `hsn_sac`, `quantity`, `unit_price`, `taxable_amount`, `gst_percent`, `total_amount`, and `category` (including `rubber` & `fiberglass`).
  - Returns `_audit` envelope with `tax_posture`, `columns_detected`, `reconciliation_note`, and warnings.
- feat(dialogs): **AI Review Dialog Audit Card** (`AIReviewDialog.tsx`) displays tax posture badge, column detection overview, and reconciliation feedback notes to the surveyor. `_audit` is stripped by `stripPageTags` before persisting.
- feat(model): Added `estimateId` to `AssessmentRow` (`assessment.ts`), automatically computed in `buildEstimateRows` from `workshop_name + estimate_number + estimate_date`.
- refactor(ui): **Lean Assessment Tab Header** (`AssessmentTab.tsx`, `PolicyCheckStrip.tsx`):
  - Collapsed stacked header controls into a single lean 36px toolbar, recovering >200px vertical table space.
  - Converted Policy Depreciation into an inline select badge and Policy Check into a compact pill chip (`Policy checked` / `Policy check: 2 of 4 [⚠️ 1]`) with a floating popover overlay.
- feat(claim): **Estimate View Switcher & Tally Banner** (`EstimateViewSwitcher.tsx`, `EstimateTallyBanner.tsx`):
  - Added segmented view lens pills above the assessment grid (`[ All (N) ] [ Vendor A (X) ] [ Vendor B (Y) ]`) when 2+ distinct quotations are present.
  - Display-layer only: underlying flat `assessmentRows` array, serial numbers, calculations, and report generation remain completely untouched.
  - Tally Banner shows live taxable base, estimated GST, and gross sum for the active quotation to cross-check against paper documents.
- feat(claim): **Multi-Estimate Row Accent Borders** (`AssessmentSectionTable.tsx`):
  - Rows are highlighted with distinct left-border color accents (`border-l-4 border-l-blue-500`, etc.) in "All" view to visually distinguish items from different estimates at a glance.
- tests: Added test suites for prompt audit structure, review dialog cards, estimate tagging, view switcher, and row accent borders. All 215 test files (1,890 tests) passing; zero regressions.
- Scan impact: None — display-only views and prompt changes do not touch Scan coupling.

## 2026-10-27 (Antigravity) — Bill Check Reference Serial Numbers
- feat(bill-check): **Reference Serial Number column (`refSrNo`)** added across Bill Check grid and generated reports (both Standard and UIIC formats).
  - Cross-references Estimate item serial numbers against Final Bill item numbers (or vice versa in bill-first UIIC flow).
  - Rendered as the **last column** in red italic font (`#d32f2f`, `italic`, `font-weight: 600`).
  - Column title defaults to `Bill No.` (or `Est. No.` if `baseDocument === 'final-bill'`), and is directly editable in-place on the Bill Check grid header or stored in `claim.billCheck.refColumnTitle`.
  - Grid cell is directly editable in-place; shows amber indicator dot for ambiguous matches.
  - Added **"Review Ref Numbers (N)"** toggle button in the grid toolbar to filter down to uncertain/missing rows in high-volume claims (up to 400 lines) with zero fatigue.
- feat(ai): `applyFinalBill` extracts invoice line serial numbers (`sr_no`, `item_no`, `serial_no`) and writes `refSrNo` and `refStatus` (`clean` | `ambiguous`) into matched assessment rows.
- feat(reports):
  - Standard Bill Check Report: Added reference column on the far right of section 9 (`width: 4.5%`); column width deducted purely from Particulars so all monetary amounts retain uninterrupted currency formatting; subtotal rows use merged trailing span to avoid whitespace waste. Regular final survey report layout preserved.
  - UIIC Bill Check Report: Added reference column as the 13th column; all headers, item rows, tax lines, and subtotals aligned to 13 columns. UIIC regular final survey report preserved at 12 columns.
- tests: Added `src/lib/reports/__tests__/bill-check-ref-sr-no.test.ts` (10 tests); updated existing column count tests; 36 report test files (348 tests) passing; `tsc --noEmit` clean.
- Scan impact: None — no shared schema or coupling points touched.
- feat(assessment): **Fix estimate reading** toolbar button + dialog replaces the floating "Fix Extraction" pill. One AI re-read with the surveyor's note; the review lists only rows **missing on the sheet** (ticked) and **changed** rows (old → new, unticked, "Accept all changes"). Never deletes; a surveyor-edited assessed figure is kept and the row gets an on-screen "Re-read" badge. Original/Supplementary toggle. Removes the old path that could wipe edited estimate rows after Apply.
- feat(upload): **More pages of the same estimate** (continuation: rows join the original estimate, numbering carries on) and **More pages of the same bill** (keeps bill no./date, takes a printed total, doesn't re-match billed rows).
- feat(policy): **Policy check** — Nil Dep, IMT 23, consumables, excess. AI policy read only *suggests* ("AI read: Yes"); notice strip on Assessment and Report Center; final + bill-check Print/Word blocked until all four answered. Nil Dep answer ↔ depreciation dropdown kept in sync.
- feat(print): **Before printing — UIIC** step on every UIIC final / bill-check Print or Word: RI appointment, repair auth, est./actual completion dates, repairs as per assessment (same fields as the Reinspection tab).
- fix(word): Word export keeps UIIC page breaks (verified in Word: each page starts at the surveyor name).
- feat: Dashboard **Survey Date** + **Last Edited** columns; Recovered list shows vehicle no.; **Add row** also below each section (Assessment and Bill Check).
- refactor: **Site tab retired** (Scan replaces it); phone opens a claim on Claim Details; `?tab=site` falls back to Details; `getAt/setAt` moved to `src/lib/scan-import/path.ts`.
- Scan impact: none beyond the path move; Scan unit tests pass.
- fix: the re-read no longer offers repeat copies of a row it changed (multi-page text PDFs return each row once per page) — 88f1ccd1.
- tests: 209 files / 1865 passing, tsc clean. Commits 469aaa51..88f1ccd1 on main. Not pushed, not deployed, not tried in a signed-in browser. Spec/plan: `docs/superpowers/{specs,plans}/2026-10-27-surveyor-feedback-round-1*`.

## 2026-10-25 (Claude) — Use phone files (Assessment, Bill Check, Photos)
- feat(assessment, bill-check): **Use phone files** beside Upload Estimate (`estimate`, `supplementaryEstimate`) and the invoice upload (`invoice`). A pick runs the same handler as the file chooser, so the estimate mode dialog and the read and review run unchanged.
- feat(photos): **Use phone files** beside Gallery / Browse opens **Phone photos**: phone photos grouped by type (Final Photos, Spot, Front/Rear/Left/Right, Chassis, Odometer) with lazy thumbnails (3 read at a time, object URLs revoked on close), per-photo ticks and **Select all** per group. **Add to photo sheet** runs the same compress-and-add path as Gallery / Browse. Nothing lands without that click.
  - Tags carry over (a chassis photo arrives tagged `chassis`; Final Photos arrive as plain Damage).
  - `PhotoItem.sourceDocId` (new, optional) records the source document; already-added photos show "Added" and are disabled, so adding twice adds nothing. Photos stored without an id are matched by name.
  - Phone photos are not saved into the claim folder a second time; the Drive save prompt is unchanged.
- Buttons are hidden when the claim has no matching phone files. No change to Scan. No AI call, no running cost.
- tests: `npm test` green, tsc clean. Commits 3946c2d0 and the Photos commit. Not pushed, not deployed, not tried in a signed-in browser.

## 2026-10-25 (Claude) — Bring phone scans (SurveyOS Scan → Prime)
- feat(documents): **Bring phone scans** button: From Google Drive (Google Picker, existing `drive.file` token) or From this computer.
  - A vehicle mismatch asks Import anyway / Cancel.
  - The import needs a connected claim folder.
  - Files are de-duped by content and saved as source `'scan'`.
  - No AI calls.
- feat(documents): **Phone notes** review with three parts:
  - Will fill, ticked by default.
  - Phone notes differ, with Keep Prime (default) / Use phone.
  - Rows to add.
  - Nothing is written until Apply. A re-import never asks again (`claim.scanImport.decided`), and `isInsurable` is never auto-filled.
- feat(documents): cards show "From phone — click to read". New Phone files list with "Checked N of M" portal ticks.
- refactor(documents): removed the Pages grid, Portal list, "Documents · N" and "Files on Drive". The claim folder is now one line.
- Scan repo: Sync to Drive removed. Every import arrives as a zip. The handover doc is clarified.
- Owner step: enable the Google Picker API in `surveyos-v2-antigravity-in`.
- tests: `npm test` green, tsc clean.
  - Prime commits 7611cc83..6ad6a0d7, plus the import entry commit.
  - Scan commits b8b1248..0da6f79, plus the handover commit.
  - Not pushed, not deployed, not tried in a signed-in browser. Session log `Sessions/2026-10-25-bring-phone-scans.md`.

## 2026-10-25 (Claude) — Claim Details regrouped by document, dates on the right
- feat(claim): sections follow the source papers: Assignment, Policy & Insured, RC, Driving Licence, Permit & Fitness, Accident, At the Time of Accident, Survey & Workshop, Documents Obtained, Spot Findings; shared `DocSection` puts every date field in one right-hand column
- feat(claim): Scan RC / DL / Policy buttons in their section headers (replace the three big tiles); sticky processing banner
- feat(claim): vehicle type switch (Private / Comm. Goods / Comm. Passenger) in the report-number strip; only shows or hides type-specific fields, stored values stay
- style(claim): "used in spot report" dots removed, red empty-borders only on core fields, neutral section titles, Spot section restyled to match; Word Report button removed from this tab (Report tab has it)
- fix(spot): "Log Book / Tax Paid" saved into `spotDetails.fitnessType` and printed as Fitness Type; now `spotDetails.taxPaid` (old value still shown); UIIC prints `vehicle.fitnessType` only
- fix(claim): overload prompt showed for any load on final claims (capacity 0); capacity falls back to RC GVW − ULW, unknown = no prompt
- fix(claim): screen-width column spans inside container grids broke rows with the Evidence panel open; all spans container-based
- Storage paths unchanged; fitness/route/goods hidden for private vehicles, passenger/load hidden for valuation (not printed there)
- tests: 1744 passing, tsc clean. Commit ea2a9ed6 on `main`. Deployed to motorsurveyos-in 2026-10-25 10:18 (hosting; new strings verified in the live chunk). Not tried in the signed-in app. Session log `Sessions/2026-10-25-claim-details-layout.md`.

## 2026-10-22 (Claude) — Surveyor feedback: date/time, evidence viewer, select-all, rephrase, page jump
- fix(ai): accident time parsed from "4.30 pm", "16.30 hrs", "1630 hrs", "02:30 PM" (AM/PM kept); an unreadable date keeps the existing value instead of writing a blank "T00:00"; Reconciliation writes a valid datetime-local and no longer shows a false date-vs-datetime conflict
- fix(review): AI Review tab uses the shared inline Evidence Viewer (its old copy read a sessionStorage key nothing writes, so it never showed a document)
- feat(documents): Select all / Unselect all on the shared PDF page grid (AI reading and Photos annexure pickers)
- feat(claim): "Rephrase with AI" beside Cause and Nature of Accident (now a 3-line textarea); translates and rewrites in a senior surveyor's house style, never adds facts, Undo restores; ~1k tokens per press
- feat(evidence): extraction tags each value with its PDF page/file; AI Review, Details and Reconciliation open the document at that page ("page N" in the header)
- tests: 1734 passing, tsc clean. Commits 7bc9132e, 565919af, 877ab9f8 on `main`. Deployed to motorsurveyos-in 2026-10-22 15:54 (hosting, owner-run; live chunks verified). Not tried in the signed-in app.

## 2026-10-21 (Claude) — Claim document kit, Phases 1–2
- feat(documents): KYC and portal document types with page labels; per-device file fingerprints, so a changed file resets its labels
- feat(documents): free page recognisers from the text layer and file names (no AI); identity checks that a document belongs to this claim (registration, chassis, policy, names; KYC compares names only)
- feat(documents): portal recipes for New India non-tieup, New India KIA tie-up (provisional) and United India; Ready / Check / Missing checklist with a copy-ready missing-documents message
- feat(documents): upload files built with pdf-lib (split and merge); upload files written into `Portal Upload/<portal>/` only for confirmed boxes; Review upload set, where a source or claim-field change marks a box stale until rebuilt
- fix(documents): final-review fix wave: labels tied to the exact file (Scan and labelling fingerprint every file; Build refuses a changed one); HTML stand-ins never built; boxes build independently with per-box errors; `Portal Upload/<portal>/` cleared of files the review doesn't cover; boxes go stale on any source, not-needed or identity-field change; identity checks that haven't run count as "Still checking"; continuation pages (policy terms, card backs) no longer a mismatch; encrypted PDFs refused; Windows-safe file names
- feat(documents): folder location choice (this computer, or Google Drive for desktop with a guide); three Documents-tab panels: Portal checklist, Pages, Review
- chore(deps): `pdf-lib@^1.17.1`, the only new dependency
- tests: 1721 passing, tsc clean. Commits 7181ae3c..f510fbae, fix wave 287d7113..5f1bb70a, on `main`. Not deployed; not tried in a browser. Owner to confirm recipe defaults in spec §8(b)–(d). Next: Phases 3–5 (Google Drive online picker, opt-in AI "Guess the rest", extension upload). Spec `docs/superpowers/specs/2026-10-20-claim-document-kit-design.md`, plan `docs/superpowers/plans/2026-10-20-claim-document-kit.md`.

## 2026-10-17 (Claude) — Portal fill v0.4.0: page check and redesigned card
- feat(extension): **Check page**, a read-only button that reports per field whether Fill would work (structure, value and wrong-claim modes); writes nothing; text and money values never shown
- feat(extension): redesigned card: docked right and centred, collapsible 40 px tab, Esc and keyboard support, screen-reader roles, draggable header, problems listed first, click a line to jump to the field, summary, next-step hint, legend, Copy report
- chore(extension): map labels and next-step hints in the overlays (NIA map v3, UIIC v2); README: Check page, updated fixture walk-throughs, read-only live-check steps
- tests: 1507 passing, tsc clean. Not deployed (hosting needs the owner's go-ahead); card not yet tried in a browser.

## 2026-10-16 (Claude) — Portal fill extension Phase 2: UIIC (v0.3.0)
- feat(extension): UIIC claim-survey map (28 fields: survey date/time/place, mobile, report no, IRDAI parts buckets, GST slabs, labour, invoice no, salvage, excesses, fee bill), generated from the capture (renamed `uiic-claimsurvey-survey.json`)
- feat(extension): `uiicText` (portal's `[a-zA-Z0-9. ]` pattern, 500 cap), `hour`/`minute` split; any map field can read another packet field via `from`
- feat(uiic): `buildUiicPacket` (bill-check basis, R12) + Send to extension in the UIIC summary dialog, behind the bill-check tick
- fix(extension): unmatched select option reported rejected, not filled; new maps load on worker start; panel text portal-neutral; panel re-boots after removal; results survive a map refresh; remote maps shape-checked; fill-core wrapped in an IIFE; flow-list drift test; build fails on field/file key clash
- tests: 1456 passing, tsc clean. Commits 2019832f..fcfff741. Deployed to motorsurveyos-in.web.app (hosting) 2026-10-16; hosted maps verified live. No browser run of the extension.

## 2026-10-16 (Claude) — Portal fill extension Phase 1 (multi-portal core, v0.2.0)
- docs: roadmap `docs/superpowers/plans/2026-10-16-portal-extension-roadmap.md` — Phase 0 (live checks + capture sweep) through Phase 6 (store listing)
- feat(extension): `pickMap(maps, host, hash)` — exact route match, so `#/WorklistSurvey` never catches `#/WorklistSurveyNew`; map headers gain `host` and `modelRoot`
- feat(extension): background keeps `maps` (one per flow, `MAP_IDS`), migrates v0.1.0's `map` key, loads maps when the worker starts with none
- feat(extension): panel re-picks its map on every route change; `packetGate` refuses a packet built for another portal/flow; validator reads `KNOWN_FLOWS`
- feat(extension): scope found from the claim-number / field elements when a map names no controller (UIIC)
- chore(extension): `build-ext.py` builds and zips every `*.overlay.json`; fixture scope generated from model paths; NIA map version 2
- tests: 1424 passing. Commits e62a61fa..2019832f. Not deployed; no browser walk-through run (needs an unpacked extension in Chrome).

## 2026-09-18 → 09-23 (Claude) — back-filled
- feat(nia): NIA Assessment Excel generator with nil-dep painting and bill-check gate (09-18)
- feat(extension): Portal Fill extension v0.1.0 for NIA non-tieup; `src/lib/portal/packet.ts` + Send to extension in the NIA dialog (09-21)
- feat(documents): Claim Documents typed index + disk folder; folders named by vehicle + insurer short form; Scan folder; one-time Tidy up (09-21 → 09-23)

## 2026-10-04 (Claude) — Phone layout bug-fix pass
- fix(layout): sidebar now slides off-screen below 1024 px (it was always visible and covered the left 258 px)
- fix(evidence): Details/Review evidence panel closed by default on phones, opens as a full-screen overlay; shared `useEvidencePanel` + `EvidencePanelSlot` replace two copies
- fix(layout): `h-screen`/`100vh` → `dvh`; report preview fits phone width and no longer clips left; hover-only row/photo actions visible on touch; hamburger hidden on phones with a claim open; notifications dropdown fits the phone drawer
- chore: Playwright MCP added to the project (extension mode, Pixel 7) for phone-layout verification
- tests: 1408 passing. Commits 472dbc5b, c1fcd3ed..47c9f8f6. Deployed to motorsurveyos-in.web.app (hosting) 2026-10-04. Visual check via Playwright pending (needs Bridge extension + session restart).

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
