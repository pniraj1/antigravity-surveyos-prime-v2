# Graph Report - .  (2026-05-12)

## Corpus Check
- Large corpus: 202 files · ~215,824 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 673 nodes · 944 edges · 78 communities detected
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.85)
- Token cost: 32,300 input · 8,100 output

## God Nodes (most connected - your core abstractions)
1. `getDB()` - 22 edges
2. `driveRequest()` - 14 edges
3. `System Architecture â€” Static Next.js + Firebase Backend` - 12 edges
4. `Re-Inspection (RI) Report (Sample)` - 11 edges
5. `parseDate()` - 9 edges
6. `getRootFolder()` - 8 edges
7. `SurveyOS Prime V2 â€” AI-Powered Survey Management Platform` - 8 edges
8. `Project Bramha Blueprint` - 8 edges
9. `getDriveToken()` - 7 edges
10. `getOrCreateClaimFolder()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Token-Efficient Development DOs and DONTs` --semantically_similar_to--> `Obsidian Vault â€” AI Token Reduction Instruction`  [INFERRED] [semantically similar]
  SurveyOS-Antigravity-Prime-V2-KnowledgeBase/AI_Field_Extraction_Mapping.md → AGENTS.md
- `Client-Side Image Compression Strategy` --semantically_similar_to--> `Photo Processing Engine â€” Canvas Resize & JPEG Compression`  [INFERRED] [semantically similar]
  claude_handover.md → README_DEEP.md
- `Database Separation / Schema Splitting Strategy` --semantically_similar_to--> `IndexedDB driveFileCache Store â€” Per-FileId Blob Cache (DB v4)`  [INFERRED] [semantically similar]
  claude_handover.md → docs/superpowers/plans/2026-05-09-drive-document-reuse.md
- `Knowledge Base â€” 01 Architecture and Status` --semantically_similar_to--> `System Architecture â€” Static Next.js + Firebase Backend`  [INFERRED] [semantically similar]
  SurveyOS-Antigravity-Prime-V2-KnowledgeBase/01_Architecture_and_Status.md → docs/ARCHITECTURE.md
- `Module 0 â€” Big Picture: Offline-First AI Operating System` --conceptually_related_to--> `3-Layer Persistence Model (In-Memory / Local / Cloud)`  [EXTRACTED]
  README_DEEP.md → README.md

