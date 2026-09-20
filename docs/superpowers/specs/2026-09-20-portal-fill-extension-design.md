# Portal Fill Extension v1 — Design

**Date:** 2026-09-20
**Status:** Draft — awaiting review
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
| E3 | **Claim number must match** between the packet and the open page or nothing fills. |
| E4 | **Existing non-empty portal values are kept**, listed in the panel, and highlighted amber on the page. The surveyor decides. |
| E5 | **Nothing leaves the machine.** The packet moves SurveyOS tab → `chrome.storage.local` → portal tab. The only network call the extension makes is fetching its field map from our own hosting. No page content is read beyond the claim number and the target fields. (DPDP: the packet holds insured PII — mobile, email.) |
| E6 | **Packet expires.** Cleared after a successful fill or after 24 h, whichever first. |
| E7 | **No AI in the extension.** Field maps are written by us from captured portal HTML. |
| E8 | The extension **fails per field, not per page.** A field whose model path no longer exists is reported and skipped; the rest still fill. |

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
| `claimantMobile`, `claimantEmail` | insured contact | Quick Update |
| `provisionAmount` | net assessed | Quick Update (`surveyorAccessedAmount`) |
| `expectedRepairDate` | if recorded, else omitted | Quick Update |
| `invoiceInNameOfNIA`, `gstApplicable`, `vendorInvoiceNo`, `vendorInvoiceDate` | bill check details | Invoice 1 |
| `paintingEstimate`, `paintingAssessed` | `niaPainting()` — **standard policy only**; omitted on nil-dep (R11) | Invoice 1 painting |
| `noOfInvoices` | `1` | Claim Assessment |
| `netSalvage`, `compulsoryExcess`, `voluntaryExcess`, `otherDeductions`, `towingCharges` | assessment summary | Claim Assessment |
| `nilDepCover`, `engineProtectCover`, `consumableCover`, `keyProtectCover`, `returnToInvoiceCover` | add-on flags | Claim Assessment |
| `feeInvoiceNo`, `feeInvoiceDate`, `professionalFee`, `photosAmount`, `conveyanceAmount`, `feeOthers`, `feeGstApplicable`, `feeHsn`, `feeGstPercent` | `feeBill` | Survey Fee Bill |

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

### 3.3 The extension — new repo `surveyos-portal-fill`, MV3

```
manifest.json
src/relay.ts        content script @ https://motorsurveyos-in.web.app/*
src/panel.ts        content script @ https://web.newindia.co.in/NIABancsPortal/*
src/filler.ts       main-world script, injected by panel via chrome.scripting
src/background.ts   map fetch + cache, packet expiry
src/map.ts          types + resolveMap()
maps/nia-nontieup.json   (source of truth; also published to our hosting)
```

Permissions: `storage`, `scripting`, `alarms`; host permissions for exactly
the two origins above. No `tabs`, no `<all_urls>`, no `webRequest`.

**Relay.** Listens for `message` events where `event.origin === location.origin`
and `data.type === 'surveyos:portal-packet'`. Validates the packet shape
(closed union of fields, string claimNo, ≤ 1 MB files). Writes
`{ packet, storedAt }` to `chrome.storage.local`. Sets the marker attribute
on load.

**Panel.** A fixed, small card injected at the bottom-right of the portal
page, only on `#/WorklistSurveyNew`. States:

- *No packet* — "Send a claim from SurveyOS first."
- *Packet ready* — claim no, built time, field count, file count, **Fill** button.
- *Filling / done* — per-field result list: filled ✓, kept (existing value) ⚠,
  not found ✗. "Clear packet" link.

The Panel never reads the page itself; it asks the Filler.

**Filler** (main world — the only place `angular` is reachable). Injected
with `chrome.scripting.executeScript({ world: 'MAIN' })`; talks to the Panel
via `window.postMessage` with a per-injection nonce. Protocol:

1. `probe` → returns `{ claimNo, controllerFound }`, reading the claim
   number from the map's `claimNoPath`.
2. `fill(packet, map)` → for each canonical field in the packet:
   - resolve `map.fields[name]` → `{ modelPath, kind, transform?, options? }`
   - find the input: `[ng-model="<modelPath>"]`; missing → `notFound`
   - read current scope value via `$parse(modelPath)(scope)`; non-empty and
     ≠ ours → `kept`, add amber outline
   - else assign via `$parse(modelPath).assign(scope, value)` inside
     `scope.$apply()`; for radios/selects match on the map's `options`
   - files: `new File([bytes], name, { type })` → `DataTransfer` →
     `input.files = dt.files` → `dispatchEvent(new Event('change', { bubbles: true }))`.
     NIA's `readExcel` runs on `change`, so the portal parses the sheet
     itself; the surveyor then clicks **Validate**.
3. Returns the result list. Nothing else is touched.

Guard order in `fill`: controller present → claim number equal (trimmed,
case-insensitive) → then fields. Any guard failure returns before the first
write.

### 3.4 The field map — `maps/nia-nontieup.json`

```json
{
  "portal": "nia", "flow": "nontieup", "version": 3,
  "route": "#/WorklistSurveyNew",
  "controller": "surveyorWorklistSurveyCtrl",
  "claimNoPath": "surveyorData.worklist.claimNumber",
  "fields": {
    "surveyPlace": { "modelPath": "surveyorData.worklist.quickUpdate.placeOfSurvey", "kind": "text", "maxLen": 100 },
    "surveyTime":  { "modelPath": "...surveyTime", "kind": "text", "transform": "hhmm" },
    "nilDepCover": { "modelPath": "...claimAssessment.nilDepreciationCover", "kind": "radio", "options": { "true": "Y", "false": "N" } },
    "assessmentExcel": { "kind": "file", "selector": "input[type=file][ng-model*='xlsTemplate']" }
  }
}
```

Model paths are taken from `scripts/portal-map/nia-nontieup-survey.json`;
the map is derived from it by hand and checked into both repos. Transforms
are a closed set implemented in `filler.ts` (`hhmm`, `ddmmyyyy`, `money2dp`,
`yn`).

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
| 0 | Niraj + brother, a closed claim | unpacked, dev mode; Fill → Validate → save page |
| 1 | 3–5 surveyors | zipped CRX + install note; map v-bumps as needed |
| 2 | all subscribers | Chrome Web Store, unlisted link from the dialog |
| 3 | — | listed, after a month without a `notFound` report |

Store submission needs a privacy policy page (we have `/privacy`) and a
justification for the two host permissions. Cost: $5 developer registration,
nothing recurring; hosting the map JSON is static.

---

## 5. Tests

**SurveyOS** (Vitest): `buildPortalPacket` — canonical key set, omits
painting on nil-dep, claimNo trimmed, throws when claimNo empty, file present
and base64.

**Extension** (Vitest, no browser): packet validator accepts/rejects; map
resolver; each transform; the `fill` decision function
`decide(current, incoming) → 'fill' | 'kept'` (pure, extracted from the
Filler).

**Manual**: Stage 0 above, plus: wrong claim open → refuses; pre-filled
place → kept + amber; map with one bad path → one `notFound`, others fill;
portal tab without a packet → idle state.

---

## 6. Out of scope

- Document attachment (RC, DL, photos, reports) — v2, needs the Claim
  Documents index (`2026-09-20-claim-documents-design.md`)
- UIIC — same engine, needs its map and a paste-block check (scope writes
  bypass paste blocks, to be confirmed on a live page)
- Maruti / KIA tie-ups — per-row approval flow, different map shape
- Supplementary estimate file, invoices 2–3
- Firefox / Edge store listings (Edge loads Chrome extensions unpacked)
