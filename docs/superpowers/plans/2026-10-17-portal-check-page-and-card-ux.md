# Portal Fill v0.4.0: Check Page and Card UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship extension v0.4.0 with:
- a read-only **Check page** mode;
- a redesigned surveyor card (states, copy, docking, collapse, keyboard, screen-reader support);
- clearer SurveyOS Send steps;
- a structure-only live extractor for Stage B.

**Architecture:**
- **Decisions move into pure, unit-tested functions:**
  - `planCheck` in `fill-core.js`;
  - `cardView` and `reportText` in a new `card-view.js`, loaded only in the isolated world;
  - `extractFields` in `live-extract.js`.
- **The DOM files only gather reads and draw:**
  - `filler.js` gets a read-only `check()`;
  - `panel.js` renders the view model.
- SurveyOS gets one tested copy helper.

**Tech Stack:** Chrome MV3, plain JS with `// @ts-check` and the existing UMD shim, Vitest, Python stdlib (`scripts/portal-map/build-ext-map.py`), Next.js 16 / React / TypeScript for the two dialogs.

**Spec:** `docs/superpowers/specs/2026-10-16-portal-live-verification-and-audit-design.md`. Stage A is §4.1, the UX is §10, the extractor is §9, and the builder-check rulings are §11. The base rules E1–E10 are in `docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md`.

## Global Constraints

- **Zero writes in Check:** no `$setViewValue`, `$render`, `$apply`, `$evalAsync`, `$digest` or `dispatchEvent`, and no setting of `.files`, `.value`, `.checked`, `.style` or any attribute on portal elements.
  - Reads are allowed: `.scope()`, `.controller('ngModel')`, `$modelValue`, `$parse(path)(scope)`, option and radio values.
  - The one exception is a **user click** on a result line, which may `scrollIntoView` and pulse an outline for 1.5 s, then remove it.
- **E2:** the extension never clicks Validate/Submit/Save/upload. E3/E4/E8 hold for Fill exactly as today.
- **No new npm or pip dependencies.** No jsdom. Python stdlib only.
- **Surveyor-facing copy** never says "packet", "map", "scope" or "model path". The Copy report is the only exception.
- **Copy is fixed by spec §10.3/§10.4:** use the exact strings given in this plan.
- **Card style:**
  - Width 320 px, docked to the right edge, vertically centred; collapsed tab 40 px; max height 60vh.
  - Body 13 px, nothing under 12 px; `tabular-nums` for numbers.
  - Status colours `#15803d` / `#b45309` / `#b91c1c` / `#1d4ed8`, muted `#6b7280`, primary `#0f766e`, each with a word or icon. Colour is never alone.
  - Motion 150–200 ms, transform/opacity only, none under `prefers-reduced-motion`.
- **Accessibility:**
  - `role="region"` with `aria-label="SurveyOS Portal Fill"`, results `aria-live="polite"`.
  - Real `<button>`s with a visible 2 px teal focus ring offset 2 px; Esc collapses.
  - Click targets ≥ 32 px tall.
- **Packet values never shown** for text and money fields, neither in the card nor in the Copy report. Option codes may be shown.
- **Encoding:** UTF-8 only. Edit with the Edit/Write tools, not Python/PowerShell rewrites, and strict-decode any file with non-ASCII text after editing.
- **Commits:** on `main`. Each ends with a `Co-Authored-By:` trailer naming the model that wrote it.
- **Tooling:** Python is `py`. Extension tests run with `npx vitest run extension/__tests__`; the full suite with `npm test`.

## Review Focus

