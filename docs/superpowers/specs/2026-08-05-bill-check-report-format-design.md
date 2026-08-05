# Bill Check Report Format — Design

**Date:** 2026-08-05
**Status:** Awaiting review
**Supersedes:** the report-format portions of `2026-08-05-bill-check-verification-layer-design.md`
**Reference:** surveyor-supplied specimen, `Bill Check.pdf` (Ref MOTOR-828/2026, vehicle MH.39.AD.2416)

---

## 1. Why this exists

The first pass built a Bill Check report with `Billed`, `Status` and `Remarks` columns — a verification worksheet. The specimen shows the real document has none of them. It is the **assessment sheet restated for allowed items**, with original serial numbers and their gaps.

Verification decides *which rows appear*. It is not printed as a comparison.

That version was deployed and rolled back. This spec replaces the report format; the screen-side work stands.

---

## 2. Scope

**In scope — everything between the BILLCHECK SUMMARY block and the ENCL line:**
- the BILLS CHECK REPORT table
- the GST SUMMARY blocks

**Also in scope, because correctness demands it:**
- the summary block's **input values** (layout, labels and cell positions unchanged — see §7)
- hardcoded GST in the **Final Survey Report** (§8)

**Out of scope:** the letterhead, the BILLCHECK SUMMARY layout, the enclosure line, the signature block. Everything else in the current report is correct.

---

## 3. Confirmed calculation model

Established with the surveyor against the specimen:

| Column | Source |
|---|---|
| `Part List Without Tax` | `row.estimated` |
| `Part Depreciation` | rate, or `N.D.` when zero |
| `Parts Assessment` | `row.assessed` |
| `GST %` | `row.gst` — **never a literal** |
| `Final amount With G.S.T` | `assessed × (1 − dep/100) × (1 + gst/100)` |

**Depreciation applies to the assessed amount, always** — same as the Final Survey Report. GST is applied once, after depreciation, at the row's own rate.

**CGST = SGST, and GST = CGST + SGST.** Each half is `base × (gst/2) / 100`. A 28% item splits 14/14, not 9/9.

Verified against the specimen: 61.02 × 1.18 = 72.00 · 2811.86 × 1.18 = 3317.99 · 8581.36 × 1.18 = 10126.01 · parts subtotal 41435.59 × 1.18 = 48894.00 · labour 2385.00 × 0.18 = 429.30 → 2814.30 · paint 17500 × 0.18 = 3150 → 20650.

The specimen is a nil-depreciation policy, so every `Part Depreciation` cell reads `N.D.` and `Parts Assessment` equals `Part List Without Tax` on every row. That is a property of the claim, not of the format.

---

## 4. The table

Single table, section headers inside it, eleven columns:

```
SR NO. │ Description │ Part Type │ Job Type │ Part List Without Tax │
Part Depreciation │ Parts Assessment │ GST % │ Final amount With G.S.T │ Labour │ Paint
```

Labour rows carry their money in the `Labour` column, paint rows in `Paint`.

**Row selection:** allowed rows only — `filter(r => r.allowed !== false)`, unchanged from today. Bill status does not filter: an item the surveyor allowed is on the report. Serial numbers come from `buildSerialMap`, which counts disallowed rows so the gaps survive (specimen parts run 4, 6, 7, 8, 13…37).

**Sections and subtotals:**

| Section | Rows | Trailing lines |
|---|---|---|
| SPARE PARTS | `section === 'parts'` | SUB TOTAL across List / Assessment / Final |
| LABOUR | `section === 'labour'` | SUB TOTAL → one `TAX IN n % for Labour` line **per distinct rate present** → SUB TOTAL |
| PAINTING CHARGES | `section === 'paint'` | SUB TOTAL → tax line(s) per rate → SUB TOTAL |
| TOTAL | — | across all five money columns |

Parts carry GST per row, in the `Final amount With G.S.T` column. Labour and paint show bare amounts per row and are taxed at subtotal level, matching the specimen. Labour is usually a single 18% band, giving one tax line; a mixed-rate claim emits one line per rate.

**Depreciation label:** `N.D.` at zero, `n%` otherwise, `n%*` when `depOverride` is set — existing convention, retained.

**Job Type:** from `row.action` (Replace / Repair), defaulting to `Replace`; `Labour` and `Paint` for those sections.

**Disposal rows** keep today's treatment: no GST, `assessed × (1 − dep) × (disposalPercent/100)`, `DISP` marker.

---

## 5. GST SUMMARY

Two blocks, each grouped by `(hsnSac, gst)` — one line per distinct combination, so a 28% tyre forms its own band automatically.