## Hyperedges (group relationships)
- **Offline-First Persistence Pipeline** — readme_3layer_persistence, readme_milestone_push_sync, readme_deep_module1_foundation, docs_architecture_zustand_stores, kb_01_broadcast_channel_sync [EXTRACTED 1.00]
- **Access Control & User Onboarding System** — docs_access_pending_status, docs_admin_new_signups, docs_admin_subscription_statuses, docs_access_hardened_firestore_rules, readme_rbac_firebase, docs_architecture_auth_flow [EXTRACTED 1.00]
- **XSS Attack Chain: No CSP + OAuth in localStorage + DOMPurify iframe** — docs_security_h1_no_security_headers, docs_security_h2_oauth_localstorage, docs_security_h3_dompurify_iframe [EXTRACTED 1.00]
- **Memory Bloat Mitigation Strategy** — handover_memory_bloat_problem, handover_compression_strategy, handover_db_separation_strategy, handover_soft_archiving_strategy, readme_deep_photo_squeezer [EXTRACTED 1.00]
- **Drive Document Reuse Feature** — docs_drive_reuse_design_spec, docs_drive_reuse_plan, docs_drive_reuse_files_ts, docs_drive_reuse_list_cache, docs_drive_reuse_indexeddb_blob_cache, docs_drive_reuse_duplicate_dialog, docs_drive_reuse_use_claim_drive_files_hook [EXTRACTED 1.00]
- **AI Multi-Model Extraction Pipeline** — readme_multimodel_routing, readme_gemini_extraction, docs_architecture_ai_pipeline, kb_ai_field_extraction_mapping, kb_ai_field_extraction_error_handling [EXTRACTED 1.00]
- **AI Token Reduction Instructions** — agents_obsidian_vault_instruction, gemini_md_mcp_instructions, kb_ai_context_index, kb_ai_field_extraction_dev_rules [EXTRACTED 1.00]
- **Report Generation System (PDF/Word/Excel)** — docs_architecture_report_builders, readme_deep_module4_forge, kb_01_power_print_pdf, kb_01_uiic_excel_bridge [EXTRACTED 1.00]
- **Project Bramha 4-Step Intelligence Cycle** — bramha_vision_to_text, bramha_embedding, bramha_vector_db_search, bramha_rag_generation [EXTRACTED 1.00]
- **Bramha Agentic RAG: Three Specialized Agents** — bramha_agent_extractor, bramha_agent_assessor, bramha_agent_reviewer [EXTRACTED 1.00]
- **SurveyOS Claim Full Lifecycle (5 Phases)** — claim_lifecycle_phase1_intake, claim_lifecycle_phase2_assessment, claim_lifecycle_phase3_financials, claim_lifecycle_phase4_output, claim_lifecycle_phase5_archive [EXTRACTED 1.00]
- **Antigravity Triple-Layer AI Pipeline** — antigravity_bible_openrouter, antigravity_bible_nvidia_nim, antigravity_bible_ollama [EXTRACTED 1.00]
- **SurveyOS Zustand Store Triad** — state_mgmt_claim_store, state_mgmt_ui_store, state_mgmt_profile_store [EXTRACTED 1.00]
- **SurveyOS Dual Storage System** — storage_indexeddb_surveyos_db, storage_cloud_sync_profile_backup, storage_cloud_sync_auto_upload [EXTRACTED 1.00]
- **Security Audit: 3 Critical Issues Fixed** — security_audit_c1_xss, security_audit_c2_hardcoded_key, security_audit_c3_firestore_rules [EXTRACTED 1.00]
- **2026-05-12 Race Condition Fix: Two-Part Patch** — session_2026_05_12_route_sync_fix, session_2026_05_12_sidebar_batch, state_mgmt_race_condition_fix [EXTRACTED 1.00]
- **SurveyOS Dual Reporting Engine** — module_reporting_power_print, module_reporting_excel_bridge, data_dict_uiic_excel_builder, data_dict_react_pdf_engine [EXTRACTED 1.00]
- **Motor Valuation Report Structure** — motor_valuation_sample_report, motor_valuation_vehicle_details, motor_valuation_vehicle_condition, motor_valuation_idv, motor_valuation_owner, motor_valuation_vehicle_tata_zest [EXTRACTED 1.00]
- **Reinspection Report Structure** — ri_report_sample, ri_report_policy_details, ri_report_survey_details, ri_report_vehicle_particulars, ri_report_reinspection_finding, ri_report_claim_number [EXTRACTED 1.00]
- **SurveyOS Brand Asset Collection** — app_icon_svg, public_logo_teal_png, public_og_image_png, brand_identity_surveyos [INFERRED 0.85]
- **Next.js Scaffold Default Assets** — public_next_svg, public_vercel_svg, public_file_svg, public_globe_svg, tech_stack_nextjs_vercel [INFERRED 0.90]
- **Motor Insurance Survey Domain Concepts** — concept_motor_insurance_survey, concept_vehicle_break_in_inspection, concept_repair_reinspection, concept_surveyor_credentials, motor_valuation_idv [INFERRED 0.85]
- **Vikram Patil Surveyor Document Portfolio** — motor_valuation_surveyor, motor_valuation_sample_report, ri_report_sample, concept_surveyor_credentials [EXTRACTED 1.00]

## Communities

### Community 0 - "UI Components & Forms"
Cohesion: 0.05
Nodes (0): 

### Community 1 - "Claim Lifecycle & Workflow"
Cohesion: 0.04
Nodes (62): Claim Lifecycle Workflow Document, Claim Phase 1: Intake & Initiation, Claim Phase 2: Assessment & Deepening, Claim Phase 3: Financials (Fee Bill), Claim Phase 4: Output Generation (Reports), Claim Phase 5: Archiving (isActive=false), AssessmentRow (Core Math Engine), ClaimData Master Schema (src/types/claim.ts) (+54 more)

