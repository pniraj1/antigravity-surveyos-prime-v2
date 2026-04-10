# Dashboard Module

The Dashboard acts as the central hub for local, offline-first claims in SurveyOS Prime V2.

## Components
- `page.tsx`: Handles UI rendering of the 6-column grid and top navigation actions.
- `useClaimsLoader.ts`: Custom React hook that queries IndexedDB to map `ClaimData` to dashboard-readable `claimsList` items.

## Key Logic
- The Dashboard directly reads from local storage via `getAllClaims()`.
- It dynamically maps `stage` markers based on internal payload footprint (e.g. `c.reinspection` vs `c.billCheck`).
- **Archive System:** Silently flags a claim's `isActive` state in local storage via inline list interactions, triggering global state refresh via `BroadcastChannel`.

## Relevant Stores
- [[State_Management#claim-store]]
- [[State_Management#ui-store]]