**Parts, by HSN code:**
```
S.N. │ HSN CODE │ DEPRECIATED AMOUNT │ CGST │ SGST │ AMOUNT
```
`DEPRECIATED AMOUNT` is the GST base: `Σ assessed × (1 − dep/100)`. In the specimen it equals the Parts Assessment subtotal only because depreciation is nil.

**Labour and paint, by service accounting code:**
```
S.N. │ SERVICE ACCOUNTING CODE │ AMOUNT │ CGST │ SGST │ AMOUNT
```

Both end in a GRAND TOTAL row. `hsnSac` is taken from the row and left **blank when unset**. Specimen check: labour+paint base 19885.00 = 2385 + 17500; CGST = SGST = 1789.65 = 19885 × 0.09; total 23464.30 = 2814.30 + 20650. ✓

---

## 6. Removed

`Billed`, `Status`, `Remarks`, and the `billStatusLabel()` helper. `computeRowLiability` is retained — the grid still needs billed-versus-assessed — but nothing derived from it appears on the page.

---

## 7. Summary block inputs

The summary's layout, labels and cell positions are **unchanged**. Its *values* are rewired to the same per-row totals that feed the table.

Necessary, not optional: today the block computes `labOnly * 1.18` and `pC = partsDepreciated * 0.09`. Leaving those while the table below uses per-row GST would make `Cost of Parts` disagree with the SPARE PARTS subtotal on any claim containing a non-18% item — the two halves of one page contradicting each other.

---

## 8. Hardcoded GST — both reports

`row.gst` is editable per row ([AssessmentGrid.tsx:743](../../../src/components/claim/AssessmentGrid.tsx)), and both the grid ([:571](../../../src/components/claim/AssessmentGrid.tsx)) and the summary engine ([assessment.ts:83](../../../src/lib/calculations/assessment.ts)) honour it. Both PDF builders ignore it.

| Site | Report | Defect |
|---|---|---|
| [:119–120](../../../src/lib/reports/uiic-final-builder.ts) | Final Survey | `× 0.09` CGST/SGST |
| [:312](../../../src/lib/reports/uiic-final-builder.ts) | Final Survey | `afterDep * 1.18` |
| [:315](../../../src/lib/reports/uiic-final-builder.ts) | Final Survey | literal `'18'` printed in GST% column |
| [:322](../../../src/lib/reports/uiic-final-builder.ts), [:330](../../../src/lib/reports/uiic-final-builder.ts) | Final Survey | literal `18`, labour and paint |
| [:339–340](../../../src/lib/reports/uiic-final-builder.ts), [:355](../../../src/lib/reports/uiic-final-builder.ts) | Final Survey | `labOnly * 1.18`, `paintOnly * 1.18` |
| [:478–480](../../../src/lib/reports/uiic-final-builder.ts) | Bill Check | `× 0.09` |
| [:666–667](../../../src/lib/reports/uiic-final-builder.ts) | Bill Check | `× 1.18` |

**Impact:** a tyre assessed ₹10,000 at 28% with nil depreciation shows ₹12,800 on screen and prints ₹11,800, with "18" beside it. The Final Survey Report is the worse case — it is the primary deliverable and it both miscalculates and mislabels.

All sites move to `row.gst`, with CGST and SGST each at half the row's rate.

**This changes Final Survey Report output** for any claim holding a non-18% item. Claims that are entirely 18% are unaffected.

---

## 9. Testing

- **Per-row arithmetic** — the specimen's own figures as fixtures: 61.02, 2811.86 and 8581.36 at 18% returning 72.00, 3317.99, 10126.01; a 28% row; a depreciated row; a disposal row carrying no GST.
- **Subtotals and TOTAL** — parts 41435.59 → 48894.00; labour 2385.00 → 2814.30; paint 17500 → 20650.
- **GST SUMMARY grouping** — a claim with 18% and 28% items produces two banded lines; CGST equals SGST in each; grand total equals the sum of the bands.
- **Mixed-rate labour** — two tax lines, one per rate.
- **Serial gaps** — a disallowed row leaves a gap, rows stay consecutive on the page.
- **Summary reconciliation** — `Cost of Parts` equals the SPARE PARTS subtotal on a mixed-rate claim. This is the guard for §7.
- **Final Survey Report** — a 28% row prints 28 in the GST% column and its amount at 28%.

---

## 10. Risks

| Risk | Handling |
|---|---|
| Final Survey Report output changes | Only for non-18% items, where it was wrong. Flagged to the surveyor; accepted. |
| Summary block touched despite being out of scope | Values only, never layout. Covered by the reconciliation test. |
| Specimen is nil-depreciation | It cannot distinguish depreciated from raw assessed in `Parts Assessment`. Resolved with the surveyor directly: depreciation applies to the assessed amount, always. |
| Rounding | Not addressed — the specimen's `70000.00` from `70000.30` sits in the summary block, outside this scope. |
