# SurveyOS Prime V2 — Admin Guide

## Accessing the Admin Dashboard

1. Log in with a Google account that has `isAdmin: true` in its Firestore profile
2. Click the **Admin** tab in the sidebar (only visible to admins)

---

## New Signups Tab

When a new user signs in for the first time, they land on a pending screen and appear here.

### Approving a user

1. Go to **Admin Dashboard → New Signups**
2. Review the user's name, email, and signup time
3. Set the **default expiry date** at the top (defaults to 1 year from today)
4. Click **Approve** — this:
   - Sets `subscriptionStatus: 'active'`
   - Sets `subscriptionExpiry` to your chosen date
   - Removes the user from the new signups queue
   - User gets access on their next page reload

### Dismissing a signup

Click **Dismiss** to remove a signup without approving. The user stays on the pending screen and can contact support.

---

## All Surveyors Tab

### Search
Filter by name, email, or Firebase UID using the search box.

### Subscription status badges

| Badge | Meaning |
|---|---|
| Green — Active | User has full access |
| Yellow — Pending | Awaiting admin approval |
| Red — Suspended | Manually blocked |
| Orange — Expired | Subscription date passed |

### Actions (hover over a row to see)

- **Activate** — sets status to `active` (works for pending and suspended users)
- **Suspend** — blocks the user immediately

### Update expiry date

Click the date field in the **Expiry Date** column and pick a new date. Updates Firestore immediately.

### Assign Platform ID

Type a platform ID in the **Platform ID** column. Used in generated reports as the surveyor's system ID.

---

## Making Someone an Admin

Currently done directly in Firestore (no UI for this):

1. Go to Firebase Console → Firestore
2. Navigate to `users/{uid}/profile/current`
3. Edit the document: set `isAdmin: true`
4. The user gets admin access on next login

---

## Revoking Admin Access

Same as above — set `isAdmin: false` in the user's Firestore profile.

---

## Firestore Direct Access

For operations not in the dashboard:

- **User profiles:** `users/{uid}/profile/current`
- **Claims:** `users/{uid}/claims/{claimId}`
- **New signups queue:** `newSignups/{uid}`
- **AI config:** `ai_config/routing`

---

## Common Admin Tasks

### User locked out / can't access app
1. Search for user in All Surveyors tab
2. Check their subscription status
3. If expired: update expiry date to a future date
4. If suspended: click Activate
5. If pending: go to New Signups tab and approve them

### Reset a user's data
Not available in dashboard. Do this in Firestore Console:
- Delete `users/{uid}/claims/*` to clear claims
- Edit `users/{uid}/profile/current` to reset profile fields

### Check activity
Firebase Console → Firestore → monitor read/write counts on the dashboard.

---

## Security Notes

- Only accounts with `isAdmin: true` in Firestore can see the Admin tab
- Admin bypass is enforced in both the UI (`SubscriptionGuard`) and Firestore rules (`isAdmin()` function)
- Never share admin credentials — each admin should have their own Google account with `isAdmin: true`
