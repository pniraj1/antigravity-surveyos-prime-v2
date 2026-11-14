# 2026-11-14 — Parser robustness (Claude Code)

Owner question: is the estimate/invoice parser ready for digital PDFs like `MH40BG5830_INV_20260930_final` (Prabal Motors, BharatBenz DMS)?

- Found: text layer fine on pages 1–12; blank page 13 sent as an image and switched the parser off; grand-total label unknown; with that patched, totals tied but part no./HSN/labour columns were wrong (totals tying is not proof).
- Owner priorities agreed: money right, no missing rows, never a confident wrong value, fewest calls. Part no./HSN matter for Bill Check match score, part price history, GST bands and insurer Excel.
- Built (TDD, real token fixtures): column fixes, labour "Std Hrs"/"SAC", total labels, blank-page skip, `checkFields`, opt-in corpus snapshot test.
- Corpus: 28 sample PDFs (paths in scratchpad list, files in Downloads, never committed). Only Prabal changed.
- Deferred to next talk: learning loop + DPDP; AI fill of blanked fields.
