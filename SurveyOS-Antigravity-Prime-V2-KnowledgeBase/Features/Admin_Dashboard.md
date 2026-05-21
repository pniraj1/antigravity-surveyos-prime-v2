# Admin Dashboard

## Current Implementation

- **What it does:** Two distinct dashboards: (1) The **main Dashboard** is the central hub showing all claims in a 6-column grid with archive, stage tracking, and stats (claimsToday, claimsWeek, pending, archived). (2) The **Admin Dashboard** is an admin-only panel for managing users — approving signups, managing subscriptions, updating expiry dates, and sending custom emails.
- **Key files:**
  - `src/components/layout/Dashboard.tsx` — Main claims dashboard with grid view, archive, stats
  - `src/hooks/useClaimsLoader.ts` — Loads claims from IndexedDB, maps stage markers
  - `src/components/admin/AdminDashboard.tsx` — Admin panel: New Signups tab + All Surveyors tab
  - `src/lib/firebase/sync.ts` — Firestore operations for profile management
  - `src/lib/email/sendEmail.ts` — Email sending for approval/dismissal/custom notifications
- **Dependencies:** Firebase Firestore, Zustand (claim-store, ui-store), IndexedDB, BroadcastChannel API

## Admin Panel Features

- **New Signups:** Approve/dismiss pending users with email notifications
- **All Surveyors:** Update subscription status, expiry dates, surveyor IDs
- **Custom Emails:** Send custom messages to any surveyor
- **Access:** Admin access = `isAdmin` flag OR master UID (prevents lockout)

## Known Issues / What Went Wrong

- Dashboard navigation race condition: clicking "Dashboard" from inside a claim could fail (fixed 2026-05-12 — stale URL guard + batched closeClaim)
- Admin reads from `profile/current` but sync writes to `profile/main` (path mismatch — M-4, still open)

## Improvement Ideas

- Real-time dashboard stats (currently requires reload)
- Bulk user management (approve/dismiss multiple at once)
- Dashboard search/filter for claims
- Admin audit log for all actions

## Technical Debt

- Dashboard dynamically infers claim stage from payload footprint — fragile heuristic
- Archive uses BroadcastChannel for cross-tab refresh — could use Zustand subscription instead

## Related

- [[Authentication]] — Admin manages user approval flow
- [[Subscription_System]] — Admin manages subscription status and expiry
- [[Cloud_Sync]] — Dashboard reads from IndexedDB (L2)
