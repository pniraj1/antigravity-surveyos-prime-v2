# SurveyOS Portal Fill — extension

Fills New India's non-tieup survey page and United India's claim-survey page from a SurveyOS claim. Spec:
`docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md`.

## Load unpacked
1. `py scripts/build-ext.py` or `npm run build:ext` (builds every overlay: maps + fixtures,
   the zip, and two loadable folders)
2. chrome://extensions → Developer mode → Load unpacked → pick ONE of:
   - `extension/dist/unpacked-dev` — fixtures and `localhost:3000`. Then on the
     extension's Details page enable **Allow access to file URLs**.
   - `extension/dist/unpacked` — the release build (live portals + motorsurveyos-in only).
   Not `extension/` itself: Chrome refuses a folder containing `__tests__`.
3. After a rebuild, press the reload ↻ on the extension's card.
4. To make a remote map win over the bundled one, bump `version` in
   `scripts/portal-map/nia-nontieup.overlay.json`, regenerate, deploy hosting.

## Check page
**Check page** is a text button on the card. It looks at the portal page and says, for each
field, whether Fill would work. It writes nothing: no values, no clicks, no events. The one
exception is clicking a result line, which scrolls to that field and outlines it for 1.5 s.
It works whatever the claim state:
- **No claim sent** (or a claim for the other portal): checks that every field and the Excel
  slot are on the page, enabled, and which already hold a value. Lists the portal's options
  for dropdowns and radios.
- **Claim matches**: the same, plus what Fill would put in each field, checked against the
  portal's options. Text and money values are never shown.
- **Different claim**: runs like the above, but the card warns that Fill will refuse.

**Copy report** (after a check) copies a plain-text report with no text or money values.
Esc or **Hide** collapses the card to a tab on the right edge; it stays that way per portal.

## Fixture walk-through (no portal needed)
Load `extension/dist/unpacked-dev` and, on the extension's Details page, enable
**Allow access to file URLs**.
1. Open `extension/fixture/nia-nontieup.html` in Chrome (a 1366×768 window), no claim sent.
   Expect the card docked on the right, centred, badge "No claim sent", and **Check page**.
2. **Check page** → badge "Checked", the lines that need you, the reassurance line,
   **Copy report**. Copy it and paste: the first line names version, map and mode; no text
   or money values appear.
3. **Hide** → a 40 px tab with the badge. Reload: still collapsed. **Show**, then Esc in
   the card: it collapses again.
4. Click a result line: the page scrolls to the field and outlines it, then the outline clears.
5. Drag the header up and down (it moves vertically only); ArrowUp/ArrowDown move it, Home
   re-centres. Click a field that sits behind the card: the card collapses.
6. Type a claim number in the fixture's box, e.g. `3101/00312/24-C`.
7. In SurveyOS (`localhost:3000`), open a claim with the same number → Assessment →
   **NIA Excel** → tick the bill-check gate → **Send to extension** → "Ready".
8. Back on the fixture: badge "Claim matches"; **Fill**.
9. Expect: green outlines on filled inputs; the ng-change log lists the filled
   canonical names; the file input shows the xlsx name; the summary line, the next step
   and the legend show; filled lines are behind **Show all lines**.
10. Type `Nashik` into Place, Fill again → Place is "kept", amber, listed first.
11. Change the fixture claim number → badge "Different claim" (within a couple of seconds),
    Fill disabled with the reason shown; both numbers show in full on hover.
12. Rename one `data-ng-model` in the fixture → Fill → that field "not found",
    the rest fill.

## Stage 0 (live portal, closed claim, via screen-share)
- [ ] Panel appears on `#/WorklistSurveyNew` only
- [ ] Page claim number read (`claimNoPath`); if `(none)`, note where it actually lives
- [ ] Wrong claim open → refused with both numbers
- [ ] Fill: Quick Update date radio / date / time / place / mobile
- [ ] Invoice 1: GST select, invoice no/date; painting Consolidated + est/assessed on a standard policy
- [ ] Claim Assessment: no. of invoices, salvage, excesses
- [ ] Fee bill fields
- [ ] Excel attached → portal shows the file name → surveyor clicks **Validate** → grid populates
- [ ] `notFound` / `manual` list captured verbatim for the map overlay
- [ ] Save page ("Webpage, Complete") for re-extraction

