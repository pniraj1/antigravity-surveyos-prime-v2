# SurveyOS Prime V2 — Claude Code Instructions

## Agent Protocol (MUST READ FIRST)
Read and follow: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/AGENT_PROTOCOL.md`

This is your source of truth for:
- Where to put files → `Rules/File_Placement.md`
- How to name things → `Rules/Naming_Conventions.md`
- What to read before starting → `Tasks.md`, latest `Sessions/` log
- What to update before stopping → `Tasks.md`, `Changelog.md`, new session log
- How to hand off to other agents → `Rules/Handoff_Protocol.md`

## Prime ↔ SurveyOS Scan: check the other side (owner rule, 2026-10-25)
SurveyOS Scan (sibling repo `../SurveyOS Scan`, native Android) is Prime's helper. Every change on either side must account for its impact on the other, in the same piece of work.
- **Coupling points** — touching any of these in Prime means checking Scan:
  - doc types, labels and aliases (`documents.ts`, `DocumentChecklist.tsx`)
  - insurer table and claim folder naming
  - the claim folder layout Prime reads from Drive (photo folders such as "Final Photos")
  - spot and valuation field labels (`SpotPrintReport.tsx`, `SpotTab.tsx`, `ValuationTab.tsx`, `valuation-report-builder.ts`)
  - claim paths, such as `spotDetails.*` and `valuationDetails.*`
  - the Scan manifest `_surveyos-scan.json` and its import
- **How to check:**
  - Run Scan's unit tests (`./gradlew :app:testDebugUnitTest` in Git Bash, `JAVA_HOME` = Android Studio jbr). Its drift tests read these Prime files and fail on renames.
  - Read `../SurveyOS Scan/docs/handover/` for the contract.
- **Scan → Prime:** a Scan change that alters the manifest, the folder layout or the notes must update `../SurveyOS Scan/docs/handover/` and say what Prime must change.
- **When you report a change**, state the impact on the other app, even when it is "none".

## Token Optimization
- Use graphify / code-review-graph MCP tools BEFORE Grep/Glob/Read
- Read vault docs (`Architecture/`, `Features/`) BEFORE scanning source files
- If context gets large, save state to `Tasks.md` and ask user to start fresh

## Next.js Warning
This project uses **Next.js 16** with breaking changes. Check `node_modules/next/dist/docs/` before writing code.
