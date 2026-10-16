# Portal Fill — Live Verification, Portal Audit and Integration Roadmap — Design

**Date:** 2026-10-16
**Status:** Draft for owner approval
**Builds on:** `docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md` (rules E1–E10 stay binding), `docs/superpowers/plans/2026-10-16-portal-extension-roadmap.md` (Phases 0–6), `docs/portal-integration.md`.
**Author's note:** the owner asked for the scope to be set "as product designer and solutions architect" without a question round. Every decision below is the author's call unless marked **(owner)**.

---

## 1. Why this exists

Extension v0.3.0 (NIA non-tieup + UIIC claim survey) has never touched a live portal. It was built from saved copies of the portal pages captured in August and September. The owner is now in India with Chrome access for Claude and a logged-in NIA session. The obvious test, filling a claim that is both finished in SurveyOS and open on the portal, is **not available**:

- The only claim present in both systems is **already settled** on the portal.
- The NIA worklist holds 4 open non-tieup claims, but **none of them is in SurveyOS yet**.

So "send the claim and click Fill" cannot be run end to end today. This document defines how we prove the extension and the field maps are correct anyway, with **zero writes to a live claim**. It also defines what we learn from the portal while we have access, and what we build next.

**What success looks like:**
1. For every mapped field we know, from the live page, whether the extension can find it and write to it. We know this without writing.
2. The maps match today's portal, or we know exactly which entries to fix.
3. We have a ranked, evidence-based list of what surveyors still do by hand on the portal, and a build order.
4. The first real claim that goes through SurveyOS → portal is filled correctly at the first attempt.

## 2. Hard constraints

| # | Constraint | Consequence for this design |
|---|---|---|
| C1 | The portals are the insurer's **production system of record**. A stray Save, Validate, Quick Update or upload can change a real claim. | Nothing in Stages A–B writes to a live page. Only the owner clicks any portal button that commits. |
| C2 | No open claim exists in both SurveyOS and the portal. | The live tests must not depend on a matching claim. The full fill test waits for the next real claim (Stage D). |
| C3 | Portals are reachable **only from India** (F5 geo-block); Claude reaches them only through the owner's Chrome via Claude in Chrome, inside its own tab group. | Live work happens in sessions the owner starts, with the owner logged in. Claude never types credentials. Sessions can be cut short at any time, so each stage must be resumable and leave notes. |
| C4 | The portal session lives in the owner's tab, and a fresh tab shows only the splash. | The owner logs in inside the Claude tab group, or drags a logged-in tab into it. |
| C5 | DPDP: claim pages show insured names, mobiles, policy and registration numbers. | Captures keep **field structure only**: model paths, types, validation, options. No rendered values are kept or committed. Anything shown on screen during a session stays in the session. |
| C6 | Rules E1–E10 of the extension spec (never submit, claim-number match, keep existing values, nothing leaves the machine, no AI in the extension). | New features must keep them, or amend them explicitly here (see §6, I-6). |
| C7 | Cost must stay ~₹0 (BYOK, free tier). | No paid services. The only cost in the whole roadmap is the US $5 Chrome Web Store fee (Phase 6). |
| C8 | Portals change without notice. | Every stage re-checks the map against the live page instead of trusting the September capture. |
| C9 | UIIC: we don't know whether the owner holds a live UIIC login today. **(owner)** | UIIC stages are written so they can run later without changes. |

## 3. Scope

**In scope**
- **Stage A:** a read-only **Check page** mode in the extension, which reports per field whether a fill would work, writing nothing.
- **Stage B:** running Check page on the live NIA portal: the open worklist claims' survey pages, the settled claim's view, plus a fresh structure capture.
- **Stage C:** a read-only audit of NIA portal screens we never captured, with a tedium inventory.
- **Stage D:** acceptance on the first real claim (owner-driven).
- The same A–D for UIIC once a login is available.
- An integration roadmap (§6) ranked by surveyor time saved.

