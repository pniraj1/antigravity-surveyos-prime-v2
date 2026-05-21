# SurveyOS Prime V2 — Gemini / Antigravity Instructions

## Agent Protocol (MUST READ FIRST)
Read and follow: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/AGENT_PROTOCOL.md`

This is your source of truth for:
- Where to put files → `Rules/File_Placement.md`
- How to name things → `Rules/Naming_Conventions.md`
- What to read before starting → `Tasks.md`, latest `Sessions/` log
- What to update before stopping → `Tasks.md`, `Changelog.md`, new session log
- How to hand off to other agents → `Rules/Handoff_Protocol.md`

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read.**

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — risk-scored analysis |
| `get_review_context` | Need source snippets — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding impacted execution paths |
| `query_graph` | Tracing callers, callees, imports, tests |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | High-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

## Token Optimization
- Use graph tools BEFORE file reads (saves 70-80% tokens)
- Read vault docs (`Architecture/`, `Features/`) BEFORE scanning source files
- If context gets large, save state to `Tasks.md` and ask user to start fresh

## Next.js Warning
This project uses **Next.js 16** with breaking changes. Check `node_modules/next/dist/docs/` before writing code.