1. **Expired packet** (stored more than 24 h ago) must be treated as *no claim sent*, never planned as values. Owner: Task 4 (`cardView` test "expired packet shows No claim sent").
2. **A model path repeated inside `ng-repeat`** (NIA `multiInvoice[$index]` fields render once per invoice) must be checked on the **first** element, the same one Fill writes to. Owner: Task 2 (`planCheck` test "uses the first element of a repeated path").
3. **AngularJS present but `.scope()` returns undefined** (debug info disabled) must give a readable "page fields not found" result, not a crash or an empty ✓ list. Owner: Task 3 (harness test "scope unavailable").
4. **Wrong claim:** Check stays enabled and Fill shows disabled with the reason visible. Owner: Task 4 (`cardView` test "wrong claim").
5. **The Copy report never contains a text or money value,** even when the field is `noOption` or `hasValue`. Owner: Task 4 (`reportText` test "no text or money values").

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/portal-map/nia-nontieup.overlay.json`, `uiic-claimsurvey.overlay.json` | `label` per field, `doneHint` in header | 1 |
| `scripts/portal-map/build-ext-map.py` | copy `label`, `doneHint` into maps | 1 |
| `extension/src/lib/fill-core.js` | + `planCheck` (pure) | 2 |
| `extension/src/filler.js` | + read-only `check()` handler, shared reader | 3 |
| `extension/src/lib/card-view.js` (new) | `cardView`, `reportText`, `claimTail`, `LINE_COPY` (pure, isolated world only) | 4 |
| `extension/src/panel.js`, `extension/src/panel.css` | render the view model; dock/collapse/drag/keyboard/a11y | 5 |
| `extension/manifest.json` | add `card-view.js` to the panel script list; version 0.4.0 | 5, 8 |
| `src/lib/portal/extension-bridge.ts` | + `readyLine` copy helper | 6 |
| `src/components/dialogs/NIAExportDialog.tsx`, `UIICSummaryDialog.tsx` | Ready line, not-installed line, UIIC view switch | 6 |
| `scripts/portal-map/live-extract.js` (new) | `extractFields` pure + DOM adapter, run in-page in Stage B | 7 |
| `extension/README.md`, vault docs | Check page, new card, release notes | 8 |

---

### Task 1: Field labels and next-step hints in the maps

**Files:**
- Modify: `scripts/portal-map/nia-nontieup.overlay.json`, `scripts/portal-map/uiic-claimsurvey.overlay.json`, `scripts/portal-map/build-ext-map.py`
- Generated (do not hand-edit): `extension/maps/*.json`, `public/portal-maps/*.json`, `extension/fixture/*.html`
- Test: `extension/__tests__/map.test.js`

**Interfaces:**
- Produces: every map field has `label: string`, and every map header has `doneHint: string`. Tasks 4 and 5 read these.

- [ ] **Step 1: Write the failing test.** Add to the per-map `describe` in `map.test.js`:

```js
it('every field has a surveyor label and the map has a next-step hint', () => {
  expect(typeof map.doneHint).toBe('string');
  expect(map.doneHint.length).toBeGreaterThan(10);
  for (const [k, f] of Object.entries(map.fields)) expect(f.label, k).toMatch(/^[A-Z][^]*\S$/);
});
```

- [ ] **Step 2:** Run `npx vitest run extension/__tests__/map.test.js`. Expected: FAIL (`doneHint` undefined).

- [ ] **Step 3: Add `"label"` to every overlay field and `"doneHint"` to each overlay header,** using exactly these values.
  - These are plain-English stand-ins. Stage B replaces any that differ from the live portal's caption.
  - Bump each overlay's `version` by 1 (NIA 2 → 3, UIIC 1 → 2), so installed copies take the new map.

  **NIA `doneHint`:** `Now click Validate on the portal to load the Excel lines, then check the totals.`

  **NIA labels:**

  | Field | Label |
  |---|---|
  | surveyDateRadio | Survey date choice |
  | surveyDate | Survey date |
  | surveyTime | Survey time |
  | surveyPlace | Place of survey |
  | claimantMobile | Claimant mobile |
  | claimantEmail | Claimant email |
  | noOfInvoices | No. of invoices |
  | gstApplicable | GST applicable (invoice) |
  | vendorInvoiceNo | Vendor invoice no. |
  | vendorInvoiceDate | Vendor invoice date |
  | paintingWork | Painting work details |
  | paintingEstimate | Painting estimated amount |
  | paintingAssessed | Painting assessed amount |
  | netSalvage | Net salvage |
  | compulsoryExcess | Compulsory excess |
  | voluntaryExcess | Voluntary excess |
  | feeInvoiceDate | Fee invoice date |
  | professionalFee | Professional fee |
  | photosAmount | Photographs |
  | conveyanceAmount | Conveyance |
  | feeOthers | Other charges (fee) |
  | feeGstApplicable | GST applicable (fee) |
  | feeGstPercent | GST % (fee) |

  **UIIC `doneHint`:** `Check the depreciated amounts and tax the portal calculated, then save or submit.`

  **UIIC labels:**

  | Field | Label |
  |---|---|
  | surveyDate | Survey date |
  | surveyTimeHours | Survey time (hours) |
  | surveyTimeMinutes | Survey time (minutes) |
  | surveyPlace | Place of survey |
  | claimantMobile | Claimant mobile |
  | reportNo | Report no. |
  | ageBasedDep | Parts: vehicle age based depreciation |
  | dep50 | Parts at 50% |
  | dep30 | Parts at 30% |
  | nilDep | Parts at nil |
  | gst28AmountP | Parts GST 28% amount |
  | gst18AmountP | Parts GST 18% amount |
  | gst12AmountP | Parts GST 12% amount |
  | gst5AmountP | Parts GST 5% amount |
  | gst0AmountP | Parts GST 0% amount |
  | labourCharge | Labour charges |
  | gst18AmountL | Labour GST 18% amount |
  | gst0AmountL | Labour GST 0% amount |
  | workshopInvoiceNo | Workshop invoice no. |
  | salvageValue | Salvage value |
  | voluntaryExcess | Voluntary excess |
  | compulsoryExcess | Compulsory excess |
  | towingCharge | Towing charges |
  | invoiceNo | Fee invoice no. |
  | profFeeAmount | Professional fee |
  | travelExpense | Travel expense |
  | photoCharge | Photographs |
  | dailyAllowance | Daily allowance |

  **In `build-ext-map.py`:**
  - Add `"label"` to the keys `entry()` copies.
  - Add `"doneHint"` to `need` (required header).
  - Exit loudly if any field lacks `label`, naming the fields.

- [ ] **Step 4:** Run `py scripts/portal-map/build-ext-map.py nia-nontieup`, then `py scripts/portal-map/build-ext-map.py uiic-claimsurvey`. Expected output: `ok 23 fields`, then `ok 28 fields`. Then run `npx vitest run extension/__tests__`. Expected: PASS.

- [ ] **Step 5: Commit**
  - Message: `feat(extension): surveyor labels and next-step hints in the field maps`
  - Include the overlays, the build script, and the generated maps, hosted copies and fixtures.

---

### Task 2: `planCheck`, the read-only check planner

**Files:**
- Modify: `extension/src/lib/fill-core.js` (inside the IIFE; add `planCheck` and `CHECK_STATUS` to `API`)
- Test: `extension/__tests__/check-core.test.js` (new)

**Interfaces:**
- Consumes: `planFill(map, packet, read)`, `normaliseClaimNo`, `packetGate`.
- Produces:

```js
/** read.lookup(modelPath) → { found: boolean, bound: boolean, disabled: boolean,
 *                              options: string[] | null,   // select <option> values or radio values, else null
 *                              current: unknown }           // $modelValue, else undefined
 *  read.current(path) and read.radioValues(path) — same contract planFill already uses. */
