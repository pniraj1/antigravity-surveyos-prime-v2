# Session: 2026-10-17 (Claude): Portal Fill v0.4.0 (page check and redesigned card)

## What changed
Stage A of `docs/superpowers/specs/2026-10-16-portal-live-verification-and-audit-design.md`, built from the plan `docs/superpowers/plans/2026-10-17-portal-check-page-and-card-ux.md`:
- **Check page:** reports, field by field, whether Fill would work on the open portal page. It writes nothing.
- **Redesigned card:** docked right, collapsible, keyboard and screen-reader support, surveyor copy, problems listed first, jump to a field. It re-reads the page's claim number every 2 s while idle.
- **SurveyOS Send steps:** a clearer Ready line, a "not installed" hint, and the UIIC view switching to Bill check on tick.
- **`scripts/portal-map/live-extract.js`:** a structure-only capture for Stage B.

Commits c3ccff68..8a4482d6 on `main`. 1515 tests, tsc clean. **Not deployed; the card hasn't been tried in a browser.**

Execution: subagent-driven, with a review of each task. Five tasks needed one fix round each. An Opus final review followed, then one fix wave (8 items) and a scoped re-review.

## Owner next steps
1. Reload the extension from `extension/dist/unpacked-dev`, enable file URLs, and run the README fixture walk-throughs (NIA steps 1–12, UIIC steps 1–8).
2. Approve a hosting deploy: the map versions moved to NIA 3 and UIIC 2.
3. Stage B: the live read-only check on the NIA portal (README "Live check").

## Rulings made
- Setup: Ruling: no worktree; commit on main — owner's standing rule (memory no-branches-work-on-main) — cost if wrong: revert commits instead of deleting a branch.
- | T4 self | cardView state precedence across phase/fill/check/packet not stated | Ruling: precedence = loading → probeFailed → filling → checking → fill result (fillFailed/needsYou/filled) → check result (checked) → noPacket (incl. expired) → otherPortal → wrongClaim → ready — results of the user's last action win over resting states; probe failure blocks everything — cost if wrong: a state shows the wrong copy; tests pin it. |
- | T4 self | card-view needs normaliseClaimNo/packetGate from fill-core in both node tests and isolated world | Ruling: card-view resolves `const F = typeof module !== 'undefined' && module.exports ? require('./fill-core.js') : globalThis.SxFill` — cost if wrong: none |
- | T4 self | Fill step lines need labels: steps carry `name` | Ruling: label = map.fields[name]?.label ?? name; file slot label 'Excel file' |
- | T5 self | no unit tests for DOM rendering (no jsdom, no new deps) | Ruling: plan-mandated per spec §4.1/§10.10 — node --check + all pure logic in T4 tests + manual fixture walk-through — cost if wrong: rendering slip found at owner walk-through |
- | T5 step 4 | fixture walk-through needs an unpacked extension loaded in Chrome | Ruling: subagents can't load extensions; implementer reports "not run"; controller hands the walk-through to the owner at the end (owner reloads dist/unpacked-dev) — cost if wrong: UI bugs surface at owner check, before any live use |
- | T8 | version 0.4.0; no deploy | Ruling: hosting deploy excluded — owner approval — cost if wrong: hosted maps lag bundled (bundled wins) |
- Task 4: Ruling: card shows `planned` only for `noOption` lines (planCheck also returns it for other choice statuses) — option codes only, keeps the card quiet — cost if wrong: none.
- Task 4: Ruling: when the page claim number reads empty, wrongClaim body says "This page's claim number couldn't be read. You sent claim {packetTail}." instead of "This page is claim ." — avoids a blank tail — cost if wrong: copy only.
- Task 3: Ruling: check's lookup strips AngularJS ng-options type prefixes (string:/number:/boolean:) from option values before comparison — reviewer ⚠️: ng-options selects would otherwise report false noOption — cost if wrong: a real 'string:...' code would be misread; Stage B confirms the live option format. Fill is unchanged.
- Task 4: Ruling: secondary labels follow spec §10.3 — 'Check page' (not 'Check this page'), 'Show all lines'/'Show fewer lines' — spec names them — cost if wrong: copy only.
- Task 4: ⚠️ resolved by controller: Fill `why` is validator names (invalid) or an exception string (error); card-only, never in reportText — acceptable. Spec §10.3 "No map" state is unreachable by design (pickMap returns null → no card is booted), so cardView needs no noMap state — Ruling: leave out — cost if wrong: none.
- Task 5: Ruling: implementer added to card-view.js (with tests) a `checkFailed` state (check ok:false crashed buildLines), `line.tone`, and `legend` (after Fill only) — keeps decisions out of the untested renderer, per dispatch — cost if wrong: none.
- Task 5: Ruling: line "pulse" is a steady 1.5 s outline restoring the field's prior outline, not an animated pulse — global constraint allows only transform/opacity motion — cost if wrong: slightly less noticeable highlight.
- Task 6: Ruling: UIIC bill-check checkbox now always visible (was inside extPresent &&), Send block still gated on extPresent — otherwise the not-installed line (spec §10.2 row 2a) was unreachable — cost if wrong: an extra tick box in the UIIC dialog for users without the extension.
- Task 7: Ruling: live-extract emits select options as codes (brief) while extract-fields.py stores {value,text}; the Stage B diff compares option values only (map python {value}→value) — option labels can carry rendered text and aren't needed — cost if wrong: a label-only portal change goes unnoticed (doesn't affect fills).
- Task 8: Ruling: spec §4.2 step 3 ("click Fill, expect refusal") conflicts with spec §10.3 (Fill disabled on a different claim). §10.3 wins — later, safer design; E3 refusal in the page script stays unit-tested (filler-check "fill still refuses a mismatched claim"). Live step 3 becomes "confirm Fill is disabled with the reason and both tails"; spec §4.2 step 3 amended to match — cost if wrong: the page-script refusal is not proven live (it is unit-tested).
- Final: Ruling: re-graded Minor 3 (invoice count dropped from card) to Important — on a multi-invoice NIA claim nothing tells the surveyor invoices 2..N stay untouched — fix wave.
- Final: Ruling: re-graded Minor 4 (probe failure shows developer text "controller … not found — portal changed?") to Important — the likeliest failure when a portal changes, breaks §10.8 copy rules — fix wave.
- Final: Ruling: re-graded Minor 5 (Check result is a dead end: no Show all lines, no Check again) to Important — surveyor can't see ready lines or re-run without reload — fix wave.
- Final: Ruling: Minor 1 (report header: extension version, invoices, scope found, "(none)") and Minor 6 (README: name the radio-date values to scan) folded into the fix wave — cheap, used in Stage B.
- Final: parked — check()'s AngularJS-absent reason still developer text ("AngularJS not found on this page") — Ruling: rare (page not loaded), shown only after an explicit Check; fix with the next card touch — cost if wrong: one confusing message on a half-loaded page.
- Final: parked — re-probe interval keeps running if the portal removes the card outside onRoute — Ruling: harmless read-only probe every 2 s until route change/reload — cost if wrong: negligible CPU.
- Final: parked — one timed-out probe briefly flips the card to "Couldn't read page" until the next probe — Ruling: honest state, self-heals within 2 s — cost if wrong: a momentary red badge.

