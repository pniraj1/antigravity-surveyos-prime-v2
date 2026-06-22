# Task 5 Report — Sidebar pilot migration

**Status:** DONE

## Commit
`cc968c2b` — `refactor(ui): migrate sidebar to design tokens (pilot screen)`

## Build result
`✓ Compiled successfully` — all 18 static pages generated, no TypeScript errors.

## Test result
Pre-existing failures only (`jsdom` missing for `open-design/apps/web/tests/`) — unrelated to sidebar changes. 197 test files passed, 2262 individual tests passed. No sidebar test files exist.

## Changes made (`src/components/layout/sidebar.tsx`)

### Added imports
- `Button` from `@/components/ui/button`
- `cn` from `@/lib/utils`

### Step 2 — Nav button: inline hex → tokens, JS mouse handlers removed
- Replaced `style` + `onMouseEnter`/`onMouseLeave` block with `cn(...)` className logic
- Active: `bg-[var(--color-neutral-100)] text-[var(--color-neutral-900)] font-medium`
- Disabled: `text-[var(--color-neutral-200)] cursor-not-allowed`
- Default: `text-[var(--color-neutral-600)] hover:bg-[var(--color-neutral-50)] hover:text-[var(--color-neutral-900)]`
- Active bar: `bg-primary` (was `style={{ background: '#D4AF37' }}`)
- Active icon: `text-primary` (was `style={{ color: '#D4AF37' }}`)
- Removed `font-semibold` from label span (now inherits weight from button)

### Step 3 — "New Claim" button → `Button` primitive
- Replaced inline-styled `<button>` with `<Button>` from `@/components/ui/button`
- Title and label sentence-cased: "New claim"
- "Open claim" secondary button: JS mouse handlers removed, replaced with Tailwind hover tokens

### Step 4 — Remaining hex replaced throughout
| Location | Before | After |
|---|---|---|
| `<aside>` border | `style={{ background, borderRight }}` | `bg-white border-r border-[var(--color-neutral-200)]` |
| Brand header border | `style={{ borderBottom: '#F0F2F5' }}` | `border-b border-[var(--color-neutral-50)]` |
| Logo mark | `style={{ background: 'linear-gradient(...)', color: '#D4AF37' }}` | `bg-[var(--color-neutral-900)] text-primary` |
| User display name | `style={{ color: '#0D1B2A' }}` | `text-[var(--color-neutral-900)]` |
| Role badge | `style={{ color: '#D4AF37' }}` + `font-black` | `text-primary font-medium` |
| Version chip | `style={{ background: 'rgba(...)', color: '#8D99AE' }}` | `bg-[var(--color-neutral-100)] text-[var(--color-neutral-400)]` |
| Collapse toggle | `style={{ color: '#8D99AE' }}` + JS handlers | `text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-900)]` |
| Quick actions border | `style={{ borderBottom: '#F0F2F5' }}` | `border-b border-[var(--color-neutral-50)]` |
| Active claim badge | `style={{ background: 'rgba()', border: '#E2E6EA' }}` | `bg-[var(--color-neutral-50)] border-[var(--color-neutral-200)]` |
| Active claim accent bar | `style={{ background: '#D4AF37' }}` | `bg-primary` |
| Group labels | `style={{ color: '#8D99AE' }}` | `text-[var(--color-neutral-400)]` |
| Footer border | `style={{ borderTop: '#F0F2F5' }}` | `border-t border-[var(--color-neutral-50)]` |
| Admin active label | `style={{ color: '#0D1B2A' }}` | CSS var via `style` → inline token string |
| Sign out button | `style={{ color: '#EF4444' }}` + JS handlers | `text-[var(--color-status-danger)] hover:bg-[var(--color-status-danger-tint)]` |
| Sign in button | `style={{ background, color, border }}` + JS handlers | Tailwind token classes, no JS handlers |
| Sign in icon | `style={{ color: '#D4AF37' }}` | `text-primary` |
| Drive status | `style={{ color: isDriveConnected ? '#D4AF37' : '#8D99AE' }}` | conditional `text-primary` / `text-[var(--color-neutral-400)]` |
| Collapsed Cloud icon | `style={{ color: isDriveConnected ? '#D4AF37' : 'rgba(...)' }}` | conditional `text-primary` / `text-[var(--color-neutral-200)]` |
| Mobile menu button | `style={{ background: '#0D1B2A', color: '#F8F9FA' }}` | `bg-[var(--color-neutral-900)] text-white` |

