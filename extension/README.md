# SurveyOS Portal Fill — extension

Fills New India's non-tieup survey page from a SurveyOS claim. Spec:
`docs/superpowers/specs/2026-09-20-portal-fill-extension-design.md`.

## Load unpacked (dev)
1. `python scripts/portal-map/build-ext-map.py nia-nontieup` (regenerates map + fixture)
2. chrome://extensions → Developer mode → Load unpacked → this folder
3. For the fixture only: on the extension's Details page enable **Allow access
   to file URLs**, and temporarily add `"file:///*"` to both portal `matches`
   arrays in `manifest.json`. Revert before zipping — `npm run build:ext` refuses
   a manifest containing `file://` or `localhost`.

## Fixture walk-through (no portal needed)
1. Open `extension/fixture/nia-nontieup.html` in Chrome.
2. Type a claim number in the fixture's box, e.g. `3101/00312/24-C`.
3. In SurveyOS (`localhost:3000`), open a claim with the same number → Assessment →
   **NIA Excel** → tick the bill-check gate → **Send to extension** → "Ready".
4. Back on the fixture: the card shows the packet; **Fill**.
5. Expect: green outlines on filled inputs; the ng-change log lists the filled
   canonical names; the file input shows the xlsx name; card lists `✓` per field.
6. Type `Nashik` into Place, Fill again → Place is `⚠ kept`, amber.
7. Change the fixture claim number → Fill → refused, both numbers shown.
8. Rename one `data-ng-model` in the fixture → Fill → that field `✗ not found`,
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
