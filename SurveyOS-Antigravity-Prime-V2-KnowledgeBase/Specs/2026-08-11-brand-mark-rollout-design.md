# Brand Mark Rollout — Design

**Date:** 2026-08-11
**Status:** Approved for planning
**Scope:** Replace the logo mark across app and website. Mark only.

---

## Problem

The product ships two unrelated logos:

- `src/components/ui/Logo.tsx` — an amber (`#F59E0B`) pointy-top hexagon with a stroked "S" and a white gradient shine, plus the wordmark `Motor SurveyOS.` with an amber period.
- `src/app/icon.svg` — a gold (`#D4AF37`) hexagon with a literal `<text font-family="Arial">S</text>`.

The second is a latent defect: it renders differently or not at all wherever Arial is absent or substituted. The new mark's design notes call this out directly — a logo must never depend on a font being present.

Meanwhile a designed mark already exists in `design/landing-v2/logo/`, chosen 03 Aug 2026 (Direction C), and is unused by the product.

## Non-goals

Explicitly **out of scope**, and must not be folded in:

- **Colour tokens.** The app's accent system is gold/amber (`#D4AF37` appears throughout, including the document-slot colours in `DocumentsTab.tsx`). Re-tokening the app to the landing-v2 ink/oxide/paper palette is a separate, much larger piece of work.
- **Typography.** The landing-v2 lockup sets the wordmark in IBM Plex. Adopting it means loading a webfont family. The existing `font-black tracking-tight` classes stay.
- **Any other landing-v2 element.** Layout, copy, components, and sections on the live landing page are untouched. Ideas will be extracted from landing-v2 incrementally in later, separate work.
- **`og-image.png`.** See Deferred Assets below.

## The mark

Source of truth: `design/landing-v2/logo/`.

| File | Role |
|---|---|
| `mark.svg` | Primary, monotone. Inherits `currentColor`. |
| `mark-duo.svg` | Two-tone. Brackets + monogram in ink, field rule in oxide. **This is the lockup used in nav** (`design/landing-v2/src/landing.html:203`). |
| `favicon.svg` | Redrawn for 16px — thicker strokes, wider bracket gap, on a solid ink tile. Not the primary scaled down. |
| `c-field.svg` | Identical geometry to `mark.svg`; the surviving exploration file for the direction that won. Not a separate asset. |
| `a-seal.svg`, `b-plate.svg` | Rejected directions. Not used. |

Geometry (viewBox `0 0 64 64`) — note the current `LogoMark` uses `0 0 40 40` and must change:

```
brackets:  M19 8 H8 V56 H19        stroke-width 3.6
           M45 8 H56 V56 H45       stroke-width 3.6
monogram:  M21.5 40 V22.4 L32 32.6 L42.5 22.4 V40   stroke-width 4.2
field rule: rect x=21.5 y=45.4 w=21 h=3.1  (filled, not stroked)
```

All strokes are `stroke-linecap="square" stroke-linejoin="miter"`. The field rule is a filled `<rect>` deliberately — a stroked line renders lighter at small sizes.

### Oxide is background-dependent

From `design/landing-v2/css/tokens.css`, oxide has two steps by ground:

- `--oxide-500: #B03C26` — on paper (light backgrounds), 4.98:1
- `--oxide-300: #E2705A` — on ink (dark backgrounds), 5.80:1

This is why `favicon.svg` uses `#E2705A` on its `#0E1620` tile. The mark cannot ship one fixed red: `variant="light"` takes `#B03C26`, `variant="dark"` takes `#E2705A`. Getting this wrong fails contrast on one of the two grounds.

### Wordmark

The landing-v2 nav lockup is `mark-duo` + `<span>Motor SurveyOS</span>` — **no trailing period**. The amber period in the current `Logo.tsx` retires with the hexagon. Font classes are unchanged (see Non-goals).

## Changes

### 1. `src/components/ui/Logo.tsx`

Replace `LogoMark`'s internals. **Public props are unchanged** (`variant`, `size`, `showWordmark`, `className`), so all four call sites need zero edits.

- `LogoMark` gains an optional `variant?: 'light' | 'dark'` prop (default `'light'`) to select the oxide step. `LogoMark` is effectively private — the only reference outside its own definition is `Logo.tsx:83` — so extending it is safe.
- `viewBox` changes `0 0 40 40` → `0 0 64 64`.
- The hexagon, the `hexShine` gradient, and its `<defs>` block are deleted. The new mark is flat; the gradient has no equivalent and must not be reconstructed.
- Ink strokes use `currentColor` so the mark inherits from its container, as today.
- Wordmark: drop `<span className="text-amber-500">.</span>`.

`SIZE_MAP` values (`sm` 24 / `md` 32 / `lg` 44) are retained. The mark was drawn to hold at 16px, so all three are comfortable.

### 2. `src/app/icon.svg`

Replace wholesale with the contents of `design/landing-v2/logo/favicon.svg`. This removes the Arial dependency.

### 3. `src/app/favicon.ico`

Regenerate from `favicon.svg` at 16/32/48px. Binary asset — cannot be produced by editing text and must be generated during implementation.

### 4. Delete `public/logo-teal.png`, `public/logo-transparent.png`

Neither is referenced anywhere in `src/` (verified by grep). They are stale raster copies of the old mark.

## Deferred assets

**`public/og-image.png`** — a 1200×630 raster with the old mark baked in, referenced from `src/app/layout.tsx:44,56`, `src/app/landing/layout.tsx:20,32`, and `src/app/products/motor-surveyos/page.tsx:18`. It stays as-is. A credible replacement needs a real design export, not a generated approximation. The references are left untouched so nothing breaks; this is tracked as follow-up work, not a blocker.

## Consumers (no changes required)

| Call site | Usage |
|---|---|
| `src/app/landing/page.tsx:306` | `<Logo variant="light" size="sm" />` |
| `src/app/landing/page.tsx:663` | `<Logo variant="light" size="sm" className="justify-center mb-4" />` |
| `src/app/access-request/page.tsx:40` | `<Logo variant="dark" size="sm" />` |
| `src/app/access-request/page.tsx:61` | `<Logo variant="dark" size="lg" />` |

Both `variant` values are in live use, which is exactly why the oxide flip must be correct.

## Verification

Auth state is irrelevant here — `/landing` and `/access-request` are both reachable without login, so this is one of the rare surfaces that **can** be checked in a preview:

- `/landing` — mark renders on light ground, oxide reads `#B03C26`, wordmark has no period.
- `/access-request` — mark renders on dark ground, oxide reads `#E2705A`.
- Mark legible at `size="sm"` (24px).
- Browser tab icon is the ink-tile favicon, not a blank or a serif "S".

`npx tsc --noEmit` must pass. That is a compile check, not behavioural verification.

## Risk

Low. Four call sites, unchanged component API, no behavioural change. The one real trap is the oxide step: a single hardcoded red silently fails contrast on one of the two grounds, and `access-request` is the page that would catch it.