planCheck(map, packet /* object | null */, pageClaimNo /* string */, read)
  → { mode: 'structure' | 'value' | 'wrongClaim',
      fields: Array<{ name, label, kind, modelPath,
                      status: 'ready' | 'ready?' | 'notFound' | 'notBound' | 'disabled'
                            | 'noOption' | 'hasValue' | 'skip',
                      planned?: string,          // ONLY for select/radio/dateRadioOrOthers kinds
                      liveOptions?: string[] }>, // ONLY when status === 'noOption'
      files: Array<{ slot, status: 'found' | 'notFound' | 'disabled' }> }
CHECK_STATUS = ['ready','ready?','notFound','notBound','disabled','noOption','hasValue','skip']
```

**Mode rules:**
- `structure` when `packet` is null or `packetGate(map, packet).ok` is false.
- `wrongClaim` when the gate passes but `normaliseClaimNo(packet.claimNo) !== normaliseClaimNo(pageClaimNo)`.
- `value` otherwise.

**Status precedence per field, first match wins:**
1. `notFound`
2. `notBound`
3. `disabled`
4. `hasValue` (current not empty per `isEmptyValue` with the field's `empty`)
5. in value/wrongClaim modes: `skip` when `planFill`'s step is `skip`
6. `noOption` when the kind is `select`/`radio`/`dateRadioOrOthers` and the planned value isn't in `options`
7. `ready` for select/radio/dateRadioOrOthers kinds
8. `ready?` for text/money

In `structure` mode, select/radio fields with options are `ready` and text/money are `ready?`.

- [ ] **Step 1: Write the failing tests** in `check-core.test.js`. Use the bundled maps and a fake `read` built from a plain object `{ [modelPath]: lookupResult }`:
  - `structure mode with no packet`: all found and bound → text/money `ready?`, select `ready`; `mode === 'structure'`.
  - `packet for another portal is structure mode`: a UIIC packet on the NIA map gives `mode === 'structure'`.
  - `wrong claim mode`: packet claim `3101/1`, page claim `3101/2` → `mode === 'wrongClaim'`; values are still planned.
  - `status precedence`: one field each for `notFound`, `notBound`, `disabled` (also bound), `hasValue` (current `'Nashik'`, empty `''`) → expect exactly those statuses.
  - `noOption shows planned and live codes`: UIIC map, packet `surveyTime: '9:05'`, lookup for the hours select has options `['9','10']` → hours field `{status:'noOption', planned:'09', liveOptions:['9','10']}`.
  - `text fields never carry planned`: packet `surveyPlace:'Nashik'` → `surveyPlace` entry has no `planned` key.
  - `uses the first element of a repeated path` (Review Focus 2): the fake `read.lookup` records calls; assert it's called once per field path, and that `planCheck` doesn't ask for indexed variants. The DOM side picking the first element is Task 3's.
  - `file slots`: NIA map `assessmentExcel` lookup found → `files[0].status === 'found'`; disabled → `'disabled'`.
- [ ] **Step 2:** Run `npx vitest run extension/__tests__/check-core.test.js`. Expected: FAIL (`planCheck is not a function`).
- [ ] **Step 3:** Implement `planCheck` per the Interfaces block. Reuse `planFill` for `planned` values; never call `read` for anything but `lookup`, `current`, `radioValues`.
- [ ] **Step 4:** Run the same file, then `npx vitest run extension/__tests__`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(extension): read-only check planner`.

