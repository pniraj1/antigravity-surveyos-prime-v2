# Public Site Rev. B — parallel build

> **Status: NOT DEPLOYED.** Nothing in this folder is part of the Next.js build.
> `next.config.ts` uses `output: 'export'`, which only exports routes under
> `src/app/`. This directory is deliberately outside it, so there is no path by
> which `firebase deploy` can push this live. The existing site is untouched.

## What this is

A ground-up redesign of everything before sign-in, built in parallel with the
live site. It gets ported into `src/` only if and when it is approved.

Strategy and findings that led here:
`../../SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Specs/2026-08-03-public-site-redesign.md`

## Phases

| # | Phase | Status | Gate |
|---|-------|--------|------|
| 1 | Identity — logo, type, colour, motion | **Approved** | Direction C · oxide kept, contained · square corners · mono display |
| 2 | Copy — every word, written for impact | **Approved** | Headline locked · names consented · MBA kept |
| 3 | Components — nav, footer, buttons, cards, tags | **Approved** | — |
| 4 | Landing page | **Built, awaiting review** | — |
| 5 | Remaining routes — features, pricing, about, faq, guides | Not started | — |
| 6 | Review — a11y, performance, code review, port plan | Not started | Go / no-go on deploying |

Each phase is reviewed before the next begins.

## Contents

```
css/tokens.css      The design system. Single source of truth.
                    No raw hex outside this file.
css/components.css  Every component. Requires tokens.css.
                    No raw hex, no magic numbers.
copy.md             Every user-facing string before sign-in.
                    Strings are copied from here into components,
                    never rewritten in JSX.

logo/mark.svg       CHOSEN — primary mark, monotone (currentColor)
logo/mark-duo.svg   CHOSEN — two-tone; oxide on the field rule only
logo/favicon.svg    CHOSEN — redrawn for 16px, on an ink tile
logo/a-seal.svg     Not chosen — verification seal
logo/b-plate.svg    Not chosen — chassis plate
logo/c-field.svg    Exploration that became mark.svg
```

The favicon is **not the primary mark scaled down**. At 16px the primary's
3.6px strokes render sub-pixel and grey out, and the bracket gap closes. It is
redrawn with strokes ~40% thicker and a wider bracket gap.

## Decisions locked in Phase 1

- **Type:** IBM Plex superfamily (Mono for display/data, Sans for prose).
  SIL OFL, self-hosted. Production loads via `next/font/local` — never a
  `<link>` to fonts.googleapis.com, which is a third-party request on the
  critical path.
- **Weight ceiling: 600.** 900 is banned.
- **Border radius: 0.** One exception — 2px on the logo plate rivets.
- **Shadows:** only on a product shot or document meant to read as a lifted
  physical object. Everywhere else, 1px hairlines carry structure.
- **Oxide is not the action colour.** Actions are ink. Oxide is reserved for
  the mark, a flagged value, and the single "recommended" ring.
- **Motion:** must teach, never loops, never scroll-linked.

## Contrast

Every text/ground pair is measured, not assumed. Two first-pass values failed
WCAG AA for small text and were replaced before anything was built on them:

| Token | First pass | Measured | Replaced with | Now |
|---|---|---|---|---|
| `--on-paper-400` | `#7E8894` | 3.01:1 ✗ | `#5F6874` | 4.72:1 ✓ |
| `--oxide-500` | `#C0452F` | 4.25:1 ✗ | `#B03C26` | 4.98:1 ✓ |
| `--on-ink-400` | `#6C7885` | 4.04:1 ✗ | `#7B8794` | 4.97:1 ✓ |

Captions and flag tags are small type, so they are held to 4.5:1 — not the
3:1 large-text allowance.

For reference, the current live site's amber CTA text on its background
measures **1.53:1**.

## Interaction contract

Applied to every interactive component, without exception:

- **Hover changes colour or border — never a transform.** A control that grows
  on hover shifts its neighbours and moves out from under the cursor.
- **Focus ring always visible**, defined once, never removed. `:focus-visible`
  keeps it off mouse users.
- **Active is a real pressed state**, not a repeat of hover. On touch there is
  no hover, so press is the only feedback that exists.
- **44×44 minimum tap target.** Verified headless at 1440 / 768 / 375.
- **Durations and easings from tokens only.** No inline timing anywhere.

Two states are deliberately failure-safe: `.reveal` only hides itself once JS
has confirmed it can un-hide (so a script error leaves a readable page, not a
blank one), and `.tag--drop` rests visible.

## Build & verify

```bash
cd design/landing-v2/test
node build.js ../src/landing.html ../out/landing.html   # inline fonts, css, svg, images
node check.js  ../out/landing.html                      # static: tags, braces, banned words
node viewports.js landing.html                          # 1440 / 768 / 375
node functional.js                                      # exercises every interaction
```

`functional.js` drives the real page: it runs six cases through the depreciation
engine, waits out the extraction animation, checks the stamp lands, forces a
deep link to `#price`, opens and Escape-closes the mobile sheet, and re-runs the
page under `prefers-reduced-motion` and with JavaScript disabled.

**Three real bugs this has caught so far:**

1. `.nav__sheet` was styled only inside its `max-width:860px` media query, so on
   desktop it rendered as an unstyled column of links in the flow. Fixed with
   `display:none` at base.
2. Reveal blocks stayed invisible after a scroll jump. `IntersectionObserver`
   only fires on a threshold **crossing**; an anchor click takes an element from
   "below, ratio 0" to "above, ratio 0" without crossing, so no callback ran.
   Fixed by also treating "already above the viewport" as revealed.
3. Same flaw silently disabled the extraction and stamp demos when deep-linked
   past — they never ran at all.

None of these are visible in a static read of the code, which is why the
headless pass exists.

## Porting

The CSS is plain custom properties, not Tailwind utilities, specifically so it
ports in one move: `tokens.css` becomes a stylesheet import, and the markup
splits into components. No utility-class translation step.
