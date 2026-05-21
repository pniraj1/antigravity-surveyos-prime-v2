# Subscription System

## Current Implementation

- **What it does:** Manages trial/active/readonly subscription states with expiry warnings, read-only overlay on expired access, and UPI payment submission. New users get a 60-day trial; expired users see a full-screen overlay with payment options.
- **Key files:**
  - `src/lib/subscription/status.ts` — State calculator: 60-day trial, 5-day warning period, handles trial/active/readonly/suspended/pending states
  - `src/components/layout/SubscriptionGuard.tsx` — Overlay component: amber banner at 5-day warning, full readonly overlay on expiry with payment form
  - `src/components/subscription/PaymentSubmissionForm.tsx` — UPI payment submission
  - `src/components/subscription/AccessRequestForm.tsx` — New user access request
  - `src/lib/firebase/payments.ts` — Payment processing logic
- **Dependencies:** Profile store, Auth store, Next.js routing, Firebase Firestore

## Known Issues / What Went Wrong

- UPI payment ID hardcoded as `surveyosprime@upi` — should be configurable
- PaymentSubmissionForm and AccessRequestForm need thorough review

## Improvement Ideas

- Payment gateway integration (Razorpay/Stripe) instead of manual UPI
- Referral system for extended trials
- Grace period after expiry before full lockout
- Admin-configurable trial duration

## Technical Debt

- Subscription status calculation is in `src/lib/subscription/status.ts` but guard UI is in `src/components/layout/` — split across domains

## Related

- [[Authentication]] — Subscription check happens after auth
- [[Admin_Dashboard]] — Admin manages subscription status and expiry dates
