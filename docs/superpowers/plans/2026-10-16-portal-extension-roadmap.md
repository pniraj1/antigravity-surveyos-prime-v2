# Portal Fill Extension — Roadmap and Phase 1–2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the NIA-only Portal Fill extension (v0.1.0) to a multi-portal extension, prove it on the live NIA portal, add UIIC, then grow the portal map set (NIA tie-ups, National, OIC, private insurers).

**Architecture:** The fill engine (`extension/src/lib/fill-core.js`) is already portal-neutral. What is NIA-only is the plumbing around it: one hard-coded map URL, one storage key, one route check, one portal in the packet validator, one flow in the build scripts. Phase 1 turns those five places into "a list of maps, chosen by host + route". Each new portal is then a capture → overlay → map → packet builder, with no engine change.

**Tech Stack:** Chrome MV3, plain JS with `// @ts-check`, Vitest (`extension/__tests__`), Python 3 map scripts (`scripts/portal-map/`), Next.js 16 / TypeScript on the SurveyOS side (`src/lib/portal/`).

**Spec:** `docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md` (rules E1–E10, §6 out-of-scope list this plan picks up). Portal facts: `docs/portal-integration.md`.

## Global Constraints

- E1–E10 of the spec hold for every portal: never touches credentials, never clicks Validate/Submit/Save, claim number must match, existing values kept, nothing leaves the machine, packet expires in 24 h, no AI in the extension, fails per field, map generated never typed, writes through `ngModelController.$setViewValue` + `$render`.
- No new npm or pip dependencies. Python stdlib only in `scripts/portal-map/`.
- `minimum_chrome_version` stays `"111"` (needed for `world: "MAIN"`).
- Map id = `<portal>-<flow>`, file `extension/maps/<id>.json`, hosted copy `public/portal-maps/<id>.json`, overlay `scripts/portal-map/<id>.overlay.json`, capture `scripts/portal-map/<id>-survey.json`.
- Never commit captured values: strip `label_hint` and any rendered claim/policy/insured data before committing a capture (portal-integration §1.2).
- Cost: ₹0 for all phases except the one-time Chrome Web Store developer fee (US $5) in Phase 6.

## Review Focus

1. **Route prefix collision** — NIA's Maruti route `#/WorklistSurvey` is a prefix of the non-tieup route `#/WorklistSurveyNew`. A `startsWith` match picks the wrong map once both exist. `pickMap` must match the route exactly, ignoring only a `?query` or `/sub-path` after it (Task 1).
2. **Upgrade from v0.1.0** — an installed v0.1.0 keeps its map under the storage key `map`. After the upgrade the panel must load maps from the new key, not show "Field map not loaded yet" forever (Task 2).
3. **Packet for the wrong portal** — a packet built for NIA with a UIIC page open must be refused with a message naming both portals, and nothing gets written (Task 3).
4. **UIIC punctuation** — `surveyPlace` like `Plot 4, MIDC-Nashik (W)` must be sanitised to `^[a-zA-Z0-9. ]{1,500}$` before writing, not written raw and reported `invalid` (Task 6).
5. **UIIC time split** — `9:05` must become hours `09` and minutes `05` in two separate selects. `14:30:00` → `14` / `30` (Task 6).

---

## Phase map

| Phase | What | Who / gate | Effort | Cost |
|---|---|---|---|---|
| **0** | Stage 0 on live NIA plus a capture sweep of every portal you can log into | **Owner, in India**, closed claims, ~2 h | — | ₹0 |
| **1** | Multi-portal extension core (Tasks 1–5) | Code, can start today | 1 session | ₹0 |
| **2** | UIIC claim-survey fill (Tasks 6–9) | Code today; live check needs Phase 0-style session on UIIC | 1–2 sessions | ₹0 |
| **3** | NIA tie-ups (Maruti, KIA): per-row approval grids | Needs its own spec (brainstorm first); gate: Phase 0 NIA passes | 2–3 sessions | ₹0 |
| **4** | New portals: National Insurance, then OIC, then private insurers | Gate: a capture of each portal (owner) | 1 session per Angular portal; more for non-Angular | ₹0 |
| **5** | v2: attach documents by type from Claim Documents | Gate: Phase 0 confirms upload behaviour; own spec | 1–2 sessions | ₹0 |
| **6** | Distribution: unlisted Chrome Web Store listing, privacy note, auto-update | Gate: two portals pass live checks | ½ session plus listing review wait | US $5 once |

