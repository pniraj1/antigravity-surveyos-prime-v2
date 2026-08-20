# Public Site Redesign — Strategy & Spec

> **Date:** 2026-08-03
> **Scope:** Everything before sign-in. `/`, `/landing`, `/features`, `/pricing`, `/about`, `/faq`,
> `/contact`, `/products`, `/blog`, `/privacy`, `/terms`, `/refund`, `/signup`.
> **Explicitly out of scope:** the authenticated app. No tab, store, calculation or report changes.

---

## 0. The one-sentence thesis

The site currently sells **spectacle**. The buyer is making a **risk decision**. Every rupee of design
effort should move from atmosphere to evidence — and the evidence you need is already written, in
`/about` and `/faq`, where nobody sees it.

---

## 1. Who is actually reading this page

An IRDAI-licensed independent motor surveyor in India. Concretely:

- Solo or a 2–5 person firm. Not an enterprise buyer, no procurement, no committee.
- Reading on an Android phone, often on mobile data, frequently in a garage or a basement.
- Charges roughly ₹1,500–5,000 per survey, so ₹799/month is not the objection. **Risk is.**
- Their licence is on every report they sign. The question behind every other question is:
  *"Can this get me a query from the insurer, or trouble with IRDAI?"*
- Found through word of mouth, IIISLA chapters and WhatsApp groups. It is a **small, tight-knit
  market where everyone can check with three peers in ten minutes.**

That last point governs the entire copy strategy. See §3.

---

## 2. What the current site gets wrong

Each finding is grounded in the code, with the file.

### 2.1 The scroll choreography inverts the information hierarchy — CRITICAL

`src/app/landing/page.tsx` is a two-phase animated experience:

- Phase 1: a `min-h-[120vh]` hero, faded to `opacity: 0` by 500px of scroll (`heroOpacity`, line 241).
- Phase 2: a **fixed video occupying 70vw**, with all actual content — how-it-works, features,
  pricing, CTA, blog, footer — compressed into a `w-[30%]` left rail (line 453).

On a 1440px desktop, the pricing card renders in roughly a 400px column while a stock AI-generated
video gets 1000px. The video carries zero information. **The value proposition literally fades out
while decoration takes over the screen.** This is the single largest structural problem.

Secondary costs: scroll-jacking breaks Ctrl+F, breaks the scrollbar's meaning as a progress
indicator, and stutters on mid-range Android — which is your user's actual device.

### 2.2 The money page is gated behind an auth round-trip — CRITICAL

`src/app/page.tsx` is `'use client'`, wrapped in `AuthSyncWrapper → AuthGate → SubscriptionGuard`,
and returns a **loading spinner** while Firebase auth resolves (lines 57–68).

Because `next.config.ts` sets `output: 'export'`, the prerendered `out/index.html` contains
*the spinner*, not the landing page. Every anonymous visitor on the canonical URL gets:
blank → spinner → Firebase SDK boot → landing render. LCP on the highest-priority page in
`sitemap.ts` (`priority: 1.0`) is gated on an auth check that anonymous visitors never need.

**This is a three-line fix. See Phase 0.**

### 2.3 Payload

| Asset | Size | Status |
|---|---|---|
| `public/hero-cinematic.mp4` | 6.4 MB | Served, autoplays |
| `src/app/landing/dreamina-…mp4` | 6.4 MB | **Not served** — repo dead weight |
| `src/app/landing/6f92cb75-….png` | 2.4 MB | **Not served** — repo dead weight |
| `public/images/` | 11 MB | Served unoptimised |
| `public/logo-transparent.png` | 652 KB | A logo, as PNG |
| `public/logo-teal.png` | 572 KB | A logo, as PNG |

`next.config.ts` sets `images: { unoptimized: true }`, so `<Image>` ships every original PNG
untouched. There is no WebP or AVIF anywhere in the project.

**Dead code:** `DemoSection.tsx` (19 KB), `HeroScrollCanvas.tsx` (8 KB), `PricingSection.tsx`
(10 KB) are defined and never imported anywhere. The vault's `Features/Landing_Page.md` still
documents a `LandingClient.tsx` that no longer exists.

