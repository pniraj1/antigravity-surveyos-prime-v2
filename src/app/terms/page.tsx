/**
 * Terms of Service — TEMPLATE
 *
 * EDIT BEFORE GOING LIVE:
 *  1. Replace every <span className="placeholder"> block with your real info.
 *  2. Confirm pricing, trial length, and cancellation behaviour match your code.
 *  3. Have a lawyer review for compliance with Indian Contract Act, Consumer
 *     Protection Act 2019, and IT Act 2000. Decide your governing-law city
 *     before publishing — disputes default to that jurisdiction.
 */

import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Terms of Service · SurveyOS Prime',
  description: 'The terms that govern your use of SurveyOS Prime.',
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated="Last updated: 8 May 2026">
      <p>
        These Terms of Service ("Terms") govern your use of SurveyOS Prime ("the
        Service"). By creating an account or using the Service, you agree to these
        Terms. If you do not agree, do not use the Service.
      </p>

      <span className="placeholder">
        EDIT: Insert your registered legal entity name. Example: "The Service is
        operated by <em>[Legal Entity Name Pvt Ltd]</em>, a company registered in
        India under CIN <em>[CIN Number]</em>."
      </span>

      <h2>1. Eligibility</h2>
      <ul>
        <li>You must be at least 18 years old.</li>
        <li>You must have the right to use the Google account you sign in with.</li>
        <li>If you are using the Service on behalf of a firm or employer, you confirm you have authority to bind them to these Terms.</li>
      </ul>

      <h2>2. Your account</h2>
      <p>
        You are responsible for keeping your Google account credentials secure.
        Activity that occurs under your account is your responsibility. Notify us
        immediately if you suspect unauthorised access.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or to violate any applicable law (including IRDAI regulations applicable to your work).</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service.</li>
        <li>Use the Service to process data you are not authorised to handle.</li>
        <li>Resell, sublicense, or rebrand the Service without our written permission.</li>
        <li>Use automated tools to access the Service in a way that exceeds normal individual use.</li>
      </ul>

      <h2>4. Your content, your data</h2>
      <p>
        You retain ownership of all data you create or upload — claim records,
        photos, documents, generated reports. We claim no ownership over your work
        product. We use your content only to provide the Service to you.
      </p>
      <p>
        You grant us a limited, non-exclusive license to process your content as
        needed to operate the Service (run AI extraction, generate PDFs, sync to
        Drive).
      </p>

      <h2>5. Free trial</h2>
      <p>
        New accounts get full access for 60 days at no cost. We do not require a
        credit card to start the trial. After 60 days, your account remains
        accessible but new claim creation is paused until you start a Pro
        subscription. We will not auto-charge you.
      </p>
      <span className="placeholder">
        EDIT: Confirm this matches your actual trial logic. If you charge automatically
        when the trial ends, change the wording above accordingly.
      </span>

      <h2>6. Subscription &amp; billing</h2>
      <p>
        SurveyOS Pro is currently priced at <strong>₹999 per month</strong>, billed
        monthly. Pricing may change with at least 30 days' notice; existing
        subscribers will be notified by email before any increase takes effect.
      </p>
      <ul>
        <li>Billing renews automatically each month unless you cancel.</li>
        <li>You can cancel any time from your Profile page. Cancellation stops the next renewal — your subscription stays active until the end of the period you've already paid for.</li>
        <li>Refund eligibility is described in our <a href="/refund">Refund Policy</a>.</li>
      </ul>
      <span className="placeholder">
        EDIT: List your payment processor (Razorpay, Stripe-India, etc.) and any
        applicable taxes (GST). Example: "Prices are exclusive of applicable taxes.
        GST is added at checkout where required."
      </span>

      <h2>7. Intellectual property</h2>
      <p>
        The Service, its software, designs, and trademarks are owned by us. These
        Terms grant you a limited, non-transferable license to use the Service for
        its intended purpose only. No other rights are granted.
      </p>

      <h2>8. Service availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted access. The
        Service depends on third parties (Google Cloud, Firebase, AI providers, your
        internet connection). We may perform maintenance with prior notice where
        practical.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Service is provided <strong>"as is"</strong> without warranties of any
        kind, express or implied, including merchantability, fitness for a
        particular purpose, or non-infringement. We do not warrant that the
        Service will be error-free or that AI extraction will be accurate in all
        cases — you remain responsible for verifying every report before
        submitting it to insurers, regulators, or customers.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, our aggregate liability arising out
        of or relating to the Service will not exceed the fees you paid us in the
        12 months preceding the claim. We are not liable for indirect, incidental,
        special, consequential, or punitive damages, or for loss of profits, data,
        or business interruption.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate
        your account for material breach of these Terms, fraud, abuse, or extended
        non-payment, with reasonable notice where practical. On termination you can
        export your data; your Drive folder remains in your Drive under your
        control.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms. Material changes will be announced inside the
        app or by email at least 14 days before they take effect. Continued use of
        the Service after the changes take effect means you accept the new Terms.
      </p>

      <h2>13. Governing law &amp; disputes</h2>
      <p>
        These Terms are governed by the laws of India.
      </p>
      <span className="placeholder">
        EDIT: Specify your jurisdiction city. Example: "Disputes will be subject to
        the exclusive jurisdiction of courts in <em>[City, State]</em>." This
        should match where your business is registered.
      </span>

      <h2>14. Contact</h2>
      <p>
        Questions? Email{' '}
        <a href="mailto:surveyosprime@gmail.com">surveyosprime@gmail.com</a>{' '}
        or visit the <a href="/contact">Contact page</a>.
      </p>
    </LegalPageShell>
  );
}
