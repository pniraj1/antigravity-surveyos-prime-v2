# Session: 2026-10-16 (Claude) — Portal fill extension Phase 1

## What changed
Wrote the portal roadmap (`docs/superpowers/plans/2026-10-16-portal-extension-roadmap.md`) and built Phase 1: the extension now handles several portal maps instead of one hard-coded NIA map. There's still only one map (NIA non-tieup); UIIC is Phase 2.
Commits e62a61fa..2019832f on `main`. 1424 tests. Not deployed. Executed inline; final whole-branch review on Opus found no Critical/Important issues, and one declined item was promoted and fixed (maps loaded when the worker starts with none).

## Owner checks
1. Load `extension/dist/surveyos-portal-fill-0.2.0.zip` unpacked (rebuild with `py scripts/build-ext.py` — `python` isn't on PATH on this machine).
2. Fixture walk-through in `extension/README.md`. The fixture now sets its own `#/WorklistSurveyNew` hash.
3. Phase 0 in India: NIA Stage 0 + capture sweep (roadmap Phase 0 table).
4. Before the remote NIA map v2 is served: `firebase deploy --only hosting --project surveyos-v2-antigravity-in`. Until then the bundled copy is used.

## Rulings made (full list in the roadmap ledger, git-ignored)
- Empty host (file:// fixture) matches any map host. The zip strips file:// matches.
- NIA map version bumped 1→2 because `host` is a new required header.
- `scopeAnchors` added as pure tested logic for the controller-less scope lookup.
- No browser walk-throughs were run: this session can't load an unpacked extension.

## Deferred minors (from the final review)
- Panel won't re-boot if the portal removes `#sx-panel` without a route change.
- A remote map is accepted on id + version only. Validate `host`/`route`/`fields` too.
- `MAP_IDS`, `KNOWN_FLOWS`, manifest `matches` and the overlay glob are kept in sync by hand. Add a drift test.
- fill-core's top-level names leak into the portal's MAIN-world globals. Wrap it in an IIFE.
- Migration test seeds a v2 map, not a v1.
- A map update after a good fill replaces the results list.
- Fixture path list merges the fields and files dicts, so a shared key would drop a path.
