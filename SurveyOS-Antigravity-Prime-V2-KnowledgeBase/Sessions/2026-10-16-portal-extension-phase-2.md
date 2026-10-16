# Session: 2026-10-16 (Claude) — Portal fill extension Phase 2 (UIIC) + review minors

## What changed
- The extension (v0.3.0) now fills **United India's claim-survey page** as well as New India's non-tieup page.
- The UIIC dialog in SurveyOS has a "Send to portal" step, behind the same bill-check tick as NIA.
- Phase 1 review minors fixed:
  - the panel comes back after the page removes it
  - fill results survive a map refresh
  - remote maps are shape-checked
  - a test catches flow lists drifting apart
  - fill-core no longer leaks page globals
  - the build fails on a field/file key clash
- Final-review fixes:
  - a select with no matching option is reported as rejected, not filled
  - a newly added map loads on worker start
  - the panel text is portal-neutral
  - UIIC Stage 0 checklist lines added

Commits 2019832f..fcfff741 on `main`. 1456 tests, tsc clean. Built `extension/dist/surveyos-portal-fill-0.3.0.zip` (git-ignored). **Not deployed. Not tried in a browser.**
Execution: a fresh subagent implemented each task, a reviewer checked each one (two tasks needed one fix round each, both for cp1252/UTF-8 slips), and an Opus whole-branch review ran at the end, followed by one fix wave and a scoped re-review.

## Owner next steps
1. Load the v0.3.0 zip unpacked. Run the NIA and UIIC fixture walk-throughs in `extension/README.md`.
2. Phase 0 in India: NIA Stage 0 + UIIC Stage 0 on closed claims (README checklists), plus the capture sweep.
3. Approve a hosting deploy (`firebase deploy --only hosting --project surveyos-v2-antigravity-in`) so the hosted maps (NIA v2, UIIC v1) match the bundled ones.
4. Decide: should `uiicText` replace punctuation with a space (`MIDC Nashik`) instead of deleting it (`MIDCNashik`)?

## Rulings made
- M: Ruling: no jsdom in the repo and no new deps allowed — panel.js decisions (M1 re-boot, M6 keep results) extracted as pure fns in fill-core and unit-tested; panel wiring itself stays untested — cost if wrong: a wiring slip only an owner fixture run catches.
- | T7→T8 | T8 UIIC_FIELDS = T7 canonical names + surveyTime − surveyTimeHours/Minutes | consistent; Ruling: overlay `from: "surveyTime"` keys must equal packet field `surveyTime` — carried in both dispatches |
- | T7 rename capture uiic-claim-survey.json → uiic-claimsurvey-survey.json | docs/portal-integration.md + uiic spec reference old name | Ruling: update references in the same commit — cost if wrong: stale doc path |
- | T9 step 5 deploy | Ruling: NOT run by subagents — deploy is an outward side effect needing owner approval — cost if wrong: hosted maps stay stale until owner deploys; bundled copy covers it |
- Phase 2: Ruling: task-9 brief truncated at "## Phase 3" — the brief extractor ran past the task into later phases/housekeeping already done — cost if wrong: none.
- Phase 2: Ruling: Task 9 Step 5 (hosting deploy) and Step 6 (owner live check) excluded from the dispatch — outward side effect needs owner approval — cost if wrong: hosted maps stale until owner deploys.
- Task 6: Ruling: implementer used an accurate Haiku Co-Authored-By trailer instead of the Opus line in the rules — accurate attribution wins; rules now say name your own model — cost if wrong: none.
- Task 7: Ruling: M3 drift test fails the moment a uiic map is bundled, so Task 9's list updates (MAP_IDS, KNOWN_FLOWS, manifest host_permissions + both portal matches) move into Task 7; Task 9 keeps README, fixture walk-through notes, build zip, version bump — cost if wrong: none, same end state.
- Task 7: Ruling: fixture generator emits options 00–23 / 00–59 for selects whose transform is hour / minute (capture has no ng-options values) — real portal option format is unknown until Phase 0 — cost if wrong: fixture differs from portal; Stage 0 catches it.
- Task 8: Ruling: UIIC packet always uses the bill-check basis (projectForBillCheck(rows)) behind the NIA-style "bill amounts verified" checkbox, regardless of the dialog's Assessment/Bill check view toggle — spec R12: the packet carries billed figures, same as NIA — cost if wrong: a surveyor filling an interim (pre-bill) UIIC submission gets no packet; they still have the copy panel.
- Task 8: Ruling: not sent — towingCharge (SurveyOS has towing only for total loss; NIA v1 also omits it), invoiceNo (fee invoice no: SurveyOS holds none, as NIA spec). dailyAllowance = feeBill.haltageCharges; postal has no UIIC field — cost if wrong: surveyor types those two by hand.
- Task 8: Ruling: UIIC_FIELDS is 25 names, not the context's 27 — 27 counted towingCharge/invoiceNo which the same context says not to send; implementer's 25 is correct — cost if wrong: none.
- Final: Ruling: re-graded Minor 1 (worker-start fallback ignores a newly added map) to Important — a v0.2→v0.3 update without onInstalled leaves UIIC with no panel for up to a day — fix wave.
- Final: Ruling: re-graded Minor 2 (panel says "click Validate" + "invoice 1 of 1" on UIIC) to Important — wrong instruction on the new portal — fix wave; copy-only panel change, no unit test (no jsdom) — cost if wrong: copy slip seen at fixture run.
- Final: Ruling: Minor 4 (two UIIC Stage 0 checklist lines) folded into the fix wave — doc-only, cheap.

## Deferred minors
- M: minor (deferred): map.test.js chrome stub set at collection time, never torn down
- M: minor (deferred): map.test.js hostOf mis-parses a *.subdomain pattern (fails loudly if added)
- M: minor (deferred): fill-core-globals test asserts no throw, not "no new globals"
- Task 6: minor (deferred): uiicText deletes \n/\t instead of spacing them — multi-line text merges words ("Line1Line2")
- Task 6: minor (deferred): hour/minute duplicate the time regex; no 0–23/0–59 range check
- Task 7: minor (deferred): dateRadioOrOthers branch keeps its own fields[spec.from] read (now redundant)
- Task 8: minor (deferred): UIIC dialog sendState stays 'sent' if the bill-check box is unticked and re-ticked
- Final: minor (deferred): dialog view (Assessment) can differ from the packet basis (bill check); checkbox text discloses it
- Final: minor (deferred): maxLen truncation reported "filled"; non-finite amount written as 0.00 (shared with NIA)
- Final: minor (deferred): a transform yielding '' still writes a blank → invalid:required (noisy, honest)
- Final: minor (deferred): GST slabs with no portal field dropped without notice in the dialog
- Final: minor (deferred): in the $evalAsync (mid-digest) write path, an unmatched select is still reported filled — same pre-existing limit as the $invalid check
- Final: (owner decision) uiicText deletes punctuation ("MIDCNashik") rather than spacing it ("MIDC Nashik") — plan chose delete pending Phase 0