---

### Task 3: `check()` in the page script (read-only)

**Files:**
- Modify: `extension/src/filler.js`
- Test: `extension/__tests__/filler-check.test.js` (new)

**Interfaces:**
- Consumes: `planCheck`, plus `probe` / `ctrlScope` / `q` / `readPath`, which already exist in `filler.js`.
- Produces: a message `{ sx, type: 'check', map, packet|null }` → `{ sx, type: 'check:result', ok: true, claimNo, invoices, ...planCheck(...) }`, or `{ ok: false, reason }`.
  - `reason` copy when the scope is unavailable: `page fields not found. The portal may have changed.`
  - `lookup(path)` uses `q(path)[0]` (first element), `angular.element(el).controller('ngModel')`, `el.disabled`.
  - For `options`: `<select>` → `Array.from(el.options, o => o.value)`; radios → `q(path).map(e => e.value)`; else `null`.

- [ ] **Step 1: Write the failing tests.** The harness loads `fill-core.js` and then `filler.js` into one `vm` context, with fakes:
  - `window` (`addEventListener` captures the message handler; `postMessage` records replies);
  - `document.querySelectorAll` returning fake elements;
  - `globalThis.angular.element(el)` returning `{ scope, controller, injector }`.

  Every fake element and controller is a **Proxy that records any property set and any call** to `$setViewValue`, `$render`, `$apply`, `$evalAsync`, `$digest`, `dispatchEvent`.

  Tests:
  - `check touches no write API`: run a `check` message on a fake NIA page with all 23 paths present → the recorded writes list is empty.
  - `check reports first element of a repeated path` (Review Focus 2): two elements for `…multiInvoice[$index].vendorTaxInvoiceNumber`, the first disabled → status `disabled`.
  - `scope unavailable` (Review Focus 3): `angular.element(el).scope()` returns `undefined` → reply `{ ok: false, reason: 'page fields not found. The portal may have changed.' }`.
  - `fill still refuses a mismatched claim`: a regression guard; the existing behaviour is unchanged.
- [ ] **Step 2:** Run `npx vitest run extension/__tests__/filler-check.test.js`. Expected: FAIL (no `check:result` reply).
- [ ] **Step 3:** Implement `check(map, packet)` in `filler.js` and route `d.type === 'check'` in the message listener. It must not call `write`, `attachFile`, or touch `.style`.
- [ ] **Step 4:** Run `npx vitest run extension/__tests__`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(extension): read-only page check in the page script`.

---

### Task 4: `cardView` and `reportText` (pure view model)

**Files:**
- Create: `extension/src/lib/card-view.js` (same UMD shim as `fill-core.js`, global `SxCard`, inside an IIFE)
- Test: `extension/__tests__/card-view.test.js` (new)

**Interfaces:**
- Consumes: map `label`, `doneHint` (Task 1); `planCheck` result shape (Task 2); the Fill result shape `{ ok, reason?, steps:[{name, action, why?}], files:[{slot,status,why?}] }` (existing).
- Produces:

```js
claimTail(claimNo) → '…' + last 4 alphanumerics (normaliseClaimNo applied), '' when blank
cardView({ map, packet, storedAt, now, probe /* {ok, claimNo, invoices, reason?} */,
           phase /* 'loading'|'idle'|'filling'|'checking' */,
           fill /* Fill result | null */, check /* {ok, ...planCheck} | null */ })
  → { state, badge: {tone:'muted'|'ok'|'warn'|'bad'|'info', text},
      body: string, primary: {id:'fill'|'retry', label, disabled, reason?} | null,
      secondary: Array<{id:'check'|'clear'|'copy'|'showAll', label}>,
      summary: string | null, lines: Array<{status, label, text, modelPath}>,
      okCount: number, doneHint: string | null, reassurance: string | null,
      claim: { packetTail, pageTail, packetFull, pageFull } }