### 2.4 Four navbars, two footers, no agreement between them

| Route | Nav | CTA target |
|---|---|---|
| `/landing` | own, inline | Google popup |
| `/features`, `/pricing`, `/about`, `/faq`, legal | `MarketingShell` | `/signup` |
| `/products` | hand-rolled | `/landing` |
| `/blog` | hand-rolled | `/landing` |

`/products` and `/blog` have **no footer at all** — no privacy link, no terms link. The landing
footer lists "Refunds"; `MarketingShell` lists "Refund Policy". Below `md`, the landing nav hides
Features, Pricing *and* Products, so **mobile visitors have no site navigation whatsoever.**

### 2.5 The site contradicts itself in a single session

- Nav says **"Start 14-Day Free Trial"** (line 334). The pricing card ten sections below says
  **"30 Days Free"** (line 574). `TRIAL_DAYS = 14`.
- The landing hardcodes **₹799/month, one plan** (line 579). `/pricing` reads `PLANS` and shows
  **three** (₹799 / ₹2,199 / ₹7,990 — "2 months free"). A visitor who only sees the landing never
  learns the annual plan exists. **That is your best conversion lever, hidden.**
- The referral offer (14 bonus trial days + 30 days credited to the referrer, **no cap**) appears
  on `/pricing` only. Your cheapest acquisition channel is absent from the landing page.

### 2.6 Unsubstantiated claims — the most expensive problem on the site

| Claim | Where | Why it costs you |
|---|---|---|
| "99.9% extraction accuracy" | `CHAPTERS[0]`, metrics card | An unverifiable hard number invites the exact objection you least want: *"so it's wrong 1 in 1000 times, and I'm the one who signed it."* |
| "0 — Third-party breaches" as a **stat** | `CHAPTERS[2]`, metrics card | Absence of evidence dressed as achievement. Every pre-breach company can say it. |
| "Join thousands of surveyors" | CTA card, line 620 | This is a sole proprietorship. |

The third one is the serious one. In a market where a prospect can verify with three peers in ten
minutes, an inflated scale claim gets caught at the exact moment of maximum scepticism — and in
India it is also exposure under the Consumer Protection Act 2019 and the ASCI code.

**Removing these three claims costs nothing and is the highest-ROI change in this document.**

### 2.7 Your strongest assets are buried

The best copy on the entire site is on `/about` and `/faq`, and none of it is on the landing page:

- *"Photographs never reach our servers — they stay on your device and in your own Google Drive."*
- *"Claim records are stored in India, in Google Cloud's Mumbai region."*
- *"The AI extracts, reconciles and flags. It does not decide."*
- *"Every registration is reviewed manually against the licence details you provide."*

That last one is a genuine moat. **Manual IRDAI licence verification means the platform is
peer-vetted** — no generic document-AI tool can claim it. It is currently an FAQ answer.

Likewise, the **reconciliation engine** — flagging a chassis-number mismatch between the RC and the
policy *before* it reaches the insurer — is the feature a working surveyor would pay for on sight.
It appears on the landing page as one 12-word grid tile called "LLM Reconciliation".

### 2.8 The features list undersells a much deeper product

The landing advertises seven generic tiles, two of which — **"Lightning Fast"** and **"Offline
First"** with the copy *"Zero load times, native-like performance"* — are not features. Every SaaS
says it, and to a technical-minded buyer it reads as filler.

Meanwhile the app has **13 working tabs** including Bill Check, Valuation, Reinspection and Fees.
Those are the things a generic tool cannot do, and the things that make a surveyor say *"this was
built by someone who has actually done the job."* They are not mentioned anywhere on the landing
page.

### 2.9 Accessibility

- `layout.tsx` sets `maximumScale: 1` — **blocks pinch-zoom.** WCAG 1.4.4 failure, and actively
  hostile to a demographic largely over 45 reading on phones.
- Chapter cards are `div`s with `role="button"` and `onClick`, no `tabIndex`, no key handler
  (line 488) — keyboard-inaccessible.