## Deferred minors
- Task 2: minor (deferred): precedence test picks fields by Object.keys order; no test pins structure-mode non-matching options staying `ready`
- Task 3: minor (deferred): check's reader duplicates fill's current/radioValues readers (extract makeRead)
- Task 3: minor (deferred): no page-script test for notFound/notBound paths (covered at planCheck level)
- Task 4: minor (deferred): file-row mapping duplicated in buildLines; unknown-status rank vs comment; String.replace $-pattern in why/planned; circular LINE_COPY test; mode fallthrough to wrong-claim text
- Task 5: minor (deferred): Copy-label race (second click within 2 s sticks "Copied")
- Task 5: minor (deferred): focusin/resize listeners added per boot, never removed (slow leak across route changes)
- Task 5: minor (deferred): focusResult can target hidden summary after auto-collapse; auto-collapse later persisted by saveUi
- Task 5: minor (deferred): aria-live list toggled hidden+refilled same tick may not announce; failure states announce nothing
- Task 5: minor (deferred): aria-label on generic span not reliably announced (brief-mandated)
- Task 5: minor (deferred): fillFailed body shows Filler's raw "claim mismatch — page: X, packet: Y" (uses "packet"; normally unreachable)
- Task 5: minor (deferred): retry with fill set and packet cleared is a dead button (unreachable today)
- Task 5: minor (deferred): Fill recolouring during a live pulse + re-click restores a stale pre-Fill outline (needs two events within 1.5 s)
- Task 6: minor (deferred): UIIC block indented one level too deep after unwrapping; checkbox helper text says "The extension is sent…" even when the extension is absent
- Task 7: minor (deferred): `required` parity with extract-fields.py (bare required → true; ng-required ignored when required present)
- Task 7: minor (deferred): fromDom whitelist untested (not exported); checkbox value not emitted (stored captures emit it)
- Task 8: minor (deferred): Live check section omits spec "done when" and the Claude-in-Chrome pre-flight note; Tasks.md line has an orphan "Earlier: —"
- Final: minor (deferred): structure check doesn't list live options for `ready` selects (plan narrowed spec §4.1); live-extract covers the option format in Stage B
