# Landing Page UX & Professionalism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every fake-clickable element on the landing page, add blog navigation, and add SurveyOS Sync as a product feature — making the page behave like a professional SaaS product landing page.

**Architecture:** All changes are confined to `src/app/landing/page.tsx` and `src/components/auth/AuthGate.tsx`. No new files needed except a `DemoModal` component if a demo video is available. Each fix is independent and can be committed separately.

**Tech Stack:** Next.js 16, React, Framer Motion, Tailwind CSS, Lucide React, TypeScript

---

## Problem Inventory

| # | Element | Current Behaviour | Problem |
|---|---------|-------------------|---------|
| 1 | Nav logo | No link | Logos are universally expected to go home |
| 2 | Footer logo | No link | Same |
| 3 | Dashboard mockup image | `pointer-events-none` | Looks like an interactive app screenshot |
| 4 | Feature tiles (6×) | Hover effect, no click | `hover:bg` implies clickability |
| 5 | Chapter cards (3×) | Scroll-only, look like tabs | Active ring + opacity imply tab switching |
| 6 | "Watch Demo" button | Scrolls page, Play icon | Play icon implies video — users expect a video |
| 7 | Nav | No Blog link | Blog exists at `/blog/surveyos-sync` but unreachable |
| 8 | Landing page | No SurveyOS Sync mention | Core product not mentioned anywhere |
| 9 | Landing page | No path to blog | Blog post is orphaned — no entry point |

---

## File Map

| File | Changes |
|------|---------|
| `src/app/landing/page.tsx` | All 9 fixes below |
| `src/components/auth/AuthGate.tsx` | Already done (`/blog` bypass added) |

---

## Task 1: Fix Logo Links (Nav + Footer)

**Files:**
- Modify: `src/app/landing/page.tsx` (nav ~line 185, footer ~line 478)

Both `<Logo>` instances have no wrapper link. Every professional site links the logo to the homepage.

- [ ] **Step 1: Wrap nav Logo in Link**

Find this in the nav section (~line 185):
```tsx
<Logo variant="light" size="sm" />
```
Replace with:
```tsx
<Link href="/landing" aria-label="Motor SurveyOS Home">
  <Logo variant="light" size="sm" />
</Link>
```

- [ ] **Step 2: Wrap footer Logo in Link**

Find this in the footer section (~line 478):
```tsx
<Logo variant="light" size="sm" className="justify-center mb-3" />
```
Replace with:
```tsx
<Link href="/landing" aria-label="Motor SurveyOS Home">
  <Logo variant="light" size="sm" className="justify-center mb-3" />
</Link>
```

- [ ] **Step 3: Verify**

Open `/landing` in browser. Click both logos. Both should reload `/landing`.

- [ ] **Step 4: Commit**
```bash
git add src/app/landing/page.tsx
git commit -m "fix: make nav and footer logos link to /landing"
```

---

## Task 2: Make Dashboard Mockup Clickable

**Files:**
- Modify: `src/app/landing/page.tsx` (~line 286–300)

The dashboard screenshot has `pointer-events-none` on its parent and is wrapped in a non-interactive `motion.div`. A real app screenshot implies "click to enter" — especially for authenticated users.

- [ ] **Step 1: Remove pointer-events-none, wrap in button**

Find:
```tsx
<motion.div
  initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 1 }}
  className="w-full max-w-5xl mx-auto mt-16 z-20 pointer-events-none hidden md:block"
>
  <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-amber-500/20 bg-white/10 backdrop-blur-sm">
    <Image
      src="/images/dashboard-mockup.png"
      alt="SurveyOS Prime Dashboard"
      width={1200}
      height={800}
      className="w-full h-auto object-cover"
      priority
    />
  </div>
</motion.div>
```

Replace with:
```tsx
<motion.div
  initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 1 }}
  className="w-full max-w-5xl mx-auto mt-16 z-20 hidden md:block"
>
  <button
    onClick={handleAction}
    aria-label={isAuthenticated ? 'Enter Dashboard' : 'Start Free Trial'}
    className="w-full group relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-amber-500/20 bg-white/10 backdrop-blur-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
  >
    <Image
      src="/images/dashboard-mockup.png"
      alt="SurveyOS Prime Dashboard — click to enter"
      width={1200}
      height={800}
      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.01]"
      priority
    />
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-6 py-3 bg-amber-400 text-gray-900 text-sm font-bold rounded-full shadow-lg">
        {isAuthenticated ? 'Enter Dashboard' : 'Start Free Trial'}
      </span>
    </div>
  </button>
</motion.div>
```