- `text-[9px]` / `text-[10px]` throughout. Minimum readable body text on mobile is 16px.
- `font-black` (900) as the default weight at those sizes is the most recognisable
  "AI-generated landing page" tell, and it hurts legibility.
- No `prefers-reduced-motion` handling anywhere, on a page built entirely of scroll animation.
- Amber-400 (`#FBBF24`) is used for CTA text and links on `#F5F5F3` — roughly **1.7:1**. Fails AA
  by a wide margin.

### 2.10 SEO targets a category that does not exist

`layout.tsx` keywords target *"AI motor insurance survey software"*, *"IRDAI surveyor app"*. Nobody
in India searches these — the category has no name yet. The blog has **one post**.

`robots.txt` explicitly welcomes GPTBot, PerplexityBot and ClaudeBot. That is smart and forward-
looking. It is also currently pointing them at a site with nothing worth citing.

---

## 3. Strategy

### 3.1 Reposition: from "AI" to "you still sign it"

"AI-powered motor surveying" is category-creating copy. It requires educating the market, and it
triggers the fear you must neutralise (*"is this going to replace me / write something I'm liable
for?"*).

**Proposed line:**

> ## The report writes itself. You still sign it.

It states the benefit and defuses the primary objection in eight words, and it is exactly what
`/about` already says. Alternatives worth testing: *"Stop typing the RC book."* / *"From site
photos to a signed final report in one sitting."*

### 3.2 Replace spectacle with proof

Three substitutions, in order of impact:

| Remove | Replace with |
|---|---|
| 6.4 MB autoplay cinematic video | The **actual report** you already generate — `report-final.png`, annotated |
| "99.9% accuracy" | *"Flags the mismatch before the insurer does"* + a screenshot of it doing so |
| "Join thousands of surveyors" | A named human: *"Built in Pune, by one person, alongside working surveyors."* |

For a one-person product in a trust-driven market, **a real face beats fake scale.** Small honest
numbers beat large invented ones when the buyer can check.

### 3.3 The single best asset you are not shipping

**A redacted sample final survey report, as a PDF, downloadable from the hero without signing up.**

You already generate these. It takes an hour to produce one. It converts better than any animation,
because it answers the only question that matters — *"will this produce something my insurer
accepts?"* — with the artefact itself.

---

## 4. Information architecture — the new landing page

Eleven sections. Static, image-driven, no scroll choreography.

**1 · Header** — one shared `PublicHeader` on all 14 public routes.
`Logo | Product ▾ | Features | Pricing | Resources ▾ | [Sign in] [Start free trial]`
Sticky, 64px, solid at scroll (no `backdrop-blur` over video — GPU cost and a contrast hazard).
Mobile: hamburger → full-screen sheet. **Mobile must have navigation.**

**2 · Hero** — split, no video.
Left: headline, subhead naming the exact artefacts (RC, licence, policy schedule, spot report,
final report, fee bill), two CTAs — `Start 14-day free trial` (reading `TRIAL_DAYS`) and
**`See a sample final report (PDF)`**. Trust line beneath: *No card required · Data stays in India ·
Licence verified before activation.*
Right: `report-final.png` in a device frame with 3–4 annotated callouts — *this field came from the
RC · this total is computed · this row flagged a mismatch.* Static, LCP-eligible, zero JS.

**3 · Trust bar** — immediately under the hero, four cells, each linking to the relevant `/faq`
anchor or `/privacy` section:
`IRDAI licence verified before activation` · `Claim data in Google Cloud, Mumbai` ·
`Photographs never touch our servers` · `Your AI key, your Drive, your files`
This converts your compliance posture — genuinely differentiated — into the primary marketing asset.

**4 · The problem, in their words** — no hyperbole. The same five fields typed into eight places.
The estimate and the assessment disagreeing at the last minute. The fee bill rebuilt in Excel. The
insurer query three weeks later because the chassis number doesn't match the RC.
One honest number: *"A final report is typically 2–3 hours. Most of it is transcription."*

**5 · How it works — three steps, three real screenshots**
1. **Upload the documents** → DocumentsTab extraction, fields filled, sources highlighted.
2. **Check what it flagged** → the reconciliation/evidence viewer catching an RC-vs-policy chassis
   mismatch. **This is the killer feature and it is currently one grid tile.**
3. **Sign and export** → PDF / print HTML / Word / Excel, into your own Drive folder.

**6 · What it actually covers** — a compact grid of the real 13 tabs: Details, Review, Photos,
Assessment, Bill Check, Valuation, Documents, Reinspection, Spot, Fees, Report, Cloud Vault,
Profile. Delete "Lightning Fast" and "Zero load times."

**7 · Objections, answered plainly** — three columns, promoted verbatim from `/about` and `/faq`:
- *Will the AI make the assessment?* → No. It extracts, reconciles and flags. Every figure is yours,
  and it is your licence on the report.
- *What if I stop paying?* → Read-only. Nothing is deleted. Your Drive exports are yours forever.
- *Will it work with no signal?* → Offline-first, on-device, syncs on reconnect.

**8 · Pricing — complete, on the landing page.** All three `PLANS`, annual highlighted with
"2 months free", the referral offer as its own callout. Anchor with the `/pricing` headline, which
is the most persuasive line on the site: **"One survey fee covers about three months."**

**9 · Proof** — founder's note with a name and a face now; three real testimonials (name, city,
licence category, photo) as they arrive; an honest build-time constant thereafter
(*"Used by 43 surveyors across 11 cities"*). Offer early users a free month for a 60-second video.

