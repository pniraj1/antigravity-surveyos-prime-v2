# Marketing Site Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five missing marketing/legal pages (`/pricing`, `/features`, `/about`, `/contact`, `/refund`, `/faq`), wire them into nav, footer and sitemap, and record re-acceptance of the updated Terms from existing surveyors.

**Architecture:** Next.js 16 static export. Each page is a server component under `src/app/<route>/page.tsx` exporting `metadata`, reusing a shared `MarketingShell` for nav/footer so the header exists in exactly one place. Prices and trial lengths are imported from `src/lib/subscription/plans.ts` — no page may hardcode an amount. Nothing under `src/components/layout/` (the authenticated app shell, `AppTab`, `useRouteSync`) is touched.

**Tech Stack:** Next.js 16 (static export, `output: 'export'`), React 19, Tailwind v4, lucide-react, vitest, Firebase Hosting.

## Global Constraints

- **Prices come from `src/lib/subscription/plans.ts` only.** `PLANS` = monthly ₹799 / quarterly ₹2,199 (note `save ₹198`) / yearly ₹7,990 (note `2 months free`). Never write an amount as a literal in a page.
- **Trial copy:** 14 days base, 28 days with a referral code. Constants `TRIAL_DAYS = 14`, `REFERRAL_TRIAL_BONUS_DAYS = 14`, `REFERRER_REWARD_DAYS = 30`.
- **Legal identity, verbatim:** `SurveyOS, a sole proprietorship of Niraj Patil, Pune, India`
- **Jurisdiction, verbatim:** `courts of Pune, Maharashtra`
- **Support + grievance email:** `surveyosprime@gmail.com`
- **Canonical URLs:** always relative, resolved by `metadataBase` (already set to `SITE_URL` in `src/app/layout.tsx`). Never write an absolute `https://motorsurveyos-in.web.app/...` in a new page.
- **Route name is `/refund` (singular)** — `src/components/landing/LandingClient.tsx:505` already links there.
- **Do not modify** `src/components/layout/Dashboard.tsx`, `src/stores/ui-store.ts`, or anything touching `AppTab` / `useRouteSync`.
- **Verification per task:** `npx tsc --noEmit` must exit 0 and `npm run build` must succeed before every commit.

---

### Task 1: Shared marketing shell

**Files:**
- Create: `src/components/marketing/MarketingShell.tsx`
- Test: `src/components/marketing/__tests__/marketing-shell.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `MarketingShell({ eyebrow, title, subtitle, children, wide })` — `eyebrow: string`, `title: string`, `subtitle?: string`, `children: React.ReactNode`, `wide?: boolean` (default `false` → `max-w-2xl`; `true` → `max-w-5xl`). Also exports `MARKETING_LINKS: { href: string; label: string }[]` used by the footer.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/marketing/__tests__/marketing-shell.test.tsx
import { describe, test, expect } from 'vitest';
import { MARKETING_LINKS } from '../MarketingShell';

describe('MARKETING_LINKS', () => {
  test('covers every marketing and legal route', () => {
    const hrefs = MARKETING_LINKS.map((l) => l.href);
    for (const route of ['/pricing', '/features', '/about', '/contact', '/faq', '/privacy', '/terms', '/refund']) {
      expect(hrefs).toContain(route);
    }
  });

  test('uses /refund singular, matching the existing footer link', () => {
    const hrefs = MARKETING_LINKS.map((l) => l.href);
    expect(hrefs).toContain('/refund');
    expect(hrefs).not.toContain('/refunds');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/marketing/__tests__/marketing-shell.test.tsx`
Expected: FAIL — `Failed to resolve import "../MarketingShell"`.

- [ ] **Step 3: Create the shell**

```tsx
// src/components/marketing/MarketingShell.tsx
import Link from 'next/link';

/** Every marketing + legal route. The footer renders this list verbatim. */
export const MARKETING_LINKS: { href: string; label: string }[] = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/refund', label: 'Refund Policy' },
];

interface MarketingShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Wide layout for content pages; narrow (default) reads better for legal text. */
  wide?: boolean;
}

export function MarketingShell({ eyebrow, title, subtitle, children, wide = false }: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-[#F5F5F3] font-sans text-slate-900">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b border-black/5 bg-[#F5F5F3]/90 backdrop-blur-xl">
        <Link href="/landing" className="text-sm font-black text-slate-900 tracking-tight">Motor SurveyOS</Link>
        <div className="flex items-center gap-5">
          <Link href="/features" className="hidden sm:block text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">Features</Link>
          <Link href="/pricing" className="hidden sm:block text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">Pricing</Link>
          <Link href="/signup" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm">
            Start Free Trial
          </Link>
        </div>
      </nav>

      <article className={`${wide ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-5 py-16`}>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{eyebrow}</div>
        <h1 className="text-3xl font-black text-slate-900 mb-2">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mb-10">{subtitle}</p>}
        <div className="space-y-10 text-sm text-slate-700 leading-relaxed">{children}</div>

        <div className="mt-12 pt-6 border-t border-black/5 text-xs text-slate-400 flex flex-wrap gap-4">
          {MARKETING_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-slate-600 transition-colors">{l.label}</Link>
          ))}
        </div>
      </article>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/marketing/__tests__/marketing-shell.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/components/marketing/
git commit -m "feat(marketing): shared shell and route list for marketing pages"
```

---

### Task 2: `/pricing`

**Files:**
- Create: `src/app/pricing/page.tsx`
- Test: `src/app/__tests__/pricing-page.test.ts`

**Interfaces:**
- Consumes: `MarketingShell` (Task 1); `PLANS`, `TRIAL_DAYS`, `REFERRAL_TRIAL_BONUS_DAYS`, `REFERRER_REWARD_DAYS`, `UPI_ID` from `@/lib/subscription/plans`.
- Produces: route `/pricing`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/__tests__/pricing-page.test.ts
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PLANS } from '@/lib/subscription/plans';

