# SurveyOS Prime V2 — Knowledge Base Index

> Central index and catalog for the SurveyOS Prime V2 Obsidian vault / Second Brain.
> Structured according to the Karpathy LLM Wiki pattern and agent protocols.

## Core Protocol & Handover
- [[AGENT_PROTOCOL]] — Master agent protocol & single source of truth
- [[HANDOVER]] — Primary live handover and product status
- [[HANDOVER_2026_11_16_CLAUDE]] — Master handover covering Bill Check Cockpit & Orange Theme
- [[HANDOVER_2026_11_10_CLAUDE]] — Previous sprint handover to Claude Code
- [[Tasks]] — Active task tracking & backlog
- [[Changelog]] — Chronological changelog of releases and commits
- [[READ_ME_FIRST]] — Quickstart guide for opening and navigating this vault

## Architecture & System Design
- [[Architecture/Codebase_Architecture_Map|Codebase Architecture Map]] — Complete line-by-line architecture, topology, lifecycle, and coupling map
- [[Architecture/Overview|Architecture Overview]] — High-level system architecture, tech stack, and data flow
- [[Architecture/Claim_Lifecycle|Claim Lifecycle]] — Complete end-to-end claim data and status lifecycle
- [[Architecture/Data_Dictionary|Data Dictionary]] — Schema definition for claims, vehicles, policies, and estimates
- [[Architecture/State_Management|State Management]] — Zustand store slices and reactivity rules
- [[Architecture/UI_Refactor_Guardrails|UI Refactor Guardrails]] — Guardrails preventing regressions during UI overhauls

## Core Features & Subsystems
- [[Features/Assessment_Grid|Damage Assessment Grid]] — IRDAI-compliant damage assessment spreadsheet grid
- [[Features/AI_Extraction|AI Extraction Engine]] — Multi-model chunking, OCR, and deterministic DMS parsing
- [[Features/Portal_Fill_Extension|Portal Fill Chrome Extension]] — MV3 sidecar automating UIIC, OIC, and NIA portals
- [[Features/Claim_Document_Kit|Claim Document Kit]] — Document collection and ZIP assembly
- [[Features/PDF_Reports|PDF & Print Reports]] — Twin-engine report generators (Standard A4 and UIIC 13-column)
- [[Features/Cloud_Sync|Offline Cloud Sync]] — Offline-first IndexedDB and Firestore sync queue
- [[Features/Google_Drive_Integration|Google Drive Integration]] — Backup vault and photo synchronization
- [[Features/IndexedDB_Schema|IndexedDB Tenant Schema]] — Local tenant-isolated storage structure (`surveyos-v2-UID`)
- [[Features/Volkswagen_DMS_Parser|Volkswagen DMS Parser]] — Deterministic token-level parser for digital DMS PDFs
- [[Features/Subscription_System|Subscription System]] — Surveyor tiering and Bring-Your-Own-Key (BYOK) architecture
- [[Features/Authentication|Authentication]] — Firebase Google Auth and silent anonymous sandbox access
- [[Features/Admin_Dashboard|Admin Dashboard]] — Surveyor user management and system metrics
- [[Features/Landing_Page|Landing Page]] — Public-facing landing page design and conversion funnel

## Project Bramha
- [[Project_Bramha/Overview|Project Bramha Overview]] — Agentic RAG intelligence layer
- [[Project_Bramha/The_Magic_Explained|The Magic Explained]] — Vector search and zero-PII consensus matching

## Reference & Bibles
- [[Reference/ANTIGRAVITY_BIBLE|Antigravity Bible]] — Canonical principles and rules for Antigravity agents
- [[Reference/AI_Field_Extraction_Mapping|AI Field Extraction Mapping]] — Mapping between raw document fields and claim store paths
- [[Reference/Token_Optimization|Token Optimization]] — Strategies for minimizing token consumption during analysis
- [[Reference/Error_Handling|Error Handling]] — Diagnostic patterns and error-recovery mechanisms
- [[Reference/User_Manual|User Manual]] — End-user manual for insurance surveyors

## Operational Rules & Governance
- [[Rules/Handoff_Protocol|Handoff Protocol]] — Rules for handing off between Claude Code and Antigravity
- [[Rules/File_Placement|File Placement]] — Where to place new components, libraries, and vault documents
- [[Rules/Naming_Conventions|Naming Conventions]] — Standardized casing and naming rules
- [[Rules/Documentation_Protocol|Documentation Protocol]] — Maintenance protocol for keeping docs synchronized with code
- [[Operations/Admin_Guide|Admin Guide]] — Runbook for administrator operations
- [[Operations/Launch_Checklist|Launch Checklist]] — Pre-flight checklist before production deployments
- [[Operations/Security_Audit|Security Audit]] — Security assessment and credential protection rules

## Patterns
- [[Patterns/Sequential_Numbering|Sequential Numbering Pattern]] — Managing line item serial numbers across split chunks

## Key Specifications & Plans
- [[Specs/2026-11-16-bill-check-document-kind-report|Bill Check Document Kind Report]]
- [[Specs/2026-11-07-oic-portal-fill-full-steps-plan|OIC Portal Fill Full Steps Plan]]
- [[Specs/2026-11-06-assessment-grid-excel-paste-and-formulas-design|Assessment Grid Excel Paste & Formulas Design]]
- [[Specs/2026-11-05-unified-claim-folder-and-storage-design|Unified Claim Folder & Storage Design]]
- [[Specs/2026-11-05-scan-gallery-stamp-mode-design|Scan Gallery Stamp Mode Design]]
- [[Specs/2026-11-04-user-onboarding-design|User Onboarding Design]]
- [[Specs/2026-10-27-bill-check-reference-serial-design|Bill Check Reference Serial Design]]

## Recent Session Logs
- [[Sessions/2026-11-17-uiic-spot-dates-ai-model-note|2026-11-17 UIIC Spot Dates & AI Model Note]]
- [[Sessions/2026-11-16-surveyor-controlled-tallying-cockpit|2026-11-16 Surveyor Controlled Tallying Cockpit]]
- [[Sessions/2026-11-16-orange-themed-billcheck-dialog-workflow|2026-11-16 Orange Themed Bill Check Dialog Workflow]]
- [[Sessions/2026-11-16-cockpit-stage3-stage4|2026-11-16 Cockpit Stage 3/4]]
- [[Sessions/2026-11-16-bill-check-columns|2026-11-16 Bill Check Columns]]
- [[Sessions/2026-11-16-bill-check-document-kind-fixes|2026-11-16 Bill Check Document Kind Fixes]]
- [[Sessions/2026-11-16-handover-to-claude|2026-11-16 Handover to Claude]]
- [[Sessions/2026-11-14-codebase-architecture-map|2026-11-14 Codebase Architecture Map]]
- [[Sessions/2026-11-14-parser-robustness|2026-11-14 Parser Robustness]]
- [[Sessions/2026-11-14-assessment-billcheck-usability|2026-11-14 Assessment & Bill Check Usability]]
