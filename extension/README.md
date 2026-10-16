# SurveyOS Portal Fill â€” extension

Fills New India's non-tieup survey page and United India's claim-survey page from a SurveyOS claim. Spec:
`docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md`.

## Load unpacked (dev)
1. `py scripts/build-ext.py` or `npm run build:ext` (builds every overlay: maps + fixtures)
2. chrome://extensions â†’ Developer mode â†’ Load unpacked â†’ this folder
3. For the fixture only: on the extension's Details page enable **Allow access
   to file URLs**, and temporarily add `"file:///*"` to both portal `matches`
   arrays in `manifest.json`. No need to revert before zipping â€” the build strips
   `localhost` and `file://` matches from the zipped manifest.
4. To make a remote map win over the bundled one, bump `version` in
   `scripts/portal-map/nia-nontieup.overlay.json`, regenerate, deploy hosting.

## Fixture walk-through (no portal needed)
1. Open `extension/fixture/nia-nontieup.html` in Chrome.
2. Type a claim number in the fixture's box, e.g. `3101/00312/24-C`.
3. In SurveyOS (`localhost:3000`), open a claim with the same number â†’ Assessment â†’
   **NIA Excel** â†’ tick the bill-check gate â†’ **Send to extension** â†’ "Ready".
4. Back on the fixture: the card shows the packet; **Fill**.
5. Expect: green outlines on filled inputs; the ng-change log lists the filled
   canonical names; the file input shows the xlsx name; card lists `âœ“` per field.
6. Type `Nashik` into Place, Fill again â†’ Place is `âš  kept`, amber.
7. Change the fixture claim number â†’ Fill â†’ refused, both numbers shown.
8. Rename one `data-ng-model` in the fixture â†’ Fill â†’ that field `âœ— not found`,
   the rest fill.

## Stage 0 (live portal, closed claim, via screen-share)
- [ ] Panel appears on `#/WorklistSurveyNew` only
- [ ] Page claim number read (`claimNoPath`); if `(none)`, note where it actually lives
- [ ] Wrong claim open â†’ refused with both numbers
- [ ] Fill: Quick Update date radio / date / time / place / mobile
- [ ] Invoice 1: GST select, invoice no/date; painting Consolidated + est/assessed on a standard policy
- [ ] Claim Assessment: no. of invoices, salvage, excesses
- [ ] Fee bill fields
- [ ] Excel attached â†’ portal shows the file name â†’ surveyor clicks **Validate** â†’ grid populates
- [ ] `notFound` / `manual` list captured verbatim for the map overlay
- [ ] Save page ("Webpage, Complete") for re-extraction

## UIIC fixture walk-through (no portal needed)
1. Open `extension/fixture/uiic-claimsurvey.html` (it sets its own `#/SurveyorClaimSurvey` hash).
2. Type a claim number in the fixture's box.
3. In SurveyOS, open a claim with the same number -> Assessment -> **UIIC summary** ->
   tick the bill-check box -> **Send to extension** -> "Ready".
4. On the fixture: **Fill**.
5. Expect `Plot 4, MIDC-Nashik` to land as `Plot 4 MIDCNashik`, and `9:05` to split
   into hours `09` / minutes `05`.
6. Type a value into a field first, then Fill -> that field is `⚠ kept`, amber.
7. Change the claim number -> Fill -> refused, both numbers shown.
8. With an NIA packet stored, the UIIC page shows "This claim was sent for nia
   (nontieup); this page is uiic (claimsurvey)."

## UIIC Stage 0 (live portal, closed claim)
- [ ] Paste-blocked money fields accept the write
- [ ] Readonly `*AfterDep` / `*Tax` twins recompute
- [ ] Hour/minute select option format (`09` vs `9`)
- [ ] Final Submit validation list captured
- [ ] `notFound` / `manual` lines captured verbatim
- [ ] Save page ("Webpage, Complete") for re-extraction
