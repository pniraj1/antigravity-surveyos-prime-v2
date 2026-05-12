---
type: community
cohesion: 0.19
members: 14
---

# Cloud Vault & Sync

**Cohesion:** 0.19 - loosely connected
**Members:** 14 nodes

## Members
- [[CloudVaultTab.tsx]] - code - src\components\tabs\CloudVaultTab.tsx
- [[fetchData()]] - code - src\components\tabs\CloudVaultTab.tsx
- [[getLastSyncTimestamp()]] - code - src\lib\firebase\sync.ts
- [[handleRestore()]] - code - src\components\tabs\CloudVaultTab.tsx
- [[pullClaimsFromCloud()]] - code - src\lib\firebase\sync.ts
- [[pullProfileFromCloud()]] - code - src\lib\firebase\sync.ts
- [[pushClaimToCloud()]] - code - src\lib\firebase\sync.ts
- [[pushProfileToCloud()]] - code - src\lib\firebase\sync.ts
- [[sanitize()]] - code - src\lib\firebase\sync.ts
- [[setLastSyncTimestamp()]] - code - src\lib\firebase\sync.ts
- [[stripPhotos()]] - code - src\lib\firebase\sync.ts
- [[sync.ts]] - code - src\lib\firebase\sync.ts
- [[syncDeltaToCloud()]] - code - src\lib\firebase\sync.ts
- [[syncTombstones()]] - code - src\lib\firebase\sync.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Cloud_Vault_&_Sync
SORT file.name ASC
```

## Connections to other communities
- 5 edges to [[_COMMUNITY_UI Components & Forms]]
- 2 edges to [[_COMMUNITY_IndexedDB & Drive Sync]]
- 1 edge to [[_COMMUNITY_Bill Check Grid]]

## Top bridge nodes
- [[sync.ts]] - degree 16, connects to 3 communities
- [[CloudVaultTab.tsx]] - degree 6, connects to 2 communities