### Step 5 — Sentence case + font weight
- "New Claim" → "New claim"
- "Open Claim" → "Open claim"  
- "Sign In with Google" → "Sign in with Google"
- "Sign Out" → "Sign out"
- "Admin Active" → "Admin active"
- "Drive Unlinked" → "Drive unlinked"
- "Cloud Linked" → "Cloud linked"
- `font-black`, `font-extrabold`, `font-bold`, `font-semibold` → `font-medium` throughout
- GROUP_LABELS kept in uppercase (short group labels, as per spec)

## Logic preserved
- `NAV_ITEMS` array: unchanged
- `AppTab` IDs: unchanged
- `handleTabChange`: unchanged
- Survey-type filtering (spot/final/valuation): unchanged
- `requiresClaim` gating: unchanged
- `SubscriptionGuard`: N/A (not in this file)
- `'use client'` directive: kept
- Collapse/expand state: unchanged
- Drive/auth status UI: still renders
- `disabled` prop on nav buttons: kept

## Concerns
None. No raw hex remains in the file. All JS mouse handlers removed. Two font weights only (400 default, 500 via `font-medium`). Gold (`text-primary`/`bg-primary`) used only on: active accent bar, New Claim button (via Button primitive which uses `bg-primary`), active nav icon, Drive-connected indicator, sign-in icon, logo mark text.

---

## Fix Pass — Code Review Corrections (2026-06-22)

**Commit:** `fix(ui): correct sidebar divider token + migrate dashboard status hex to tokens`

### Fix 1 — sidebar.tsx: invisible dividers

**Problem:** All four divider/separator borders used `border-[var(--color-neutral-50)]` = `#F8F9FA`, identical to the sidebar background colour, making them invisible.

**Locations fixed (4 occurrences, `replace_all`):**
- Brand header separator (`border-b`)
- Quick actions separator (`border-b`)
- Footer separator (`border-t`)
- Status sub-divider inside footer (`border-t`)

**Change:** `border-[var(--color-neutral-50)]` → `border-[var(--color-neutral-100)]`

`--color-neutral-100` = `#F0F2F5` — the correct visible separator colour.

### Fix 2 — Dashboard.tsx: raw hex in status badges

**Problem:** Two inline `style` props used raw hex for claim status colours.

**Line 262 — archived count badge:**
| Before | After |
|---|---|
| `background: 'rgba(239,68,68,0.12)'` | `background: 'var(--color-status-danger-tint)'` |
| `color: '#EF4444'` | `color: 'var(--color-status-danger)'` |

Uses `--color-status-danger-tint` (= `#FBE9E7`) which already exists as a token and is the correct semantic tint, consistent with how the sidebar sign-out button uses it.

**Line 412 — claim status badge (active/done/archived):**
| Hex | Token | Semantic |
|---|---|---|
| `#10B981` (green) | `var(--color-status-success)` | Done / completed |
| `#F59E0B` (amber) | `var(--color-status-warning)` | Active / in progress |
| `#EF4444` (red) | `var(--color-status-danger)` | Archived / closed |

Applied to both `borderColor` and `color` properties.

### Build + Test
- `npm run build`: ✓ Compiled successfully, all 18 static pages generated, no TypeScript errors.
- `npm run test`: Pre-existing failures only — 192 files in `open-design/` fail due to missing `jsdom` package (unrelated infrastructure issue, pre-dates these changes). 197 SurveyOS test files passed, 2262 individual tests passed. No failures in sidebar or Dashboard tests.