const src = () => readFileSync('src/app/pricing/page.tsx', 'utf8');

describe('/pricing', () => {
  test('renders plans from the constant instead of hardcoded amounts', () => {
    const text = src();
    expect(text).toContain("from '@/lib/subscription/plans'");
    for (const plan of PLANS) {
      expect(text).not.toContain(String(plan.amount));
    }
  });

  test('states tax clarity, required before purchase', () => {
    expect(src()).toMatch(/No additional tax/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/__tests__/pricing-page.test.ts`
Expected: FAIL — `ENOENT ... src/app/pricing/page.tsx`.

- [ ] **Step 3: Create the page**

```tsx
// src/app/pricing/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { PLANS, TRIAL_DAYS, REFERRAL_TRIAL_BONUS_DAYS, REFERRER_REWARD_DAYS } from '@/lib/subscription/plans';

export const metadata: Metadata = {
  title: 'Pricing | Motor SurveyOS',
  description: `Motor survey software for IRDAI surveyors. ${TRIAL_DAYS}-day free trial, then simple monthly, quarterly or yearly plans. No credit card required.`,
  alternates: { canonical: '/pricing' },
};

const FAQS = [
  { q: 'How do I pay?', a: 'Pay by UPI to the ID shown on your renewal screen, then submit the transaction ID in the app. Your access is restored once the payment is verified, usually within a few hours.' },
  { q: 'What happens when my trial ends?', a: 'Your account becomes read-only. Existing claims stay visible and nothing is deleted — you simply cannot create or edit until you subscribe.' },
  { q: 'Can I cancel?', a: 'Yes, any time. Cancelling stops future payments; your access continues until the end of the period you have already paid for.' },
  { q: 'Do you charge GST?', a: 'No additional tax is currently charged. The price you see is the price you pay.' },
  { q: 'Is there a refund?', a: 'Paid periods are non-refundable — the free trial is the evaluation period. See our Refund Policy for details.' },
];

export default function PricingPage() {
  return (
    <MarketingShell
      eyebrow="Pricing"
      title="One claim pays for months of SurveyOS"
      subtitle={`A single motor survey fee covers your subscription several times over. Start with ${TRIAL_DAYS} days free — ${TRIAL_DAYS + REFERRAL_TRIAL_BONUS_DAYS} days with a referral code.`}
      wide
    >
      <section className="grid gap-4 sm:grid-cols-3 not-prose">
        {PLANS.map((plan, i) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-6 flex flex-col ${i === PLANS.length - 1 ? 'border-amber-400 bg-white shadow-md' : 'border-black/10 bg-white/60'}`}
          >
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{plan.label}</div>
            <div className="text-3xl font-black text-slate-900">₹{plan.amount.toLocaleString('en-IN')}</div>
            <div className="text-xs text-slate-500 mt-1">
              {plan.months === 1 ? 'per month' : `for ${plan.months} months`}
            </div>
            {plan.note && <div className="text-xs font-bold text-emerald-600 mt-2">{plan.note}</div>}
            <Link
              href="/signup"
              className="mt-6 text-center px-4 py-2.5 rounded-full text-xs font-bold bg-amber-400 text-gray-900 hover:scale-105 transition-transform"
            >
              Start Free Trial
            </Link>
          </div>
        ))}
      </section>

      <section>
        <p className="text-xs text-slate-500">
          Prices are in Indian Rupees. No additional tax is currently charged. No credit card is required for the trial.
        </p>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <h2 className="text-base font-black text-slate-900 mb-2">Refer a surveyor, you both gain</h2>
        <p>
          Share your referral code from the app. They get {REFERRAL_TRIAL_BONUS_DAYS} extra trial days
          ({TRIAL_DAYS + REFERRAL_TRIAL_BONUS_DAYS} instead of {TRIAL_DAYS}), and when their first payment is
          verified you get {REFERRER_REWARD_DAYS} days added to your own subscription. No cap.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">Pricing questions</h2>
        <div className="space-y-4">
          {FAQS.map((f) => (
            <div key={f.q}>
              <p className="font-bold text-slate-900">{f.q}</p>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </MarketingShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/__tests__/pricing-page.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck, build and commit**

```bash
npx tsc --noEmit && npm run build
git add src/app/pricing src/app/__tests__/pricing-page.test.ts
git commit -m "feat(marketing): dedicated pricing page with plan cards and FAQ schema"
```

---

### Task 3: `/refund` and `/contact` — the two live broken links

**Files:**
- Create: `src/app/refund/page.tsx`
- Create: `src/app/contact/page.tsx`
- Test: `src/app/__tests__/legal-pages.test.ts`

**Interfaces:**
- Consumes: `MarketingShell` (Task 1); `TRIAL_DAYS` from `@/lib/subscription/plans`.
- Produces: routes `/refund`, `/contact`.

**Why first among the content pages:** `src/components/landing/LandingClient.tsx:505-506` already links to `/refund` and `/contact`. Because `firebase.json` rewrites unmatched paths to `/index.html`, both currently return HTTP 200 while rendering the app shell — a customer clicking "Refund Policy" lands in the dashboard.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/__tests__/legal-pages.test.ts
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const IDENTITY = 'SurveyOS, a sole proprietorship of Niraj Patil, Pune, India';

describe('legal pages', () => {
  test('the footer-linked routes exist', () => {
    expect(existsSync('src/app/refund/page.tsx')).toBe(true);
    expect(existsSync('src/app/contact/page.tsx')).toBe(true);
  });

  test('contact publishes the legal identity and grievance officer', () => {
    const text = readFileSync('src/app/contact/page.tsx', 'utf8');
    expect(text).toContain(IDENTITY);
    expect(text).toMatch(/Grievance Officer/);
    expect(text).toMatch(/Data Protection Board/);
  });

  test('refund policy states the cancellation rule', () => {
    const text = readFileSync('src/app/refund/page.tsx', 'utf8');
    expect(text).toMatch(/non-refundable/i);
    expect(text).toMatch(/cancel/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/__tests__/legal-pages.test.ts`
Expected: FAIL — `expected false to be true` on the existence check.

- [ ] **Step 3: Create `/refund`**

```tsx
// src/app/refund/page.tsx
import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { TRIAL_DAYS } from '@/lib/subscription/plans';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy | Motor SurveyOS',
  description: 'How subscription cancellations and refunds work at Motor SurveyOS.',
  alternates: { canonical: '/refund' },
};

export default function RefundPage() {
  return (
    <MarketingShell
      eyebrow="Legal"
      title="Refund & Cancellation Policy"
      subtitle="Last updated: 31 July 2026 · Effective: 31 July 2026"
    >
      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">1. Your free trial is the evaluation period</h2>
        <p>
          Every account begins with a {TRIAL_DAYS}-day free trial with full access to all features, and no
          credit card is required. We ask you to satisfy yourself during the trial that Motor SurveyOS suits
          your practice, because paid periods are non-refundable.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">2. Paid subscriptions are non-refundable</h2>
        <p>
          Once a subscription period has been paid for and activated, the amount is non-refundable, whether
          the period is monthly, quarterly or yearly, and whether or not the software is used during it.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">3. You can cancel at any time</h2>
        <p>
          There is no lock-in and no cancellation fee. Simply do not submit a payment for the next period.
          Your access continues to the end of the period you have already paid for, after which the account
          becomes read-only: existing claims remain visible and nothing is deleted.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">4. Payment problems</h2>
        <p>
          If a payment was made but not credited, if an incorrect amount was transferred, or if a period was
          activated for the wrong duration, write to{' '}
          <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>{' '}
          with the UPI transaction ID. Genuine payment errors are corrected by adjusting your subscription
          period. We acknowledge such requests within 72 hours.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">5. If we end your access</h2>
        <p>
          If we suspend or terminate an account for a reason other than a breach of our Terms of Service,
          we refund the unused portion of the current paid period.
        </p>
      </section>
    </MarketingShell>
  );
}
```

- [ ] **Step 4: Create `/contact`**

```tsx
// src/app/contact/page.tsx
import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Contact & Grievance Redressal | Motor SurveyOS',
  description: 'How to reach Motor SurveyOS for support, and how to raise a data protection grievance.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <MarketingShell
      eyebrow="Contact"
      title="Get in touch"
      subtitle="We are a small team and read every message ourselves."
    >
      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">Support</h2>
        <p>
          For help with the software, your subscription or a payment, email{' '}
          <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>.
          We reply within one working day.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">Who you are dealing with</h2>
        <div className="p-4 rounded-xl border border-black/5 bg-white/60">
          <p className="font-bold text-slate-900">SurveyOS, a sole proprietorship of Niraj Patil, Pune, India</p>
          <p className="mt-1">Motor SurveyOS is operated by SurveyOS. Any agreement you enter into for the use of this software is with the proprietor named above.</p>
        </div>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">Grievance Redressal</h2>
        <p className="mb-3">
          Under India&apos;s Digital Personal Data Protection Act 2023, you may raise any complaint about how
          your personal data has been handled with our Grievance Officer.
        </p>
        <div className="p-4 rounded-xl border border-black/5 bg-white/60">
          <p><strong className="text-slate-900">Grievance Officer</strong>, Motor SurveyOS</p>
          <p>Email: <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a></p>
          <p className="mt-2 text-slate-500">We acknowledge every complaint within 72 hours and aim to resolve it within 30 days.</p>
        </div>
        <p className="mt-3">
          If you are not satisfied with our response, you may escalate the matter to the{' '}
          <strong>Data Protection Board of India</strong>.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">If your details appear in a survey</h2>
        <p>
          If you are an insured person or a third party whose details appear in a motor survey, please
          contact your insurer or the surveyor appointed to your claim. They decide what happens to that
          data; we only hold it on their behalf. If you write to us directly, we pass your request to the
          relevant surveyor and confirm to you that we have done so.
        </p>
      </section>
    </MarketingShell>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/__tests__/legal-pages.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Typecheck, build and commit**

```bash
npx tsc --noEmit && npm run build
git add src/app/refund src/app/contact src/app/__tests__/legal-pages.test.ts
git commit -m "fix(marketing): add refund and contact pages the footer already linked to

Both routes were linked from the landing footer but never existed. The SPA
rewrite meant they returned HTTP 200 while rendering the app shell, so a
customer clicking Refund Policy landed in the dashboard."
```

---

### Task 4: `/about` and `/faq`

**Files:**
- Create: `src/app/about/page.tsx`
- Create: `src/app/faq/page.tsx`
- Test: `src/app/__tests__/about-faq-pages.test.ts`

**Interfaces:**
- Consumes: `MarketingShell` (Task 1); `TRIAL_DAYS`, `REFERRAL_TRIAL_BONUS_DAYS` from `@/lib/subscription/plans`.
- Produces: routes `/about`, `/faq`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/__tests__/about-faq-pages.test.ts
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('about and faq', () => {
  test('both routes exist', () => {
    expect(existsSync('src/app/about/page.tsx')).toBe(true);
    expect(existsSync('src/app/faq/page.tsx')).toBe(true);
  });

  test('about names the proprietorship', () => {
    expect(readFileSync('src/app/about/page.tsx', 'utf8'))
      .toContain('SurveyOS, a sole proprietorship of Niraj Patil, Pune, India');
  });

  test('faq emits FAQPage structured data', () => {
    const text = readFileSync('src/app/faq/page.tsx', 'utf8');
    expect(text).toContain('FAQPage');
    expect(text).toContain('acceptedAnswer');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/__tests__/about-faq-pages.test.ts`
Expected: FAIL — `expected false to be true`.

- [ ] **Step 3: Create `/about`**

```tsx
// src/app/about/page.tsx
import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'About | Motor SurveyOS',
  description: 'Motor SurveyOS is built for independent IRDAI-licensed surveyors in India, by someone who works alongside them.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <MarketingShell
      eyebrow="About"
      title="Built for the surveyor, not the insurer"
      subtitle="Most insurance software is sold to companies. This one is built for the person doing the survey."
    >
      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">Why it exists</h2>
        <p>
          An independent motor surveyor spends more time transcribing documents than assessing damage.
          Registration certificates, driving licences and policy schedules all say the same things in
          different layouts, and every one of them gets typed out by hand into a report.
        </p>
        <p className="mt-3">
          Motor SurveyOS reads those documents and drafts the report, so the surveyor spends their time on
          the judgement only they can make.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">The assessment stays yours</h2>
        <p>
          The AI extracts, reconciles and flags. It does not decide. Every figure in a report is reviewed
          and signed off by the licensed surveyor, whose name and IRDAI licence appear on it. We build the
          software this way deliberately: the professional responsibility for an assessment is not something
          a tool can hold.
        </p>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">How we treat your data</h2>
        <ul className="space-y-2 pl-4">
          {[
            'Claim records are stored in India, in Google Cloud’s Mumbai region.',
            'Photographs never reach our servers — they stay on your device and in your own Google Drive.',
            'AI extraction runs with your own API key, from your browser to the provider. We store nothing from it.',
            'Only you can read your claims. Not other surveyors, and not us in the ordinary course of running the service.',
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-amber-400 flex-shrink-0">·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-base font-black text-slate-900 mb-3">Who we are</h2>
        <div className="p-4 rounded-xl border border-black/5 bg-white/60">
          <p className="font-bold text-slate-900">SurveyOS, a sole proprietorship of Niraj Patil, Pune, India</p>
          <p className="mt-1">
            Contact: <a href="mailto:surveyosprime@gmail.com" className="text-amber-600 hover:underline">surveyosprime@gmail.com</a>
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
```

- [ ] **Step 4: Create `/faq`**

```tsx
// src/app/faq/page.tsx
import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { TRIAL_DAYS, REFERRAL_TRIAL_BONUS_DAYS } from '@/lib/subscription/plans';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | Motor SurveyOS',
  description: 'Answers about trials, payment, data storage, AI extraction and SurveyOS Sync.',
  alternates: { canonical: '/faq' },
};

const GROUPS: { heading: string; items: { q: string; a: string }[] }[] = [
  {
    heading: 'Getting started',
    items: [
      { q: 'Who can use Motor SurveyOS?', a: 'IRDAI-licensed surveyors and loss assessors practising in India. Every registration is reviewed manually against the licence details you provide before the account is activated.' },
      { q: 'How long is the free trial?', a: `${TRIAL_DAYS} days with full access, or ${TRIAL_DAYS + REFERRAL_TRIAL_BONUS_DAYS} days if you sign up using another surveyor's referral code. No credit card is required.` },
      { q: 'Why does approval take time?', a: 'Because a human checks it. We verify the licence details in each request before granting access, which usually takes less than a working day.' },
    ],
  },
  {
    heading: 'Payment',
    items: [
      { q: 'How do I pay?', a: 'By UPI. The renewal screen shows the UPI ID and the amount; you pay from any UPI app, then submit the transaction ID (and optionally a screenshot) in the app.' },
      { q: 'How long does verification take?', a: 'Usually a few hours. Until it is verified, your account shows the payment as under review so you know it has been received.' },
      { q: 'What happens when my subscription expires?', a: 'The account becomes read-only. Every claim stays visible and nothing is deleted; you simply cannot create or edit until you renew.' },
      { q: 'Can I get a refund?', a: 'Paid periods are non-refundable, which is why the free trial exists. You can cancel at any time and keep access to the end of the period you paid for.' },
    ],
  },
  {
    heading: 'Your data',
    items: [
      { q: 'Where is my data stored?', a: 'Claim records and account details are held in Google Cloud’s Mumbai region, in India. Photographs are never uploaded to our servers.' },
      { q: 'Can other surveyors see my claims?', a: 'No. Access rules are enforced per account at the database level, so a claim is readable only by the surveyor who created it.' },
      { q: 'What happens to my documents?', a: 'Documents you send for AI extraction go from your browser directly to the AI provider using your own key, and we keep no copy. Finished reports go to your own Google Drive.' },
      { q: 'How do I delete my account?', a: 'Email us and we erase your personal data within 30 days. Files already exported to your Google Drive stay in your Drive, under your control.' },
    ],
  },
  {
    heading: 'AI and reports',
    items: [
      { q: 'Do I need my own API key?', a: 'Yes, for document extraction. You add a free Google Gemini or Groq key in your profile, so your document processing runs on your own account and stays under your control.' },
      { q: 'How accurate is the extraction?', a: 'Good enough to draft from, never good enough to sign blindly. Every extracted field is shown for review, discrepancies between documents are flagged, and the assessment remains yours.' },
      { q: 'Which reports can it produce?', a: 'Spot survey, final survey, re-inspection and valuation reports, plus fee bills, in PDF, printable HTML, Word and Excel formats.' },
    ],
  },
  {
    heading: 'SurveyOS Sync',
    items: [
      { q: 'What is SurveyOS Sync?', a: 'A separate, optional product: a Telegram bot your clients can send claim documents to, which you can then pull into a claim inside Motor SurveyOS.' },
      { q: 'Do I have to use it?', a: 'No. It is off unless you connect it, and you can disconnect at any time from your profile. If you never connect it, no document of yours passes through it.' },
    ],
  },
  {
    heading: 'Referrals',
    items: [
      { q: 'How does the referral scheme work?', a: `Share your referral code from your profile. The surveyor who signs up with it gets ${REFERRAL_TRIAL_BONUS_DAYS} extra trial days, and once their first payment is verified you get 30 days added to your own subscription.` },
      { q: 'Is there a limit?', a: 'No. Every referred surveyor whose first payment is verified extends your subscription by another 30 days.' },
    ],
  },
];

export default function FaqPage() {
  const all = GROUPS.flatMap((g) => g.items);
  return (
    <MarketingShell
      eyebrow="Support"
      title="Frequently asked questions"
      subtitle="If your question is not here, email surveyosprime@gmail.com and we will answer it."
    >
      {GROUPS.map((group) => (
        <section key={group.heading}>
          <h2 className="text-base font-black text-slate-900 mb-3">{group.heading}</h2>
          <div className="space-y-4">
            {group.items.map((f) => (
              <div key={f.q}>
                <p className="font-bold text-slate-900">{f.q}</p>
                <p>{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: all.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </MarketingShell>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/__tests__/about-faq-pages.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Typecheck, build and commit**

```bash
npx tsc --noEmit && npm run build
git add src/app/about src/app/faq src/app/__tests__/about-faq-pages.test.ts
git commit -m "feat(marketing): about and FAQ pages with FAQPage structured data"
```

---

### Task 5: `/features`

**Files:**
- Create: `src/app/features/page.tsx`
- Test: `src/app/__tests__/features-page.test.ts`

**Interfaces:**
- Consumes: `MarketingShell` (Task 1).
- Produces: route `/features`.

**Note on images:** use only files that already exist in `public/images/` — `report-spot.png`, `report-final.png`, `report-final-pdf.png`, `report-assessment.png`, `report-spot-hero.png`. Do not reference an image that is not in that list.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/__tests__/features-page.test.ts
import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('/features', () => {
  test('route exists', () => {
    expect(existsSync('src/app/features/page.tsx')).toBe(true);
  });

  test('every referenced image is present in public/images', () => {
    const text = readFileSync('src/app/features/page.tsx', 'utf8');
    const refs = [...text.matchAll(/\/images\/([a-z0-9-]+\.png)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const file of refs) {
      expect(existsSync(`public/images/${file}`)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/__tests__/features-page.test.ts`
Expected: FAIL — `expected false to be true`.

- [ ] **Step 3: Create the page**

```tsx
// src/app/features/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Features | AI Motor Survey Software | Motor SurveyOS',
  description: 'Automatic document extraction, spot and final survey reports, offline-first storage, Google Drive backup and fee bills — everything an IRDAI surveyor needs.',
  alternates: { canonical: '/features' },
};

const FEATURES: { title: string; body: string; image?: string }[] = [
  {
    title: 'Read documents instead of typing them',
    body: 'Point the app at a registration certificate, driving licence or policy schedule and the fields arrive filled in. Conflicting values between documents are flagged for you rather than silently accepted, so mismatches surface before they reach the insurer.',
    image: 'report-assessment.png',
  },
  {
    title: 'Spot survey reports in minutes',
    body: 'Capture damage at the site, list the affected parts, and the spot report assembles itself — driver particulars, licence verification, accident details and the damage schedule, in the format insurers expect.',
    image: 'report-spot.png',
  },
  {
    title: 'Final survey reports that reconcile themselves',
    body: 'Assessment rows carry estimate and assessed values per part, with depreciation and material splits totalled for you. The final report, the fee bill and the summary all read from the same figures, so they cannot disagree.',
    image: 'report-final.png',
  },
  {
    title: 'Every format an insurer asks for',
    body: 'The same claim exports as a PDF, a printable HTML report, a Word document or an Excel sheet. Re-inspection and valuation reports use the same data, so nothing is re-entered.',
    image: 'report-final-pdf.png',
  },
  {
    title: 'Works when the network does not',
    body: 'Claims are stored on the device first, so a basement parking lot or a highway with no signal does not stop a survey. Everything syncs to your cloud vault when the connection returns.',
  },
  {
    title: 'Backed up to your own Google Drive',
    body: 'Finished reports and photographs are exported to your own Drive account, in folders per claim. They are yours: we cannot read them, and they remain if you ever stop using the software.',
  },
  {
    title: 'Documents collected over Telegram',
    body: 'SurveyOS Sync is an optional companion: your client sends the RC or licence to a Telegram bot, and it appears in the app ready to attach to a claim. Connect it if it suits how you work, ignore it if it does not.',
  },
  {
    title: 'Fee bills and professional fees',
    body: 'Your fee schedule lives in your profile and drives the fee bill for each claim, so billing follows the survey instead of being rebuilt in a spreadsheet afterwards.',
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell
      eyebrow="Features"
      title="Everything the survey needs, nothing it does not"
      subtitle="Built around how an independent motor surveyor actually works — on site, often offline, and answerable for every figure."
      wide
    >
      {FEATURES.map((f, i) => (
        <section key={f.title} className="grid gap-6 sm:grid-cols-2 items-center">
          <div className={i % 2 === 1 ? 'sm:order-2' : ''}>
            <h2 className="text-base font-black text-slate-900 mb-2">{f.title}</h2>
            <p>{f.body}</p>
          </div>
          {f.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/images/${f.image}`}
              alt={f.title}
              className="rounded-xl border border-black/10 shadow-sm w-full"
              loading="lazy"
            />
          ) : (
            <div className="rounded-xl border border-black/5 bg-white/60 p-6 text-xs text-slate-400">
              Included in every plan.
            </div>
          )}
        </section>
      ))}

      <section className="text-center pt-4">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 transition-transform"
        >
          See pricing
        </Link>
      </section>
    </MarketingShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/__tests__/features-page.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck, build and commit**

```bash
npx tsc --noEmit && npm run build
git add src/app/features src/app/__tests__/features-page.test.ts
git commit -m "feat(marketing): features page with real report screenshots"
```

---

### Task 6: Wire everything into sitemap and footer

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/components/landing/LandingClient.tsx:502-507`
- Test: `src/app/__tests__/sitemap-coverage.test.ts`

**Interfaces:**
- Consumes: `MARKETING_LINKS` (Task 1); the routes created in Tasks 2–5.
- Produces: nothing consumed later.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/__tests__/sitemap-coverage.test.ts
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import sitemap from '@/app/sitemap';
import { MARKETING_LINKS } from '@/components/marketing/MarketingShell';

describe('sitemap', () => {
  test('lists every marketing route', () => {
    const paths = sitemap().map((e) => new URL(e.url).pathname.replace(/\/$/, '') || '/');
    for (const link of MARKETING_LINKS) {
      expect(paths).toContain(link.href);
    }
  });
});

describe('landing footer', () => {
  test('links to the pages that now exist', () => {
    const text = readFileSync('src/components/landing/LandingClient.tsx', 'utf8');
    for (const href of ['/privacy', '/terms', '/refund', '/contact', '/about', '/faq', '/pricing']) {
      expect(text).toContain(`href="${href}"`);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/__tests__/sitemap-coverage.test.ts`
Expected: FAIL — sitemap paths do not contain `/pricing`.

- [ ] **Step 3: Add the routes to the sitemap**

Open `src/app/sitemap.ts`. It already builds entries as `{ url: \`${baseUrl}/path\`, lastModified: new Date(), changeFrequency, priority }` where `baseUrl = SITE_URL`. Add these entries to the returned array, immediately after the existing `/landing` entry:

```ts
    { url: `${baseUrl}/features`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/pricing`,               lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/about`,                 lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.6 },
    { url: `${baseUrl}/faq`,                   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contact`,               lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${baseUrl}/refund`,                lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.4 },
```

- [ ] **Step 4: Extend the landing footer**

In `src/components/landing/LandingClient.tsx`, replace the four-link row (currently Privacy Policy, Terms of Service, Refund Policy, Contact) with:

```tsx
            <Link href="/features" className="hover:text-amber-400 transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-amber-400 transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-amber-400 transition-colors">About</Link>
            <Link href="/faq" className="hover:text-amber-400 transition-colors">FAQ</Link>
            <Link href="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</Link>
            <Link href="/refund" className="hover:text-amber-400 transition-colors">Refund Policy</Link>
            <Link href="/contact" className="hover:text-amber-400 transition-colors">Contact</Link>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/__tests__/sitemap-coverage.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Typecheck, build and commit**

```bash
npx tsc --noEmit && npm run build
git add src/app/sitemap.ts src/components/landing/LandingClient.tsx src/app/__tests__/sitemap-coverage.test.ts
git commit -m "feat(marketing): add new pages to sitemap and landing footer"
```

---

### Task 7: Terms — legal identity, Pune jurisdiction, version bump

**Files:**
- Modify: `src/app/terms/page.tsx`
- Modify: `src/lib/legal/versions.ts`
- Test: `src/lib/legal/__tests__/versions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TERMS_VERSION = '2026-07-31'` consumed by Task 8.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/legal/__tests__/versions.test.ts
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TERMS_VERSION, PRIVACY_VERSION, buildConsentRecord } from '../versions';

describe('legal versions', () => {
  test('terms version matches the date printed on the page', () => {
    expect(TERMS_VERSION).toBe('2026-07-31');
    expect(readFileSync('src/app/terms/page.tsx', 'utf8')).toContain('Version 2026-07-31');
  });

  test('terms names the contracting party and Pune jurisdiction', () => {
    const text = readFileSync('src/app/terms/page.tsx', 'utf8');
    expect(text).toContain('SurveyOS, a sole proprietorship of Niraj Patil, Pune, India');
    expect(text).toContain('courts of Pune, Maharashtra');
  });

  test('a consent record captures all three versions', () => {
    const record = buildConsentRecord();
    expect(record.termsVersion).toBe(TERMS_VERSION);
    expect(record.privacyVersion).toBe(PRIVACY_VERSION);
    expect(record.acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/legal/__tests__/versions.test.ts`
Expected: FAIL — `expected '2026-07-25' to be '2026-07-31'`.

- [ ] **Step 3: Bump the version**

In `src/lib/legal/versions.ts`, change:

```ts
export const TERMS_VERSION = '2026-07-31';
```

- [ ] **Step 4: Update the terms page**

In `src/app/terms/page.tsx`:

a. Replace the dateline text `Last updated: 25 July 2026 · Effective: 25 July 2026 · Version 2026-07-25` with:

```
Last updated: 31 July 2026 · Effective: 31 July 2026 · Version 2026-07-31
```

b. In section 1 (Acceptance), add this sentence at the end of the existing paragraph:

```tsx
{' '}These Terms are an agreement between you and <strong>SurveyOS, a sole proprietorship of Niraj Patil, Pune, India</strong>, which operates Motor SurveyOS.
```

c. Replace the Governing Law paragraph text with:

```
These Terms are governed by the laws of India. Any dispute arising out of or in connection with them is subject to the exclusive jurisdiction of the courts of Pune, Maharashtra.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/legal/__tests__/versions.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Typecheck, build and commit**

```bash
npx tsc --noEmit && npm run build
git add src/app/terms src/lib/legal
git commit -m "feat(legal): name the contracting party and Pune jurisdiction in the terms"
```

---

### Task 8: Re-acceptance prompt for existing surveyors

**Files:**
- Create: `src/components/legal/TermsReacceptGate.tsx`
- Create: `src/components/legal/__tests__/needs-reaccept.test.ts`
- Modify: `src/components/layout/Dashboard.tsx` (render the gate — a single added element, no routing change)

**Interfaces:**
- Consumes: `TERMS_VERSION`, `PRIVACY_VERSION`, `buildConsentRecord` from `@/lib/legal/versions`.
- Produces: `needsReaccept(consent: { termsVersion?: string; privacyVersion?: string } | undefined): boolean` and the `TermsReacceptGate` component.

**Why this exists:** the attestation added earlier applies only to new signups. The eight existing surveyors have never accepted any version, so `profile.consent` is undefined for them.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/legal/__tests__/needs-reaccept.test.ts
import { describe, test, expect } from 'vitest';
import { needsReaccept } from '../TermsReacceptGate';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions';

describe('needsReaccept', () => {
  test('an existing surveyor with no consent record must accept', () => {
    expect(needsReaccept(undefined)).toBe(true);
  });

  test('an outdated terms version must be re-accepted', () => {
    expect(needsReaccept({ termsVersion: '2026-06-19', privacyVersion: PRIVACY_VERSION })).toBe(true);
  });

  test('an outdated privacy version must be re-accepted', () => {
    expect(needsReaccept({ termsVersion: TERMS_VERSION, privacyVersion: '2026-06-19' })).toBe(true);
  });

  test('current versions need no prompt', () => {
    expect(needsReaccept({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/legal/__tests__/needs-reaccept.test.ts`
Expected: FAIL — `Failed to resolve import "../TermsReacceptGate"`.

- [ ] **Step 3: Create the gate**

```tsx
// src/components/legal/TermsReacceptGate.tsx
'use client';

import { useState } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import { useProfileStore } from '@/stores/profile-store';
import { TERMS_VERSION, PRIVACY_VERSION, buildConsentRecord } from '@/lib/legal/versions';
import { FileText, Loader2 } from 'lucide-react';

/**
 * True when the stored consent is missing or predates the current documents.
 * Surveyors onboarded before the attestation shipped have no record at all.
 */
export function needsReaccept(
  consent: { termsVersion?: string; privacyVersion?: string } | undefined,
): boolean {
  if (!consent) return true;
  return consent.termsVersion !== TERMS_VERSION || consent.privacyVersion !== PRIVACY_VERSION;
}

export function TermsReacceptGate() {
  const uid = useAuthStore((s) => s.user?.uid);
  const { profile, updateProfile } = useProfileStore();
  const [saving, setSaving] = useState(false);

  // Admins and signed-out visitors are not prompted; neither are up-to-date users.
  if (!uid || profile.isAdmin || !needsReaccept(profile.consent)) return null;

  const accept = async () => {
    setSaving(true);
    try {
      const consent = buildConsentRecord();
      await setDoc(
        doc(db, 'users', uid, 'profile', 'current'),
        { consent, updatedAt: Timestamp.now() },
        { merge: true },
      );
      updateProfile({ consent });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h2 className="text-base font-medium text-foreground">We have updated our terms</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Our Terms of Service and Privacy Policy have changed: they now name the operator of Motor
          SurveyOS, set out our subscription plans and refund position, and describe how claim data is
          handled under the DPDP Act. Please review and accept them to continue.
        </p>
        <div className="flex gap-3 text-sm">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>
        </div>
        <button
          onClick={accept}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : null}
          {saving ? 'Saving…' : 'I have read and accept'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/legal/__tests__/needs-reaccept.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add `consent` to the profile type**

In `src/types/vehicle.ts`, inside the `SurveyorProfile` interface, add:

```ts
  /** Set when the surveyor accepted the terms; see lib/legal/versions.ts */
  consent?: {
    attestationVersion: string;
    termsVersion: string;
    privacyVersion: string;
    acceptedAt: string;
  };
```

- [ ] **Step 6: Render the gate in the dashboard**

In `src/components/layout/Dashboard.tsx`, add the import beside the other component imports:

```tsx
import { TermsReacceptGate } from '@/components/legal/TermsReacceptGate';
```

and render it as the first child of the component's returned top-level fragment or wrapper element:

```tsx
      <TermsReacceptGate />
```

Do not change any other line in this file. The gate renders `null` for admins and for up-to-date users, so it cannot affect existing navigation.

- [ ] **Step 7: Typecheck, build and commit**

```bash
npx tsc --noEmit && npm run build
git add src/components/legal src/types/vehicle.ts src/components/layout/Dashboard.tsx
git commit -m "feat(legal): one-time terms re-acceptance for surveyors onboarded before consent records"
```

---

### Task 9: Deploy and verify live

**Files:** none modified.

**Interfaces:** none.

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: PASS — all suites, including the six added in this plan.

- [ ] **Step 2: Build and deploy**

```bash
npm run build
firebase deploy --only hosting
```
Expected: `Deploy complete!` and hosting URL `https://motorsurveyos-in.web.app`.

- [ ] **Step 3: Verify each new route serves its own page, not the app shell**

```bash
for p in pricing features about contact faq refund; do
  echo "/$p -> $(curl -s https://motorsurveyos-in.web.app/$p | grep -oE '<title>[^<]*</title>' | head -1)"
done
```
Expected: each line shows that page's own title (for example `<title>Pricing | Motor SurveyOS</title>`).
A response of `AI Motor Insurance Survey Software | Motor SurveyOS` means the SPA rewrite is still serving the app shell and the route did not build.

- [ ] **Step 4: Verify the sitemap lists the new routes**

```bash
curl -s https://motorsurveyos-in.web.app/sitemap.xml | grep -oE "<loc>[^<]*</loc>" | grep -E "pricing|features|about|faq|contact|refund"
```
Expected: six `<loc>` lines, all on `https://motorsurveyos-in.web.app`.

- [ ] **Step 5: Confirm no page hardcodes a price**

```bash
grep -rn "799\|2199\|2,199\|7990\|7,990" src/app/pricing/page.tsx src/app/features/page.tsx src/app/faq/page.tsx
```
Expected: no output. Amounts must come from `PLANS`.

- [ ] **Step 6: Commit any build artefacts and push**

```bash
git add -A
git commit -m "chore(marketing): deploy phase A marketing pages" --allow-empty
git push origin main
```

---

## Out of scope for this plan

- The three evergreen resource pages (`/resources/*`) — Phase B, each needs its own keyword and competitor research pass first.
- Landing page restyle and the pricing-section-to-teaser change — the landing page already carries pricing correctly; converting it to a teaser is cosmetic and can follow.
- Google Search Console submission — a manual step for the site owner, not a code change. Nothing here ranks until it is done.
