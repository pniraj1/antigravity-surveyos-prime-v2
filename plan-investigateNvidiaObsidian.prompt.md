## Plan: Investigate NVIDIA → Obsidian integration and model inventory

TL;DR - I located the script that writes to the Obsidian vault (`scripts/vault-log.mjs`) and the AI provider mappings (`src/lib/ai/service.ts`). Next steps: inspect the vault-writing script, enumerate configured models, verify NVIDIA usage (NIM), and confirm whether Anthropic/Claude can proxy OpenAI/Codex.

**Steps**
1. Inspect `scripts/vault-log.mjs` to confirm how requests are formed, which NVIDIA model is called, and how Markdown is composed and written to the vault. (*depends on step 2*)
2. Enumerate providers and model names in `src/lib/ai/service.ts` and any profile fields (`src/types/vehicle.ts`) to produce a canonical model list. (*parallelizable with step 3*)
3. Run the `scripts/tests/test_nv_key.py` (or a dry-run) to validate NVIDIA NIM connectivity and sample response format. (*depends on credentials being available*)
4. Search docs for any claims that Claude can call OpenAI/Codex; if ambiguous, flag for vendor confirmation. (no code change)
5. Produce a short recommendations doc with: token-saving options (model selection, caching, AST + semantic split, tuning), a small checklist to centralize provider configs, and a follow-up task to add a `models.json` manifest.

**Relevant files**
- `scripts/vault-log.mjs` — script that posts to NVIDIA NIM and writes Markdown into the Obsidian vault
- `src/lib/ai/service.ts` — AI gateway/provider mapping & model list
- `scripts/tests/test_nv_key.py` — connectivity test for NVIDIA endpoint
- `claude_handover.md`, `CLAUDE.md`, `AGENTS.md` — docs referencing Claude and the Obsidian vault
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/ANTIGRAVITY_BIBLE.md` — lists many provider model names

**Verification**
1. Run `node scripts/vault-log.mjs` (dry-run or with test key) and inspect `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/*.md` output.
2. Run `python scripts/tests/test_nv_key.py` to confirm HTTP response structure from NVIDIA NIM.
3. Confirm `src/lib/ai/service.ts` contains model IDs and whether any model is marked `vision`.
4. Re-run repo search for `codex`/`Codex` and for phrases like "OpenAI inside Claude" to confirm absence/presence.

**Decisions / Assumptions**
- Assumed remote NVIDIA NIM is used via HTTP (no local SDK in deps).
- No evidence found of Codex or OpenAI being run inside Claude in this repo; vendor-level claim requires external confirmation.

**Further considerations**
1. If you want me to proceed, I can (A) inspect `scripts/vault-log.mjs` and summarize its request/response and Markdown template, (B) produce a canonical model list from `src/lib/ai/service.ts`, and (C) run the NVIDIA test script if you provide test credentials or permit a dry-run.
2. Option: Add a `models.json` manifest and small helper to centralize model selection and token-cost metadata.
