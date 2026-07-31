# Marketing Site — Information Architecture & Page Plan

**Date:** 2026-07-31 · **Status:** approved by Niraj (city: Pune) · pending implementation plan
**Goals:** lean page set · rank on Google for surveyor searches · Apple/Google-grade visual quality

## Context

Live site: `https://motorsurveyos-in.web.app` (Firebase Hosting, Next.js 16 static export, `out/`).
Existing: `/landing` (pricing section inline), `/products`, `/products/motor-surveyos`, `/blog` (+1 post),
`/privacy`, `/terms` (v2026-07-25), `/signup`, `/access-request`, `/screenshots/*` (demo report captures).
Missing: dedicated pricing, features, about, contact, refunds, FAQ, evergreen resource pages.

Legal identity for all pages: **"SurveyOS, a sole proprietorship of Niraj Patil, Pune"** —
jurisdiction: **courts of Pune**. Udyam number added later as a one-line edit.
Pricing (live): ₹799/mo · ₹2,199/quarter · ₹7,990/yr (2 months free). Trial: 14 days, 28 with referral.
Referral: entrant +14 trial days; referrer +30 days on first verified payment.

## Sitemap (target state)

```
Header nav:  Product · Features · Pricing · Resources · [Start Free Trial]
Footer:      About · Contact · FAQ · Privacy · Terms · Refunds · Blog
```

| # | Route | Status | One-line purpose |
|---|---|---|---|
| 1 | `/landing` | restyle only | Convert. Pricing stays as teaser section linking to /pricing |
| 2 | `/pricing` | NEW | 3 plan cards, referral banner, ROI framing, FAQPage schema |
| 3 | `/features` | NEW | Module-by-module with real screenshots: AI extraction, reports, Cloud Vault, Sync, fee bills |
| 4 | `/about` | NEW | Proprietor story, mission, legal identity. Trust page for insurers |
| 5 | `/contact` | NEW | Identity, support email, Grievance Officer + response times (72h ack / 30d resolve) |
| 6 | `/refunds` | NEW | No refunds; cancel anytime; trial = evaluation period. Distinct URL for gateway checklists |
| 7 | `/faq` | NEW | 15–20 real questions, FAQPage structured data |
| 8 | `/resources/report-format` | NEW (Phase B) | "Motor survey report format — with sample" |
| 9 | `/resources/fee-schedule` | NEW (Phase B) | "IRDAI motor surveyor fee schedule, explained" |
| 10 | `/resources/become-a-surveyor` | NEW (Phase B) | "How to become an IRDAI-licensed surveyor" |
| 11 | `/products/*`, `/blog`, `/privacy`, `/terms` | keep | Terms gets §identity + Pune jurisdiction update |

Excluded deliberately (YAGNI): careers, press kit, case studies, help-center, per-module product pages.
An empty version of any of these is worse than its absence.

## Page content outlines

### /pricing
- Hero: "One claim pays for months of SurveyOS" (fee ₹1,500–5,000 vs ₹799/mo)
- The 3 plan cards (single source: `src/lib/subscription/plans.ts` — never hardcode amounts on pages)
- Referral banner (two-sided: +14 days them / +30 days you)
- Price clarity line: "Prices in INR. No additional tax currently charged." (mandatory pre-purchase clarity)
- Mini-FAQ (5 Qs: how to pay, cancel, refund, what happens at expiry, GST) with FAQPage schema

### /features
- One `FeatureRow` per module, alternating layout, real screenshots from `/screenshots/*` mock data
- Modules: AI document extraction · report generation (all formats) · Cloud Vault sync ·
  offline-first device storage · Google Drive backup · SurveyOS Sync (Telegram) · fee bills · admin/billing
- Each row: H2 with keyword, 2–3 sentences, screenshot, micro-CTA

### /about
- The story: built for IRDAI surveyors; assessment stays surveyor-made (IRDAI positioning)
- Who: "SurveyOS, a sole proprietorship of Niraj Patil, Pune"
- Data promises (mirrors privacy: India-hosted, photos never on our servers, BYOK AI)