reportText(view, meta /* {mapId, version, route, mode} */) → string   // for Copy report
LINE_COPY = { kept, manual, notFound, invalid, noOption, disabled, notBound, error }  // exact strings below
```

**States and copy:** use these exact strings (spec §10.3).
- `{n}` = number of packet fields plus files.
- `{h}` = whole hours since `storedAt`, shown as "Sent {h} h ago". Under one hour it reads "Sent just now".

| state | when | badge | body | primary | secondary |
|---|---|---|---|---|---|
| `loading` | `phase==='loading'` or probe missing | muted "" | `Reading this page…` | null | [] |
| `noPacket` | no packet, **or `now - storedAt > 24 h`** (Review Focus 1) | muted `No claim sent` | `Send this claim from SurveyOS (Assessment → {path} → Send to extension).` with path `NIA Excel` for `portal==='nia'`, `UIIC summary` for `uiic` | null | [check] |
| `otherPortal` | `packetGate` fails | muted `Other portal` | `The claim you sent is for {packetPortalName}. Open it on that portal.` (names: `nia`→`New India`, `uiic`→`United India`) | null | [check] |
| `wrongClaim` | gate ok, claim mismatch | bad `Different claim` | `You sent claim {packetTail}. This page is claim {pageTail}. Open the right claim, or send this one from SurveyOS.` | `{id:'fill', label:'Fill', disabled:true, reason:'Different claim'}` | [check] |
| `probeFailed` | `probe.ok===false` | bad `Couldn't read page` | `{probe.reason}` | `{id:'retry', label:'Try again'}` | [] |
| `ready` | gate ok, claims match | ok `Claim matches` | `{n} items are ready to fill. Sent {h} h ago.` | `{id:'fill', label:'Fill'}` | [check, clear] |
| `filling` | `phase==='filling'` | ok `Claim matches` | `Filling…` | `{id:'fill', label:'Filling…', disabled:true}` | [] |
| `checking` | `phase==='checking'` | info `Checking` | `Checking this page…` | null | [] |
| `filled` | fill ok, no needs-you lines | ok `Filled` | `` | null | [showAll] |
| `needsYou` | fill ok, ≥1 needs-you line | warn `Needs you: {k}` | `` | `{id:'fill', label:'Fill again'}` only if some step is `error`/`invalid`, else null | [showAll] |
| `fillFailed` | `fill.ok===false` | bad `Couldn't fill` | `{fill.reason}` | `{id:'retry', label:'Try again'}` | [] |
| `checked` | check present | info `Checked` | mode line: `structure`→`Page check (no claim sent).`, `value`→`Page check for this claim.`, `wrongClaim`→`Page check: you sent claim {packetTail}, this page is {pageTail}. Fill will refuse.` | `{id:'fill', label:'Fill'}` when the claim matches and a packet is present, else null | [copy] |

**Lines** (for `filled`, `needsYou` and `checked`):
- Order: needs-you statuses first (`notFound`, `invalid`, `error`, `manual`, `noOption`, `disabled`, `notBound`), then `kept`/`hasValue`, then OK (`filled`, `same`, `ready`, `ready?`, `attached`, `found`). Fill's `skip` lines are omitted.
- `okCount` = number of OK lines. Only needs-you and kept lines appear in `lines` unless `showAll` is on. `showAll` is a view input flag defaulting to false; add it to the input object.
- `label` is the map field's `label`, or `Excel file` for a file slot.

**`LINE_COPY`** (exact strings):
- kept / hasValue: `Kept the portal's value. Check it.`
- manual: `Type this one yourself (the portal locks it for this claim).`
- disabled: `Locked on this page. Type it yourself if needed.`
- notFound: `Not on this page. The portal may have changed.`
- notBound: `Can't be filled automatically. Type it yourself.`
- invalid: `The portal rejected the value ({why}). Type it yourself.`
- noOption: `The portal has no option '{planned}' (it offers {first 3 liveOptions joined ', '}…).` Drop the trailing `…` when there are 3 or fewer options.
- error: `Something went wrong here: {why}`
- OK lines: `Filled` / `Same as the portal` / `Ready` / `Ready (the portal checks the format when it is written)` / `Attached` / `Found`.

