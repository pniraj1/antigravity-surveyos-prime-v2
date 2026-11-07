# Design Spec: Admin Panel Surveyor Claims Count & Trial Activity Indicator

> **Date:** 2026-11-07  
> **Status:** Approved / Validated  
> **Author:** Antigravity  
> **Target Subsystem:** Admin Dashboard — Surveyors Registry (`src/components/admin/tabs/SurveyorsTab.tsx`)

---

## 1. Understanding Summary

* **What is being built:** A "Claims Created" count metric inside each surveyor's expandable profile card in the Admin Panel (`SurveyorsTab.tsx`).
* **Why it exists:** Provides administrators with direct visibility into whether a surveyor—particularly those on trial—has actively created claims to test the software or remains untested (`0 claims`), enabling effective follow-up and trial conversion tracking.
* **Who it is for:** SurveyOS administrators managing trial accounts and user onboarding.
* **Placement & UI:** Positioned inside the expandable profile card (row expansion) alongside existing details (City, State, Qualifications, Join Date), leaving the main table header clean and uncluttered.
* **Scope:** Visible for all surveyor accounts (Trial, Active, Read-Only, Suspended) when expanded.
* **Explicit Non-Goals:**
  * No new columns added to the main table header.
  * No full claim document payload downloads (metadata aggregation only).
  * No complex breakdown modals or report type filtering.

---

## 2. Assumptions & Constraints

1. **Performance & Aggregation:** Uses Firestore's `getCountFromServer(collection(db, 'users', uid, 'claims'))`. This is an aggregation query requiring 1 lightweight index read per 1,000 index items, without downloading claim documents.
2. **On-Demand Loading:** Count is fetched lazily only when a surveyor's row is clicked and expanded, preventing slow initial dashboard loads.
3. **In-Memory Caching:** Once a surveyor's count is fetched in an admin session, it is cached in React state so subsequent toggles don't trigger repeat network queries.
4. **Security Rules:** Covered by existing Firestore rules (`match /{collectionId}/{document=**} { allow read: if isAdmin(); }`).
5. **Prime ↔ Scan Impact:** 0 impact. Changes are internal to Prime's Admin UI.

---

## 3. Decision Log

| Decision # | Topic | Chosen Decision | Alternatives Considered | Rationale |
|:---:|:---|:---|:---|:---|
| **D-1** | Metric Placement | Expanded Detail Drawer | New table column, Onboarding milestone integration | Keeps the primary table view scannable and clean while providing detailed activity on demand. |
| **D-2** | Surveyor Scope | All Surveyors | Trial only | Highly valuable for trial evaluations, while providing useful audit context for Active, Read-Only, or Suspended accounts. |
| **D-3** | Metric Depth | Basic Count + Engagement Badge | Deep report breakdown, Raw number only | Immediately answers whether they tested the app (`0 (Untested)` vs `X claims`) without visual clutter. |
| **D-4** | Data Fetching Strategy | Lazy On-Demand `getCountFromServer` | Eager bulk fetch on load, Denormalized profile counter (`claimsCount`) | Zero synchronization drift, no database backfill required, zero added latency to initial dashboard load. |

---

## 4. Final Architecture & Technical Design

### 4.1 Data Access Layer (`src/lib/firebase/claims-count.ts` or admin helper)

```typescript
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

/**
 * Authoritative count of claims created by a surveyor.
 * Runs as a lightweight server-side count aggregation query.
 */
export async function getSurveyorClaimCount(uid: string): Promise<number> {
  if (!uid) return 0;
  const claimsColl = collection(db, 'users', uid, 'claims');
  const snapshot = await getCountFromServer(claimsColl);
  return snapshot.data().count;
}
```

### 4.2 State & Caching in `SurveyorsTab.tsx`

```typescript
// Cache: uid -> number | 'loading' | 'error'
const [claimsCountMap, setClaimsCountMap] = useState<Record<string, number | 'loading' | 'error'>>({});

const loadClaimsCount = useCallback(async (uid: string) => {
  if (claimsCountMap[uid] !== undefined) return; // already loaded or loading
  setClaimsCountMap(prev => ({ ...prev, [uid]: 'loading' }));
  try {
    const count = await getSurveyorClaimCount(uid);
    setClaimsCountMap(prev => ({ ...prev, [uid]: count }));
  } catch (err) {
    console.error('Failed to fetch claim count for surveyor:', uid, err);
    setClaimsCountMap(prev => ({ ...prev, [uid]: 'error' }));
  }
}, [claimsCountMap]);

// Trigger load when row is expanded
const handleToggleExpand = (id: string) => {
  setExpandedId(prev => {
    const next = prev === id ? null : id;
    if (next) {
      loadClaimsCount(next);
    }
    return next;
  });
};
```

### 4.3 UI Component Specification (UI/UX Pro Max Standards)

Placed inside the 3-column detail grid in `SurveyorsTab.tsx`:

```tsx
<div>
  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Claims Created</div>
  {claimsCountMap[surveyor.id] === 'loading' ? (
    <div className="h-4 w-16 rounded bg-[var(--color-neutral-200)] animate-pulse" />
  ) : claimsCountMap[surveyor.id] === 'error' ? (
    <span className="text-xs text-muted-foreground">—</span>
  ) : typeof claimsCountMap[surveyor.id] === 'number' ? (
    <div className="flex items-center gap-1.5">
      <FileText size={10} className="text-muted-foreground" />
      {claimsCountMap[surveyor.id] === 0 ? (
        surveyor.subscriptionStatus === 'trial' ? (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            0 (Untested)
          </span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">0 claims</span>
        )
      ) : (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {claimsCountMap[surveyor.id]} {claimsCountMap[surveyor.id] === 1 ? 'claim' : 'claims'}
        </span>
      )}
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )}
</div>
```

---

## 5. Verification & Testing Plan

1. **Unit Tests:**
   * Test `getSurveyorClaimCount` with mocked Firestore responses (normal count, 0 count, error state).
   * Verify caching logic ensures a second expand invocation does not re-query Firestore.
2. **Component Integration Tests:**
   * Render `SurveyorsTab` and simulate clicking to expand a surveyor row.
   * Verify skeleton displays during `'loading'` state.
   * Verify `0 (Untested)` amber styling for trial users with 0 claims.
   * Verify positive count (e.g., `3 claims`) emerald styling for users who have created claims.
3. **Compiler & Suite Check:**
   * Run `npx tsc --noEmit` (0 errors).
   * Run `npm test` across all Vitest suites.
4. **Coupling Guard:**
   * Scan impact: None (0 drift).