**Non-goals (this round)**
- Building document upload, tie-ups, National/OIC maps, or portal→SurveyOS import. These are ranked in §6 and each gets its own design.
- Any change to how SurveyOS computes the assessment.
- Publishing the extension to the Chrome Web Store.

**Anti-goals: a failure even if it "works"**
- Any value written into a live claim during testing.
- Any insured's personal data saved to disk, committed, or sent anywhere.
- A green ✓ in the card for a field that did not really take the value. That is the E8 honesty rule, the reason for the select-option fix in v0.3.0.
- A Check page result that says "fine" when the real Fill would fail. A check that can't be trusted is worse than none.

## 4. The verification approach (Stages A–D)

The idea in one line: **split "would this work?" from "do it".** Everything that can go wrong in a fill, except the final write, can be detected by reading the page.

| What can go wrong on a live page | Detectable without writing? | How |
|---|---|---|
| Panel doesn't appear (wrong host/route) | Yes | Panel present on the route |
| Map not loaded or out of date | Yes | Map version in the card |
| AngularJS scope not found (controller renamed) | Yes | Probe finds the scope |
| Claim number not read | Yes | Probe shows the page's claim number |
| A mapped field is missing on the page | Yes | Query each model path |
| Field found but not Angular-bound | Yes | `ngModel` controller present |
| Field disabled or readonly on this claim | Yes | Element state |
| Select has no option for the value we'd send | Yes | Compare the planned value with the live option values |
| Radio has no option for the value | Yes | Same, for radio values |
| Value rejected by the portal's validator | **No (v0.4.0)** | Reported `ready?`, confirmed only in Stage D (see §4.1, "No validator dry-run") |
| File slot present for the Excel | Yes | Input found and enabled (attaching is a write, so not tested) |
| Portal's computed totals recompute after the write | **No** | Stage D only |
| Excel accepted by Validate | **No** | Stage D only |

### 4.1 Stage A: "Check page" mode (build, ~1 session, ₹0)

A second button on the SurveyOS card, **Check page**, next to Fill. It runs everything Fill runs up to the write, then stops.

