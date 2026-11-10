# Session Log: OIC Portal Fill rebuild

**Date:** 2026-11-10
**Agent:** Claude Code
**Branch:** `main` (commits 0abced2c..e297fff0, not pushed, not deployed)
**Prime ↔ SurveyOS Scan Impact:** None.

## What happened
1. Audited the OIC fill failure on the owner's saved pages. The real cause is B1 (the claim number read twice over) and B2 (the map's `from` keys were wrong). The handover's iframe/route theory was rejected. Notes: `docs/superpowers/specs/2026-11-10-oic-portal-fill-debug.md`.
2. Fixed the OIC Excel: not-billed, not-allowed and zero rows are left out.
3. Read OIC's live form code (owner logged in, read-only). Each step's Next saves the whole step as a draft; Submit makes it final.
4. The owner chose **typing into the boxes** over saving drafts to OIC's server, approved the defaults, and confirmed: initial loss amount = net liability (billed and allowed, assessed), workshop estimate amount = bill total, DL verified always Yes.
5. Design `docs/superpowers/specs/2026-11-10-oic-portal-fill-design.md`, plan `docs/superpowers/plans/2026-11-10-oic-portal-fill.md`; Tasks 1–5 built subagent-driven, each task reviewed, plus a final whole-branch review and fix wave.

## Open
- Task 6 live checks with the owner (see Tasks.md). Then build and offer the deploy; nothing is deployed without approval.
