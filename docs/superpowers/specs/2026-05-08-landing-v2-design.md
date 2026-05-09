# SurveyOS Prime — Landing V2 Design Spec
**Date:** 2026-05-08  
**Status:** Approved  
**Route:** `src/app/landing-v2/page.tsx`  
**Constraint:** Fully independent from existing `src/app/landing/page.tsx`. Nothing in the current page is modified. Reusable components (Logo, DemoSection, PricingSection, auth logic) are imported as-is.

---

## 1. Goal

Create an alternative, cinematic landing page for SurveyOS Prime centered around a **3D hero scene**: a damaged premium sedan in golden-hour light, a sleek humanoid AI robot, and a human surveyor. The page tells the product story visually before a single word is read. The user will choose between this and the current page to keep.

---

## 2. Design System (UI/UX Pro Max)

- **Pattern:** Horizontal Scroll Journey → adapted as scroll-driven 3D camera orbit
- **Style:** Motion-Driven — scroll animations, parallax, entrance effects
- **Primary color:** `#1E293B` (slate) with amber `#F59E0B` brand accent (carried from v1)
- **CTA color:** `#DC2626` → overridden to amber `#F59E0B` to stay on-brand
- **Background:** `#0F172A` dark (hero) → `#FBFBFD` light (middle sections) → `#05050A` dark (CTA/footer)
- **Typography:** Plus Jakarta Sans (Google Fonts) for headings; existing font stack for body
- **Effects:** Scroll-linked parallax 3–5 layers, spring physics, entrance reveals, `prefers-reduced-motion` respected

---

## 3. Page Structure

| # | Section | Key tech |
|---|---|---|
| 1 | Nav | Existing nav — Logo, auth buttons, sticky |
| 2 | 3D Hero | R3F canvas + Particles + Spotlight + Animated Gradient Text badge + Hero Video Dialog CTA |
| 3 | Scroll Journey | Hero Parallax (3 rows / 3 acts) — ~150vh sticky |
| 4 | Metrics Bar | Existing 3-stat strip, white bg |
| 5 | Bento Features | Apple bento grid, Hero Highlight bg (mouse-reactive dots) |
| 6 | Demo Section | Existing `DemoSection` + Shooting Stars bg layer |
| 7 | Pricing Section | Existing `PricingSection` — unchanged |
| 8 | CTA Section | Background Beams + copy + looping mini robot animation |
| 9 | Footer | Existing footer — unchanged |

---

## 4. Hero Section (Section 2)

### 4.1 Scene Composition
- **Canvas:** Full-viewport, `dpr={[1,2]}`, `<Suspense>` fallback = amber gradient `#F59E0B → #EA580C`
- **Car:** Damaged premium sedan (crumpled front quarter panel), PBR materials, Draco-compressed GLTF ~3MB. Source: Sketchfab free assets (BMW M4 / Mercedes C-Class with damage).
- **Robot:** Sleek humanoid, metallic silver, blue-white chest panel glow (`#60A5FA`), Mixamo base rig ~1.5MB
- **Surveyor:** Human figure in work uniform, crouched near car damage, holding tablet, idle animation ~1MB
- **Environment:** Polyhaven `golden_bay` or `sunset_fairway` HDRI, loaded async, blurred until ready ~2MB
- **Lighting:**
  - `<DirectionalLight>` warm amber `#FFB347`, intensity 3, casts shadows
  - `<PointLight>` inside robot chest `#60A5FA`, pulsing via `useFrame`
  - `<Environment files="/hdri/golden-hour.hdr" />` for IBL
- **Particles:** MagicUI Particles overlay, amber `#F59E0B`, quantity 60, mouse magnetism enabled — simulates golden-hour dust motes
- **Spotlight:** Aceternity Spotlight SVG overlay, `pointer-events-none`, warm fill — adds theatrical second light source

### 4.2 Camera Behaviour
- **On load:** Camera starts close on the car damage (dramatic), pulls back over 2s to reveal full scene (surveyor + robot + car) — cinematic establishing shot
- **After reveal:** Mouse position subtly rotates scene ±5° (parallax). Robot `lookAt()` tracks mouse cursor.
- **Mobile:** Device gyroscope drives tilt; fallback to slow auto-rotate. `dpr={1}`, reduced polygon models.

### 4.3 Copy Overlay (Framer Motion, z-index above canvas)
```
[Animated Gradient Text badge]   "INTRODUCING SURVEYOS PRIME"

Motor surveying,
powered by AI.                   ← font-black tracking-tight, Plus Jakarta Sans

Why spend hours verifying physical documents manually? SurveyOS Prime
automatically extracts data from RC, DL, and Policies...

[Start Free Trial →]             ← amber pill CTA
[Hero Video Dialog ▶ Watch Demo] ← 21st.dev component, play button thumbnail
```
Copy fades in after camera pull-back completes (0.8s delay).

### 4.4 21st.dev Components Used
| Component | Usage |
|---|---|
| Animated Gradient Text | Hero badge replacing static amber pill |
| Hero Video Dialog | "Watch Demo" button — animated thumbnail → spring modal |
| Particles | Dust motes overlay on canvas |
| Spotlight | Theatrical beam overlay |

---

