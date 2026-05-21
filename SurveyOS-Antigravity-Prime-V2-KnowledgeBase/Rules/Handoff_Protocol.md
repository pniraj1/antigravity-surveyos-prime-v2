# Handoff Protocol

> How to hand off work between AI agents (Claude Code and Google Antigravity).

## The Problem This Solves

When Agent A stops working and Agent B starts, Agent B has no memory of what Agent A did. The vault bridges this gap — it's the shared memory that both agents read and write.

## Handoff Flow

```
Agent A (finishing):
  1. Update Tasks.md with current state
  2. Write session log in Sessions/
  3. Update Changelog.md
  4. Commit changes to git

[User switches agents]

Agent B (starting):
  1. Read AGENT_PROTOCOL.md (this is automatic via CLAUDE.md / GEMINI.md)
  2. Read Tasks.md — see what's pending/in-progress/blocked
  3. Read latest Session log — understand what Agent A did
  4. Read Changelog.md (last 5 entries) — see recent changes
  5. Run git status — check for uncommitted work
  6. Continue work
```

## What to Write in the Session Log

The session log is the most critical handoff document. Write it as if you're briefing a colleague who has never seen the project:

**Required sections:**
- **What I Did** — concrete list of changes (not "worked on X")
- **What's Unfinished** — with enough context to continue (not just "finish the feature")
- **Decisions Made** — any choices that affect future work
- **Files Changed** — with modification type (new/modified/deleted)

**Optional sections (when relevant):**
- **Blockers** — what's preventing progress
- **Open Questions** — things that need user input
- **Warnings** — gotchas the next agent should know about

## Handling In-Progress Tasks

If you find a task marked "in-progress" that you didn't start:

1. Read the session log from the agent that started it
2. Check git log for related commits
3. Run `git diff` to see any uncommitted changes
4. Either **continue the task** or **mark it blocked** with a reason

Never silently restart a task that another agent was working on.

## Emergency Handoff (Context Window Full)

If your context window is getting large:

1. Save ALL current state to `Tasks.md`
2. Write a detailed session log
3. Update `Changelog.md`
4. Tell the user: "Context is full. I've saved state to the vault. Please start a new session."

The next agent will pick up from `Tasks.md` and the session log.