**Summary:**
- Fill: `{a} filled · {b} kept · {c} do by hand · {d} not found`, omitting zero parts, with `do by hand` = manual + disabled + notBound + noOption + invalid + error.
- Check: `{a} ready · {b} need you · {c} already filled`.

**Constant lines:**
- `doneHint` = `map.doneHint` for `filled` and `needsYou`, else null.
- `reassurance` = `Nothing is saved until you save on the portal. To undo, reload this page.` for `filled`, `needsYou`, `checked`.

**`reportText`:** plain text.
- First line: `SurveyOS Portal Fill {version} · {mapId} · {route} · mode {mode} · page claim {pageTail}`.
- Then one line per field: `{status}\t{modelPath}\t{label}`, plus `\tplanned {planned}\tlive {liveOptions.join(',')}` for `noOption` only.
- **Never** includes a text or money value (Review Focus 5).

- [ ] **Step 1: Write the failing tests** in `card-view.test.js`, one `it` per state row above.
  - Assert `state`, `badge`, `body` (exact), `primary` and `secondary` ids.
  - Plus: `expired packet shows No claim sent` (Review Focus 1: `storedAt = now - 25 h`).
  - Plus: `wrong claim keeps Check and disables Fill with reason` (Review Focus 4).
  - Plus: `lines order needs-you first and hides OK lines until showAll`.
  - Plus: `summary omits zero parts`.
  - Plus: `noOption line copy with ellipsis rule`.
  - Plus: `claimTail('7700031260390039686') === '…9686'`.
  - Plus: `reportText has no text or money values` (Review Focus 5). Build a check result whose underlying packet has `surveyPlace:'Nashik Road'` and `netSalvage: 1234`, and assert the text contains neither `Nashik` nor `1234`.
- [ ] **Step 2:** Run `npx vitest run extension/__tests__/card-view.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `card-view.js` (it may require `fill-core.js` for `normaliseClaimNo` and `packetGate` in tests; in the extension both are globals in the isolated world).
- [ ] **Step 4:** Run `npx vitest run extension/__tests__`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(extension): card view model with surveyor copy`.

---

### Task 5: Card rendering, docking, collapse, keyboard and screen-reader support

**Files:**
- Modify: `extension/src/panel.js`, `extension/src/panel.css`, `extension/manifest.json` (panel `js` becomes `["src/lib/fill-core.js", "src/lib/card-view.js", "src/panel.js"]`), `scripts/build-ext.py` (add `src/lib/card-view.js` to `FILES`)

**Interfaces:**
- Consumes: `SxCard.cardView`, `SxCard.reportText`, `SxCard.claimTail`; `SxFill.pickMap`, `routeStep`, `keepResults`, `mapId`; messages `probe`, `fill`, `check` (Task 3).
- Produces: no new API. UI state is stored under `chrome.storage.local['ui:<mapId>'] = { collapsed: boolean, top: number }`.

**Rendering rules** (spec §10.3–§10.7):
- **Structure:**
  - The root `#sx-panel` has `role="region"` and `aria-label="SurveyOS Portal Fill"`.
  - The header holds: the SurveyOS name, version, badge, and the collapse `<button aria-expanded aria-controls="sx-content">`.
  - `#sx-content` holds: body, summary (`tabindex="-1"`), lines list (`aria-live="polite"`), legend, next-step hint, reassurance, and the actions row.