### Community 2 - "AI Instructions & Security"
Cohesion: 0.04
Nodes (59): Obsidian Vault â€” AI Token Reduction Instruction, CLAUDE.md â€” Project AI Instructions, Access Control & User Onboarding Improvements (2026-04-14), Hardened Firestore Rules â€” Replaced Hardcoded UID with isAdmin(), Pending Subscription Status Implementation, Admin Dashboard â€” User Management Guide, Admin New Signups Approval Flow, Subscription Status Badges â€” active / pending / suspended / expired (+51 more)

### Community 3 - "Claim Data Model & Billing"
Cohesion: 0.06
Nodes (32): buildReinspectionHTML(), fa(), fd(), g(), triggerReinspectionPrint(), formatDateDMY(), formatDateTimeDMY(), buildSpotFeeBillDocument() (+24 more)

### Community 4 - "Assessment Chatbot & Controls"
Cohesion: 0.05
Nodes (4): handleKeyDown(), handleSend(), formatDateDMY(), formatDateTimeDMY()

### Community 5 - "Bill Check Grid"
Cohesion: 0.07
Nodes (0): 

### Community 6 - "AI Review Dialog"
Cohesion: 0.1
Nodes (4): addRow(), deleteRow(), handle(), updateRow()

### Community 7 - "IndexedDB & Drive Sync"
Cohesion: 0.14
Nodes (24): addToDriveQueue(), addToSyncQueue(), deleteClaim(), getAllClaims(), getAllPushedAt(), getClaim(), getDB(), getDriveQueue() (+16 more)

### Community 8 - "Bramha Embeddings & Profile"
Cohesion: 0.19
Nodes (16): backupProfileToDrive(), clearStoredToken(), createFolder(), downloadFileAsBase64(), driveRequest(), findFolder(), flushDriveQueue(), getDriveToken() (+8 more)

### Community 9 - "Motor Insurance Domain"
Cohesion: 0.11
Nodes (23): Motor Insurance Survey Process, Post-Repair Reinspection Workflow, Surveyor Credentials and Licensing (IIISLA), Vehicle Break-In Inspection for Insurance, Insured Declared Value (IDV) / Market Valuation, Odometer Reading (152311 km), Vehicle Owner: Govindrao B Nerkar, Vehicle Registration Number MH.18.AJ.4317 (+15 more)

### Community 10 - "Fee Calculation & GST"
Cohesion: 0.13
Nodes (8): buildAnalytics(), buildClaimRegister(), buildInsurerSummary(), buildMonthSummary(), filterClaimsForExport(), generateIRDAISummary(), getFYLabel(), getFYRange()

### Community 11 - "Assessment Grid & Evidence"
Cohesion: 0.13
Nodes (8): resetDefaults(), saveVisibility(), showAll(), toggleColumn(), applyDepreciation(), getAgeLabel(), getDepPolicyLabel(), getDepreciationRate()

### Community 12 - "AI Data Slice"
Cohesion: 0.22
Nodes (13): applyAuth(), applyClaim(), applyDL(), applyFinalBill(), applyFitness(), applyLokChallan(), applyPermit(), applyPolicy() (+5 more)

### Community 13 - "Drive Document Reuse"
Cohesion: 0.14
Nodes (16): Drive Document Reuse Design Spec (2026-05-09), DuplicateUploadDialog â€” View Existing / Upload Anyway / Replace, src/lib/drive/files.ts â€” listClaimDriveFiles / ensureFileInCache / findFileByName, IndexedDB driveFileCache Store â€” Per-FileId Blob Cache (DB v4), src/lib/drive/list-cache.ts â€” In-Memory Per-Claim File List Cache, Drive Document Reuse Implementation Plan, useClaimDriveFiles Hook â€” Shared Drive Files State, activeOrigin State â€” Reconciliation Dialog Source Document Selection (+8 more)

### Community 14 - "Admin Dashboard"
Cohesion: 0.14
Nodes (2): fetchAllProfiles(), handleApprove()

### Community 15 - "Bramha Agent Triad"
Cohesion: 0.14
Nodes (15): Bramha Agent B: Assessor, Bramha Agent A: Extractor, Bramha Agent C: Reviewer (IRDAI Compliance), Bramha Global Collective Intelligence, Bramha Step 2: Embedding (Meaning Map, 768-dim vector), Bramha Magic Explained (4-Step Intelligence Cycle), Bramha Vector DB: Firebase Native Firestore (bramha_memories), Bramha Folder Isolation Rule (+7 more)

