/**
 * Privacy Policy — TEMPLATE
 *
 * EDIT BEFORE GOING LIVE:
 *  1. Replace every <span className="placeholder"> block with your real info.
 *  2. Update "Last updated" date when you make material changes.
 *  3. Have a lawyer review for compliance with India's IT Rules 2011 +
 *     Digital Personal Data Protection Act 2023 (DPDPA) and any applicable
 *     IRDAI / data-localisation requirements for insurance-adjacent SaaS.
 *
 * The substance below is sensible defaults for a Drive-backed SaaS that
 * stores some metadata in Firebase Firestore. Adjust each section to match
 * what your code ACTUALLY does — privacy claims must be accurate.
 */

import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';

export const metadata: Metadata = {
  title: 'Privacy Policy · SurveyOS Prime',
  description: 'How SurveyOS Prime collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated="Last updated: 8 May 2026">
      <p>
        This Privacy Policy explains how <strong>SurveyOS Prime</strong> ("we", "our", "the
        Service") handles information when you use our motor-survey software. By using
        the Service, you agree to the practices described here.
      </p>

      <span className="placeholder">
        EDIT: Insert your registered legal entity name and address here. Example:
        "SurveyOS Prime is operated by <em>[Legal Entity Name Pvt Ltd]</em>, registered
        at <em>[Registered Address, City, PIN]</em>, India."
      </span>

      <h2>1. What we collect</h2>

      <h3>Account information</h3>
      <p>
        When you sign in with Google, we receive your name, email address, profile
        picture URL, and a Google account identifier. We use this to create your
        SurveyOS account and to keep you signed in.
      </p>

      <h3>Google Drive access</h3>
      <p>
        With your permission, we ask Google for the OAuth scopes needed to read and
        write files in a folder we create inside <em>your</em> Google Drive. We do not
        access files outside that folder, and we do not copy your Drive files to any
        third-party server.
      </p>

      <h3>Claim and survey data</h3>
      <p>
        Information you enter while preparing a motor-survey report — vehicle
        registration numbers, policy numbers, insured names, accident details,
        assessment line items — is stored:
      </p>
      <ul>
        <li>locally on your device (IndexedDB), so the app works offline; and</li>
        <li>in your Google Drive folder, as PDF reports and uploaded documents; and</li>
        <li>in our Firebase Firestore database, for syncing across your devices.</li>
      </ul>

      <h3>Photos and documents</h3>
      <p>
        Photos and documents you upload (RC, DL, policy, damage photos, bills) are
        stored in your Google Drive folder. We do not retain copies on our servers
        after upload completes, except temporarily during AI processing.
      </p>

      <h3>Usage and diagnostic data</h3>
      <p>
        We collect basic technical information — browser type, device type, errors,
        feature usage events — to improve the Service. This is not linked to specific
        claim content.
      </p>

      <h2>2. How we use your data</h2>
      <ul>
        <li>To provide the Service: extract data from documents you upload, sync your work across devices, generate PDF reports.</li>
        <li>To support you: respond to questions, fix bugs, improve features.</li>
        <li>To bill you for paid plans (after your free trial ends).</li>
        <li>To comply with legal obligations and to enforce our Terms.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell your data. We do not use your claim content to
        train public AI models.
      </p>

      <h2>3. AI processing</h2>
      <p>
        Document extraction and conflict detection use third-party AI models.
      </p>
      <span className="placeholder">
        EDIT: Name the AI providers you actually use (e.g., OpenAI, Anthropic, Google
        Vertex AI) and link to their data-handling statements. Example: "We use
        [Provider A] for OCR and [Provider B] for conflict detection. These providers
        process the documents you upload to extract data fields, and do not retain or
        train on your content under our enterprise agreement."
      </span>

      <h2>4. Sharing</h2>
      <p>
        We share data only with:
      </p>
      <ul>
        <li><strong>Google</strong> — for sign-in and Drive storage you authorise.</li>
        <li><strong>Firebase / Google Cloud</strong> — for our application database and hosting.</li>
        <li><strong>Our payment processor</strong> for paid plans.</li>
        <li><strong>Our AI processors</strong> for document extraction (see §3).</li>
      </ul>
      <span className="placeholder">
        EDIT: Name your payment processor (Razorpay, Stripe-India, etc.) and any other
        processors not listed above.
      </span>

      <h2>5. Where your data is stored</h2>
      <p>
        Files (photos, documents, generated reports) live in your Google Drive in the
        region Google assigns to your account. Account data and claim metadata live in
        Google Cloud Firestore.
      </p>
      <span className="placeholder">
        EDIT: State the Firestore region you've configured (e.g., "asia-south1
        (Mumbai)") if you want to be explicit about data residency, which matters for
        Indian insurance customers.
      </span>

      <h2>6. How long we keep it</h2>
      <ul>
        <li>Active claim data: as long as the claim is in your account. You can archive or delete a claim at any time.</li>
        <li>Account data: until you delete your account.</li>
        <li>Diagnostic logs: up to 90 days.</li>
        <li>Backups and audit logs: up to 12 months after deletion, after which they are purged.</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>You can:</p>
      <ul>
        <li>Access and export your data — every claim is already in your Google Drive as PDFs.</li>
        <li>Correct your data — edit any field directly in the app.</li>
        <li>Delete your data — delete claims individually, or request full account deletion via the Contact page.</li>
        <li>Withdraw consent — disconnect Google Drive in your Profile settings or revoke access at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.</li>
      </ul>

      <h2>8. Security</h2>
      <p>
        We use HTTPS for all connections, OAuth 2.0 for Google sign-in, and Firebase
        security rules to scope access to your account only. Drive files are protected
        by Google's standard encryption at rest and in transit. No system is perfectly
        secure; if we discover a breach affecting your data we will notify you within
        the timeframe required by applicable law.
      </p>

      <h2>9. Children</h2>
      <p>
        The Service is intended for licensed motor surveyors and insurance
        professionals. It is not directed at children under 18 and we do not
        knowingly collect data from minors.
      </p>

      <h2>10. Changes to this Policy</h2>
      <p>
        We may update this Policy. Material changes will be announced inside the app
        or by email at least 14 days before they take effect. The "Last updated" date
        at the top of this page reflects the latest version.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about this Policy? Email{' '}
        <a href="mailto:surveyosprime@gmail.com">surveyosprime@gmail.com</a>{' '}
        or visit the <a href="/contact">Contact page</a>.
      </p>
      <span className="placeholder">
        EDIT: If you appoint a Data Protection Officer (advisable under DPDPA once
        you cross threshold sizes), list their name and email here.
      </span>
    </LegalPageShell>
  );
}
