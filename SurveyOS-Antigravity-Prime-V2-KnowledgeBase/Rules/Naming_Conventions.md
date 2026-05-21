# Naming Conventions

> Consistent naming across the entire project. All agents MUST follow these rules.

## Files

| Type | Convention | Example | Anti-pattern |
|------|-----------|---------|--------------|
| React component | PascalCase `.tsx` | `AssessmentGrid.tsx` | `assessmentGrid.tsx` |
| Library/utility | kebab-case `.ts` | `gst-calculator.ts` | `gstCalculator.ts` |
| Custom hook | camelCase with `use` prefix `.ts` | `useCloudSync.ts` | `UseCloudSync.ts` |
| Zustand store | kebab-case with `-store` suffix `.ts` | `claim-store.ts` | `claimStore.ts` |
| Store slice | camelCase with `Slice` suffix `.ts` | `assessmentSlice.ts` | `assessment-slice.ts` |
| Type definition | kebab-case `.ts` | `assessment.ts` | `Assessment.ts` |
| Test file | kebab-case with `.test` suffix `.ts` | `assessment.test.ts` | `assessment.spec.ts` |
| CSS file | kebab-case `.css` | `print-report.css` | `printReport.css` |
| Vault doc | Title_Case `.md` | `State_Management.md` | `state-management.md` |
| Design spec | `YYYY-MM-DD-topic-design.md` | `2026-05-16-grid-paste-design.md` | `grid-paste-spec.md` |
| Session log | `YYYY-MM-DD-agent.md` | `2026-05-21-claude.md` | `session-latest.md` |

## Folders

| Type | Convention | Example |
|------|-----------|---------|
| Component domain folder | kebab-case | `src/components/bill-check/` |
| Library domain folder | kebab-case | `src/lib/calculations/` |
| Vault section folder | Title_Case | `Architecture/`, `Features/` |
| App route folder | kebab-case | `src/app/landing/` |

## Variables and Functions

Follow standard TypeScript/React conventions:
- **Components:** PascalCase (`AssessmentGrid`, `BillCheckTab`)
- **Functions:** camelCase (`calculateGST`, `fetchAllProfiles`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_CLAIMS`, `DEFAULT_GST_RATE`)
- **Types/Interfaces:** PascalCase (`ClaimData`, `AssessmentRow`)
- **Zustand hooks:** camelCase with `use` prefix (`useClaimStore`, `useAuthStore`)

## Vault Internal Links

Use `[[Title_Case_Name]]` for Obsidian wiki-links:
- `[[AGENT_PROTOCOL]]` — links to AGENT_PROTOCOL.md
- `[[Cloud_Sync]]` — links to Features/Cloud_Sync.md
- `[[State_Management]]` — links to Architecture/State_Management.md