**Behaviour**
- **The Check button shows whenever the page has a map,** whatever the packet state. `render()` today returns early with "Send a claim from SurveyOS first." when there is no packet. That early return becomes "no packet: Fill is off, Check still works". This is a restructure of `render()`, not a new panel.
- **Three modes, chosen by packet state:**
  - **Structure check** (no packet, or `packetGate` refuses it because it's for another portal or flow): every mapped field and file slot is looked up. The result says found / bound / enabled / already has a value. For every mapped select and radio it lists the live option values.
  - **Value check** (packet for this portal and flow): the above, plus the planned value for each field (`planFill`, same transforms). Each select/radio planned value is checked against the live options.
  - **Wrong claim** (packet for this flow, but its claim number differs from the page's): it runs as a value check, and the header warns *"Packet is for claim X, this page is claim Y. Fill will refuse."* So a green Check on the wrong claim can never be mistaken for "safe to Fill".
- **What the card shows:**
  - Text and money values: never shown (they can carry personal data).
  - For `noOption`: the planned value and the live options, side by side (e.g. planned `09`, live `9, 10, 11…`). These are option codes, not personal data.
- **No validator dry-run in v0.4.0, author's call:** the portal's own validators may be custom directives with side effects, so Check never calls them.
  - Text and money fields that are found, bound and enabled are reported `ready?` ("the portal checks the value when it is written").
  - Revisit only if Stage D shows validator rejections are common.
- **Per-field result statuses:**
  - `ready`: found, bound, enabled, and for selects and radios the planned option exists
  - `ready?`: text or money; the format is checked only on write
  - `notFound`
  - `notBound`
  - `disabled`
  - `noOption` (with planned and live values)
  - `hasValue`: a person already typed something, so Fill would keep it (E4)
  - `skip`: the packet has no value for this field
- **File slots:** reported `found` / `notFound` / `disabled`. Whether a file can be attached is not tested, because attaching is a write.
- **Header line:** page route, map id and version, controller or scope found, claim number read (✓ / `(none)`), invoice count when the map has `invoiceCountPath`, and the mode.
- **"Copy report" link:** copies a plain-text report to the clipboard, with model paths, statuses and option codes only, no text or money values. The owner can paste it to Claude or into a file.

**Rules**
- **Zero writes is the whole point: no observable change to the page.**
  - Check never calls `$setViewValue`, `$render`, `$apply`, `$evalAsync`, `$digest` or `dispatchEvent`.
  - It never sets `.files`, `.value`, `.checked`, `.style` or any attribute on portal elements.
  - Reads (`angular.element(el).scope()`, `.controller('ngModel')`, `$modelValue`, `$parse(path)(scope)`, option and radio values) are allowed. Fill's probe already does the same reads.
  - The check is a pure function `planCheck(map, packet, read)` in `fill-core.js`, unit-tested for every status.
  - The DOM part in `filler.js` is a separate `check()` handler that only reads. A unit test with a recording fake `angular`/element proves `check()` calls none of the write APIs listed above.
- **Same map, same planner.** `planCheck` calls `planFill` and adds the lookup results, so a passing check runs the same planning code a Fill will.
- No new permissions, no network (E5 holds). Single packet storage (`packet` key) stays as it is in v0.4.0. Several packets is I-3, out of scope here.

**Done when:**
- unit tests cover every status and all three modes;
- the generated fixtures (`extension/fixture/nia-nontieup.html`, `uiic-claimsurvey.html`) give the expected reports by hand check. They carry no personal data, being generated from captures without values. Expected:
  - all fields `ready` / `ready?`
  - the UIIC hour select `ready` (fixture options are 00–23)
  - a field typed into first is `hasValue`;
- extension v0.4.0 is built.

### 4.2 Stage B: live check on NIA (owner + Claude, ~45 min, read-only)

**Pre-flight**
- The owner loads `extension/dist/unpacked` v0.4.0 and is logged in inside the Claude tab group.
- Claude in Chrome is allowed. That needs `mcp__claude-in-chrome` out of the project deny list, which is done.

**Steps**
0. **Resend the packet:** in SurveyOS, open the settled claim → NIA Excel → tick → Send to extension.
   - The packet stored earlier may have expired (E6: 24 h) or been cleared.
   - A fresh one makes the value check possible in step 2.
1. **Settled claim:** open it through Claim Search.
   - Record which route it opens on and whether the card appears.
   - If it opens on another route (expected), there's no card, and that's recorded.
   - If it opens on `#/WorklistSurveyNew`:
     - run **Check page only**. Expect mostly `disabled` / `hasValue`, which is recorded as "settled claims are locked".
     - **Do not click Fill on the settled claim.** Its claim number matches the packet, so E3 would *not* stop the write into the page's form.
2. **One open non-tieup claim:** open its survey page from the Worklist (the pencil icon).
   - Opening the page is viewing; nothing is committed until a portal button is clicked.
   - Then **Check page**. It runs in "wrong claim" mode: values are planned against this claim's live options, and the header says Fill will refuse.
3. **Fill once on the same page:** the expected result is a refusal that names both claim numbers, with nothing written. This proves E3 live.
   - Author's call: this is safe because the refusal happens before planning (`filler.js` `fill()` returns on mismatch before `planFill`).
4. **Structure capture:** run `scripts/portal-map/live-extract.js` (new, see §9) in the page through Claude in Chrome.
   - It emits the same JSON shape as `extract-fields.py` (`groups` → `{name, id, type, model, required, pattern, options, hidden, disabled_when}`), **without values**.
   - Diff it against `scripts/portal-map/nia-nontieup-survey.json` by model path: paths added or removed, and type, options or pattern changed per path.
   - Commit the new capture only if it differs, and only after a scan for values.
5. **Report:** paste the Check page report and the diff into `docs/portal-integration.md` §5 (new "Live check 2026-10-xx" subsection).
   - Each `notFound` / `notBound` / `noOption` becomes an overlay fix through `build-ext-map.py` (E9: never a hand-edited map).

**Stop rules:** if any step would need a click on Save, Validate, Quick Update, Submit, Upload, a declaration tick, or any confirm dialog, stop and hand back to the owner.

**Done when:** every one of the 23 NIA map fields and the `assessmentExcel` file slot has a live status, every field that isn't `ready` / `ready?` has a recorded cause and a fix or a ruling, and the map is regenerated if needed.

### 4.3 Stage C: read-only portal audit (Claude, ~45 min, NIA first)

**Screens:** worklist (filters, card fields), the survey page's tabs end to end (Quick Update, additional details, claim assessment, invoices, painting, declarations, mandatory and other documents, fee bill), Surveyor Fee, Claim Search results, a settled claim's view, the Maruti and KIA survey pages if one is visible.

**Per screen, record:**
- every input the surveyor fills by hand (structure only)
- which ones SurveyOS already knows (source field)
- which ones SurveyOS would need to start holding
- which are attestations (stay manual: liability; see memory "assessment is surveyor-made")
- upload slots, accepted types and size limits as shown on screen
- anything the portal shows that SurveyOS asks the surveyor to re-type (the reverse direction)

**Output:** `docs/portal-integration.md` §5 updated, plus a **tedium inventory** table. For each item: screen, count of fields, minutes per claim (author's estimate, marked as such), what it would take, and the §6 item it feeds.

**Never:** open a confirm dialog, change a filter that persists server-side, download files beyond the page itself, or keep any value.

### 4.4 Stage D: first real claim (owner, when the next claim arrives)

When the next NIA non-tieup claim is assigned:
1. Process it in SurveyOS as usual.
2. Run Check page, then Fill.
3. Review the amber fields and Validate yourself.
4. Note:
   - whether the portal's computed boxes recalculated
   - whether the Excel populated the grid
   - any `invalid` lines
5. Copy the card's report.

This is the acceptance test; nothing else proves the write path and the portal's own recalculation. UIIC follows the same steps on its first claim.

**Done when:** one real claim per portal went from SurveyOS to the portal with every sent field ✓ or explained, and the surveyor confirmed the portal accepted it.

## 5. Who does what

| Step | Owner | Claude |
|---|---|---|
| Logins, 2FA, CAPTCHA | ✓ | never |
| Load / reload the extension | ✓ | gives the exact folder |
| Navigate worklist, open a claim (view) | either | ✓ through Claude in Chrome |
| Check page, read the card, copy reports | either | ✓ |
| Fill on a matching live claim | ✓ (Stage D) | only when the owner says so, on that claim |
| Validate / Save / Submit / Upload / declarations | ✓ only | never |
| Map fixes, code, tests, docs | — | ✓ |
| Decisions marked **(owner)** | ✓ | proposes |

## 6. Integration roadmap after verification (ranked)

Ranked by surveyor minutes saved per claim (author's estimate), then by risk. Each item gets its own design and plan when picked up.

| # | Item | Why it ranks here | Size | Needs |
|---|---|---|---|---|
| I-1 | **Check page** (this doc, Stage A) | Unblocks everything; also becomes a permanent "portal changed?" detector | S | — |
| I-2 | **Map drift warning:** on every portal load the panel quietly runs the field-existence part of Check, and shows "portal changed: N fields not found" if any are missing | Portals change without notice (C8); surveyors find out at the worst moment otherwise | XS | I-1 |
| I-3 | **Several packets at once**, keyed by claim number (today a second Send overwrites the first) | A surveyor sends several finished claims a day; the card picks the packet matching the open claim automatically | S | spec change to E6 (expiry per packet) |
| I-4 | **Document attach** (Phase 5): survey report, bill-check report, estimate, invoice, reinspection report, RC/DL/policy into their portal slots | Largest remaining manual chore, every claim | M | Stage C slot inventory; Claim Documents index; packet size limits; DPDP note (documents are personal data) |
| I-5 | **Worklist assist:** on the worklist, mark claims that have a waiting packet and offer "open survey page" | Removes the find-the-claim step | XS | I-3 |
| I-6 | **Portal → SurveyOS intake:** read a new claim's details from the portal (claim no, policy no, insured, vehicle reg, loss/intimation dates, branch) and offer them to SurveyOS as a new-claim draft | Removes retyping at the *start* of every claim, today's other big duplicate entry | M | **(owner)** amends E5 ("no page content read beyond the claim number and target fields"). Data still moves only tab → tab on the same machine. |
| I-7 | NIA tie-ups (Maruti, KIA) per-row approval (Phase 3) | Hundreds of fields per tie-up claim | L | brainstorm + spec: dealer-line ↔ SurveyOS-row matching |
| I-8 | National Insurance (same TCS stack as NIA) | New insurer at low cost | S–M | a capture (owner login) |
| I-9 | UIIC observations/recommendation from the surveyor's own SurveyOS remarks, cleaned to the portal's pattern | Removes retyping; never AI-written | S | **(owner)** confirm wanted; uiicText space-vs-delete decision |
| I-10 | OIC, then private insurers | Coverage | per portal | captures; non-Angular writer if needed |

**Recommended order:** I-1 → Stage B/C → I-2 → I-3 → I-4 → I-6 → I-8 → I-7. The owner may reorder.

## 7. Risks and how the design handles them

| Risk | Handling |
|---|---|
| Check says ready, Fill later fails | Check reuses Fill's own planner and lookups; text and money fields report `ready?` rather than claiming the portal will accept them; Stage D is the real acceptance |
| Check itself changes the live page | Check only reads; no validator calls, no digest, no DOM writes; a recording-fake test proves `check()` touches no write API |
| Fill clicked on the settled claim (claim numbers match, so E3 doesn't stop it) | Stage B step 1 forbids Fill there; the card's Check header names the claim so the owner sees which one is open |
| Claude clicks something that commits | Stop rules in §4.2 and §4.3; Claude never clicks Save/Validate/Submit/Upload/Quick Update/declarations/confirm dialogs |
| PII leaks into the repo | Captures are structure-only; a value scan runs before any capture is committed; reports carry model paths and statuses only |
| Session cut off mid-stage | Each stage writes its notes to `docs/portal-integration.md` as it goes; stages restart from the last recorded step |
| Owner's time | Stage B ~45 min, Stage C ~45 min, both can run in one sitting with the owner only logging in and watching |

## 8. Owner decisions needed

1. **(owner)** Is it OK for Claude to open the **open** worklist claims' survey pages (view only, no clicks that commit) for Stage B and C? The design assumes yes.
2. **(owner)** Is there a UIIC login available now, or does UIIC wait?
3. **(owner)** I-6 (portal → SurveyOS intake) needs E5 widened. Approve the direction now, or decide when it's picked up?
4. **(owner)** I-9 and the `uiicText` question: should punctuation become a space (`MIDC Nashik`) or be deleted (`MIDCNashik`)?

## 9. Left to the builder

- Card layout for the Check report, matching the existing card styles in `panel.css`.
- Status icon glyphs and wording, consistent with the existing `icon` map in `panel.js`.
- The in-page extractor, settled as author's call: `scripts/portal-map/live-extract.js` is a standalone snippet, not shipped in the extension. It is run through Claude in Chrome's page-script tool, and its output matches `extract-fields.py`'s shape so one diff works for both. It is a second implementation of the same rules, kept short. Add a unit test that runs it in node's `vm` against `extension/fixture/nia-nontieup.html` parsed by a minimal DOM. If no DOM library is installed, compare its output by hand on the fixture in Stage A instead; add no dependency.

## 10. Author's calls made after the builder check

- The Check button is always shown when a map matches, and runs in structure / value / wrong-claim mode. Fill keeps its existing gates.
- There is no validator dry-run in v0.4.0. Text and money fields report `ready?`.
- The zero-writes bar is "no observable change". Reads, including `$parse`, are allowed; `$apply` / `$evalAsync` / `$digest` are not.
- File slots are reported found / not found / disabled only.
- Stage B starts by resending the packet. Fill is never clicked on the settled claim.
- `noOption` shows planned and live option codes, never text or money values.
- A single `packet` storage key stays. Several packets is I-3.
