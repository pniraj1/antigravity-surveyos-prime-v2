# Portal Fill Extension v1 — Design

**Date:** 2026-09-20
**Status:** Implemented — Stage 0 pending
**Scope:** A Chrome extension that fills the New India non-tieup survey page
from a finished SurveyOS claim, plus one small hand-off in SurveyOS. No
portal credentials touched, nothing submitted.

Portal facts below come from `docs/portal-integration.md` §5 and the maps in
`scripts/portal-map/nia-*.json`.

---

## 1. The problem

After SurveyOS produces the report, the surveyor opens the insurer's portal
and types the same figures again — survey date and place, invoice details,
deductions, fee bill — then attaches the Excel we already generated. The
UIIC panel and NIA Excel dialog cut this to copy-paste. The extension cuts
it to one click, on the surveyor's own logged-in session.

Why an extension and not a script or a server: the portals are AngularJS
SPAs behind the surveyor's login, geo-blocked, with no API. Only code
running inside the surveyor's own browser tab can write to them, and only
an extension can run there without being pasted in by hand every time.

---

## 2. Rules

| # | Rule |
|---|------|
| E1 | **Never touches credentials.** No login page permission, no reading of password fields, no storage of anything but the packet and the map. |
| E2 | **Never clicks Validate, Submit, Save, or any upload-confirm.** The surveyor does every commit. The extension writes field values and attaches files; that is all. |
| E3 | **Claim number must match** between the packet and the open page or nothing fills. Compared after normalising both (uppercase, non-alphanumerics stripped). The refusal shows both numbers — a mismatch is also how a wrong claim number typed into SurveyOS gets caught. |
| E4 | **Existing portal values are kept**, listed in the panel, and highlighted amber on the page. The surveyor decides. "Existing" means *set by a person*: the map declares each field's `empty` value (the portal's default — `N` on radios, `0` or `""` on amounts, `null`) and only a value that differs from it counts as existing. Without this every pre-filled default would be kept and nothing would fill. |
| E5 | **Nothing leaves the machine.** The packet moves SurveyOS tab → `chrome.storage.local` → portal tab. The only network call the extension makes is fetching its field map from our own hosting. No page content is read beyond the claim number and the target fields. (DPDP: the packet holds insured PII — mobile.) |
| E6 | **Packet expires.** Cleared after a successful fill or after 24 h, whichever first. |
| E7 | **No AI in the extension.** Field maps are written by us from captured portal HTML. |
| E8 | The extension **fails per field, not per page.** A field whose model path no longer exists is reported and skipped; the rest still fill. |
| E9 | **The map is generated, never typed.** `scripts/portal-map/build-ext-map.py` derives `nia-nontieup.json` from `nia-nontieup-survey.json` plus a small canonical-name overlay; a hand-edited model path is a bug. The overlay is the only file we write. |
| E10 | **Writes go through Angular's own input path.** `ngModelController.$setViewValue(value)` + `$render()`, inside `scope.$apply` (or `$evalAsync` only when a digest is already running), so a throwing write surfaces as an `error` step and `ng-change`, validators and the portal's computed totals run exactly as if typed. Never a bare scope assignment. |

---

## 3. Design

Three parts. SurveyOS knows the claim. The extension knows the portal. The
packet between them is portal-neutral.

```
SurveyOS tab ──postMessage──▶ Relay (content script, our origin)
                                    │ chrome.storage.local
Portal tab   ◀──fills──── Filler (main world) ◀── Panel (content script, portal origin)
                                    ▲
                        field map JSON (fetched from our hosting, cached)
```

### 3.1 The packet — `src/lib/portal/packet.ts` (SurveyOS)

One pure function, `buildPortalPacket(claim: ClaimData, opts): PortalPacket`.

```ts
export interface PortalPacket {
  v: 1;
  portal: 'nia';
  flow: 'nontieup';
  claimNo: string;                   // policy.claimNumber, trimmed
  builtAt: string;                   // ISO
  fields: Partial<Record<CanonicalField, string | number | boolean>>;
  files: Array<{ slot: 'assessmentExcel'; name: string; mime: string; base64: string }>;
}
```