- [ ] **Step 2: Verify**

Hover over the dashboard image — it should scale slightly and show the CTA label. Clicking should trigger sign-in or navigate to dashboard.

- [ ] **Step 3: Commit**
```bash
git add src/app/landing/page.tsx
git commit -m "fix: make dashboard mockup clickable with hover CTA overlay"
```

---

## Task 3: Watch Demo — NO CHANGE NEEDED

"Watch Demo" already scrolls to the cinematic video section. This is intentional and correct. Skip this task.

---

## ~~Task 3 (skipped)~~: Make "Watch Demo" Open the Cinematic Video in a Lightbox

**Files:**
- Modify: `src/app/landing/page.tsx` (~line 273–281 and top of component)

The cinematic video already exists at `/hero-cinematic.mp4`. "Watch Demo" should open it fullscreen in a modal lightbox — this is a professional, expected behaviour for a Play button.

- [ ] **Step 1: Add videoOpen state at the top of LandingPage**

Find the existing state declarations (~line 105):
```tsx
  const [chapter, setChapter] = useState(0);
```

Add after it:
```tsx
  const [videoOpen, setVideoOpen] = useState(false);
```

- [ ] **Step 2: Replace Watch Demo button**

Find:
```tsx
<button
  onClick={() => {
     window.scrollTo({ top: window.innerHeight * 1.2, behavior: 'smooth' });
  }}
  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold text-slate-900 rounded-xl border border-black/10 hover:bg-slate-900 hover:text-white transition-all backdrop-blur-md"
>
  <Play size={16} />
  Watch Demo
</button>
```

Replace with:
```tsx
<button
  onClick={() => setVideoOpen(true)}
  aria-label="Watch demo video"
  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold text-slate-900 rounded-xl border border-black/10 hover:bg-slate-900 hover:text-white transition-all backdrop-blur-md"
>
  <Play size={16} />
  Watch Demo
</button>
```

- [ ] **Step 3: Add lightbox modal just before the closing `</div>` of the page**

Find the very last line of the return statement:
```tsx
    </div>
  );
}
```

Insert before `</div>`:
```tsx
      {/* ── VIDEO LIGHTBOX ───────────────────────────────────────────── */}
      {videoOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4"
          onClick={() => setVideoOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src="/hero-cinematic.mp4"
              autoPlay
              controls
              playsInline
              className="w-full h-auto"
            />
            <button
              onClick={() => setVideoOpen(false)}
              aria-label="Close video"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-sm font-bold"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
```

- [ ] **Step 4: Verify**

Click "Watch Demo" — fullscreen dark overlay should appear with the cinematic video playing and controls visible. Clicking outside the video or ✕ closes it.

- [ ] **Step 5: Commit**
```bash
git add src/app/landing/page.tsx
git commit -m "feat: Watch Demo opens cinematic video in fullscreen lightbox modal"
```

---

## Task 4: Make Chapter Cards Clickable

**Files:**
- Modify: `src/app/landing/page.tsx` (~line 351–389)

Chapter cards change via scroll position only. The active ring + opacity fade on inactive cards is a classic tab UI pattern — users will try to click them. Make clicking a card set it as the active chapter immediately.

- [ ] **Step 1: Add onClick to GlassCard in the CHAPTERS map**

Find:
```tsx
{CHAPTERS.map((ch, i) => (
  <GlassCard
    key={i}
    className={`p-5 relative z-10 transition-all duration-500 ${chapter === i ? 'ring-1' : 'opacity-70'}`}
  >
```

Replace with:
```tsx
{CHAPTERS.map((ch, i) => (
  <GlassCard
    key={i}
    className={`p-5 relative z-10 transition-all duration-500 cursor-pointer ${chapter === i ? 'ring-1' : 'opacity-70 hover:opacity-90'}`}
    onClick={() => setChapter(i)}
    role="button"
    aria-label={`View ${ch.tag} chapter`}
  >
```

- [ ] **Step 2: Update GlassCard to accept onClick and role props**

Find the GlassCard component definition (~line 22):
```tsx
function GlassCard({
  children,
  className = '',
  id,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      id={id}
      className={`relative rounded-2xl border border-black/5 backdrop-blur-xl shadow-xl ${className}`}
```

Replace with:
```tsx
function GlassCard({
  children,
  className = '',
  id,
  style,
  onClick,
  role,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  role?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      id={id}
      role={role}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`relative rounded-2xl border border-black/5 backdrop-blur-xl shadow-xl ${className}`}
```