Phases 1 and 0 run in parallel: Phase 1 needs no portal access, and Phase 0 needs only the v0.1.0 zip that already exists.

---

## Phase 0 — Live checks and capture sweep (owner, no code)

The portals block non-Indian and VPN IPs (portal-integration §1), so this is a person at a machine in India. Do it as **one sitting** across every portal you have a login for. Each capture is **⋮ → Cast, Save and Share → Save page as → Webpage, Complete** on a **closed or test claim**.

### 0-A. NIA Stage 0 (the existing README checklist)
- [ ] Load `extension/dist/surveyos-portal-fill-0.1.0.zip` unpacked (chrome://extensions → Developer mode → Load unpacked).
- [ ] Run every box in `extension/README.md` → "Stage 0". Write down the panel's `✗ not found` / `✎ do by hand` / `✗ rejected` lines word for word.
- [ ] Click **Validate** yourself after the Excel attaches, then save the page (Webpage, Complete). That is the post-Validate grid the docs list as not captured (§5.6).

### 0-B. Capture sweep (save each page; name the file `<portal>-<screen>.html`)
| Portal | Screens to save | Why |
|---|---|---|
| NIA | SurveyorFee, ClaimSearch, a submitted (locked) claim, a Hero MotoCorp claim if one exists | §5.6 gaps |
| UIIC | Claim survey of a **Spot Survey** claim and of a claim **with add-on covers**; SurveyorFee; upload; the validation list Final Submit shows on an incomplete form | §3 gaps; Phase 2 live check |
| UIIC | The Assessment Excel template opened in Excel: does column B have a dropdown, is B8 a formula, can you type past row 151 | answers §4.3 Q1, Q2, Q5 |
| National Insurance | Worklist + claim survey (non-tieup) | Phase 4 — same TCS stack as NIA |
| OIC | Worklist + claim survey | Phase 4 |
| Any private insurer you survey for | Worklist + claim survey | Phase 4 — find out whether it is AngularJS |

- [ ] Put the saved pages in a folder **outside the repo** and hand it over. A session runs `extract-fields.py` and strips PII before anything gets committed.

---

## Phase 1 — Multi-portal extension core

### File structure

| File | Change |
|---|---|
| `extension/src/lib/fill-core.js` | add `mapId`, `pickMap`, two transforms (Task 1, Task 6) |
| `extension/src/background.js` | `MAP_IDS` list, `maps` storage key, migrate `map` (Task 2) |
| `extension/src/lib/packet-validate.js` | `KNOWN_FLOWS` table instead of the NIA literal (Task 3) |
| `extension/src/panel.js` | route via `pickMap`, refuse wrong-portal packet (Task 3) |
| `extension/src/filler.js` | optional `map.controller` (Task 4) |
| `scripts/portal-map/build-ext-map.py` | fixture roots from overlay paths; `host` in header (Task 5) |
| `scripts/build-ext.py` | build and zip every overlay (Task 5) |
| `extension/__tests__/map.test.js` | iterate every map in `extension/maps/` (Task 5) |

### Task 1: Map selection by host and route

**Files:**
- Modify: `extension/src/lib/fill-core.js` (add to `API`)
- Test: `extension/__tests__/fill-core.test.js`

**Interfaces:**
- Produces: `mapId(map: {portal: string, flow: string}): string` → `"nia-nontieup"`; `pickMap(maps: Record<string, Map>, host: string, hash: string): Map | null`. Every map header gains `host: string` (Task 5 writes it).

- [ ] **Step 1: Write the failing tests**

```js
describe('pickMap', () => {
  const nontieup = { portal: 'nia', flow: 'nontieup', host: 'web.newindia.co.in', route: '#/WorklistSurveyNew' };
  const maruti   = { portal: 'nia', flow: 'maruti',   host: 'web.newindia.co.in', route: '#/WorklistSurvey' };
  const uiic     = { portal: 'uiic', flow: 'claimsurvey', host: 'portal.uiic.in', route: '#/SurveyorClaimSurvey' };
  const maps = { 'nia-maruti': maruti, 'nia-nontieup': nontieup, 'uiic-claimsurvey': uiic };
  it('exact route wins over a prefix', () => {
    expect(pickMap(maps, 'web.newindia.co.in', '#/WorklistSurveyNew')).toBe(nontieup);
    expect(pickMap(maps, 'web.newindia.co.in', '#/WorklistSurvey')).toBe(maruti);
  });
  it('ignores a query or sub-path after the route', () => {
    expect(pickMap(maps, 'web.newindia.co.in', '#/WorklistSurveyNew?id=4')).toBe(nontieup);
    expect(pickMap(maps, 'portal.uiic.in', '#/SurveyorClaimSurvey/2')).toBe(uiic);
  });
  it('host must match', () => {
    expect(pickMap(maps, 'portal.uiic.in', '#/WorklistSurveyNew')).toBeNull();
  });
  it('unknown route is null', () => {
    expect(pickMap(maps, 'web.newindia.co.in', '#/Worklist')).toBeNull();
  });
});
it('mapId', () => expect(mapId({ portal: 'nia', flow: 'nontieup' })).toBe('nia-nontieup'));
```

- [ ] **Step 2:** Run `npx vitest run extension/__tests__/fill-core.test.js`. Expected: FAIL, `pickMap is not a function`.
- [ ] **Step 3:** Implement both in `fill-core.js`. A route matches when `hash === route` or `hash` starts with `route + '?'` or `route + '/'`.
- [ ] **Step 4:** Re-run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(extension): pick the field map by host and exact route`.

### Task 2: Background holds many maps

**Files:**
- Modify: `extension/src/background.js`
- Test: `extension/__tests__/background.test.js` (new; stub `chrome.storage.local`, `chrome.runtime.getURL`, `fetch` with plain objects)

**Interfaces:**
- Consumes: `mapId` (Task 1). The background is a module-less service worker, so copy the one-line `mapId` there; a shared import isn't worth a bundler.
- Produces: storage key `maps: Record<string, Map>` (replaces `map`). Constant `MAP_IDS = ['nia-nontieup']` (Task 9 adds `'uiic-claimsurvey'`). Remote URL `https://motorsurveyos-in.web.app/portal-maps/<id>.json`. Export `refreshMaps()` for the test with the same UMD shim as `fill-core.js`.

- [ ] **Step 1: Write the failing tests**
  - `refreshMaps keeps the bundled map when offline` → `fetch` rejects; `maps['nia-nontieup'].version === bundled.version`.
  - `remote wins only when newer and its id matches` → remote `{portal:'nia', flow:'nontieup', version: bundled+1}` is stored; a remote with `flow:'maruti'` at a higher version is ignored.
  - `migrates the v0.1.0 key` → storage starts with `{ map: <v1 nia map> }`; after `refreshMaps()` storage has `maps['nia-nontieup']` and no `map` key.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `refreshMaps()`, which loops `MAP_IDS` with the current per-map logic, then `chrome.storage.local.remove('map')`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(extension): background keeps one field map per portal flow`.

### Task 3: Packet and panel know which portal they're on

**Files:**
- Modify: `extension/src/lib/packet-validate.js`, `extension/src/panel.js`, `extension/manifest.json`
- Test: `extension/__tests__/packet-validate.test.js`, plus a new `extension/__tests__/panel-gate.test.js` for the pure gate

**Interfaces:**
- Produces: `KNOWN_FLOWS = { nia: ['nontieup'] }` in `packet-validate.js` (Task 9 adds `uiic: ['claimsurvey']`). `packetGate(map, packet): {ok: true} | {ok: false, reason: string}` added to `fill-core.js`.
- Panel: on every `hashchange`, `pickMap(maps, location.host, location.hash)`. A null result removes the panel, otherwise it boots with that map. Before probing, `packetGate` runs. A refusal shows the reason and disables Fill.

- [ ] **Step 1: Write the failing tests**
  - validator: `{portal:'uiic', flow:'claimsurvey'}` fails with `packet is for another portal` until Task 9 adds it; `{portal:'nia', flow:'nontieup'}` passes; `{portal:'nia', flow:'maruti'}` fails.
  - gate: `packetGate(uiicMap, niaPacket)` → `{ok:false, reason:'This claim was sent for nia (nontieup); this page is uiic (claimsurvey).'}`; same portal + flow → `{ok:true}`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. In `panel.js` replace the hard-coded `'#/WorklistSurveyNew'` and the `map` storage reads with `maps` + `pickMap`. The `render` storage listener watches `ch.maps`.
- [ ] **Step 4:** Run `npx vitest run extension/__tests__`. Expected: PASS.
- [ ] **Step 5:** Fixture check: open `extension/fixture/nia-nontieup.html` (see the README walk-through). The panel appears and Fill works as before.
- [ ] **Step 6:** Commit `feat(extension): panel picks its map per page and refuses another portal's packet`.

### Task 4: Controller optional in the filler

**Files:**
- Modify: `extension/src/filler.js` (`ctrlScope`)

UIIC's capture has no controller name, and the extractor doesn't record one.

- [ ] **Step 1:** Change `ctrlScope(map)`. With `map.controller`, behaviour is unchanged. Without it, use the scope of the first element whose `ng-model`/`data-ng-model` equals `map.claimNoPath`, else the first mapped field's element, else `null` (the probe then says "page fields not found — portal changed?").
- [ ] **Step 2:** Fixture check: temporarily delete `controller` from the loaded NIA map in `chrome.storage` via DevTools (`chrome.storage.local.get('maps', …)`), Fill on the fixture → same result as with it. Restore.
- [ ] **Step 3:** Commit `feat(extension): find the page scope without a controller name`.

### Task 5: Build scripts and map test for every flow

**Files:**
- Modify: `scripts/portal-map/build-ext-map.py`, `scripts/build-ext.py`, `extension/__tests__/map.test.js`, `scripts/portal-map/nia-nontieup.overlay.json` (add `"host": "web.newindia.co.in"`)

**Interfaces:**
- Produces: map header key `host` (copied from the overlay). The fixture's stub controller builds every parent object of every mapped model path at load. A `[$index]` segment becomes a one-element array, and the `ng-repeat` wrapper is emitted only when the overlay has `invoiceCountPath`.

- [ ] **Step 1:** `map.test.js` → loop over every `extension/maps/*.json` (`import.meta.glob('../maps/*.json', { eager: true })`). For each map: header has `portal, flow, version, host, route, claimNoPath`; the file name equals `mapId(map)`; the hosted copy is identical; every field has `modelPath`, a known kind and `empty`. Drop the NIA-only `^surveyorData\.worklist\.` assertion. The model root is per portal, so assert `modelPath` starts with the overlay's own `modelRoot` header key instead (NIA `surveyorData.worklist.`, UIIC `surveyorClaimSurvey.`).
- [ ] **Step 2:** Run. Expected: FAIL on `host` and `modelRoot`.
- [ ] **Step 3:** `build-ext-map.py`: copy `host` and `modelRoot` into the header (fail loudly if missing), and generate the fixture's `$scope` roots from the paths instead of the hard-coded NIA object. `build-ext.py`: loop over every `scripts/portal-map/*.overlay.json`, regenerate each, and zip every `extension/maps/*.json`.
- [ ] **Step 4:** Run `npm run build:ext`, then `npx vitest run extension/__tests__`. Expected: zip built, PASS. The NIA fixture still passes the README walk-through.
- [ ] **Step 5:** Bump `manifest.json` `version` to `0.2.0`. Commit `chore(extension): build every portal map; v0.2.0`.

---

## Phase 2 — UIIC claim-survey fill

Built from the capture in `scripts/portal-map/uiic-claimsurvey-survey.json`. The figures already exist: `uiicPortalSummary()` in `src/lib/calculations/uiic-portal-summary.ts` feeds today's copy panel. The extension's main gain on UIIC is that **paste is blocked on 45 fields** and writes through `$setViewValue` aren't paste. Phase 0 confirms that on a live page (spec §6).

### Task 6: UIIC transforms

**Files:**
- Modify: `extension/src/lib/fill-core.js` (`transforms`)
- Test: `extension/__tests__/fill-core.test.js`

**Interfaces:**
- Produces: `transforms.uiicText(v): string` → strip every character outside `[a-zA-Z0-9. ]`, collapse runs of spaces, trim, cut to 500. `transforms.hour(v)` / `transforms.minute(v)` → two-digit parts of `H:MM[:SS]`, `''` when unparseable.

- [ ] **Step 1: Write the failing tests**

```js
expect(transforms.uiicText('Plot 4, MIDC-Nashik (W)')).toBe('Plot 4 MIDCNashik W');
expect(transforms.uiicText('a'.repeat(600))).toHaveLength(500);
expect(transforms.hour('9:05')).toBe('09');   expect(transforms.minute('9:05')).toBe('05');
expect(transforms.hour('14:30:00')).toBe('14'); expect(transforms.minute('14:30:00')).toBe('30');
expect(transforms.hour('')).toBe('');
```

> Decision: a hyphen between words is dropped (`MIDCNashik`), not turned into a space, which matches what a surveyor gets today by typing the text without the forbidden characters. If Phase 0 shows surveyors prefer a space, change it in the transform only.

- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(extension): UIIC text sanitiser and survey-time split`.

### Task 7: UIIC overlay and generated map

**Files:**
- Create: `scripts/portal-map/uiic-claimsurvey.overlay.json`
- Rename: `scripts/portal-map/uiic-claimsurvey-survey.json` → `uiic-claimsurvey-survey.json` (matches the `<id>-survey.json` rule)
- Generated: `extension/maps/uiic-claimsurvey.json`, `public/portal-maps/uiic-claimsurvey.json`, `extension/fixture/uiic-claimsurvey.html`

**Interfaces:**
- Header: `portal: "uiic"`, `flow: "claimsurvey"`, `version: 1`, `host: "portal.uiic.in"`, `route: "#/SurveyorClaimSurvey"`, `modelRoot: "surveyorClaimSurvey."`, `claimNoPath: "surveyorClaimSurvey.ClaimEntry.quickUpdate.claimNumber"`, no `controller`, no `invoiceCountPath`.
- Fields (canonical name → leaf under `surveyorClaimSurvey.ClaimEntry.`). Every money field uses `kind: "money"`, `empty: ""`:

| Canonical | Model leaf | Kind / transform |
|---|---|---|
| `surveyDate` | `quickUpdate.surveyDate` | text, `ddmmyyyy` |
| `surveyTimeHours` | `quickUpdate.surveyTimeHours` | select, `from: surveyTime`, `hour` |
| `surveyTimeMinutes` | `quickUpdate.surveyTimeMinutes` | select, `from: surveyTime`, `minute` |
| `surveyPlace` | `quickUpdate.surveyPlace` | text, `uiicText` |
| `claimantMobile` | `quickUpdate.claimantMobileNo` | text, `maxLen: 10` |
| `reportNo` | `quickUpdate.reportNo` | text, `maxLen: 10` |
| `ageBasedDep` `dep50` `dep30` `nilDep` | `claimAssessment.<same>` | money |
| `gst28AmountP` `gst18AmountP` `gst12AmountP` `gst5AmountP` `gst0AmountP` | `claimAssessment.<same>` | money |
| `labourCharge` | `claimAssessment.labourCharge` | money |
| `gst18AmountL` `gst0AmountL` | `claimAssessment.<same>` | money |
| `workshopInvoiceNo` | `claimAssessment.workshopInvoiceNo` | text, `maxLen: 16` |
| `salvageValue` `voluntaryExcess` `compulsoryExcess` `towingCharge` | `claimAssessment.<same>` | money |
| `invoiceNo` | `claimAssessment.invoiceNo` | text (fee bill) |
| `profFeeAmount` `travelExpense` `photoCharge` `dailyAllowance` | `claimAssessment.<same>` | money |

- Not mapped, by design: readonly `*AfterDep` / `*Tax*` twins and `gstParts` (the portal computes them), the 9 `documentVerified` Y/N attestations (the surveyor ticks them, same as the NIA declarations), `SurveyorRemarksOffice` and `recommendation` (free text the surveyor writes), the hidden add-on cover amounts, and `impDoc` uploads (Phase 5).
- `fill-core.js` change: `from` currently applies only to `dateRadioOrOthers`. Generalise it so any field with `from` reads `fields[spec.from]` instead of `fields[name]`. Test: a `surveyTimeHours` map entry with `from: 'surveyTime'`, `transform: 'hour'` and packet `{surveyTime: '9:05'}` → step value `'09'`.

- [ ] **Step 1:** Write the `from` generalisation test in `fill-core.test.js`. Run. FAIL.
- [ ] **Step 2:** Implement in `planFill`. Run. PASS.
- [ ] **Step 3:** Write the overlay, then run `python scripts/portal-map/build-ext-map.py uiic-claimsurvey`. Expected: `ok 28 fields` (fails loudly on any path not in the capture, per E9).
- [ ] **Step 4:** `npx vitest run extension/__tests__`. Expected: PASS, with the map test now covering both maps.
- [ ] **Step 5:** Commit `feat(extension): UIIC claim-survey field map`.

### Task 8: UIIC packet in SurveyOS

**Files:**
- Modify: `src/lib/portal/packet.ts` (packet union, `buildUiicPacket`)
- Modify: `src/components/dialogs/UIICSummaryDialog.tsx` (Send to extension block, copied from `NIAExportDialog`'s)
- Test: `src/lib/portal/__tests__/packet.test.ts` (UIIC cases beside the existing NIA ones)

**Interfaces:**
- Consumes: `uiicPortalSummary(rows, ageMonths, depType)`, `resolveBillSalvage`, `getCompulsoryExcess`, `calculateFeeSummary`, `sendPacketToExtension` / `isExtensionPresent` (`src/lib/portal/extension-bridge.ts`).
- Produces: `PortalPacket` becomes a union discriminated on `portal`: the NIA shape is unchanged, plus `{ v: 1; portal: 'uiic'; flow: 'claimsurvey'; claimNo; builtAt; fields: Partial<Record<UiicField, string|number>>; files: [] }`. Export `UIIC_FIELDS` (the canonical names in Task 7, plus `surveyTime`, minus `surveyTimeHours`/`surveyTimeMinutes`, which the map derives). `buildUiicPacket(claim: ClaimData, opts: { ageMonths: number }): PortalPacket` is synchronous because there's no file.

- [ ] **Step 1: Write the failing tests**
  - Parts buckets and GST slabs equal `uiicPortalSummary(...)` for the same rows. Slabs whose rate isn't in the portal's set are dropped from fields, and a test pins that a 0 % slab maps to `gst0AmountP`.
  - `labourCharge === summary.labour.totalLabour`.
  - `salvageValue` uses the bill-check rule (`resolveBillSalvage`), same as NIA.
  - A claim with no claim number throws the same message as `buildPortalPacket`.
  - `claimantMobile` is the last 10 digits.
- [ ] **Step 2:** Run `npx vitest run src/lib/portal`. Expected: FAIL.
- [ ] **Step 3:** Implement `buildUiicPacket`. Add the dialog block behind the same bill-check gate the NIA dialog uses (spec R12).
- [ ] **Step 4:** Run `npx vitest run`. Expected: whole suite PASS (1408 + new).
- [ ] **Step 5:** Commit `feat(uiic): send the claim to the portal-fill extension`.

### Task 9: Enable UIIC in the extension

**Files:**
- Modify: `extension/manifest.json` (add `https://portal.uiic.in/surveyor/*` to `host_permissions` and to both portal `content_scripts.matches`), `extension/src/background.js` (`MAP_IDS` += `'uiic-claimsurvey'`), `extension/src/lib/packet-validate.js` (`KNOWN_FLOWS.uiic = ['claimsurvey']`), `extension/README.md` (UIIC fixture walk-through + UIIC Stage 0 checklist)

- [ ] **Step 1:** Change the validator test from Task 3: the UIIC packet now passes. Run → FAIL, implement, PASS.
- [ ] **Step 2:** `npm run build:ext`. Zip contains both maps.
- [ ] **Step 3:** Fixture walk-through on `extension/fixture/uiic-claimsurvey.html`: claim match, Fill, `Plot 4, MIDC-Nashik` lands sanitised, time splits, a pre-filled field is kept amber.
- [ ] **Step 4:** Bump to `0.3.0`, commit `feat(extension): UIIC support; v0.3.0`.
- [ ] **Step 5:** Deploy hosting (`firebase deploy --only hosting --project surveyos-v2-antigravity-in`) so the hosted maps exist. **Ask the owner before deploying.**
- [ ] **Step 6:** Owner: UIIC Stage 0 on a closed claim. Check that paste-blocked money fields accept the write, the portal's readonly twins recompute, and Final Submit's validation list is captured.

---

## Phase 3 — NIA tie-ups (Maruti, KIA): needs its own spec

The map shape is different. These pages have **no Excel**. The dealer supplies line items, and the surveyor sets each row's allowed service type, approval amount and depreciation (`item4.*` for Maruti, 84 controls; `obj` grid for KIA, 549 controls). The hard problem is **matching each dealer line to a SurveyOS assessment row** (part code first, then name). That's a design decision, not plumbing, so start with `superpowers:brainstorming` → spec → plan. Prerequisites: Phase 0 NIA passes, and a saved Maruti claim *with dealer lines filled in* (today's capture has the empty grid).

Engine work it will need: a `rows` map section (repeat path + per-row fields + match key) and a `planRows` step in `fill-core.js`. The per-field rules (E4, E8) apply per cell.

## Phase 4 — Mapping new portals

Same pipeline for each: **capture (Phase 0-B) → `extract-fields.py` → section in `docs/portal-integration.md` → overlay → `build-ext-map.py` → packet builder → fixture → Stage 0.**

| Order | Portal | Why this order | Expected effort |
|---|---|---|---|
| 1 | **National Insurance** | Same TCS BaNCS "Maruti" stack as NIA (§5, §6). The NIA overlay probably ports with new model paths and the same packet. | 1 session after capture |
| 2 | **Oriental (OIC)** | Public sector, closed portal, not captured. Stack unknown until captured. | 1 session if AngularJS |
| 3 | **Private insurers** you survey for (owner to name them) | Stack unknown per insurer. | see below |

**Non-AngularJS portals** need two engine additions, kept out of scope until a capture proves they're needed: (a) `extract-fields.py` falls back to `name`/`id` when there's no `ng-model`; (b) the filler gets a second writer that uses the native value setter plus `input`/`change` events (React/Vue-safe) when `angular` is absent. E10 is reworded to "through the page framework's own input path". That's one spec amendment plus one task each, scheduled when the first non-Angular capture lands.

## Phase 5 — v2: attach documents

Uses the typed index from Claim Documents (`docs/superpowers/specs/2026-09-20-claim-documents-design.md`). It needs a `files` map entry that can address the *n*-th repeat: UIIC's five mandatory slots share the model `impDoc.fileToUpload` (names `fileToUpload0..4`), so the map keys them by `name`, not model. It also raises the packet's file cap (today ≈ 1 MB total) to cover PDFs, or the panel fetches files lazily from the SurveyOS tab. That needs a spec: the size limits and the DPDP note change (photos and RC/DL are personal data).

## Phase 6 — Distribution

- Unlisted Chrome Web Store item: US $5 one-time developer registration. It gives auto-update, so surveyors stop re-loading unpacked zips.
- A short privacy note restating E1/E5 (needed for the listing; also feeds `docs/compliance/`).
- Edge users can install from the Chrome Web Store directly. No separate listing.

---

## Housekeeping (do with Task 1's commit or before it)

- [ ] `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`: add an "In Progress — Portal fill extension" block that points at this plan. Add the NIA Excel (09-18), extension v0.1.0 (09-21) and Claim Documents (09-21) to Recently Completed. Fix the stale Node 20 item (`functions/package.json` already says 22; confirm deployed runtime in the Firebase console).
- [ ] `Changelog.md`: back-fill 2026-09-18 → 09-23 (NIA Excel, extension, Claim Documents, folder naming), which are missing today.
- [ ] `docs/portal-integration.md` §6: link this plan under **Next**.

## Open questions for the owner

1. Which portals do you hold a surveyor login for? This sets the Phase 4 order.
2. Who does the Phase 0 session, and when? Everything after Phase 2's code waits on it.
3. Which private insurers matter most by claim volume?