### Community 16 - "Cloud Vault & Sync"
Cohesion: 0.19
Nodes (6): fetchData(), handleRestore(), pushClaimToCloud(), sanitize(), stripPhotos(), syncDeltaToCloud()

### Community 17 - "Legacy Assessment Grid"
Cohesion: 0.19
Nodes (4): resetDefaults(), saveVisibility(), showAll(), toggleColumn()

### Community 18 - "AI Model Architecture"
Cohesion: 0.23
Nodes (12): Context Window Concept, Antigravity Bible (Layman Edition), Large Language Model (LLM) Concept, NVIDIA NIM Turbo Fallback (Layer 2), Ollama Local Infinite (Layer 3), OpenRouter Cloud Hub (Layer 1), Local AI Privacy Rationale (Data Vault), Smart Router / Magic Dispatcher (+4 more)

### Community 19 - "Reconciliation Engine"
Cohesion: 0.27
Nodes (4): buildFields(), getConflictFields(), getNestedValue(), getUnanimousFields()

### Community 20 - "Bank Statement Extractor"
Cohesion: 0.25
Nodes (2): extractBankStatement(), parseCsvTransactions()

### Community 21 - "UIIC Excel Builder"
Cohesion: 0.47
Nodes (1): UIICExcelBuilder

### Community 22 - "Error Boundary"
Cohesion: 0.4
Nodes (1): ErrorBoundary

### Community 23 - "Cloud Sync Logic"
Cohesion: 0.67
Nodes (4): Auto Push Files Toggle (Photos/Documents to Drive), Cloud Sync & Google Drive Backup Logic, Profile Backup (surveyos_profile_backup.json, always-on), Rationale: Separate high-bandwidth uploads from critical config sync

### Community 24 - "Brand Identity Assets"
Cohesion: 0.5
Nodes (4): App Favicon / Icon (Hexagon + S), SurveyOS Brand Identity, SurveyOS Teal Logo PNG, Open Graph Social Share Image PNG

### Community 25 - "Next.js & Vercel Stack"
Cohesion: 0.67
Nodes (3): Next.js Wordmark SVG, Vercel Logo SVG (Triangle), Next.js + Vercel Technology Stack

### Community 26 - "UI Design Icons"
Cohesion: 0.67
Nodes (3): UI Design System Icons (file, globe), File/Document Icon SVG, Globe / Web Icon SVG

### Community 27 - "Previous Grid Version"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "API Key Testing"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "PDF Extraction"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Sitemap & SEO"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Valuation Report Document"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Drive Truth Architecture"
Cohesion: 1.0
Nodes (2): Drive Reuse Architecture â€” Three Units (files.ts / DocumentsTab / DuplicateDialog), Rationale: Drive Holds Truth â€” UI Ignores Drive â†’ Duplicate Uploads

### Community 33 - "DnD Row Reordering Session"
Cohesion: 1.0
Nodes (2): AssessmentGrid.tsx: dnd-kit Row Reordering Restored, Session Log 2026-05-11 (DnD Row Reordering Restored)

### Community 34 - "Next.js Config"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Old Grid Component"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "PDF Extractor Script"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Type Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Auth Sync Wrapper"
Cohesion: 1.0
Nodes (1): AuthSyncWrapper

### Community 39 - "Accident Form"
Cohesion: 1.0
Nodes (1): AccidentForm

### Community 40 - "Assessment Summary"
Cohesion: 1.0
Nodes (1): AssessmentSummary

### Community 41 - "Driver Form"
Cohesion: 1.0
Nodes (1): DriverForm

### Community 42 - "Photo Sheet Document"
Cohesion: 1.0
Nodes (1): PhotoSheetDocument

### Community 43 - "Spot Report Document"
Cohesion: 1.0
Nodes (1): SpotReportDocument

### Community 44 - "Survey Report Document"
Cohesion: 1.0
Nodes (1): SurveyReportDocument

