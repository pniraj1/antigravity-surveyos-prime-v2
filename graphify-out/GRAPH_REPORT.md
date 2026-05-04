# Graph Report - .  (2026-04-30)

## Corpus Check
- 192 files · ~50,000 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 790 nodes · 1188 edges · 109 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `getDB()` - 22 edges
2. `driveRequest()` - 14 edges
3. `ARCHITECTURE.md — System Architecture` - 14 edges
4. `README — SurveyOS Prime V2` - 11 edges
5. `Ashok Leyland AVTR Dump Truck RJ23GD1504` - 11 edges
6. `buildProvider()` - 9 edges
7. `parseDate()` - 9 edges
8. `getRootFolder()` - 8 edges
9. `IndexedDB — Offline-First Local Storage` - 8 edges
10. `Report Generation — PDF/Word/Excel Builders` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Reinspection Report (RIN/416/2026)` --semantically_similar_to--> `Power Print HTML Report Engine`  [INFERRED] [semantically similar]
  RI REPORT Sample.pdf → SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Modules/Reporting_Engine.md
- `code-review-graph MCP — Structural Code Graph` --semantically_similar_to--> `Obsidian Vault — External Brain / KnowledgeBase`  [INFERRED] [semantically similar]
  GEMINI.md → AGENTS.md
- `DTC Proforma Invoice (Ujwal Automotives, Dhule)` --semantically_similar_to--> `Detailed Spare Parts Assessment Sheet (140+ items)`  [INFERRED] [semantically similar]
  photosheetsforreview_extracted/DTC Proforma Invoice-1.PDF → total loss report sample.pdf
- `MCP (Model Context Protocol) — Universal Translator` --conceptually_related_to--> `code-review-graph MCP — Structural Code Graph`  [INFERRED]
  SurveyOS-Antigravity-Prime-V2-KnowledgeBase/ANTIGRAVITY_BIBLE.md → GEMINI.md
- `SurveyOS Prime Photosheet (SPO/498/2026-27)` --references--> `Spot Report Number Format SPO/YYYY/NNN`  [EXTRACTED]
  photosheetsforreview_extracted/SURVEY OS PHOTOSHEET.pdf → SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Patterns/Sequential_Numbering.md

## Hyperedges (group relationships)
- **Memory Bloat Mitigation Strategy** — concept_memory_bloat, concept_image_compression, concept_db_separation, concept_soft_archiving [EXTRACTED 1.00]
- **Triple-Layer AI Resilience Pipeline** — concept_openrouter, concept_nvidia_nim, concept_ollama, concept_smart_router [EXTRACTED 1.00]
- **Access Control & User Onboarding System** — concept_pending_status, concept_subscription_guard, concept_admin_dashboard, concept_firestore_rules [EXTRACTED 1.00]
- **Offline-First Storage Pipeline** — indexeddb_surveyos_db, indexeddb_broadcast_channel, cloud_sync_auto_push_files [EXTRACTED 0.95]
- **AI Provider Error Recovery Flow** — error_handling_quota_exhausted, error_handling_rate_limited, error_handling_graceful_degradation [EXTRACTED 1.00]
- **Report Generation Pipeline** — reporting_engine_power_print, sequential_numbering_pattern, state_management_claim_store [INFERRED 0.85]
- **Vehicle Damage Survey Session - Yellow Ashok Leyland Truck** —  [INFERRED 0.90]
- **Next.js Starter Template Public Assets** —  [INFERRED 0.95]

## Communities

### Community 0 - "Claim Form UI Components"
Cohesion: 0.04
Nodes (11): handleKeyDown(), handleSend(), getStorageKey(), loadImage(), getStorageKey(), loadImage(), storeEvidenceImage(), addRow() (+3 more)

### Community 1 - "PDF Generation and Claim Types"
Cohesion: 0.04
Nodes (30): convertPolicyFile(), getPolicyImagesFromSession(), getResolvedPolicyImages(), handleGenerate(), handleLanguageChange(), handlePolicyUpload(), formatDateDMY(), formatDateTimeDMY() (+22 more)

### Community 2 - "Project Docs and Admin Panel"
Cohesion: 0.05
Nodes (73): AGENTS.md — Agent Instructions, Claude Handover Document, CLAUDE.md — Claude Instructions, AdminDashboard — User Management UI, AI Extraction Pipeline — Gemini/Groq OCR, AssessmentRow — Core Math Engine for Claims, auth-store.ts — Firebase Auth State, Bill Check — Repair Bill vs Assessment (+65 more)

### Community 3 - "Assessment and Calculation Engine"
Cohesion: 0.05
Nodes (12): applyDepreciation(), getAgeLabel(), getDepPolicyLabel(), getDepreciationRate(), buildAnalytics(), buildClaimRegister(), buildInsurerSummary(), buildMonthSummary() (+4 more)

### Community 4 - "Claim UI and Auth Flow"
Cohesion: 0.05
Nodes (12): fetchData(), handleRestore(), ErrorBoundary, buildFields(), getConflictFields(), getNestedValue(), getReconciliationFields(), getUnanimousFields() (+4 more)

### Community 5 - "Authentication and Access Control"
Cohesion: 0.05
Nodes (0): 

### Community 6 - "UI Component Library"
Cohesion: 0.05
Nodes (2): formatDateDMY(), formatDateTimeDMY()

### Community 7 - "Cloud Sync and Drive Integration"
Cohesion: 0.05
Nodes (44): Auto Push Files Toggle (Photos and Docs), Profile and System Backup (surveyos_profile_backup.json), Rationale: Separate High-Bandwidth vs Critical-State Sync, Dashboard Archive System, GST Invoice Parts + Labour (Gross Rs. 2,26,860.85), DTC Proforma Invoice (Ujwal Automotives, Dhule), Tata Nexon Accident Repair (GJ26AE9189), BroadcastChannel surveyos_claims_sync (+36 more)

### Community 8 - "Offline IndexedDB Storage"
Cohesion: 0.14
Nodes (24): addToDriveQueue(), addToSyncQueue(), deleteClaim(), getAllClaims(), getAllPushedAt(), getClaim(), getDB(), getDriveQueue() (+16 more)

### Community 9 - "Bank Reconciliation"
Cohesion: 0.09
Nodes (9): extractBankStatement(), parseCsvTransactions(), AITaskQueue, extractDocument(), extractPageText(), fileToImages(), rescanTargetPages(), tolerance() (+1 more)

### Community 10 - "AI Gateway Service"
Cohesion: 0.19
Nodes (16): buildProvider(), callAIGateway(), callWithKey(), callWithRotation(), getAIProvider(), getProfileFromStorage(), isHighDemandError(), isModelUnavailable() (+8 more)

### Community 11 - "Google Drive API"
Cohesion: 0.27
Nodes (16): backupProfileToDrive(), clearStoredToken(), createFolder(), downloadFileAsBase64(), driveRequest(), findFolder(), flushDriveQueue(), getDriveToken() (+8 more)

### Community 12 - "Fee Bill and Reports"
Cohesion: 0.14
Nodes (8): buildReinspectionHTML(), fa(), fd(), g(), triggerReinspectionPrint(), buildSpotFeeBillDocument(), buildSpotFeeBillHTML(), triggerSpotFeeBillPrint()

### Community 13 - "Admin Dashboard"
Cohesion: 0.13
Nodes (2): fetchAllProfiles(), handleApprove()

### Community 14 - "AI Data State"
Cohesion: 0.22
Nodes (13): applyAuth(), applyClaim(), applyDL(), applyFinalBill(), applyFitness(), applyLokChallan(), applyPermit(), applyPolicy() (+5 more)

### Community 15 - "Assessment Grid UI"
Cohesion: 0.21
Nodes (4): resetDefaults(), saveVisibility(), showAll(), toggleColumn()

### Community 16 - "Photo Evidence"
Cohesion: 0.36
Nodes (12): Front Bumper – Surface Rust and Abrasion, Rear Tipper Body – Heavy Rust and Paint Wear, Windshield – Heavy Dirt Contamination, Front Overview with Inspector – RJ23GD1504, Front Closeup – Bumper and Grille – RJ23GD1504, Right Side View – Tipper Body – RJ23GD1504, Front Left Quarter View – RJ23GD1504, Windshield Closeup with Stickers – RJ23GD1504 (+4 more)

### Community 17 - "AI Error Handling"
Cohesion: 0.25
Nodes (9): AI Provider Error Hierarchy, Fallback to Manual Entry, Graceful Degradation Pattern, Quota Exhausted Error (Permanent), Rate Limited Error (Temporary), Retry With Backoff Strategy, H-3 No Input Sanitization Before AI Prompt Injection, Token Saving Strategy - Always Delegate (+1 more)

### Community 18 - "Vehicle Damage Photos"
Cohesion: 0.28
Nodes (9): Cracked Windshield - Interior View, Vehicle VIN / Chassis Number Plate, Front Bumper and Headlights - Damage, Cracked Windshield - Exterior View, Vehicle Dashboard Odometer Display, Vehicle Undercarriage and Front Skid Plate, Accident Scene - Concrete Bridge/Retaining Wall, Radiator / Intercooler - Damage and Dirt (+1 more)

### Community 19 - "Extraction Test Scripts"
Cohesion: 0.38
Nodes (6): call_gemini(), main(), pdf_to_images(), Test script to validate the extraction quality of the DTC Proforma Invoice usin, Convert PDF pages to base64 JPEG images., Call Gemini API with images.

### Community 20 - "Module 20"
Cohesion: 0.29
Nodes (0): 

### Community 21 - "Module 21"
Cohesion: 0.29
Nodes (7): Dashboard Module Components, Field Mapping Error Pattern, Immutability Violation Error Pattern, SurveyOS Obsidian Knowledge Base Vault, Claim Store (Zustand), UI Store (Zustand), Dashboard - Mission Control

### Community 22 - "Module 22"
Cohesion: 0.47
Nodes (5): call_gemini(), main(), pdf_to_jpeg_base64(), Direct test: convert DTC Proforma Invoice-1.PDF to image and send to Gemini. Ru, Convert PDF pages to JPEG base64. Returns list of (mime, base64) tuples.

### Community 23 - "Module 23"
Cohesion: 0.47
Nodes (1): UIICExcelBuilder

### Community 24 - "Module 24"
Cohesion: 0.33
Nodes (6): Next.js Application Project, File Icon SVG, Globe / Web Icon SVG, Next.js Wordmark Logo SVG, Vercel Triangle Logo SVG, Window / Browser Icon SVG

### Community 25 - "Module 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Module 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Module 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Module 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Module 29"
Cohesion: 1.0
Nodes (2): Completed Features (2026-04-12 to 2026-04-13), IRDAI Annual Summary Export Feature

### Community 30 - "Module 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Module 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Module 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Module 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Module 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Module 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Module 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Module 37"
Cohesion: 1.0
Nodes (1): Claim Type Error Pattern (Spot vs Standard)

### Community 38 - "Module 38"
Cohesion: 1.0
Nodes (1): C-3 Master AI API Keys Readable by All Users

### Community 39 - "Module 39"
Cohesion: 1.0
Nodes (1): H-4 console.log Leaks UIDs in Production

### Community 40 - "Module 40"
Cohesion: 1.0
Nodes (1): March 2026 Model Catalog

### Community 41 - "Module 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Module 42"
Cohesion: 1.0
Nodes (1): layout

### Community 43 - "Module 43"
Cohesion: 1.0
Nodes (1): page

### Community 44 - "Module 44"
Cohesion: 1.0
Nodes (1): AuthSyncWrapper

### Community 45 - "Module 45"
Cohesion: 1.0
Nodes (1): AdminDashboard

### Community 46 - "Module 46"
Cohesion: 1.0
Nodes (1): AuthGate

### Community 47 - "Module 47"
Cohesion: 1.0
Nodes (1): SignInScreen

### Community 48 - "Module 48"
Cohesion: 1.0
Nodes (1): AccidentForm

### Community 49 - "Module 49"
Cohesion: 1.0
Nodes (1): AssessmentGrid

### Community 50 - "Module 50"
Cohesion: 1.0
Nodes (1): AssessmentSummary

### Community 51 - "Module 51"
Cohesion: 1.0
Nodes (1): DriverForm

### Community 52 - "Module 52"
Cohesion: 1.0
Nodes (1): PolicyForm

### Community 53 - "Module 53"
Cohesion: 1.0
Nodes (1): VehicleForm

### Community 54 - "Module 54"
Cohesion: 1.0
Nodes (1): AIReviewDialog

### Community 55 - "Module 55"
Cohesion: 1.0
Nodes (1): NewClaimDialog

### Community 56 - "Module 56"
Cohesion: 1.0
Nodes (1): ErrorBoundary

### Community 57 - "Module 57"
Cohesion: 1.0
Nodes (1): SaveStatusBar

### Community 58 - "Module 58"
Cohesion: 1.0
Nodes (1): sidebar

### Community 59 - "Module 59"
Cohesion: 1.0
Nodes (1): SubscriptionGuard

### Community 60 - "Module 60"
Cohesion: 1.0
Nodes (1): BillCheckDocument

### Community 61 - "Module 61"
Cohesion: 1.0
Nodes (1): FeeBillDocument

### Community 62 - "Module 62"
Cohesion: 1.0
Nodes (1): PhotoSheetDocument

### Community 63 - "Module 63"
Cohesion: 1.0
Nodes (1): SpotReportDocument

### Community 64 - "Module 64"
Cohesion: 1.0
Nodes (1): SurveyReportDocument

### Community 65 - "Module 65"
Cohesion: 1.0
Nodes (1): UIICReportDocument

### Community 66 - "Module 66"
Cohesion: 1.0
Nodes (1): SpotPrintReport

### Community 67 - "Module 67"
Cohesion: 1.0
Nodes (1): UIICPrintReport

### Community 68 - "Module 68"
Cohesion: 1.0
Nodes (1): AssessmentTab

### Community 69 - "Module 69"
Cohesion: 1.0
Nodes (1): BillCheckTab

### Community 70 - "Module 70"
Cohesion: 1.0
Nodes (1): CloudVaultTab

### Community 71 - "Module 71"
Cohesion: 1.0
Nodes (1): DetailsTab

### Community 72 - "Module 72"
Cohesion: 1.0
Nodes (1): DocumentsTab

### Community 73 - "Module 73"
Cohesion: 1.0
Nodes (1): FeesTab

### Community 74 - "Module 74"
Cohesion: 1.0
Nodes (1): PhotosTab

### Community 75 - "Module 75"
Cohesion: 1.0
Nodes (1): ProfileTab

### Community 76 - "Module 76"
Cohesion: 1.0
Nodes (1): ReinspectionTab

### Community 77 - "Module 77"
Cohesion: 1.0
Nodes (1): ReportTab

### Community 78 - "Module 78"
Cohesion: 1.0
Nodes (1): ReviewTab

### Community 79 - "Module 79"
Cohesion: 1.0
Nodes (1): SpotTab

### Community 80 - "Module 80"
Cohesion: 1.0
Nodes (1): ReconciliationDialog

### Community 81 - "Module 81"
Cohesion: 1.0
Nodes (1): badge

### Community 82 - "Module 82"
Cohesion: 1.0
Nodes (1): button

### Community 83 - "Module 83"
Cohesion: 1.0
Nodes (1): card

### Community 84 - "Module 84"
Cohesion: 1.0
Nodes (1): dialog

### Community 85 - "Module 85"
Cohesion: 1.0
Nodes (1): input

### Community 86 - "Module 86"
Cohesion: 1.0
Nodes (1): label

### Community 87 - "Module 87"
Cohesion: 1.0
Nodes (1): select

### Community 88 - "Module 88"
Cohesion: 1.0
Nodes (1): separator

### Community 89 - "Module 89"
Cohesion: 1.0
Nodes (1): sheet

### Community 90 - "Module 90"
Cohesion: 1.0
Nodes (1): sonner

### Community 91 - "Module 91"
Cohesion: 1.0
Nodes (1): table

### Community 92 - "Module 92"
Cohesion: 1.0
Nodes (1): tabs

### Community 93 - "Module 93"
Cohesion: 1.0
Nodes (1): textarea

### Community 94 - "Module 94"
Cohesion: 1.0
Nodes (1): useAIExtraction

### Community 95 - "Module 95"
Cohesion: 1.0
Nodes (1): useAuth

### Community 96 - "Module 96"
Cohesion: 1.0
Nodes (1): useAutoSave

### Community 97 - "Module 97"
Cohesion: 1.0
Nodes (1): useClaimsLoader

### Community 98 - "Module 98"
Cohesion: 1.0
Nodes (1): useCloudSync

### Community 99 - "Module 99"
Cohesion: 1.0
Nodes (1): utils

### Community 100 - "Module 100"
Cohesion: 1.0
Nodes (1): processor

### Community 101 - "Module 101"
Cohesion: 1.0
Nodes (1): prompts

### Community 102 - "Module 102"
Cohesion: 1.0
Nodes (1): reconciliation

### Community 103 - "Module 103"
Cohesion: 1.0
Nodes (1): service

### Community 104 - "Module 104"
Cohesion: 1.0
Nodes (1): assessment

### Community 105 - "Module 105"
Cohesion: 1.0
Nodes (1): depreciation

### Community 106 - "Module 106"
Cohesion: 1.0
Nodes (1): fees

### Community 107 - "Module 107"
Cohesion: 1.0
Nodes (1): gst

### Community 108 - "Module 108"
Cohesion: 1.0
Nodes (1): Window SVG Icon

## Ambiguous Edges - Review These
- `Windshield Closeup with Stickers – RJ23GD1504` → `Windshield – Heavy Dirt Contamination`  [AMBIGUOUS]
  photosheetsforreview_extracted/images/WhatsApp Unknown 2026-04-16 at 1.25.41 PM/WhatsApp Image 2026-04-16 at 1.25.33 PM.jpeg · relation: shows

## Knowledge Gaps
- **130 isolated node(s):** `Test script to validate the extraction quality of the DTC Proforma Invoice usin`, `Convert PDF pages to base64 JPEG images.`, `Call Gemini API with images.`, `Direct test: convert DTC Proforma Invoice-1.PDF to image and send to Gemini. Ru`, `Convert PDF pages to JPEG base64. Returns list of (mime, base64) tuples.` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Module 25`** (2 nodes): `analyze_pdf.py`, `analyze_pdf()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 26`** (2 nodes): `gen_chunks.py`, `make_node()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 27`** (2 nodes): `test_nv_key.py`, `test_minimax()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 28`** (2 nodes): `extract.js`, `extractPdf()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 29`** (2 nodes): `Completed Features (2026-04-12 to 2026-04-13)`, `IRDAI Annual Summary Export Feature`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 30`** (2 nodes): `sitemap.ts`, `sitemap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 31`** (2 nodes): `ValuationReportDocument.tsx`, `g()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 32`** (1 nodes): `check_claim_sizes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 33`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 34`** (1 nodes): `extract_pdf.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 35`** (1 nodes): `uiic-html-builder.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 36`** (1 nodes): `telemetry.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 37`** (1 nodes): `Claim Type Error Pattern (Spot vs Standard)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 38`** (1 nodes): `C-3 Master AI API Keys Readable by All Users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 39`** (1 nodes): `H-4 console.log Leaks UIDs in Production`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 40`** (1 nodes): `March 2026 Model Catalog`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 41`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 42`** (1 nodes): `layout`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 43`** (1 nodes): `page`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 44`** (1 nodes): `AuthSyncWrapper`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 45`** (1 nodes): `AdminDashboard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 46`** (1 nodes): `AuthGate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 47`** (1 nodes): `SignInScreen`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 48`** (1 nodes): `AccidentForm`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 49`** (1 nodes): `AssessmentGrid`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 50`** (1 nodes): `AssessmentSummary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 51`** (1 nodes): `DriverForm`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 52`** (1 nodes): `PolicyForm`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 53`** (1 nodes): `VehicleForm`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 54`** (1 nodes): `AIReviewDialog`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 55`** (1 nodes): `NewClaimDialog`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 56`** (1 nodes): `ErrorBoundary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 57`** (1 nodes): `SaveStatusBar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 58`** (1 nodes): `sidebar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 59`** (1 nodes): `SubscriptionGuard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 60`** (1 nodes): `BillCheckDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 61`** (1 nodes): `FeeBillDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 62`** (1 nodes): `PhotoSheetDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 63`** (1 nodes): `SpotReportDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 64`** (1 nodes): `SurveyReportDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 65`** (1 nodes): `UIICReportDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 66`** (1 nodes): `SpotPrintReport`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 67`** (1 nodes): `UIICPrintReport`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 68`** (1 nodes): `AssessmentTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 69`** (1 nodes): `BillCheckTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 70`** (1 nodes): `CloudVaultTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 71`** (1 nodes): `DetailsTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 72`** (1 nodes): `DocumentsTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 73`** (1 nodes): `FeesTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 74`** (1 nodes): `PhotosTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 75`** (1 nodes): `ProfileTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 76`** (1 nodes): `ReinspectionTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 77`** (1 nodes): `ReportTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 78`** (1 nodes): `ReviewTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 79`** (1 nodes): `SpotTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 80`** (1 nodes): `ReconciliationDialog`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 81`** (1 nodes): `badge`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 82`** (1 nodes): `button`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 83`** (1 nodes): `card`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 84`** (1 nodes): `dialog`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 85`** (1 nodes): `input`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 86`** (1 nodes): `label`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 87`** (1 nodes): `select`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 88`** (1 nodes): `separator`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 89`** (1 nodes): `sheet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 90`** (1 nodes): `sonner`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 91`** (1 nodes): `table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 92`** (1 nodes): `tabs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 93`** (1 nodes): `textarea`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 94`** (1 nodes): `useAIExtraction`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 95`** (1 nodes): `useAuth`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 96`** (1 nodes): `useAutoSave`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 97`** (1 nodes): `useClaimsLoader`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 98`** (1 nodes): `useCloudSync`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 99`** (1 nodes): `utils`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 100`** (1 nodes): `processor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 101`** (1 nodes): `prompts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 102`** (1 nodes): `reconciliation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 103`** (1 nodes): `service`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 104`** (1 nodes): `assessment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 105`** (1 nodes): `depreciation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 106`** (1 nodes): `fees`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 107`** (1 nodes): `gst`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Module 108`** (1 nodes): `Window SVG Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Windshield Closeup with Stickers – RJ23GD1504` and `Windshield – Heavy Dirt Contamination`?**
  _Edge tagged AMBIGUOUS (relation: shows) - confidence is low._
- **What connects `Test script to validate the extraction quality of the DTC Proforma Invoice usin`, `Convert PDF pages to base64 JPEG images.`, `Call Gemini API with images.` to the rest of the system?**
  _130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Claim Form UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `PDF Generation and Claim Types` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Project Docs and Admin Panel` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Assessment and Calculation Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Claim UI and Auth Flow` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._