### /contact
- Legal identity block (as above) · support: surveyosprime@gmail.com
- Grievance Officer section: 72h acknowledgement, 30-day resolution, DPB escalation
- No contact form (email links only — no backend to receive forms; forms invite spam)

### /refunds
- Policy as approved: paid amounts non-refundable; cancel anytime (stops future billing, access
  runs to period end); 14-day trial is the evaluation; verification/duration disputes → grievance email

### /faq  (seed list; final list from research)
Payment (UPI flow, verification time, screenshot), trial (14/28 days, what happens at expiry,
read-only mode), data (where stored, who sees claims, DPDP, photos), AI (own API key, accuracy,
surveyor-made assessment), Sync (what it is, Telegram, optional), referral mechanics, account deletion.

### /resources/* (Phase B — research first, then write)
Each: 1,200–2,000 words, H2/H3 structured, one downloadable/visual artefact, soft CTA footer,
`Article` schema, internal links to /features and /pricing.

## Design system (the Apple/Google bar)

New marketing component kit in `src/components/marketing/`:
- `PageShell` (nav + footer + consistent max-width/spacing)
- `Hero` (headline, sub, CTA, optional visual)
- `FeatureRow` (alternating text/screenshot)
- `StatBand`, `CTABand`, `FAQList` (with schema emission), `LegalPageShell` (exists in spirit on /privacy — extract)

Rules: existing amber accent + slate palette only · real screenshots over illustrations ·
type scale from landing · static export, zero new deps · Lighthouse ≥ 95 mobile ·
every page: title, description, canonical (via `SITE_URL`), OG image, breadcrumb schema.

## SEO technicals

- Done: canonicals, sitemap.xml, robots.txt, org/software schema, Search Console tag
- Every new page added to `sitemap.ts` same commit it ships
- FAQPage schema on /faq and /pricing mini-FAQ; Article schema on resources
- **User action (blocking rank, 10 min): add property in Search Console + submit sitemap + request indexing**
- Header nav change touches `LandingClient` + marketing layouts only — NOT the app shell
  (AppTab/useRouteSync untouched; per vault guardrail the app nav is the fragile part)

## Phasing

- **Phase A (build now):** /pricing, /faq, /contact, /refunds, /about · nav+footer restructure ·
  terms §identity/jurisdiction (Pune) update + TERMS_VERSION bump · re-acceptance modal for existing users
  (from the earlier approved legal design) · landing pricing section becomes teaser → /pricing
- **Phase B (research → build):** the 3 resource pages
- **Phase C (later):** competitor comparison page, testimonials when quotable customers exist

## Research topics (per page, before Phase B writing)

| Topic | Questions to answer |
|---|---|
| Keywords: report format | Exact phrasings surveyors use; what ranks today; format variations (spot/final/reinspection) |
| Keywords: fee schedule | Current IRDAI fee circular; how competitors present it; calculator opportunity |
| Keywords: become a surveyor | Exam/licence process 2026; IIISLA role; search volume phrasing |
| FAQ mining | Real questions from surveyor WhatsApp groups / IIISLA circles / your 8 users |
| Competitor teardown | SurveyorLite + Motor Survey Plus site structure, claims, gaps |
| Screenshot inventory | Which /screenshots captures exist vs which /features rows need new ones |

## Acceptance criteria

1. All Phase A routes live, in sitemap, canonical to SITE_URL, zero dead-domain refs
2. Prices render from `plans.ts` only — no hardcoded amounts on any page
3. Legal identity "sole proprietorship of Niraj Patil, Pune" on /about, /contact, /terms
4. TERMS_VERSION bumped; new signups record it; existing users see one-time re-acceptance modal
5. FAQPage schema validates (Rich Results test)
6. Lighthouse mobile ≥ 95 on /landing, /pricing, /features
7. App shell (AppTab routing) untouched — verified by existing behaviour, no changes under `src/components/layout/Dashboard.tsx` or `useRouteSync`
