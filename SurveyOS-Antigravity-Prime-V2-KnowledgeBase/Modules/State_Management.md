# State Management

SurveyOS uses `Zustand` to orchestrate rapid, memory-optimized state management.

## Stores

### `claim-store`
- The single source of truth for the currently opened working claim (`currentClaim`).
- Handles complex updates for Arrays (e.g. Assessment parts) dynamically via utility reducers (`updateSection`, `addRow`, etc.)
- Drives UI bindings via constant `subscribe` patterns rather than React Context.

**Key actions:**
| Action | Description |
|--------|-------------|
| `loadClaim(claim)` | Sets `currentClaim` + `currentClaimId`, marks clean. Syncs to `ui-store`. |
| `closeClaim()` | Clears `currentClaim`, `currentClaimId`, `isDirty`. Sets `ui-store.currentClaimId = null`. |
| `resetStore()` | Full wipe on logout — prevents cross-user data leaks. |

> **⚠️ Important:** Always use `closeClaim()` (not manual `set({currentClaim: null})`) to navigate away from a claim. It also updates `ui-store`, which is the source of truth watched by `useRouteSync`.

### `ui-store`
- Orchestrates transient visual data (e.g., active tabs, dialog states, sidebar toggles).
- `currentClaimId` mirrors the claim store's ID and is the primary signal used by `useRouteSync` to update the URL.

### `profile-store`
- Contains persistent user information (e.g., Surveyor names, affiliations).
- Controls the core counters applied via [[Sequential_Numbering]].

---

## Navigation & URL Sync (`useRouteSync`)

Located at `src/hooks/useRouteSync.ts`. Keeps Zustand state and Next.js URL query params (`?claim=XXX&tab=YYY`) in bi-directional sync.

### Two Effects

| Effect | Trigger | Behaviour |
|--------|---------|-----------|
| **Effect 1 (URL → Store)** | `searchParams` changes (browser back/forward, initial load) | Reads `?claim` from URL, loads claim from IndexedDB if needed. Falls back to dashboard if claim not found. |
| **Effect 2 (Store → URL)** | `activeTab` or `currentClaimId` changes in Zustand | Pushes updated URL params using `router.push`. |

### Known Bug Fix — Dashboard Navigation Race (Fixed: 2026-05-12)

**Symptom:** Clicking "Dashboard" from inside a claim left the user stuck in the claim view.

**Root Cause:** Race condition between the two effects.
1. Sidebar called `closeClaim()` → Zustand cleared `currentClaimId`.
2. React scheduled Effect 2 to push the clean URL.
3. **Before Effect 2 ran**, Effect 1 fired on the stale `?claim=XXX` URL and called `loadClaim()`, restoring the claim.

**Fix applied in two places:**

1. **`useRouteSync.ts` — Stale-URL Guard** *(primary fix)*
   - In Effect 1: if `storeClaimId` is already `null` (store was intentionally cleared) but the URL still has a `?claim` param, bail out immediately. Effect 2 will push the clean URL and Effect 1 will re-run correctly.

2. **`sidebar.tsx` — Batch Navigation** *(belt-and-suspenders)*
   - `closeClaim()` and `setActiveTab('dashboard')` are now called in the same synchronous block with an early `return`, ensuring React processes both updates in one render cycle.

