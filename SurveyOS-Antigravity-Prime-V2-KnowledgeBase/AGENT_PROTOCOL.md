# Agent Protocol — SurveyOS Prime V2

> This file is the **SINGLE SOURCE OF TRUTH** for all AI agents working on this project.
> Both **Claude Code** and **Google Antigravity** MUST follow these rules.

## Identity

- **Project:** SurveyOS Prime V2 — Insurance survey management platform for Indian motor insurance surveyors
- **Stack:** Next.js 16 + React 19 + TypeScript 5 + Firebase (Auth, Firestore, Hosting) + Zustand
- **Deployment:** Firebase Hosting (static export via `next export` → `out/`)
- **Vault Location:** `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/`
- **Primary User:** Manasi / Pniraj (pniraj.india@gmail.com)

---

## Before You Start Working

1. **Read `Tasks.md`** — check what's pending, in-progress, or blocked
2. **Read the latest Session log** in `Sessions/` — understand what the last agent did
3. **Read `Changelog.md`** (last 5 entries) — know what changed recently
4. **Run `git status`** — see uncommitted changes from the previous agent

If Tasks.md has an "in-progress" task you didn't start, the previous agent was interrupted. Pick it up or mark it blocked with a reason.

---

## Next.js Warning

This project uses **Next.js 16** which has breaking changes from older versions. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

---

## File Placement Rules

| You're creating...              | Put it in...                          |
|---------------------------------|---------------------------------------|
| React component                 | `src/components/{domain}/`            |
| UI primitive (button, input)    | `src/components/ui/`                  |
| Business logic / utility        | `src/lib/{domain}/`                   |
| Custom React hook               | `src/hooks/`                          |
| TypeScript types                | `src/types/`                          |
| Zustand store or slice          | `src/stores/` or `src/stores/slices/` |
| Test file                       | `src/lib/{domain}/__tests__/`         |
| PDF/report component            | `src/components/pdf/`                 |
| Print-specific component        | `src/components/print/`               |
| New route/page                  | `src/app/{route-name}/`               |
| Static asset (image, svg)       | `public/images/`                      |
| Design spec                     | `vault → Specs/`                      |
| Implementation plan             | `vault → Specs/` (paired with spec)   |
| Architecture doc                | `vault → Architecture/`               |
| Feature deep-dive               | `vault → Features/`                   |
| Operations runbook              | `vault → Operations/`                 |
| Build/utility script            | `scripts/`                            |
| Environment variable            | `.env.example` (template) + `.env.local` (value) |

### Naming Conventions

| Type            | Convention    | Example                    |
|-----------------|---------------|----------------------------|
| Component file  | PascalCase    | `AssessmentGrid.tsx`       |
| Library file    | kebab-case    | `gst-calculator.ts`        |
| Hook file       | camelCase     | `useCloudSync.ts`          |
| Store file      | kebab-case    | `claim-store.ts`           |
| Type file       | kebab-case    | `assessment.ts`            |
| Test file       | kebab-case    | `assessment.test.ts`       |
| Vault doc       | Title_Case    | `State_Management.md`      |
| Spec file       | `YYYY-MM-DD-topic-design.md` | `2026-05-16-grid-excel-paste-design.md` |

### What NEVER Goes in the Project Root

- Loose component files (use `src/components/`)
- Folders with spaces in names
- Binary files (videos, zips, databases) — use `public/` or `.gitignore`
- Reference repositories or external code (use git submodules or npm)
- One-off handover notes (use vault `Sessions/`)

---

## While You Work

1. **Update `Tasks.md`** as you complete or add tasks
2. **If you modify a feature documented in `Features/`**, update that vault doc
3. **If you add a new file type or folder**, update this protocol's File Placement table
4. **Never leave files in project root** — everything has a designated home
5. **Use the vault before scanning code** — check Architecture/ and Features/ docs first to save tokens

---

## Before You Stop

1. **Write a session log:** `Sessions/YYYY-MM-DD-{agent}.md`
   ```
   # Session: YYYY-MM-DD (Agent Name)
   
   ## What I Did
   - (list of changes made)
   
   ## What's Unfinished
   - [ ] (pending items)
   
   ## Decisions Made
   - (any architectural or design decisions)
   
   ## Files Changed
   - path/to/file.ts (modified/new/deleted)
   ```

2. **Update `Tasks.md`** with current state of all tasks
3. **Add entry to `Changelog.md`**

---

## Token Optimization

- Use graphify / code-review-graph tools BEFORE reading raw files (saves 70-80% tokens)
- Read vault docs in `Architecture/` and `Features/` BEFORE scanning source code
- If context window gets large, save state to `Tasks.md` and ask user to start fresh
- Check `Reference/Token_Optimization.md` for detailed best practices

---

## Vault Structure

```
SurveyOS-Antigravity-Prime-V2-KnowledgeBase/
├── AGENT_PROTOCOL.md          ← You are here. The master rules.
├── Tasks.md                   ← Active work tracker (both agents update)
├── Changelog.md               ← What changed and who changed it
├── Architecture/              ← System design (data model, lifecycle, state)
├── Features/                  ← Per-feature living docs (current state, issues, improvements)
├── Rules/                     ← File placement, naming, documentation, handoff rules
├── Operations/                ← Admin guide, launch checklist, security audit
├── Sessions/                  ← Agent session logs (auto-maintained)
├── Specs/                     ← Design specs and implementation plans
├── Reference/                 ← Static reference (AI models, token optimization, error handling)
├── Project_Bramha/            ← Bramha AI subsystem docs
└── Patterns/                  ← Reusable patterns (sequential numbering, etc.)
```

---

## Cross-References

- **Detailed file rules:** `Rules/File_Placement.md`
- **Naming details:** `Rules/Naming_Conventions.md`
- **How to update docs:** `Rules/Documentation_Protocol.md`
- **Agent handoff process:** `Rules/Handoff_Protocol.md`
- **System architecture:** `Architecture/Overview.md`
