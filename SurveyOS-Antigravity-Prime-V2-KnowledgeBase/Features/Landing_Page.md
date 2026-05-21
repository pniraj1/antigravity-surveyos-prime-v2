# Landing Page

## Current Implementation

- **What it does:** Marketing/demo landing page showcasing SurveyOS features (document extraction, speed, security) with animated demo workflow, pricing section, and Google Sign-In call-to-action. Uses Framer Motion animations and glassmorphic design.
- **Key files:**
  - `src/app/landing/page.tsx` — Next.js page wrapper with metadata; delegates to LandingClient
  - `src/app/landing/layout.tsx` — Landing-specific layout
  - `src/components/landing/LandingClient.tsx` — Core component: WorkflowSimulation (3-tab demo), animated sections, sign-in flow
  - `src/components/landing/DemoSection.tsx` — Interactive demo of extraction workflow
  - `src/components/landing/PricingSection.tsx` — Pricing tiers display
  - `src/components/landing/HeroScrollCanvas.tsx` — Scroll-based hero animation
  - `src/components/landing/CinematicVideo.tsx` — Video hero component
  - `public/hero-cinematic.mp4` — Hero video asset (6.6 MB)
  - `public/images/dashboard-mockup.png` — Dashboard preview image
- **Dependencies:** Framer Motion, Next.js Image/Link, Firebase auth, Lucide icons

## Known Issues / What Went Wrong

- Hero video (6.6 MB) may slow initial page load on mobile
- Landing page was previously in a loose `Cinematic landing page/` folder (fixed 2026-05-21)

## Improvement Ideas

- Lazy-load hero video or use a CDN
- A/B test different hero sections
- Add testimonials section
- Mobile-specific video compression or static fallback

## Technical Debt

- None significant — clean component structure

## Related

- [[Authentication]] — Sign-in CTA triggers Firebase Google auth
- [[Subscription_System]] — Pricing section references subscription tiers