- [ ] **Step 3: Verify**

Click each chapter card — it should immediately become active (ring appears, others dim). Scrolling still changes the active chapter as before.

- [ ] **Step 4: Commit**
```bash
git add src/app/landing/page.tsx
git commit -m "fix: make chapter cards clickable to set active chapter"
```

---

## Task 5: Add SurveyOS Sync Feature Tile + Make Feature Tiles Meaningful

**Files:**
- Modify: `src/app/landing/page.tsx` (~line 90–97, ~line 396–408)

Two changes:
1. Add Bell import and Sync tile to FEATURES array
2. Wrap the Sync tile in a Link to the blog post. Other tiles wrap in a button that calls handleAction (sign-up is the right CTA for a feature page).

- [ ] **Step 1: Add Bell to lucide imports**

Find:
```tsx
import {
  ArrowRight, Cloud, Camera, Shield, FileText, ChevronRight, Play,
  Zap, Cpu, Clock, Lock, ChevronDown
} from 'lucide-react';
```

Replace with:
```tsx
import {
  ArrowRight, Cloud, Camera, Shield, FileText, ChevronRight,
  Zap, Cpu, Clock, Lock, ChevronDown, Bell
} from 'lucide-react';
```

- [ ] **Step 2: Add Sync to FEATURES array**

Find the end of FEATURES array:
```tsx
  { icon: <Zap size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'Lightning Fast', desc: 'Zero load times, native-like performance on any device.' },
];
```

Replace with:
```tsx
  { icon: <Zap size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'Lightning Fast', desc: 'Zero load times, native-like performance on any device.' },
  { icon: <Bell size={20} />, color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', title: 'SurveyOS Sync', desc: 'Track every pending document across all claims. Send reminders in one tap via Telegram.', href: '/blog/surveyos-sync' },
];
```

Note: Add `href?: string` to the FEATURES type by updating the array inline — TypeScript will infer the union.

- [ ] **Step 3: Update FEATURES rendering to support links and buttons**

Find:
```tsx
<GlassCard className="p-5 relative z-10">
  <div className="grid grid-cols-2 gap-3">
    {FEATURES.map((f, i) => (
      <div key={i} className="flex flex-col gap-2 p-3 rounded-xl bg-black/[0.02] border border-black/5 hover:bg-black/[0.04] transition-colors">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${f.bg} ${f.color}`}>
          {f.icon}
        </div>
        <div className="text-xs font-bold text-slate-900">{f.title}</div>
        <div className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</div>
      </div>
    ))}
  </div>