## UIIC fixture walk-through (no portal needed)
1. Open `extension/fixture/uiic-claimsurvey.html` (it sets its own `#/SurveyorClaimSurvey` hash).
   With no claim sent, **Check page** works here too.
2. Type a claim number in the fixture's box.
3. In SurveyOS, open a claim with the same number → Assessment → **UIIC summary** →
   tick the bill-check box → **Send to extension** → "Ready".
4. On the fixture: badge "Claim matches"; **Fill**.
5. Expect `Plot 4, MIDC-Nashik` to land as `Plot 4 MIDCNashik`, and `9:05` to split
   into hours `09` / minutes `05`.
6. Type a value into a field first, then Fill → that field is "kept", amber.
7. Change the claim number → badge "Different claim" (within a couple of seconds), Fill
   disabled, both numbers shown.
8. With an NIA claim sent, the UIIC page shows badge "Other portal" and names both
   portals; **Check page** still works.

## UIIC Stage 0 (live portal, closed claim)
- [ ] Paste-blocked money fields accept the write
- [ ] Readonly `*AfterDep` / `*Tax` twins recompute
- [ ] Hour/minute select option format (`09` vs `9`)
- [ ] Final Submit validation list captured
- [ ] `notFound` / `manual` lines captured verbatim
- [ ] Save page ("Webpage, Complete") for re-extraction
- [ ] Page claim number is read (hidden `claimNumber` input); if the panel shows `(none)`, note where the number actually lives
- [ ] Survey date (readonly datepicker) accepts `dd/MM/yyyy`; if it reports `✗ rejected by portal — date`, note the format the picker wants

## Live check (read-only)
Run on the live New India portal with the release build (`extension/dist/unpacked`), logged
in inside the Claude tab group. Only viewing and **Check page**; nothing is saved. UIIC
waits until a login is available.

Pre-flight: Claude in Chrome is allowed (the project settings must not deny
`mcp__claude-in-chrome`), and the owner is logged in inside the Claude tab group.

Done when: every one of the 23 NIA fields and the Excel slot has a status, and every
non-ready field has a cause noted.

0. In SurveyOS, open the settled claim → NIA Excel → tick → **Send to extension**. (The claim
   sent earlier may have expired after 24 h.)
1. Open the settled claim through Claim Search. Note which page it opens on and whether the
   card appears. If it opens on the survey page, run **Check page** only; expect mostly
   locked or already-filled fields. **Do not click Fill on it.**
2. Open one open non-tieup claim's survey page from the Worklist (pencil icon). Before running
   Check, confirm the card shows the badge **Different claim**, **Fill** greyed out with the
   reason "Different claim" next to it, and both claim numbers' last 4 digits (full numbers
   on hover). Nothing can be filled on this page. (The page script's own refusal is covered
   by an automated test.)
3. Run **Check page**. The badge changes to **Checked**, and the first line says this page is
   a different claim and that Fill will refuse.
4. Run `scripts/portal-map/live-extract.js` in the page (through Claude in Chrome). It lists
   the page's fields with no values. Compare with `scripts/portal-map/nia-nontieup-survey.json`
   and commit a new capture only if it differs, after a scan for values. The one known
   value-like output: the extractor keeps radio `value` codes, and for NIA's survey-date
   radio these are dates of the open claim, so remove them before committing a capture.
5. Paste the Check report and the comparison into `docs/portal-integration.md` §5 as
   "Live check 2026-10-xx". Each problem line becomes a map fix through the overlay and
   `build-ext-map.py`, never a hand edit.

**Stop** and hand back to the owner if any step would need a click on Save, Validate,
Quick Update, Submit, Upload, a declaration tick, or any confirm dialog.