**10 · FAQ** — top six, `FAQPage` schema, linking to full `/faq`.

**11 · Final CTA + one shared `PublicFooter`.**

---

## 5. Design system

Reuse what already exists rather than inventing. `globals.css` already defines an "Executive
Platinum" token set and a marketing type scale — the landing page ignores both.

### 5.1 Colour

Amber-400 as primary has two problems: it fails contrast on the light background, and **amber is a
warning colour** — using it for everything means you cannot use it to warn about anything, in a
product whose core value is flagging problems.

| Role | Token | Value |
|---|---|---|
| Surface | `--color-platinum` | `#F8F9FA` |
| Card | — | `#FFFFFF` |
| Heading ink | `--color-navy` | `#0D1B2A` |
| Body ink | `--color-asphalt` | `#4A4E69` |
| **Primary action** | `--color-navy` | `#0D1B2A` fill, white text — **16:1**, serious, unambiguous |
| Accent | `--color-gold` | `#D4AF37` — underlines, "recommended" ring, eyebrows. **Not CTA fill.** |
| Status | `--color-status-*` | Reserved strictly for semantics |

Side benefit: the marketing site and the app finally look like the same product. They currently
do not.

### 5.2 Typography

Keep Inter — it is loaded and it is fine. (IBM Plex Sans is the more "insurance/finance" voice if
you want it later; the swap is not worth the diff today.) **Change the usage:**

- Headings 600–700. **Never 900.**
- Body 400, `line-height` 1.6, **16px minimum on mobile**.
- Delete every `text-[9px]` and `text-[10px]`.
- Use the `text-h1` / `text-lead` / `text-body` / `text-caption` scale already in `globals.css`.
- Line length capped at 65–75ch (`MarketingShell` already does this correctly — copy it).

### 5.3 Motion

Delete the scroll-linked choreography. Keep: 150–250ms hover/focus transitions, one subtle fade-up
on section enter, `prefers-reduced-motion` respected everywhere. Nothing that moves on its own.

### 5.4 The video

If you want to keep it: a **30-second product demo on `/features`**, click-to-play behind a WebP
poster, compressed to under 2 MB (VP9/AV1). Not a 6.4 MB autoplay background on the money page.

---

## 6. Technical plan

**Stay on Next.js 16 static export.** Do not move the marketing site to Astro, Webflow or Framer —
a second pipeline, a second design system and a broken shared auth CTA, for fourteen pages. The
export you have is fine; the problem is what it prerenders.

### 6.1 Performance targets

| Metric | Target |
|---|---|
| LCP (4G, mid-range Android) | < 1.5 s |
| Total landing transfer | < 400 KB |
| CLS | < 0.05 |
| Lighthouse a11y | 100 |

### 6.2 Work

