---
type: community
cohesion: 0.25
members: 9
---

# Bank Statement Extractor

**Cohesion:** 0.25 - loosely connected
**Members:** 9 nodes

## Members
- [[BankReconcileDialog.tsx]] - code - src\components\dialogs\BankReconcileDialog.tsx
- [[applyMatches()]] - code - src\components\dialogs\BankReconcileDialog.tsx
- [[bank-statement-extractor.ts]] - code - src\lib\ai\bank-statement-extractor.ts
- [[extractBankStatement()]] - code - src\lib\ai\bank-statement-extractor.ts
- [[getDocPrompt()]] - code - src\lib\ai\prompts.ts
- [[handleFile()]] - code - src\components\dialogs\BankReconcileDialog.tsx
- [[parseCsvTransactions()]] - code - src\lib\ai\bank-statement-extractor.ts
- [[prompts.ts]] - code - src\lib\ai\prompts.ts
- [[toggleConfirm()]] - code - src\components\dialogs\BankReconcileDialog.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Bank_Statement_Extractor
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_UI Components & Forms]]
- 1 edge to [[_COMMUNITY_IndexedDB & Drive Sync]]

## Top bridge nodes
- [[BankReconcileDialog.tsx]] - degree 7, connects to 2 communities