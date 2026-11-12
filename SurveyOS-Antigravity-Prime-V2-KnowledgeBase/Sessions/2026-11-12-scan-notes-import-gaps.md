# 2026-11-12 — Scan notes import gaps (Claude Code)

Owner reported that many Scan notes fields don't reach Prime. Prime's allow-list in `notes.ts` covers all 65 Scan fields, so the list was not the cause. The losses were in `normalizer.ts`:
1. Backup fee notes are under `fee_bill`; Prime read `feeBill`.
2. Backup rows are tagged `spot` / `valuation`; Prime matched `spotDamageRows` / `valuationPartRows`.
3. The Drive picker passed a whole manifest, which the normalizer didn't recognise.

Reproduced each one with Scan-shaped JSON, rewrote the test fixture from Scan's real `backupJson()`, then fixed. scan-import 96/96 pass.

Next: deploy after the owner checks with a real "Text only" zip. (The Fee tab survey date/place turned out to be mirrored into Spot already; not a gap.)