- **Claim numbers:** whenever a claim tail (`…9686`) is shown, wrap it in a `<span>` with `title` set to the full number and an `aria-label` reading the full number (spec §10.3). Map id, version and route never appear in the card, only in the Copy report (spec §10.8).
- **Actions:** one primary button from `view.primary`. When it's disabled with a `reason`, show the reason as visible text next to it; don't hide it. Secondary actions are text buttons.
- **After a fill or check completes,** focus moves to the summary.
- **Line click / Enter:** `scrollIntoView({block:'center'})` on `document.querySelector` of that model path (first element), add the class-free inline outline `2px solid #0f766e`, and remove it after 1500 ms. Skip the pulse under reduced motion: scroll only, outline for 1500 ms with no transition.
- **Docking:** `position:fixed; right:0; top:{top}px` (default: vertically centred). Width 320 px; content `max-height:60vh; overflow:auto`.
- **Collapsed:** a 40 px-wide tab on the right edge showing the badge text vertically or abbreviated, plus an expand button.
- **Drag:** pointer-drag on the header moves `top` only, clamped to the viewport. Up/Down arrows on the focused header move it 24 px; Home resets it. Persist to `ui:<mapId>`.
- **Esc** inside the card collapses it.
- **Auto-collapse:** on `focusin` of any portal element (outside `#sx-panel`) whose bounding box intersects the card's, collapse.
- **CSS:**
  - Custom properties on `#sx-panel`: `--sx-ok:#15803d; --sx-warn:#b45309; --sx-bad:#b91c1c; --sx-info:#1d4ed8; --sx-muted:#6b7280; --sx-primary:#0f766e`.
  - `#sx-panel{all:initial}` first, then the card styles; body 13 px; nothing under 12 px; focus ring `outline:2px solid var(--sx-primary); outline-offset:2px`.
  - Buttons `min-height:32px`; transitions of 150–200 ms on transform/opacity, wrapped in `@media (prefers-reduced-motion: no-preference)`.
  - `.sx-num{font-variant-numeric:tabular-nums}`.
- **Icons:** inline SVG strings for Lucide `check`, `alert-triangle`, `x`, `pencil`, `minus` (24×24 viewBox, `stroke="currentColor"`, `stroke-width="2"`, `fill="none"`, rendered at 14 px, `aria-hidden="true"`), each next to its word.
- **Legend line:** `On the page: green = filled, amber = kept, red = rejected.`

