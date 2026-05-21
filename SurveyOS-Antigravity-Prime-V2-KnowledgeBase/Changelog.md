# Changelog

> Most recent entries at the top. Updated by whichever agent makes changes.

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
