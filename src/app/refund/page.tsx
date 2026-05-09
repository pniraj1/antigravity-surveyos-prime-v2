/**
 * Refund Policy — TEMPLATE
 *
 * EDIT BEFORE GOING LIVE:
 *  1. Replace every <span className="placeholder"> block with your real info.
 *  2. Confirm refund window and processing time match your billing setup.
 *  3. Indian payment gateways (Razorpay, etc.) require a published Refund Policy
 *     before they activate live payments — keep this up to date.
 */

import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Refund Policy · SurveyOS Prime',
  description: 'How refunds work for SurveyOS Prime subscriptions.',
};

export default function RefundPage() {
  return (
    <LegalPageShell title="Refund Policy" lastUpdated="Last updated: 8 May 2026">
      <p>
        We want SurveyOS Prime to genuinely help your work. If it doesn't, this
        Policy explains what we'll refund and how.
      </p>

      <h2>1. Free trial</h2>
      <p>
        The 60-day free trial is exactly that — free. No charge, no credit card,
        nothing to refund.
      </p>

      <h2>2. Monthly Pro subscription</h2>
      <p>
        SurveyOS Pro is billed monthly at ₹999. You can cancel from your Profile
        page at any time; cancellation stops your next renewal.
      </p>
      <p>
        <strong>7-day satisfaction window.</strong> If you start a paid
        subscription and decide within the first 7 days that the Service is not
        right for you, email us and we will refund the most recent month's charge
        in full.
      </p>
      <span className="placeholder">
        EDIT: Confirm this 7-day window matches what you want to offer. A 7-day
        window is industry-typical and Razorpay-friendly. Some teams prefer
        14 days; some skip refunds entirely after the trial. Pick a number you
        can honour consistently.
      </span>

      <h2>3. After 7 days</h2>
      <p>
        We do not refund partial months. If you cancel mid-cycle, your subscription
        remains active until the end of the period you have already paid for, and
        no further charges are made.
      </p>

      <h2>4. Annual plans</h2>
      <span className="placeholder">
        EDIT: We don't currently see an annual plan in the codebase. If you launch
        one, replace this block with: "Annual plans are refundable on a pro-rated
        basis (months unused × monthly equivalent) within the first 30 days. After
        30 days, annual subscriptions are non-refundable."
      </span>

      <h2>5. Exceptions</h2>
      <p>Refunds are not available for:</p>
      <ul>
        <li>Accounts terminated for material breach of our <a href="/terms">Terms of Service</a> (fraud, abuse, payment chargebacks).</li>
        <li>Service interruptions caused by third-party providers outside our control (Google, your internet connection, etc.).</li>
        <li>Dissatisfaction with AI extraction accuracy on poor-quality scans — we publish a "99.9% on clear scans" estimate; image quality is a known factor.</li>
      </ul>

      <h2>6. How to request a refund</h2>
      <p>
        Email <a href="mailto:surveyosprime@gmail.com">surveyosprime@gmail.com</a>{' '}
        with:
      </p>
      <ul>
        <li>The Google account email you used to sign up.</li>
        <li>The date of the charge you want refunded.</li>
        <li>A short note about why — this helps us improve, but is optional.</li>
      </ul>
      <p>
        We will reply within 2 business days. Approved refunds are processed within
        7–10 business days back to your original payment method.
      </p>

      <h2>7. Disputes &amp; chargebacks</h2>
      <p>
        Please contact us before raising a chargeback with your bank or card
        issuer. We can almost always resolve the issue faster, and chargebacks
        result in account suspension under our <a href="/terms">Terms</a>.
      </p>

      <h2>8. Changes to this Policy</h2>
      <p>
        We may update this Policy. Material changes will be announced inside the
        app or by email at least 14 days before they take effect. The "Last
        updated" date at the top of this page reflects the latest version.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about a refund? Email{' '}
        <a href="mailto:surveyosprime@gmail.com">surveyosprime@gmail.com</a>{' '}
        or visit the <a href="/contact">Contact page</a>.
      </p>
    </LegalPageShell>
  );
}