- [ ] **Step 1:** Rewrite `render()` to build the `cardView` input from storage, probe and the current phase, and draw it. Wire `fill`, `retry`, `check`, `clear`, `copy` (copy uses `navigator.clipboard.writeText(reportText(...))` and then shows `Copied` for 2 s on the button) and `showAll`. Keep `routeStep` / `keepResults` behaviour unchanged.
- [ ] **Step 2:** Run `node --check extension/src/panel.js`, then `npx vitest run extension/__tests__`. Expected: no syntax error; all tests PASS (the drift test now also sees `card-view.js` loaded; update `map.test.js`'s panel-script lookup only if it breaks).
- [ ] **Step 3:** Run `py scripts/build-ext.py`. Expected: `extension/dist/unpacked-dev` contains `src/lib/card-view.js`.
- [ ] **Step 4: Fixture walk-through by hand** (spec §10.10).
  - Load `extension/dist/unpacked-dev`, enable file URLs, open `extension/fixture/nia-nontieup.html` in a 1366×768 window.
  - Verify:
    - the "No claim sent" state, and Check giving `checked` with `ready?`/`ready` lines;
    - collapse to the 40 px tab and Esc;
    - Tab order: collapse → summary → lines → actions;
    - a line click scrolls and pulses;
    - the card doesn't cover the fixture's last row when docked;
    - under DevTools "Emulate prefers-reduced-motion" there is no transition.
  - Record what you checked in the report file. If you can't load an extension in your environment, say so plainly; the controller runs it.
- [ ] **Step 5:** Commit: `feat(extension): redesigned card with docking, collapse, keyboard and screen-reader support`.

---

### Task 6: SurveyOS Send steps

**Files:**
- Modify: `src/lib/portal/extension-bridge.ts`, `src/components/dialogs/NIAExportDialog.tsx`, `src/components/dialogs/UIICSummaryDialog.tsx`
- Test: `src/lib/portal/__tests__/extension-bridge.test.ts`

**Interfaces:**
- Produces:
  - `readyLine(portal: 'nia' | 'uiic', claimNo: string): string`
  - `NOT_INSTALLED_LINE: string`

- [ ] **Step 1: Write the failing tests:**

```ts
expect(readyLine('nia', '7700031260390039686')).toBe(
  'Ready: claim …9686 is waiting for the New India portal. Open the claim there and click Fill. Expires in 24 h. Sending another claim replaces this one.');
expect(readyLine('uiic', 'X-12')).toBe(
  'Ready: claim …X12 is waiting for the United India portal. Open the claim there and click Fill. Expires in 24 h. Sending another claim replaces this one.');
expect(NOT_INSTALLED_LINE).toBe('Fill the portal automatically with the SurveyOS Portal Fill extension.');
```

  The tail is the last 4 characters after uppercasing and removing non-alphanumerics, prefixed with `…`. For `X-12` that gives `…X12`, which is under 4 characters, so it's kept whole.

- [ ] **Step 2:** Run `npx vitest run src/lib/portal`. Expected: FAIL.
- [ ] **Step 3:** Implement both in `extension-bridge.ts`. In both dialogs:
  - (a) the `sent` line renders `readyLine(...)`;
  - (b) when `!extPresent` and the bill-check box is ticked, render one muted line `NOT_INSTALLED_LINE` where the Send section would be;
  - (c) **UIIC only:** ticking the bill-check box calls `setSource('billcheck')`.
- [ ] **Step 4:** Run `npx vitest run src/lib/portal`, then `npx tsc --noEmit -p .`. Expected: PASS, clean.
- [ ] **Step 5:** Commit: `feat(portal): clearer send steps in the NIA and UIIC dialogs`.

---

### Task 7: Live structure extractor

**Files:**
- Create: `scripts/portal-map/live-extract.js`
- Test: `extension/__tests__/live-extract.test.js` (new; lives with the other Vitest files so the runner picks it up)

**Interfaces:**
- Produces:
  - `extractFields(elements: Array<{ tag:'input'|'select'|'textarea', attrs: Record<string,string>, options?: string[], hidden: boolean }>) → { groups: Record<string, Array<{name, id, type, model, required?, pattern?, options?, hidden?, disabled_when?}>> }`. This is the same shape as `scripts/portal-map/*-survey.json`.
  - The group key is the model path minus its last segment, or `(no-model)`.
  - It never reads or emits `value`, `checked`, `selected`, `placeholder` content of rendered data, or text content.
  - Option values are emitted; option labels are not.
  - Radios emit their `value` attribute (an option code), matching the existing captures.
- The bottom of the file holds a DOM adapter. When `typeof document !== 'undefined'`, it maps `document.querySelectorAll('input,select,textarea')` to that element shape:
  - `hidden` = `el.closest('.ng-hide') !== null`;
  - attrs: `name`, `id`, `type`, `ng-model`/`data-ng-model`, `required`, `ng-pattern`/`data-ng-pattern`, `ng-disabled`/`data-ng-disabled`.
- It then evaluates to `JSON.stringify(extractFields(...))`, so Claude in Chrome's script tool returns the JSON.
- UMD export for Vitest: `module.exports = { extractFields }`.

- [ ] **Step 1: Write the failing tests:**
  - `groups by model parent`: two elements under `a.b.x`, `a.b.y` → `groups['a.b']` has 2 entries.
  - `never emits values`: an element with `attrs.value='MH12AB1234'` and `attrs.placeholder='Name'` → `JSON.stringify(result)` contains neither string. The exception is a radio, whose `value` attribute is emitted. Test that a `type=radio` with `value='Y'` emits `value:'Y'`, and that a `type=text` with `value='MH12AB1234'` doesn't.
  - `select options are codes only`: `options:['','Y','N']` is emitted as `['','Y','N']`.
  - `hidden flag`: `hidden:true` → entry `hidden:true`.
- [ ] **Step 2:** Run `npx vitest run extension/__tests__/live-extract.test.js`. Expected: FAIL.
- [ ] **Step 3:** Implement `live-extract.js`.
- [ ] **Step 4:** Run `npx vitest run extension/__tests__`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(portal-map): structure-only live extractor for the portal check`.

---

### Task 8: Release v0.4.0

**Files:**
- Modify: `extension/manifest.json` (`version` → `0.4.0`), `extension/README.md`, `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`, `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`

- [ ] **Step 1:** README: add a short "Check page" section (what it does, that it writes nothing, and the three modes in surveyor words). Add the Stage B checklist from spec §4.2 as "Live check (read-only)", steps 0–5 with the stop rules. Update the fixture walk-through for the new card states.
- [ ] **Step 2:** Run `py scripts/build-ext.py`. Expected: the 0.4.0 zip plus `dist/unpacked` and `dist/unpacked-dev`, each containing `src/lib/card-view.js` and both maps.
- [ ] **Step 3:** Run `npm test`. Expected: all pass. Then `npx tsc --noEmit -p .`: clean.
- [ ] **Step 4:** Vault: a Tasks.md "In Progress" line (Stage A done, Stage B next), and a Changelog entry for v0.4.0. Strict-decode both files after editing.
- [ ] **Step 5:** Commit: `chore(extension): v0.4.0 with page check and redesigned card`. No hosting deploy in this task: the overlay version bumps mean hosting must be redeployed, and that needs the owner's go-ahead.
