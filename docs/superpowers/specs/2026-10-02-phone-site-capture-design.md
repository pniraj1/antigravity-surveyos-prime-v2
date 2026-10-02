# Phone site capture and phone-usable form tabs — design

Date: 2026-10-02
Status: draft for review
Scope: option B from the 2026-10-02 brainstorm — site capture (level 1) plus
phone-usable form tabs (level 2). Money screens stay desktop/tablet.

## Problem

Surveyors take photos and document shots on their phone, then move them to the
laptop by WhatsApp, cable or Google Photos, sort them, and upload them into the
claim. That transfer is pure admin. The app is a website and already opens on a
phone, but:

1. Upload opens the gallery/file picker, never the camera (no `capture`
   attribute anywhere in `src/`).
2. Photos uploaded on the phone do reach the surveyor's Drive
   (`uploadFileToDrive`, with a persistent IndexedDB retry queue drained on
   reconnect), but the laptop only gets them through a manual "Restore from
   Drive" button in `PhotosTab`, which re-adds every image and so duplicates.
3. The queue's state is only shown as passing toasts. A surveyor leaving a
   no-signal site cannot see "5 photos not uploaded yet".
4. No web manifest and no service worker. The app cannot be installed to the
   home screen and does not open at all without signal.
5. The layout is desktop-first. A drawer sidebar exists below `lg`, but forms
   are multi-column with small targets; 19 tab files hold ~89 responsive classes
   between them.
6. Nothing tells the surveyor what is still missing before leaving the vehicle.

## Goals

- The surveyor can capture an entire Spot or Valuation survey, and the site part
  of a Final survey, on a phone, with or without signal, and the laptop sees it
  without any transfer step.
- Form-type tabs are comfortable at 375 px width.
- Running cost ₹0. One codebase — the same website, installable.

## Non-goals

- Assessment grid, Bill Check, Reconciliation, Admin, report preview on phones.
  They remain reachable (drawer / "More") with their current layout. Tablet
  landscape already works.
- Voice notes → fields (separate spec).
- Telegram Sync changes (retention, slot buttons) — separate spec.
- Share target, Play Store listing, push notifications.
- AI extraction offline. OCR still needs network; it can run later on any device.

## Device model

Same URL, same code. Layout switches on width:
- `< md` (768 px): phone layout — bottom bar, one-column forms, Site screen.
- `≥ md`: unchanged.

Installed from Chrome's "Add to Home screen", it opens full-screen with an icon.

## Design

### 1. Camera button

- `PhotosTab`: keep the existing multi-select input ("Gallery"). Add a second
  input `accept="image/*" capture="environment"` ("Camera"), wired to the same
  `handleFileUpload`. One photo per tap; the gallery button covers bursts.
- `DocumentsTab`: each document card is a full-card file input today. On
  `< md`, add a small camera button on the card using a second input with
  `capture="environment"` routed to the same `handleFile(e, doc.id)`. The card
  itself keeps accepting PDFs/images from the file picker.
- `useSaveToCloudPrompt` asks on every upload. On the phone that is one dialog
  per shot. Change: remember the answer for the open claim for the rest of the
  session (in-memory), so it asks once per claim.

### 2. Uploads that can be seen

- Add `getDriveQueueCount()` (reads the existing IndexedDB queue via
  `getDriveQueue`).
- `uploadFileToDrive` and `flushDriveQueue` dispatch a window event
  `surveyos:drive-queue` after they change the queue.
- `SaveStatusBar` listens to that event plus `online`/`offline` and shows a
  persistent chip "N waiting to upload" while N > 0. Tapping it calls
  `flushDriveQueue()`. Hidden when N = 0.
- Failure after `MAX_RETRIES` keeps its current path (`surveyos_failed_uploads`
  and the Settings recovery prompt). No change.

### 3. Picking up photos from another device

- Add optional `driveName?: string` to `PhotoItem`, set at upload to the exact
  filename passed to `uploadFileToDrive`
  (`${PHOTO_FILE_PREFIX}${Date.now()}_${name}.jpg`). Restore sets it to the
  Drive file's name.