`CanonicalField` is a closed union. v1 set, with the SurveyOS source:

| Canonical field | Source | Portal section |
|---|---|---|
| `surveyDate`, `surveyTime`, `surveyPlace` | `surveyDatetime` / `placeOfSurvey` | Quick Update |
| `claimantMobile` | insured contact | Quick Update |
| ~~`claimantEmail`~~ | in `CANONICAL_FIELDS` but SurveyOS's policy record has no email — not sent; would send if a future field supplies it | — |
| ~~`provisionAmount`~~ | `surveyorAccessedAmount` is **disabled** on ordinary claims (enabled only for theft / total loss) — not sent | — |
| ~~`expectedRepairDate`~~ | SurveyOS holds no such field — not sent | — |
| `invoiceInNameOfNIA`, `gstApplicable`, `vendorInvoiceNo`, `vendorInvoiceDate` | bill check details | Invoice 1 |
| `paintingEstimate`, `paintingAssessed` | `niaPainting()` — **standard policy only**; omitted on nil-dep (R11) | Invoice 1 painting |
| `noOfInvoices` | `1` | Claim Assessment |
| `netSalvage`, `compulsoryExcess`, `voluntaryExcess` | assessment summary | Claim Assessment |
| ~~`otherDeductions`~~, ~~`towingCharges`~~ | **not sent in v1** — SurveyOS has towing only for total-loss claims | — |
| ~~add-on covers~~ | the five cover fields are **amounts**, not flags; SurveyOS holds none — surveyor types them | — |
| `feeInvoiceNo`, `feeInvoiceDate`, `professionalFee`, `photosAmount`, `conveyanceAmount`, `feeOthers`, `feeGstApplicable`, `feeHsn`, `feeGstPercent` | `feeBill` | Survey Fee Bill |
| *(derived)* `surveyDateRadio` | from `surveyDate`: one of the three portal dates, else `Others` | Quick Update |
| *(derived)* `paintingWork` = `Consolidated` | only when `paintingAssessed` is sent (standard policy) | Invoice 1 painting |

Exact `ClaimData` paths are resolved at plan time; the table fixes the
canonical names. Files: the NIA Excel from `buildNiaWorkbook`, base64
(≈10–30 KB).

**Not in the packet, by design:** the 12 declarations (surveyor
attestations — they tick them), documents (v2), remarks (free text the
surveyor writes on the portal), anything for Maruti/KIA.

### 3.2 Hand-off in SurveyOS — `NIAExportDialog`

The Relay marks the page: `document.documentElement.dataset.surveyosExt = '<version>'`.
When that attribute is present the dialog shows a third block:

> **3 · Send to portal** — *Send to extension* button

Click → `buildPortalPacket` → `window.postMessage({ type: 'surveyos:portal-packet', packet }, location.origin)`.
The Relay replies `surveyos:portal-packet-ack` and the dialog shows
"Ready — open the claim on the New India portal and click Fill." Sits behind
the same bill-check gate as the Excel (R12); the packet carries billed
figures.

Without the extension, nothing changes.

### 3.3 The extension — `extension/` in this repo, MV3

One repo, one map, one dev. `extension/` has its own `package.json` and
Vitest config; `npm run build:ext` produces the unpacked folder and the zip.
The map is published to hosting by copying `extension/maps/` into
`public/portal-maps/` at build time. Shared libs (packet validator, fill-core,
map resolver) carry a UMD shim so Vitest can import them directly without a
bundler.

```
extension/
manifest.json
src/relay.js         content script @ https://motorsurveyos-in.web.app/*
src/panel.js         content script @ https://web.newindia.co.in/NIABancsPortal/*
src/filler.js        main-world script, declared in the manifest
src/background.js    map fetch + cache, packet expiry
src/lib/             packet-validate, fill-core, map (UMD, shared with Vitest)
maps/nia-nontieup.json   (generated — see E9; also published to our hosting)
fixture/nia-nontieup.html (captured portal page + AngularJS 1.x, for local tests)
```