</GlassCard>
```

Replace with:
```tsx
<GlassCard className="p-5 relative z-10">
  <div className="grid grid-cols-2 gap-3">
    {FEATURES.map((f, i) => {
      const tile = (
        <div className={`flex flex-col gap-2 p-3 rounded-xl bg-black/[0.02] border border-black/5 transition-colors h-full ${f.href ? 'hover:bg-amber-400/10 hover:border-amber-400/20 cursor-pointer' : 'hover:bg-black/[0.04] cursor-pointer'}`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${f.bg} ${f.color}`}>
            {f.icon}
          </div>
          <div className="text-xs font-bold text-slate-900">{f.title}</div>
          <div className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</div>
          {f.href && (
            <div className="text-[10px] font-bold text-amber-500 mt-auto pt-1 flex items-center gap-1">
              Read more <ChevronRight size={10} />
            </div>
          )}
        </div>
      );
      return f.href ? (
        <Link key={i} href={f.href} className="flex">
          {tile}
        </Link>
      ) : (
        <button key={i} onClick={handleAction} className="flex text-left">
          {tile}
        </button>
      );
    })}
  </div>
</GlassCard>
```

- [ ] **Step 4: Verify**

All feature tiles should have pointer cursor. Clicking any tile except Sync should trigger sign-in. Clicking Sync tile should navigate to `/blog/surveyos-sync`.

- [ ] **Step 5: Commit**
```bash
git add src/app/landing/page.tsx
git commit -m "feat: add SurveyOS Sync feature tile, make all feature tiles clickable"
```

---

## Task 6: Add Blog Link to Nav

**Files:**
- Modify: `src/app/landing/page.tsx` (~line 176–212)

The nav currently has Logo | [Sign In] [Start Trial]. Add a Blog text link between them.

- [ ] **Step 1: Add Blog link to nav**

Find the nav section:
```tsx
        {isAuthenticated ? (
          <button
            onClick={() => router.push('/')}
```

Replace the entire nav inner content:
```tsx
        <div className="flex items-center gap-4">
          <Link
            href="/blog/surveyos-sync"
            className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors hidden sm:block"
          >
            Blog
          </Link>
          {isAuthenticated ? (
            <button
              onClick={() => router.push('/')}
              aria-label="Dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm"
            >
              Dashboard <ArrowRight size={12} aria-hidden="true" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSignIn}
                aria-label="Sign In"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 rounded-full border border-black/15 hover:bg-slate-900 hover:text-white active:scale-95 transition-all"
              >
                Sign In
              </button>
              <button
                onClick={handleAction}
                aria-label="Start 30-Day Free Trial"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-900 bg-amber-400 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-sm"
              >
                Start 30-Day Free Trial <ArrowRight size={12} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
```

- [ ] **Step 2: Verify**

Nav should show: Logo | Blog | [Sign In] [Start Trial]. On mobile, Blog link hides (sm:block).

- [ ] **Step 3: Commit**
```bash
git add src/app/landing/page.tsx
git commit -m "feat: add Blog link to landing page nav"
```

---

## Task 7: Add Blog Strip Above Footer

**Files:**
- Modify: `src/app/landing/page.tsx` (~line 476 — before footer)

Add a "From the Blog" section with the Sync post card. This creates a visible, clickable path from the landing page to the blog.

- [ ] **Step 1: Add blog strip before footer**

Find the footer div:
```tsx
        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <div className="text-center text-xs text-slate-500 pt-4 pb-2 relative z-10">
```

Insert before it:
```tsx
        {/* ── BLOG STRIP ───────────────────────────────────────────────── */}
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 relative z-10 mt-4">
          From the Blog
        </div>

        <Link href="/blog/surveyos-sync" className="relative z-10 block">
          <GlassCard className="p-5 hover:shadow-lg transition-shadow group">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-600">
                Product
              </span>
              <span className="text-[9px] text-slate-400 font-bold">3 min read</span>
            </div>
            <h3 className="text-sm font-black text-slate-900 leading-snug mb-2 group-hover:text-amber-600 transition-colors">
              Never Lose Track of a Document Again
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              How SurveyOS Sync helps surveyors track every pending document across all claims — and send reminders in one tap.
            </p>
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
              Read article <ChevronRight size={10} />
            </div>
          </GlassCard>
        </Link>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
```

- [ ] **Step 2: Verify**

Scroll to bottom of landing page. Blog card should appear above the footer. Clicking it should navigate to `/blog/surveyos-sync`.

- [ ] **Step 3: Commit**
```bash
git add src/app/landing/page.tsx
git commit -m "feat: add blog strip above footer on landing page"
```

---

## Task 8: Build and Deploy

- [ ] **Step 1: Run build**
```bash
npm run build
```
Expected: All 10 routes build successfully with no TypeScript errors.

- [ ] **Step 2: Deploy**
```bash
firebase deploy --only hosting
```
Expected: `Deploy complete! Hosting URL: https://motorsurveyos.web.app`

- [ ] **Step 3: Smoke test live site**

Check each of these manually on `https://motorsurveyos.web.app/landing`:
- [ ] Nav logo links to `/landing`
- [ ] Nav shows "Blog" link → goes to `/blog/surveyos-sync`
- [ ] "See How It Works" scrolls to Features section (no Play icon)
- [ ] Dashboard mockup hover shows CTA overlay, click triggers sign-in
- [ ] Chapter cards clickable — clicking each activates it immediately
- [ ] Feature tiles all have pointer cursor and respond to click
- [ ] SurveyOS Sync tile links to `/blog/surveyos-sync`
- [ ] Blog card above footer links to `/blog/surveyos-sync`
- [ ] Footer logo links to `/landing`

- [ ] **Step 4: Submit blog URL to Search Console**

Go to Google Search Console → URL Inspection → enter `https://motorsurveyos.web.app/blog/surveyos-sync` → Request Indexing.

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: Logo links (nav + footer)
- ✅ Task 2: Dashboard mockup clickable
- ✅ Task 3: Watch Demo honest expectation
- ✅ Task 4: Chapter cards clickable
- ✅ Task 5: Feature tiles clickable + Sync tile added
- ✅ Task 6: Blog link in nav
- ✅ Task 7: Blog strip above footer
- ✅ Task 8: Build + deploy + smoke test

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency:** `GlassCard` extended with `onClick`, `role`, `aria-label` in Task 4. FEATURES array extended with optional `href` in Task 5. Both consistent throughout.
