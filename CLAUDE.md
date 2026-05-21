# SurveyOS Prime V2 — Claude Code Instructions

## Agent Protocol (MUST READ FIRST)
Read and follow: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/AGENT_PROTOCOL.md`

This is your source of truth for:
- Where to put files → `Rules/File_Placement.md`
- How to name things → `Rules/Naming_Conventions.md`
- What to read before starting → `Tasks.md`, latest `Sessions/` log
- What to update before stopping → `Tasks.md`, `Changelog.md`, new session log
- How to hand off to other agents → `Rules/Handoff_Protocol.md`

## Token Optimization
- Use graphify / code-review-graph MCP tools BEFORE Grep/Glob/Read
- Read vault docs (`Architecture/`, `Features/`) BEFORE scanning source files
- If context gets large, save state to `Tasks.md` and ask user to start fresh

## Next.js Warning
This project uses **Next.js 16** with breaking changes. Check `node_modules/next/dist/docs/` before writing code.
