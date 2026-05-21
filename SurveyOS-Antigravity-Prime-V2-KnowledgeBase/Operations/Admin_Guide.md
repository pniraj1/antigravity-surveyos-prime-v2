# Admin Guide

> Operational runbook for SurveyOS Prime V2 admin tasks.

## Accessing the Admin Dashboard

1. Log in with a Google account that has `isAdmin: true` in Firestore profile
2. Click the **Admin** tab in sidebar (only visible to admins)
3. Fallback: master UID (`NEXT_PUBLIC_MASTER_ADMIN_UID`) always has admin access

## New Signups

When a new user signs in for the first time, they land on a pending screen and appear in the **New Signups** tab.

**Approving a user:**
1. Go to Admin Dashboard → New Signups
2. Review name, email, signup time
3. Set default expiry date (defaults to 1 year from today)
4. Click **Approve** — sets `subscriptionStatus: 'active'`, sets expiry, removes from queue
5. User gets access on next page reload

**Dismissing:** Click Dismiss to remove without approving. User stays on pending screen.

## All Surveyors Tab

**Search:** Filter by name, email, or Firebase UID.

**Status badges:**

| Badge | Meaning |
|-------|---------|
| Green — Active | Full access |
| Yellow — Pending | Awaiting approval |
| Red — Suspended | Manually blocked |
| Orange — Expired | Subscription date passed |

**Actions (hover over row):**
- **Activate** — sets status to `active`
- **Suspend** — blocks user immediately

**Update expiry:** Click the date next to any user to change subscription expiry.

**Update surveyor ID:** Click the ID field to update.

**Custom email:** Click email icon to send a custom message to any surveyor.

## Direct Firestore Access

For emergency operations, access Firestore directly:
- **Profiles:** `users/{uid}/profile/main`
- **Claims:** `users/{uid}/claims/{claimId}`
- **Signups:** `newSignups/{uid}`
- **AI Config:** `ai_config/routing` (admin-only)

## Related

- [[Admin_Dashboard]] — Feature documentation
- [[Authentication]] — Auth flow and access control
- [[Subscription_System]] — Subscription status management