## 5. Scroll Journey (Section 3)

**Height:** `~150vh` sticky container. Framer Motion `useScroll` drives everything.

Uses **Aceternity Hero Parallax** pattern: 3 acts told as scroll-driven card rows.

| Act | Scroll % | 3D Scene State | Parallax Cards Content |
|---|---|---|---|
| 1 — Extract | 0–33% | Camera orbits to robot's notepad view. Floating `<Html>` field labels appear above car (RC No., Engine No., IDV) | "AI Document Reading" cards — RC Book, DL, Policy icons with extraction animations |
| 2 — AI Learns | 33–66% | Robot chest glows bright, data streams flow visually from car into robot | "AI Cross-Checking" — conflict detection, field comparison, accuracy stat |
| 3 — Report Ready | 66–100% | Scene fades, canvas opacity → 0, dark DemoSection rises | "Report Generated" — PDF preview card, 10 min stat, download CTA |

**Scroll binding:**
```ts
const { scrollYProgress } = useScroll({ target: containerRef })
useFrame(() => {
  camera.position.lerp(targetPosition(scrollYProgress.get()), 0.05)
})
```

**`prefers-reduced-motion`:** Static establishing shot only, no scroll animation.

---

## 6. Bento Features (Section 5)

Replaces the current 3-col card grid with an Apple-style bento layout.

**Grid:**
```
[ Large: AI Document Reading  ] [ Large: Smart Photo Engine  ]
[ Small: Drive Sync ] [ Small: AI X-Check ] [ Small: Offline ] [ Small: Lightning ]
```

- Large cards: `col-span-1`, tall, include a mini animated illustration inside
- Small cards: compact, icon + title + 1-line desc
- All cards: `hover:scale-[1.02]` depth effect, `transition-all duration-300`
- Section background: **Aceternity Hero Highlight** — dot pattern + mouse-reactive indigo spotlight

---

## 7. Demo Section (Section 6)

Imports existing `DemoSection` component unchanged.

Adds **Aceternity Shooting Stars** as an absolute-positioned background layer inside the section wrapper — subtle comet streaks in `#0D1B2A` reinforce "AI processing" atmosphere.

---

## 8. CTA Section (Section 8)

- Background: **Aceternity Background Beams** — animated SVG beam paths (cyan/purple → recolored to amber/slate to match brand)
- Copy: same as current ("Ready to revolutionize your workflow?")
- Addition: small looping R3F mini-scene in corner — robot head slowly turns toward viewer (reuses robot GLTF, tiny canvas, ~200×200px)

---

## 9. New Files

```
src/app/landing-v2/
  page.tsx

src/components/landing-v2/
  HeroScene.tsx          — R3F canvas, camera logic, scene composition
  ScrollJourney.tsx      — sticky scroll section, Hero Parallax integration
  BentoFeatures.tsx      — Apple bento grid with Hero Highlight bg
  SceneLoader.tsx        — progressive GLTF loader + amber gradient placeholder
  MiniRobotScene.tsx     — small looping R3F robot for CTA section

src/components/ui/
  animated-gradient-text.tsx   — from 21st.dev
  hero-video-dialog.tsx        — from 21st.dev
  background-beams.tsx         — from 21st.dev
  hero-highlight.tsx           — from 21st.dev
  particles.tsx                — from 21st.dev
  spotlight.tsx                — from 21st.dev
  shooting-stars.tsx           — from 21st.dev

public/models/
  sedan-damaged.glb
  robot-humanoid.glb
  surveyor.glb

public/hdri/
  golden-hour.hdr
```

---

## 10. Dependencies to Add

```json
"@react-three/fiber": "^8.x",
"@react-three/drei": "^9.x",
"three": "^0.160.x",
"@types/three": "^0.160.x"
```

---

## 11. Performance Budget

| Asset | Size | Strategy |
|---|---|---|
| sedan-damaged.glb | ~3MB | Draco compression, loaded via `<Suspense>` |
| robot-humanoid.glb | ~1.5MB | Draco, shared instance |
| surveyor.glb | ~1MB | Draco |
| golden-hour.hdr | ~2MB | Async, blurred placeholder |
| 21st.dev components | ~50KB total | Tree-shaken, no extra deps beyond Framer Motion |
| **Total above-fold** | **~7.5MB** | Progressive — amber gradient shown instantly |

Mobile: `dpr={1}`, `<AdaptiveDpr>` drops resolution if fps < 30, auto-rotate replaces mouse parallax, scroll journey collapses to 3-step indicator on < 768px.

---

## 12. Accessibility

- `prefers-reduced-motion`: all scroll/camera animation disabled, static scene shown
- All canvas content has ARIA description: `aria-label="3D scene: surveyor and AI robot inspecting a damaged vehicle"`
- All 21st.dev bg components use `pointer-events-none` — keyboard navigation unaffected
- Copy contrast: white on dark canvas bg — minimum 7:1 ratio
- Focus states visible on all CTAs

---

## 13. What Is NOT Changed

- `src/app/landing/page.tsx` — untouched
- `src/components/landing/DemoSection.tsx` — imported as-is
- `src/components/landing/PricingSection.tsx` — imported as-is
- All auth logic, Firestore, routing — unchanged