- Pure helper `findNewDrivePhotos(local: PhotoItem[], drive: {name}[])` returns
  Drive image files not present locally. Match rule: `driveName` equality; for
  legacy photos without `driveName`, fall back to the local `name` equal to the
  Drive name with `^photo_\d+_` and the extension stripped.
- On claim open, if Drive is linked and online, list the claim folder once and
  run the helper. If any are new, show a banner in the claim header:
  "6 new photos from another device — Add". Tap = download and `addPhoto` those
  only. Not automatic: avoids surprise downloads on mobile data.
- The existing "Restore from Drive" button switches to the same helper so it
  stops duplicating.

### 4. Installable, opens without signal

- `public/manifest.webmanifest`: name, short_name "SurveyOS", `start_url "/"`,
  `display "standalone"`, theme/background colours from the app tokens, icons
  192 and 512 PNG (to be produced from the existing logo).
- `public/sw.js`, hand-written, no library (~60 lines):
  - `install`: precache `/` (the exported `index.html`).
  - `fetch`, same-origin only:
    - navigations → network first, fall back to cached `/` (the static export
      plus the `**` → `/index.html` rewrite makes every route the same shell).
    - `/_next/static/**` → cache first (filenames are content-hashed).
    - everything else, and every cross-origin request (Firestore, Drive,
      Google APIs, AI providers, the Sync Worker) → not intercepted.
  - `skipWaiting` + `clients.claim`. Online users always get the fresh
    `index.html`; offline users get the last one they loaded.
  - ponytail: no update prompt; a deploy reaches a device on its next online
    load. Add a "new version — reload" toast only if stale shells cause support
    issues.
- Register from a small client component mounted in `src/app/layout.tsx`,
  production only.
- Call `navigator.storage.persist()` once after sign-in so the browser is less
  likely to evict unsynced photos.
- `firebase.json`: header `Cache-Control: no-cache` for `/sw.js` and
  `/manifest.webmanifest`.
- Firebase Auth already persists the session locally; a cached shell opens
  signed in.

Offline behaviour after this section:

| Works without signal | Waits for signal |
|---|---|
| Opening the app from the icon | AI document reading |
| Claims already on this device | Telegram Sync pull |
| Creating a claim | Photos reaching other devices |
| Camera / gallery capture (queued) | Sending reports |
| Details, toggles, still-missing list | A claim never opened on this device |

### 5. Site screen

- New `AppTab` id `'site'` (additive; no existing id changes).
- Rendered as the Site screen from the brainstorm mockup:
  - header: registration, survey type, insurer, upload chip from section 2;
  - three large buttons: Damage photo (camera), Document (camera, then pick the
    slot), From gallery (multi-select). No voice placeholder — the voice spec
    adds its button when it ships;
  - "Still missing" list from section 6; each row jumps to the field or opens
    the right camera input;
  - "Confirm before you leave" list from section 6.
- Default landing: when a claim is opened from the dashboard on a `< md`
  viewport, set the tab to `'site'`. A `?tab=` in the URL always wins, so
  reload, bookmarks and Back/Forward are unaffected (`useRouteSync` untouched).
- Shown for all survey types; on `≥ md` it is reachable from the sidebar but
  never the default.

### 6. Still-missing and confirm lists

Pure module `src/lib/site/site-checklist.ts`:
`siteChecklist(claim): { missing: Item[]; confirm: Item[] }`, unit-tested.

- `missing` — empty fields and absent documents. A document counts as present
  when the claim holds extracted data for that slot or a `kind: 'document'`
  photo tagged for it (the plan confirms the exact source in `DocumentsTab`).
