---
type: community
cohesion: 0.27
members: 10
---

# Reconciliation Engine

**Cohesion:** 0.27 - loosely connected
**Members:** 10 nodes

## Members
- [[ReconciliationDialog.tsx]] - code - src\components\tabs\reconciliation\ReconciliationDialog.tsx
- [[buildFields()]] - code - src\lib\ai\reconciliation.ts
- [[getBestSourceValue()]] - code - src\lib\ai\reconciliation.ts
- [[getConflictFields()]] - code - src\lib\ai\reconciliation.ts
- [[getNestedValue()]] - code - src\lib\ai\reconciliation.ts
- [[getUnanimousFields()]] - code - src\lib\ai\reconciliation.ts
- [[handleAcceptFromSource()]] - code - src\components\tabs\reconciliation\ReconciliationDialog.tsx
- [[handleAcceptRecommended()]] - code - src\components\tabs\reconciliation\ReconciliationDialog.tsx
- [[normalize()]] - code - src\lib\ai\reconciliation.ts
- [[reconciliation.ts]] - code - src\lib\ai\reconciliation.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Reconciliation_Engine
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_UI Components & Forms]]
- 1 edge to [[_COMMUNITY_Bill Check Grid]]
- 1 edge to [[_COMMUNITY_AI Review Dialog]]

## Top bridge nodes
- [[ReconciliationDialog.tsx]] - degree 6, connects to 3 communities
- [[reconciliation.ts]] - degree 8, connects to 1 community