- **Prerender the landing.** Change the `loading` branch in `src/app/page.tsx` to render
  `<LandingPage />` instead of the spinner. `out/index.html` then contains real marketing HTML.
  100% of anonymous traffic ends there anyway; authenticated users get swapped in ~200 ms.
- **Build-time WebP.** A `sharp` script in `scripts/`, run pre-build, since `unoptimized: true`
  means Next will not. 11 MB → roughly 1.5 MB.
- **Logos to SVG.** 1.2 MB of PNG for two logos; `src/app/icon.svg` already exists.
- **Delete** `src/app/landing/*.mp4` and `*.png` — 8.8 MB of unserved repo weight.
- **Delete** `DemoSection.tsx`, `HeroScrollCanvas.tsx`, `PricingSection.tsx` — 37 KB dead code.
- **Remove** `maximumScale: 1` from `layout.tsx`.
- Explicit `width`/`height` on every image (CLS).

### 6.3 SEO / content moat

Nobody searches for the category. Win by answering **the job**:

- `/guides/motor-survey-report-format` — with a downloadable template
- `/guides/irdai-surveyor-fee-schedule` — with a client-side calculator
- `/guides/depreciation-rates-motor-claims` — the IRDAI table, well formatted, plus a calculator
- `/guides/spot-survey-checklist` — printable
- `/guides/salvage-value-calculation`

Each closes with *"Motor SurveyOS does this automatically →"*. These rank because they would be the
only good versions of those pages that exist, and they bring exactly the right person. They are also
what earns citations from ChatGPT/Perplexity/Claude — which `robots.txt` already invites.

Also: `BreadcrumbList` schema, `HowTo` on the guides, and bring `/products` and `/blog` into the
shared shell so they stop shipping without a privacy link.

---

## 7. Phasing

### Phase 0 — free credibility · ~half a day, zero design work
1. Fix 14-vs-30 trial days — read `TRIAL_DAYS` everywhere.
2. Remove "99.9% accuracy", "0 breaches" as a stat, "thousands of surveyors".
3. Landing pricing reads `PLANS` — all three plans plus the referral offer.
4. `page.tsx` loading branch renders `<LandingPage />`.
5. Remove `maximumScale: 1`.
6. Delete 8.8 MB of stray assets and 37 KB of dead components.

**Do this first even if nothing else in this document ever ships.** It is the highest ROI work
here, and none of it is a redesign.

### Phase 1 — one shell, one system · 2–3 days
`PublicHeader` + `PublicFooter` across all 14 public routes. Adopt the navy/gold tokens and the
existing marketing type scale. Remove the scroll choreography.

### Phase 2 — the new landing · 3–4 days
Sections 1–11. Static, image-driven.

### Phase 3 — proof assets · ongoing
Sample redacted final report PDF **(do this in Phase 0 if you can — it is an hour and it converts)**.
Founder's note. First three testimonials. Honest user count.

### Phase 4 — content moat · ~1 day per guide
The five guides plus calculators.

**Running cost: ₹0.** Everything stays on the existing Firebase Hosting static export, which
already CDNs. The only optional spend is video hosting, and that is avoidable by not autoplaying it.

---

## 8. What not to do

- **Don't** move to Astro / Webflow / Framer. Fourteen pages sharing an auth CTA with the app.
- **Don't** add a chatbot to the landing page.
- **Don't** add dark mode to marketing before any of the above ships.
- **Don't** build an interactive product tour before the sample PDF exists — the PDF converts
  better and takes an hour.
- **Don't** add animated stat counters. They are a liability when the real numbers are small,
  and small real numbers are your credibility.
- **Don't** touch routing beyond the `page.tsx` loading branch. Per
  `Architecture/UI_Refactor_Guardrails.md`, nav/routing is the risky surface; the marketing
  pages themselves are isolated and safe to restyle.

---

## Related

- [[Landing_Page]] — needs updating; still documents a deleted `LandingClient.tsx`
- [[UI_Refactor_Guardrails]] — routing risk boundaries
- [[Subscription_System]] — `PLANS`, `TRIAL_DAYS`, referral constants
- [[Authentication]] — the sign-in CTA path