- `confirm` — toggles that `createBlankClaim` seeds with a default (so
  "empty" can't be detected); shown with their current value, one tap to change.

Initial lists (edit the module, not the UI, to change them):

| Survey | Missing — documents | Missing — fields | Confirm |
|---|---|---|---|
| Spot | RC, DL, policy | registration, odometer, accident date/time, place of accident, cause of accident, place of survey, ≥1 damage photo | drivable, airbags, police reported, TP involved, panchanama, damage severity |
| Valuation | RC, policy | registration, odometer, inspection date, inspection place, tyre condition, battery condition, glass condition, ≥1 photo | insurable |
| Final | RC, DL, policy, estimate | registration, odometer, cause of accident, workshop name, date of survey, place of survey, ≥1 damage photo | — |

### 7. Bottom bar and shared nav rule

- Extract the survey-type filtering now inline in `sidebar.tsx` into a pure
  `visibleNavItems(surveyType, hasClaim)` in `src/lib/navigation/`. The sidebar
  and the bottom bar both call it — never two copies. Unit test locks today's
  behaviour for spot / final / valuation / no claim before the sidebar switches
  to it.
- Bottom bar on `< md` when a claim is open: Site, Details, Photos, Report,
  More. More opens the existing mobile drawer (`sidebarMobileOpen`). Items not
  visible for the survey type are dropped.
- The drawer and its hamburger stay as they are.

### 8. Phone-usable form tabs (restyle only)

Tabs: Dashboard (claim list), Details (including spot fields), Documents,
Photos, Fees, Reinspection, Valuation, Profile.

Rules:
- Tailwind breakpoint classes only. No logic, store, or prop changes.
- Below `md`: single column; inputs and buttons ≥ 44 px tall; yes/no and enum
  toggles rendered as two/three large buttons where they are currently selects
  or small switches (visual only — same value, same setter).
- Dashboard: claim rows become cards (registration, insurer, type, progress).
- Do not touch `src/components/pdf/*`, `src/components/print/*`,
  `src/lib/reports/*` (UI_Refactor_Guardrails §1).
- One tab per commit, so any regression is one revert.

## Error handling

- Camera input cancelled → no-op (same as today's file input).
- Drive not linked → existing queue + toast; the chip shows the count and the
  tap prompts linking.
- Pick-up listing fails or offline → no banner, no error; retried next claim
  open.
- Service worker registration fails → app behaves exactly as today.
- `storage.persist()` denied → nothing; the waiting chip remains the warning.

## Testing

- Unit (vitest): `siteChecklist` per survey type; `visibleNavItems` parity with
  current sidebar behaviour; `findNewDrivePhotos` (driveName match, legacy name
  match, iOS-style duplicate `image` names, empty inputs).
- Guardrail: generate a Final and a Spot report (PDF + print preview) before and
  after section 8; outputs must be identical.
- Manual on a real Android phone (auth-gated, needs the surveyor's login and
  Drive — can't be verified from the dev machine): install to home screen;
  airplane mode → open app, open a claim, take 3 photos, chip shows 3; signal
  back → chip drains; open the claim on the laptop → banner offers 3, Add adds
  exactly 3, second open offers 0; Site screen lists match the claim.
- iPhone Safari: install and offline open; uploads resume when the app is
  reopened with signal.

## Phasing

Each phase ships on its own.

| Phase | Sections | Approx. size | Unlocks |
|---|---|---|---|
| P1 | 1, 2, 3 | ~250 lines | No more WhatsApp/cable transfer |
| P2 | 4 | ~120 lines + icons | Installable, opens without signal |
| P3 | 5, 6, 7 | ~450 lines | Phone site flow, nothing forgotten |
| P4 | 8 | per tab, ~1–2 weeks total | Form tabs comfortable on a phone |

## Cost

₹0 running cost: browser features (camera input, service worker, IndexedDB),
the surveyor's own Drive, no new services, no new dependencies.

## Risks

- **Stale shell after deploy** for a device that stays offline — acceptable; it
  updates on the next online load.
- **Browser eviction of unsynced photos** — reduced by install + `persist()`;
  the chip is the visible warning.
- **Same claim edited on two devices while one is offline** — governed by the
  existing multi-device sync rules (2026-07-08 spec); not changed here.
- **Nav drift** between sidebar and bottom bar — prevented by the single
  `visibleNavItems` source and its test.
