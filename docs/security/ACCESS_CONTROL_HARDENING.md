# Access-Control Hardening — Subscription & Approval Enforcement

**Date:** 2026-07-18
**Scope:** `firestore.rules`, `functions/index.js`, `functions/subscription.js`
**Trigger:** Authorization audit ("hacker" red-team of `motorsurveyos`), two scenarios below.

---

## 1. The two attacks (both previously succeeded)

### Scenario 1 — Rejected / unapproved user runs the app for free
Admin rejects a signup, so the user sees a "pending approval" screen (`SubscriptionGuard` →
`/access-request`). But that screen is **client-side React only**. The real boundary
(`firestore.rules`) allowed any signed-in user full read/write to their own
`users/{uid}/**` data with **no approval check**. Bypass: delete the overlay in
devtools, flip the store, or skip the app and call the Firebase JS SDK directly.

### Scenario 2 — Unpaid / suspended user restores access by rewriting their own profile
Subscription state is computed from three fields on the user's **own** profile
(`subscriptionStatus`, `trialEndDate`, `subscriptionExpiry` — `src/lib/subscription/status.ts`).
The old rules let a user update their own profile freely **except `isAdmin`**. So a
suspended user wrote `{ subscriptionStatus: 'active', subscriptionExpiry: '2099-01-01' }`
to `users/{uid}/profile/current` and the app granted indefinite access. Even an
admin-issued `suspended` status was user-reversible.

### Bonus — Free AI for anyone logged in
`callAI` / `nvidiaProxy` (`functions/index.js`) checked only `request.auth`, never
subscription. `callAI` spends the **admin's master API keys** — so any authenticated
Google account, approved or not, could drain them.

**Root cause (single):** authorization decisions lived on the client, and the profile
document trusted itself.

---

## 2. What was already solid (left untouched)
- `isAdmin` cannot be self-granted (create + update both guard it). ✅
- Master AI keys (`ai_config/routing`) are admin-read-only. ✅
- `nvidiaProxy` is host + path allowlisted, uses caller's own BYOK key. ✅

---

## 3. Fixes applied

### Fix 1 — Lock "money fields" to admin-write (`firestore.rules`, profile match)
A non-admin may edit their own name / keys / bank details, but **never**
`subscriptionExpiry`, `trialStartDate`, `trialEndDate`, `lastPaymentDate`, or `isAdmin`.
`subscriptionStatus` may only be self-changed **down to `readonly`** (the legitimate
`useAuth` expired→readonly auto-transition) — never up to `active`/`trial`.
`create` cannot self-grant paid access; the legacy `profile/main → profile/current`
migration is preserved by requiring the copied status to match the existing (admin-owned)
`main` doc.
→ **Closes Scenario 2.** Renewals still work because `verifyPayment`
(`src/lib/firebase/payments.ts`) and the admin panel run in an **admin session**, which
the rule permits.

### Fix 2 — Gate real data writes on active subscription (`firestore.rules`, catch-all match)
`hasActiveAccess()` = profile `subscriptionStatus in ['active','trial']`.
- **Read** stays open to the owner → expired/readonly/suspended users still *see* their
  claims (matches the read-only overlay intent).
- **Write** requires `hasActiveAccess()`, **except** the `session` presence doc, which
  stays writable so the single-session lock keeps working for read-only users.
→ **Closes Scenario 1.**

### Fix 3 — Subscription check in the AI gateway (`functions/index.js` + `functions/subscription.js`)
`assertActiveSubscription(uid)` runs after the auth check in both `callAI` and
`nvidiaProxy`. It reads the profile and rejects non-active accounts. The pure predicate
`isSubscriptionActive(profile, now)` also **enforces the ISO expiry date** in JS —
something Firestore rules cannot do with string dates.
→ **Closes the free-AI hole** and covers the residual expiry gap below for the
expensive path.

---

## 4. Known residual (documented, not a regression)
An account with `subscriptionStatus: 'active'` but a **past** `subscriptionExpiry`
(an ISO string) still passes the *rules* write-gate, because Firestore rules can't
compare an ISO string to wall-clock time. Mitigations already in place:
- `useAuth` flips expired `active`/`trial` → `readonly` on next login.
- The expensive path (`callAI`) re-checks expiry in JS.

**Upgrade path** (marked with a `ponytail:` comment in `firestore.rules`): store
`subscriptionExpiry` as a number/`Timestamp` and compare to `request.time` in the rule,
or add a scheduled function that flips expired → `readonly`.

---

## 5. Deploy & verify
```bash
# Test the money-path predicate (no emulator needed)
node functions/subscription.test.js        # → "subscription gate: all checks passed"

# Deploy (rules + functions)
firebase deploy --only firestore:rules
firebase deploy --only functions:callAI,functions:nvidiaProxy
```
Manual E2E after deploy:
1. **Pending user** (direct SDK write to own `users/{uid}/claims/x`) → `permission-denied`.
2. **Suspended user** writes `subscriptionStatus:'active'` to own profile → `permission-denied`.
3. **Pending user** calls `callAI` → `permission-denied` ("subscription is not active").
4. **Active user** → claims write + AI call succeed. Admin renewal still activates a user.
