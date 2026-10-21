# Portal Fill Extension

## Current Implementation

- **What it does:** A Chrome extension (MV3) fills an insurer's surveyor-portal forms from a SurveyOS claim. It also has a read-only **Check page** that compares what's on the portal with the claim.
- **Status (2026-10-21):**
  - v0.4.0, covering **NIA non-tieup** and **UIIC claim survey**.
  - Hosting with the current field maps was deployed to motorsurveyos-in on 2026-10-16.
  - Checked live, read-only, on a settled NIA claim.
  - The fixture walk-throughs and the Stage B live check on an *open* NIA claim are still to do.

### How it works
1. In motorsurveyos-in, open the claim and press **Send to extension**.
2. Open the claim on the insurer portal. The extension panel shows the claim card.
3. **Fill** writes the mapped fields. For AngularJS portals it uses `ngModelController.$setViewValue`, so the portal sees real edits.
4. **Check** lists, field by field, where the portal differs from the claim. It is read-only.
5. The surveyor checks the portal and presses Validate, Save and Submit themselves.

### Hard rules (E1–E10)
- It never clicks Validate, Submit, Save, Quick Update, Upload, declarations or confirm dialogs.
- It never touches logins.
- Captured portal values are never committed.

### Key files
- `extension/manifest.json`, `extension/src/`:
  - `panel.js`, `fill-core.js` and `card-view.js` run in the isolated world;
  - `filler.js` runs in the MAIN world.
- `extension/maps/nia-nontieup.json` and `uiic-claimsurvey.json` are the field maps, generated from captures by `build-ext-map.py`.
- `scripts/build-ext.py` builds `extension/dist/unpacked` and `dist/unpacked-dev`. Load `dist/unpacked` in Chrome, not the `extension/` folder, because it contains `__tests__`.
- `scripts/portal-map/live-extract.js` is the live field extractor used for mapping.
- Portal research: `docs/portal-integration.md` (anatomy, NIA, UIIC, and progress in §6).

## Owner test checklist
1. Load `extension/dist/unpacked` from `chrome://extensions` with Developer mode on, then Load unpacked.
2. On a live **open** NIA claim, use Send to extension, then Fill, then the Check page. Don't submit until you've reviewed it yourself.
3. Run the fixture walk-throughs (`extension/fixture`).

## Known Issues / Deferred
- UIIC live check waits for an open UIIC claim.
- Other insurers' portals are not mapped yet.
- Upload boxes are filled by hand, from `Portal Upload/` (see [[Claim_Document_Kit]]).

## Related
- [[Claim_Document_Kit]]