The Filler is declared in the manifest's `content_scripts` with
`"world": "MAIN"` (Chrome 111+, `minimum_chrome_version` in the manifest) —
not injected at runtime via `chrome.scripting`. Permissions: `storage`,
`alarms`; host permissions for exactly the two origins above. No `tabs`,
no `scripting`, no `<all_urls>`, no `webRequest`.

**Relay.** Listens for `message` events where `event.origin === location.origin`
and `data.type === 'surveyos:portal-packet'`. Validates the packet shape
(closed union of fields, string claimNo, ≤ 1 MB files). Writes
`{ packet, storedAt }` to `chrome.storage.local`. Sets the marker attribute
on load.

**Panel.** A fixed, small card injected at the bottom-right of the portal
page, only on `#/WorklistSurveyNew`. The SPA changes route without a reload,
so the panel listens for `hashchange`: it removes itself when the route
leaves `#/WorklistSurveyNew` and re-boots on return. States:

- *No packet* — "Send a claim from SurveyOS first."
- *Packet ready* — claim no, built time, field count, file count, **Fill** button.
- *Filling / done* — per-field result list: filled ✓, kept (existing value) ⚠,
  not found ✗. "Clear packet" link. The packet stays in storage on a partial
  fill, so **Fill** re-enables and the surveyor can retry.

The Panel never reads the page itself; it asks the Filler.

**Filler** (main world — the only place `angular` is reachable). Declared in
the manifest with `"world": "MAIN"` (§3.3), so it runs on every load rather
than being injected on demand; talks to the Panel via `window.postMessage`.
Protocol:

1. `probe` → returns `{ claimNo, controllerFound }`, reading the claim
   number from the map's `claimNoPath`.
2. `fill(packet, map)` → for each canonical field in the packet:
   - resolve `map.fields[name]` → `{ modelPath, kind, transform?, options? }`
   - find the input: `[ng-model="<modelPath>"]`; missing → `notFound`
   - read current scope value via `$parse(modelPath)(scope)`; differs from
     the map's `empty` and ≠ ours → `kept`, add amber outline (E4)
   - else `angular.element(input).controller('ngModel')` →
     `$setViewValue(value)`, `$render()`, inside `scope.$apply` (or
     `$evalAsync` if a digest is already running) (E10); radios/selects match
     on the map's `options`; a field with no ngModelController (a jQuery
     widget) → `manual`, listed for the surveyor; a throwing write → `error`
   - files: `new File([bytes], name, { type })` → `DataTransfer` →
     `input.files = dt.files` → `dispatchEvent(new Event('change', { bubbles: true }))`.
     NIA's `readExcel` runs on `change`, so the portal parses the sheet
     itself; the surveyor then clicks **Validate**.
3. Returns the result list. Nothing else is touched.

Guard order in `fill`: controller present → claim number equal after
`normaliseClaimNo` (E3) → then fields. Any guard failure returns before the
first write. The panel shows "Invoice 1 of N" when the page holds more than
one invoice; only invoice 1 is filled.

**Known-weak field:** the Quick Update survey date is a radio of the last
three days plus "Others" with a date picker. A survey older than three days
needs "Others" and the picker; if the picker is not Angular-bound it comes
back `manual`. Stage 0 decides whether we drive it or leave it.

### 3.4 The field map — `maps/nia-nontieup.json`

Shape (paths illustrative — the real ones come out of the generator, E9):

```json
{
  "portal": "nia", "flow": "nontieup", "version": 3,
  "route": "#/WorklistSurveyNew",
  "controller": "<from capture>",
  "claimNoPath": "<from capture — or 'sessionStorage:<key>' if the number is not in scope>",
  "fields": {
    "surveyPlace": { "modelPath": "<…>", "kind": "text", "empty": "", "maxLen": 100 },
    "surveyTime":  { "modelPath": "<…>", "kind": "text", "empty": "", "transform": "hhmm" },
    "nilDepCover": { "modelPath": "<…>", "kind": "radio", "empty": "N", "options": { "true": "Y", "false": "N" } },
    "assessmentExcel": { "kind": "file", "selector": "<…>" }
  }
}
```

