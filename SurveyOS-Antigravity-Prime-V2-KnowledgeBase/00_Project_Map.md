# SurveyOS Prime V2 - Map of Content (MOC)

Welcome to the SurveyOS Knowledge Base. This Obsidian vault acts as the central "Second Brain" for the project. By using WikiLinks (`[[Link]]`), we can visually map how all the modular parts of the application connect.

## Core Documentation
* [[Surveyor_User_Manual]] - Friendly, non-technical guide designed for the actual end-users checking the dashboard.
* [[Claim_Lifecycle_Workflow]] - Step-by-step documentation of how a claim breathes from creation to archive.
* [[01_Architecture_and_Status]] - The complete project snapshot, workflow, and future roadmap.
* [[ANTIGRAVITY_BIBLE]] - The core operational rulebook for the AI Agent.
* [[USER_MANUAL]] - Original AI agent operational guidelines and setups.

## Modules
* [[Dashboard]] - The main entry point, claims listing, and IndexedDB hydration via `useClaimsLoader`.
* [[Reporting_Engine]] - Documentation on how to bridge `ClaimData` into legacy `UIICExcelBuilder` or standard `React-PDF`.
* [[Data_Dictionary_and_Flow]] - Exhaustive field-to-field mapping between `ClaimData`, React State, and Output Engines.
* [[State_Management]] - How `Zustand` drives the UI (e.g. `claim-store.ts`).

## Storage & Architecture
* [[IndexedDB_Schema]] - Defines how claims are cached and loaded via offline-first mechanics.
* [[Sequential_Numbering]] - How Report Numbers (SPO vs FIN) trigger auto-increment tracking dynamically.
