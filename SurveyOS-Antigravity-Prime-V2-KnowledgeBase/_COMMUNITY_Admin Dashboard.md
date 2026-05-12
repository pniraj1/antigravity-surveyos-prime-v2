---
type: community
cohesion: 0.14
members: 15
---

# Admin Dashboard

**Cohesion:** 0.14 - loosely connected
**Members:** 15 nodes

## Members
- [[AdminDashboard.tsx]] - code - src\components\admin\AdminDashboard.tsx
- [[buildApprovalEmail()]] - code - src\lib\email\sendEmail.ts
- [[buildCustomEmail()]] - code - src\lib\email\sendEmail.ts
- [[buildDismissalEmail()]] - code - src\lib\email\sendEmail.ts
- [[fetchAllProfiles()]] - code - src\components\admin\AdminDashboard.tsx
- [[fetchSignups()]] - code - src\components\admin\AdminDashboard.tsx
- [[handleApprove()]] - code - src\components\admin\AdminDashboard.tsx
- [[handleDismissConfirm()]] - code - src\components\admin\AdminDashboard.tsx
- [[handleSendCustomEmail()]] - code - src\components\admin\AdminDashboard.tsx
- [[handleUpdateExpiry()]] - code - src\components\admin\AdminDashboard.tsx
- [[handleUpdateId()]] - code - src\components\admin\AdminDashboard.tsx
- [[handleUpdateStatus()]] - code - src\components\admin\AdminDashboard.tsx
- [[openDismissModal()]] - code - src\components\admin\AdminDashboard.tsx
- [[sendEmail()]] - code - src\lib\email\sendEmail.ts
- [[sendEmail.ts]] - code - src\lib\email\sendEmail.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Admin_Dashboard
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_UI Components & Forms]]
- 1 edge to [[_COMMUNITY_Bill Check Grid]]

## Top bridge nodes
- [[AdminDashboard.tsx]] - degree 13, connects to 2 communities