### Community 45 - "UIIC Report Document"
Cohesion: 1.0
Nodes (1): UIICReportDocument

### Community 46 - "Spot Print Report"
Cohesion: 1.0
Nodes (1): SpotPrintReport

### Community 47 - "UIIC Print Report"
Cohesion: 1.0
Nodes (1): UIICPrintReport

### Community 48 - "Assessment Tab"
Cohesion: 1.0
Nodes (1): AssessmentTab

### Community 49 - "Documents Tab"
Cohesion: 1.0
Nodes (1): DocumentsTab

### Community 50 - "Fees Tab"
Cohesion: 1.0
Nodes (1): FeesTab

### Community 51 - "Photos Tab"
Cohesion: 1.0
Nodes (1): PhotosTab

### Community 52 - "Profile Tab"
Cohesion: 1.0
Nodes (1): ProfileTab

### Community 53 - "Reinspection Tab"
Cohesion: 1.0
Nodes (1): ReinspectionTab

### Community 54 - "Review Tab"
Cohesion: 1.0
Nodes (1): ReviewTab

### Community 55 - "Spot Tab"
Cohesion: 1.0
Nodes (1): SpotTab

### Community 56 - "useAutoSave Hook"
Cohesion: 1.0
Nodes (1): useAutoSave

### Community 57 - "useClaimsLoader Hook"
Cohesion: 1.0
Nodes (1): useClaimsLoader

### Community 58 - "useCloudSync Hook"
Cohesion: 1.0
Nodes (1): useCloudSync

### Community 59 - "Processor Module"
Cohesion: 1.0
Nodes (1): processor

### Community 60 - "Service Module"
Cohesion: 1.0
Nodes (1): service

### Community 61 - "Assessment Module"
Cohesion: 1.0
Nodes (1): assessment

### Community 62 - "UIIC HTML Builder"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Telemetry Module"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Window Icon SVG"
Cohesion: 1.0
Nodes (1): Window SVG Icon

### Community 65 - "Next.js Breaking Changes"
Cohesion: 1.0
Nodes (1): Next.js Agent Rules (Breaking Changes Warning)

### Community 66 - "Pre-Launch Checklist"
Cohesion: 1.0
Nodes (1): Pre-Launch Actions (ordered) â€” API key rotation, GitHub Secrets, user flow testing

### Community 67 - "Admin UID Security Issue"
Cohesion: 1.0
Nodes (1): MEDIUM M4 â€” Master Admin UID Exposed in Bundle

### Community 68 - "SEO Crawl Rules"
Cohesion: 1.0
Nodes (1): robots.txt â€” SEO Crawl Rules

### Community 69 - "Mistral Devstral Model"
Cohesion: 1.0
Nodes (1): Mistral Devstral-2 (Coding Expert)

### Community 70 - "Gemini Flash Model"
Cohesion: 1.0
Nodes (1): Gemini 3.1 Flash (Architect / Research)

### Community 71 - "Llama 3.3 Model"
Cohesion: 1.0
Nodes (1): Llama 3.3 70B (Reasoning Muscle)

### Community 72 - "Qwen-3 Model"
Cohesion: 1.0
Nodes (1): Qwen-3 Coder (Fast Intern)

### Community 73 - "MCP Protocol"
Cohesion: 1.0
Nodes (1): Model Context Protocol (MCP)

### Community 74 - "Field Mapping Debug Flow"
Cohesion: 1.0
Nodes (1): Field Mapping Error Debug Flow

### Community 75 - "Profile Path Bug"
Cohesion: 1.0
Nodes (1): Pending Task: Fix profile path (main vs current)

### Community 76 - "Admin UID Security Decision"
Cohesion: 1.0
Nodes (1): Decision: Admin UID from env var (not hardcoded)

### Community 77 - "Surveyor License Record"
Cohesion: 1.0
Nodes (1): Surveyor License Number SLA-34369/2025-2028