`build-ext-map.py` reads the extractor's JSON, joins it with
`scripts/portal-map/nia-nontieup.overlay.json` (canonical name → the
extractor's model path, plus `empty`/`transform`/`options`), and fails if an
overlay path is not in the capture. Where the claim number lives is the
first thing Stage 0 checks; the generator has a `claimNoPath` override for
that — confirmed from the capture as
`surveyorData.worklist.viewClaimDetails.claimDetails.claimNumber`, with
`sessionStorage:claimNoForWorklist` as the fallback. Transforms are a closed
set of *names* implemented in `filler.js` (`hhmm`, `ddmmyyyy`, `money2dp`,
`yn`) — the map never carries code, which keeps it "data" for the Web
Store's remote-code rule.

**Delivery.** Bundled copy in the extension; the background fetches
`https://motorsurveyos-in.web.app/portal-maps/nia-nontieup.json` on install
and daily (`alarms`), keeps it if `version` is higher. Map fix = JSON
publish, no extension release, no store review.

### 3.5 When the portal changes

| Change | Effect | Fix |
|---|---|---|
| a model path renamed | that field → `notFound`, rest fill | map JSON |
| a section restructured | several `notFound` | map JSON |
| controller renamed / Angular removed | `probe` fails, Fill disabled with "portal changed — copy from the dialog for now" | extension release |

The SurveyOS dialog is untouched by any of this, so the surveyor is never
worse off than today. When surveyors report `notFound`, we re-capture the
page with `extract-fields.py` and diff against the map.

---

## 4. Rollout

| Stage | Who | How |
|---|---|---|
| 0 | Niraj + brother, a closed claim | Fixture walk-through in `extension/README.md` first (no portal needed); then unpacked, dev mode; Fill → Validate → save page |
| 1 | 3–5 surveyors | zipped CRX + install note; map v-bumps as needed |
| 2 | all subscribers | Chrome Web Store, unlisted link from the dialog |
| 3 | — | listed, after a month without a `notFound` report |

Store submission needs a privacy policy page (we have `/privacy`) and a
justification for the two host permissions. Cost: $5 developer registration,
nothing recurring; hosting the map JSON is static.

---

## 5. Tests

**What shipped:** pure-logic Vitest suites, no browser, no Playwright —
packet, validator, fill-core and map (21 + 8 tests).

**SurveyOS** (`src/lib/portal/__tests__/`, 8 tests): `buildPortalPacket` —
canonical key set, omits painting on nil-dep, claimNo trimmed, throws when
claimNo empty, file present and base64 (`packet.test.ts`); the SurveyOS-side
hand-off (`extension-bridge.test.ts`).

**Extension** (`extension/__tests__/`, 21 tests): packet validator
accepts/rejects; map resolver; each transform; the `fill` decision function
`decide(current, incoming) → 'fill' | 'kept'` (pure, extracted from the
Filler).

**Fixture** (`extension/fixture/nia-nontieup.html`, manual, not an automated
suite — see `extension/README.md`): the captured page markup with AngularJS
1.x loaded and a stub controller that mirrors the real model paths. Filler
runs against it: fills, `kept` on a human-set value, `notFound` on a renamed
path, the ng-change log observed, Excel `change` event dispatched. This is
where the fill engine is exercised — live checks through the geo-block are
slow and go through a screen-share, so Stage 0 confirms, not discovers.

**Manual** (Stage 0): claim number location confirmed; wrong claim open →
refuses and shows both numbers; pre-filled place → kept + amber; date
picker behaviour; Validate passes on the attached Excel; save page.

---

## 6. Out of scope

- Document attachment (RC, DL, photos, reports) — v2, needs the Claim
  Documents index (`2026-09-20-claim-documents-design.md`)
- UIIC — same engine, needs its map and a paste-block check (scope writes
  bypass paste blocks, to be confirmed on a live page)
- Maruti / KIA tie-ups — per-row approval flow, different map shape
- Supplementary estimate file, invoices 2–3
- Firefox / Edge store listings (Edge loads Chrome extensions unpacked)
