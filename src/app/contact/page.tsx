/**
 * Contact page — TEMPLATE
 *
 * EDIT BEFORE GOING LIVE:
 *  1. Replace placeholders with real business info — Indian Companies Act and
 *     Consumer Protection Act 2019 require a contactable address for any
 *     e-commerce intermediary.
 *  2. If you set up a custom support domain (e.g., support@motorsurveyos.web.app),
 *     update the email address everywhere it appears across the legal pages.
 */

import type { Metadata } from 'next';
import LegalPageShell from '@/components/legal/LegalPageShell';
import { Mail, MapPin, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact · SurveyOS Prime',
  description: 'Get in touch with the SurveyOS Prime team.',
};

export default function ContactPage() {
  return (
    <LegalPageShell title="Contact us" lastUpdated="Last updated: 8 May 2026">
      <p>
        We answer every email. The fastest way to reach us is below.
      </p>

      {/* Contact details — visually highlighted block */}
      <div className="not-prose grid sm:grid-cols-2 gap-4 my-6">
        <div className="p-5 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <Mail size={16} className="text-amber-600" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Email</span>
          </div>
          <a
            href="mailto:surveyosprime@gmail.com"
            className="text-gray-900 font-bold text-base hover:text-amber-600 transition-colors break-all"
          >
            surveyosprime@gmail.com
          </a>
          <p className="text-xs text-gray-500 mt-2">For support, billing, and privacy queries.</p>
        </div>

        <div className="p-5 rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-amber-600" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Response time</span>
          </div>
          <div className="text-gray-900 font-bold text-base">Within 2 business days</div>
          <p className="text-xs text-gray-500 mt-2">Faster on weekdays · Mon–Fri, 10:00–18:00 IST.</p>
        </div>
      </div>

      <h2>What to include in your email</h2>
      <p>To help us reply quickly:</p>
      <ul>
        <li>The Google account email you signed up with.</li>
        <li>A short description of what you need — "billing question", "bug report", "data export request", etc.</li>
        <li>Screenshots if relevant.</li>
      </ul>

      <h2>Specific kinds of requests</h2>
      <ul>
        <li><strong>Billing &amp; refunds</strong> — see our <a href="/refund">Refund Policy</a> for the full process.</li>
        <li><strong>Privacy &amp; data requests</strong> — see our <a href="/privacy">Privacy Policy</a> for what you can ask for (export, deletion, correction).</li>
        <li><strong>Bug reports &amp; feature requests</strong> — please include the browser/device and what you were doing when the issue happened.</li>
        <li><strong>Press &amp; partnerships</strong> — same email; mark the subject line clearly.</li>
      </ul>

      <h2>Registered office</h2>
      <span className="placeholder">
        EDIT: Replace this block with your real registered address. Indian e-commerce
        intermediaries are required to publish this. Example:
        <br /><br />
        <em>
          [Legal Entity Name Pvt Ltd]<br />
          [Street address]<br />
          [City, State, PIN code]<br />
          India<br />
          CIN: [Corporate Identification Number]<br />
          GST: [GSTIN, if registered]
        </em>
      </span>

      <div className="not-prose mt-6 p-5 rounded-2xl border border-gray-200 bg-gray-50">
        <div className="flex items-start gap-3">
          <MapPin size={18} className="text-gray-500 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-600">
            We're a small team — we don't have a walk-in office, but we read every email.
            <span className="block text-xs text-gray-500 mt-1">
              EDIT: change or remove this line once you have an actual office.
            </span>
          </div>
        </div>
      </div>
    </LegalPageShell>
  );
}