## Knowledge Gaps
- **123 isolated node(s):** `AuthSyncWrapper`, `AccidentForm`, `AssessmentSummary`, `DriverForm`, `PhotoSheetDocument` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Previous Grid Version`** (2 nodes): `prev_grid.tsx`, `e()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Key Testing`** (2 nodes): `test_nv_key.py`, `test_minimax()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PDF Extraction`** (2 nodes): `extract.js`, `extractPdf()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sitemap & SEO`** (2 nodes): `sitemap.ts`, `sitemap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Valuation Report Document`** (2 nodes): `ValuationReportDocument.tsx`, `g()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Drive Truth Architecture`** (2 nodes): `Drive Reuse Architecture â€” Three Units (files.ts / DocumentsTab / DuplicateDialog)`, `Rationale: Drive Holds Truth â€” UI Ignores Drive â†’ Duplicate Uploads`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DnD Row Reordering Session`** (2 nodes): `AssessmentGrid.tsx: dnd-kit Row Reordering Restored`, `Session Log 2026-05-11 (DnD Row Reordering Restored)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Old Grid Component`** (1 nodes): `old_grid.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PDF Extractor Script`** (1 nodes): `extract_pdf.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Type Declarations`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Sync Wrapper`** (1 nodes): `AuthSyncWrapper`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Accident Form`** (1 nodes): `AccidentForm`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Assessment Summary`** (1 nodes): `AssessmentSummary`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Driver Form`** (1 nodes): `DriverForm`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photo Sheet Document`** (1 nodes): `PhotoSheetDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Spot Report Document`** (1 nodes): `SpotReportDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Survey Report Document`** (1 nodes): `SurveyReportDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UIIC Report Document`** (1 nodes): `UIICReportDocument`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Spot Print Report`** (1 nodes): `SpotPrintReport`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UIIC Print Report`** (1 nodes): `UIICPrintReport`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Assessment Tab`** (1 nodes): `AssessmentTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Documents Tab`** (1 nodes): `DocumentsTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Fees Tab`** (1 nodes): `FeesTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Photos Tab`** (1 nodes): `PhotosTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Tab`** (1 nodes): `ProfileTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reinspection Tab`** (1 nodes): `ReinspectionTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Review Tab`** (1 nodes): `ReviewTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Spot Tab`** (1 nodes): `SpotTab`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `useAutoSave Hook`** (1 nodes): `useAutoSave`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `useClaimsLoader Hook`** (1 nodes): `useClaimsLoader`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `useCloudSync Hook`** (1 nodes): `useCloudSync`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Processor Module`** (1 nodes): `processor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Service Module`** (1 nodes): `service`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Assessment Module`** (1 nodes): `assessment`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UIIC HTML Builder`** (1 nodes): `uiic-html-builder.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Telemetry Module`** (1 nodes): `telemetry.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Window Icon SVG`** (1 nodes): `Window SVG Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Breaking Changes`** (1 nodes): `Next.js Agent Rules (Breaking Changes Warning)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pre-Launch Checklist`** (1 nodes): `Pre-Launch Actions (ordered) â€” API key rotation, GitHub Secrets, user flow testing`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin UID Security Issue`** (1 nodes): `MEDIUM M4 â€” Master Admin UID Exposed in Bundle`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SEO Crawl Rules`** (1 nodes): `robots.txt â€” SEO Crawl Rules`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mistral Devstral Model`** (1 nodes): `Mistral Devstral-2 (Coding Expert)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Gemini Flash Model`** (1 nodes): `Gemini 3.1 Flash (Architect / Research)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Llama 3.3 Model`** (1 nodes): `Llama 3.3 70B (Reasoning Muscle)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Qwen-3 Model`** (1 nodes): `Qwen-3 Coder (Fast Intern)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `MCP Protocol`** (1 nodes): `Model Context Protocol (MCP)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Field Mapping Debug Flow`** (1 nodes): `Field Mapping Error Debug Flow`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Path Bug`** (1 nodes): `Pending Task: Fix profile path (main vs current)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Admin UID Security Decision`** (1 nodes): `Decision: Admin UID from env var (not hardcoded)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Surveyor License Record`** (1 nodes): `Surveyor License Number SLA-34369/2025-2028`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `AuthSyncWrapper`, `AccidentForm`, `AssessmentSummary` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UI Components & Forms` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Claim Lifecycle & Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `AI Instructions & Security` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Claim Data Model & Billing` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Assessment Chatbot & Controls` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Bill Check Grid` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._