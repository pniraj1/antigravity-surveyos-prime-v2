# Graph Report - .  (2026-04-22)

## Corpus Check
- 180 files · ~291,164 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 586 nodes · 967 edges · 38 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 37 edges (avg confidence: 0.82)
- Token cost: 18,500 input · 4,800 output

## God Nodes (most connected - your core abstractions)
1. `getDB()` - 22 edges
2. `driveRequest()` - 14 edges
3. `ARCHITECTURE.md — System Architecture` - 14 edges
4. `README — SurveyOS Prime V2` - 11 edges
5. `Ashok Leyland AVTR Dump Truck RJ23GD1504` - 11 edges
6. `getRootFolder()` - 8 edges
7. `IndexedDB — Offline-First Local Storage` - 8 edges
8. `Report Generation — PDF/Word/Excel Builders` - 8 edges
9. `Vehicle Survey Session – 04 April 2026` - 8 edges
10. `buildProvider()` - 7 edges

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

### Community 0 - "Auth & Access Control"
Cohesion: 0.05
Nodes (8): fetchData(), handleRestore(), getNestedValue(), getReconciliationFields(), pushClaimToCloud(), sanitize(), stripPhotos(), syncDeltaToCloud()

### Community 1 - "Project Docs & Knowledge Base"
Cohesion: 0.05
Nodes (73): AGENTS.md — Agent Instructions, Claude Handover Document, CLAUDE.md — Claude Instructions, AdminDashboard — User Management UI, AI Extraction Pipeline — Gemini/Groq OCR, AssessmentRow — Core Math Engine for Claims, auth-store.ts — Firebase Auth State, Bill Check — Repair Bill vs Assessment (+65 more)

### Community 2 - "Claim Processing & Reports"
Cohesion: 0.07
Nodes (29): buildReinspectionHTML(), fa(), fd(), g(), triggerReinspectionPrint(), formatDateDMY(), formatDateTimeDMY(), buildSpotFeeBillDocument() (+21 more)

### Community 3 - "Cloud Storage & Sync"
Cohesion: 0.05
Nodes (44): Auto Push Files Toggle (Photos and Docs), Profile and System Backup (surveyos_profile_backup.json), Rationale: Separate High-Bandwidth vs Critical-State Sync, Dashboard Archive System, GST Invoice Parts + Labour (Gross Rs. 2,26,860.85), DTC Proforma Invoice (Ujwal Automotives, Dhule), Tata Nexon Accident Repair (GJ26AE9189), BroadcastChannel surveyos_claims_sync (+36 more)

### Community 4 - "Claim UI Components"
Cohesion: 0.08
Nodes (6): resetDefaults(), saveVisibility(), showAll(), toggleColumn(), getStorageKey(), loadImage()

### Community 5 - "Assessment Calculations"
Cohesion: 0.07
Nodes (12): applyDepreciation(), getAgeLabel(), getDepPolicyLabel(), getDepreciationRate(), buildAnalytics(), buildClaimRegister(), buildInsurerSummary(), buildMonthSummary() (+4 more)

### Community 6 - "UI Component Library"
Cohesion: 0.08
Nodes (2): formatDateDMY(), formatDateTimeDMY()

### Community 7 - "Bank Reconciliation"
Cohesion: 0.1
Nodes (16): extractBankStatement(), parseCsvTransactions(), AITaskQueue, extractDocument(), buildProvider(), callAIGateway(), callWithKey(), callWithRotation() (+8 more)

### Community 8 - "Offline Storage (IndexedDB)"
Cohesion: 0.14
Nodes (24): addToDriveQueue(), addToSyncQueue(), deleteClaim(), getAllClaims(), getAllPushedAt(), getClaim(), getDB(), getDriveQueue() (+16 more)

### Community 9 - "PDF Report Documents"
Cohesion: 0.1
Nodes (0): 

### Community 10 - "Google Drive Integration"
Cohesion: 0.27
Nodes (16): backupProfileToDrive(), clearStoredToken(), createFolder(), downloadFileAsBase64(), driveRequest(), findFolder(), flushDriveQueue(), getDriveToken() (+8 more)

### Community 11 - "Bill Check Tab"
Cohesion: 0.12
Nodes (0): 

### Community 12 - "Admin Dashboard"
Cohesion: 0.14
Nodes (2): fetchAllProfiles(), handleApprove()

### Community 13 - "Vehicle Inspection Images"
Cohesion: 0.36
Nodes (12): Front Bumper – Surface Rust and Abrasion, Rear Tipper Body – Heavy Rust and Paint Wear, Windshield – Heavy Dirt Contamination, Front Overview with Inspector – RJ23GD1504, Front Closeup – Bumper and Grille – RJ23GD1504, Right Side View – Tipper Body – RJ23GD1504, Front Left Quarter View – RJ23GD1504, Windshield Closeup with Stickers – RJ23GD1504 (+4 more)

### Community 14 - "Evidence & Review"
Cohesion: 0.24
Nodes (3): getStorageKey(), loadImage(), storeEvidenceImage()

### Community 15 - "AI Error Handling"
Cohesion: 0.25
Nodes (9): AI Provider Error Hierarchy, Fallback to Manual Entry, Graceful Degradation Pattern, Quota Exhausted Error (Permanent), Rate Limited Error (Temporary), Retry With Backoff Strategy, H-3 No Input Sanitization Before AI Prompt Injection, Token Saving Strategy - Always Delegate (+1 more)

