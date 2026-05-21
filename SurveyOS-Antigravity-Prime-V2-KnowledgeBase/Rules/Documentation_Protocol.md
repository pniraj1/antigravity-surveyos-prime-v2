# Documentation Protocol

> When and how to update the Obsidian vault. All agents MUST follow this.

## When to Update the Vault

| Event | What to Update |
|-------|---------------|
| You modified a feature's behavior | Update its doc in `Features/` |
| You added a new feature | Create a new doc in `Features/` using `_TEMPLATE.md` |
| You changed the data model | Update `Architecture/Data_Dictionary.md` |
| You changed state management | Update `Architecture/State_Management.md` |
| You changed the claim lifecycle | Update `Architecture/Claim_Lifecycle.md` |
| You completed a task | Mark it done in `Tasks.md` |
| You added a task | Add it to `Tasks.md` |
| You made any code change | Add entry to `Changelog.md` |
| You finished a session | Write a session log in `Sessions/` |
| You discovered a pattern | Document it in `Patterns/` |
| You wrote a design spec | Save to `Specs/` with date prefix |

## How to Write a Feature Doc

Use the template at `Features/_TEMPLATE.md`:

1. Copy the template
2. Fill in every section — no "TBD" or empty sections
3. List actual file paths (verify they exist)
4. Document known issues with dates
5. Link to related features with `[[Feature_Name]]`

## How to Write a Session Log

Save to `Sessions/YYYY-MM-DD-{agent}.md`:

```markdown
# Session: YYYY-MM-DD (Agent Name)

## What I Did
- (bullet list of changes)

## What's Unfinished
- [ ] (pending items with context)

## Decisions Made
- (architectural or design decisions with reasoning)

## Files Changed
- path/to/file.ts (modified/new/deleted)
```

If multiple sessions happen on the same day, append a number: `2026-05-21-claude-2.md`

## How to Update Changelog.md

Add new entries at the TOP of the file:

```markdown
## YYYY-MM-DD (Agent Name)
- type: description of change
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

## Quality Rules

- **No empty sections** — if a section doesn't apply, say "None" explicitly
- **No stale file paths** — verify paths exist before documenting them
- **No duplicated content** — link to other docs with `[[Name]]` instead of copying
- **Date everything** — use YYYY-MM-DD format for all dates
- **Keep it concise** — one paragraph per section is usually enough
