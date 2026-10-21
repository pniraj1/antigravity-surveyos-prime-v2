# Session: 2026-10-21 (Claude): Claim Document Kit, Phases 1–2

## What changed
Phases 1–2 of `docs/superpowers/specs/2026-10-20-claim-document-kit-design.md`, built from the plan `docs/superpowers/plans/2026-10-20-claim-document-kit.md`:
- **Page labels:** each file in the claim folder gets per-page labels. Free local recognisers read the text layer and file names (no AI). The surveyor labels the rest in the Pages view.
- **Fingerprints:** labels are tied to the exact file they were made on. Scan and labelling fingerprint every file, a changed file loses its labels, and Build refuses one that changed since it was labelled.
- **Identity checks:** each labelled page is checked against this claim's registration, chassis, policy number, claim number or names. KYC pages compare names only. A page whose text hasn't loaded yet shows "Still checking". A continuation page (policy terms, a card's back) takes its result from a matching page of the same file.
- **Portal checklist:** recipes for New India non-tieup, New India KIA tie-up (provisional) and United India. Each box shows Ready / Check / Missing, and the panel gives a copy-ready missing-documents message.
- **Build:** pdf-lib splits and merges. Each box builds on its own and shows its own error. Only confirmed (ready) boxes are written to `Portal Upload/<portal>/`, which keeps nothing else. HTML stand-in reports and encrypted PDFs are never cut.
- **Review upload set:** a source change, a not-needed toggle or an identity-field edit marks the box stale until it's rebuilt, even when the edit was made with the tab closed.

Commits 7181ae3c..f510fbae, then fix wave 287d7113..5f1bb70a, on `main`. 1721 tests, tsc clean. **Not deployed; not tried in a browser.**

Execution: subagent-driven, with a review of each task. An Opus whole-branch review followed, then one fix wave (1 Critical, 8 Important, minors folded in).

## Owner next steps
1. Confirm the recipe defaults in spec §8(b)–(d): what goes into NIA "Claim Related Documents", the KIA tie-up list, and UIIC's five vehicle photographs.
2. Try it on a real claim folder: Scan, label pages, Build, then Review upload set. Check the files in `Portal Upload/`.
3. Photo tags: a photo tagged Front/Chassis/… in the Photos tab is still saved to the folder as a damage photo. Label it in Pages until this is linked (see the fix report).
4. Next: Phases 3–5 (Google Drive online picker, opt-in AI "Guess the rest", extension upload).

## Rulings made