### Community 16 - "Vehicle Damage Documentation"
Cohesion: 0.28
Nodes (9): Cracked Windshield - Interior View, Vehicle VIN / Chassis Number Plate, Front Bumper and Headlights - Damage, Cracked Windshield - Exterior View, Vehicle Dashboard Odometer Display, Vehicle Undercarriage and Front Skid Plate, Accident Scene - Concrete Bridge/Retaining Wall, Radiator / Intercooler - Damage and Dirt (+1 more)

### Community 17 - "PDF Test Scripts"
Cohesion: 0.38
Nodes (6): call_gemini(), main(), pdf_to_images(), Test script to validate the extraction quality of the DTC Proforma Invoice usin, Convert PDF pages to base64 JPEG images., Call Gemini API with images.

### Community 18 - "Dashboard & State Bridge"
Cohesion: 0.29
Nodes (7): Dashboard Module Components, Field Mapping Error Pattern, Immutability Violation Error Pattern, SurveyOS Obsidian Knowledge Base Vault, Claim Store (Zustand), UI Store (Zustand), Dashboard - Mission Control

### Community 19 - "Invoice Test Scripts"
Cohesion: 0.47
Nodes (5): call_gemini(), main(), pdf_to_jpeg_base64(), Direct test: convert DTC Proforma Invoice-1.PDF to image and send to Gemini. Ru, Convert PDF pages to JPEG base64. Returns list of (mime, base64) tuples.

### Community 20 - "Misc Group 20"
Cohesion: 0.33
Nodes (0): 

### Community 21 - "Misc Group 21"
Cohesion: 0.47
Nodes (1): UIICExcelBuilder

### Community 22 - "Misc Group 22"
Cohesion: 0.33
Nodes (6): Next.js Application Project, File Icon SVG, Globe / Web Icon SVG, Next.js Wordmark Logo SVG, Vercel Triangle Logo SVG, Window / Browser Icon SVG

### Community 23 - "Misc Group 23"
Cohesion: 0.4
Nodes (1): ErrorBoundary

### Community 24 - "Misc Group 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Misc Group 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Misc Group 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Misc Group 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Misc Group 28"
Cohesion: 1.0
Nodes (2): Completed Features (2026-04-12 to 2026-04-13), IRDAI Annual Summary Export Feature

### Community 29 - "Misc Group 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Misc Group 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Misc Group 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Misc Group 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Misc Group 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Misc Group 34"
Cohesion: 1.0
Nodes (1): Claim Type Error Pattern (Spot vs Standard)

### Community 35 - "Misc Group 35"
Cohesion: 1.0
Nodes (1): C-3 Master AI API Keys Readable by All Users

### Community 36 - "Misc Group 36"
Cohesion: 1.0
Nodes (1): H-4 console.log Leaks UIDs in Production

### Community 37 - "Misc Group 37"
Cohesion: 1.0
Nodes (1): March 2026 Model Catalog

## Ambiguous Edges - Review These
- `Windshield Closeup with Stickers – RJ23GD1504` → `Windshield – Heavy Dirt Contamination`  [AMBIGUOUS]
  photosheetsforreview_extracted/images/WhatsApp Unknown 2026-04-16 at 1.25.41 PM/WhatsApp Image 2026-04-16 at 1.25.33 PM.jpeg · relation: shows

## Knowledge Gaps
- **63 isolated node(s):** `Test script to validate the extraction quality of the DTC Proforma Invoice usin`, `Convert PDF pages to base64 JPEG images.`, `Call Gemini API with images.`, `Direct test: convert DTC Proforma Invoice-1.PDF to image and send to Gemini. Ru`, `Convert PDF pages to JPEG base64. Returns list of (mime, base64) tuples.` (+58 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Misc Group 24`** (2 nodes): `analyze_pdf.py`, `analyze_pdf()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 25`** (2 nodes): `gen_chunks.py`, `make_node()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 26`** (2 nodes): `test_nv_key.py`, `test_minimax()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 27`** (2 nodes): `extract.js`, `extractPdf()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 28`** (2 nodes): `Completed Features (2026-04-12 to 2026-04-13)`, `IRDAI Annual Summary Export Feature`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 29`** (1 nodes): `check_claim_sizes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 30`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 31`** (1 nodes): `extract_pdf.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 32`** (1 nodes): `uiic-html-builder.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 33`** (1 nodes): `telemetry.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 34`** (1 nodes): `Claim Type Error Pattern (Spot vs Standard)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 35`** (1 nodes): `C-3 Master AI API Keys Readable by All Users`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 36`** (1 nodes): `H-4 console.log Leaks UIDs in Production`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc Group 37`** (1 nodes): `March 2026 Model Catalog`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Windshield Closeup with Stickers – RJ23GD1504` and `Windshield – Heavy Dirt Contamination`?**
  _Edge tagged AMBIGUOUS (relation: shows) - confidence is low._
- **What connects `Test script to validate the extraction quality of the DTC Proforma Invoice usin`, `Convert PDF pages to base64 JPEG images.`, `Call Gemini API with images.` to the rest of the system?**
  _63 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Auth & Access Control` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Project Docs & Knowledge Base` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Claim Processing & Reports` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Cloud Storage & Sync` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Claim UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._