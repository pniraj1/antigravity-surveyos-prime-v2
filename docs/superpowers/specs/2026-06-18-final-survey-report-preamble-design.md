# Final Survey Report — Preamble, Cause-Font, and Closing Wording

**Date:** 2026-06-18
**Status:** Approved design — ready for implementation plan
**Scope:** The "Final Survey" report, in **both** renderers:
- HTML: `src/lib/reports/standard-report-builder.ts` (on-screen preview + Print)
- React-PDF: `src/components/pdf/SurveyReportDocument.tsx` (PDF download)

---

## Background

The Final Survey report currently:
1. Has **no narrative preamble** introducing the survey before the assessment sheet.
2. Renders "Cause & Nature of Accident" at a **hardcoded `7.2pt`** in the HTML builder — smaller than even the Compact body tier, and it ignores the Report Centre font-scale control entirely. The React-PDF doc has **no Cause & Nature section at all**.
3. Ends with a legalistic sentence the surveyor wants replaced.

The React-PDF doc (`SurveyReportDocument.tsx`) is a simpler layout that lacks the Cause section and any closing sentence; both are added as part of this work so the two outputs match.

---

## Change 1 — Editable narrative preamble above the assessment sheet

### Data model
Add one optional field to the claim model:

```ts
reportPreamble?: string;   // free-text; empty/unset = render auto-composed default
```

Initialized to `''` in the claim factory (alongside other report-related defaults).

### Composer (shared pure function)
New helper (e.g. `composeFinalSurveyPreamble(claim, summary): string`) builds the default sentence from current claim data:

> As per instructions received from **{appointingOffice || insurerName}** to conduct the final survey of the Insured Vehicle (I.V.) at **{accident.placeOfSurvey}**, the undersigned has visited the Garage/Workshop & snapped few photos before and after dismantling the vehicle & carried out the survey. The Insured/Repairer has submitted the estimate for **Rs. {summary.totalEstimated}** (estimate total incl. GST). After discussion with the Insured/Repairer, the loss has been finally assessed for **Rs. {summary.netAssessedLoss}**, which is subject to the Policy Terms and Conditions. The loss has been worked out in detail as follows.

- Amounts formatted with the existing currency formatter (₹ / commas, Indian grouping).
- Missing source fields degrade gracefully (e.g. blank place → "the workshop").
- This function is the **single source** for both the render fallback and the editor seed.

### Editor (Report Centre / Report tab)
A "Report Preamble" card containing:
- A `<textarea>` bound to `claim.reportPreamble`.
- Pre-seeded with `composeFinalSurveyPreamble(...)` when the field is empty.
- A **"Reset to auto-generated"** button that re-runs the composer (so updated amounts/place can be re-pulled).
- What the surveyor types is saved verbatim via the existing claim update action.

### Rendering
Both renderers show the paragraph **immediately above where the assessment sheet begins**:
- HTML: just before Section 8 "ASSESSMENT SUMMARY" (`standard-report-builder.ts:365`).
- React-PDF: just before Section III "DETAILED LOSS ASSESSMENT" (`SurveyReportDocument.tsx:259`).

Render rule: `claim.reportPreamble?.trim() ? reportPreamble : composeFinalSurveyPreamble(claim, summary)`.
Paragraph styling: justified, body font bound to the report's font scale (see Change 2), line-height ~1.5.

---

## Change 2 — Cause & Nature of Accident readable + scaling

**Root cause:** `standard-report-builder.ts:363` hardcodes `font-size:7.2pt`, so it is both too small and unresponsive to the Report Centre font control (`claim.reportSettings.fontScale` → `getHtmlScale()` tiers: Compact 7.8pt / Standard 9pt / Large 10.5pt body).

**Fix:** Bind the Cause & Nature text to `scale.cellFont` (the body tier) instead of the hardcoded value. Result: 7.8 / 9 / 10.5pt depending on the Report Centre setting — readable by default and scaling with the control.

**Requirement (explicit user ask):** Cause & Nature of Accident must be clearly readable in the default view.

In the React-PDF doc, add a Cause & Nature section using a body-sized style consistent with that document's scale.

---

## Change 3 — Closing wording

Replace the sentence at `standard-report-builder.ts:539`:

> ~~We have carried out survey of the above motor vehicle in connection with the captioned claim and assessed the loss as per Surveyors and Loss Assessors Regulations 2015 under the Insurance Act 1938. This is a final report without prejudice, subject to terms and conditions of the policy including any applicable policy excess and depreciation as per IRDAI guidelines.~~

with:

> The damages sustained by the vehicle were concurrent with the cause and nature of the accident.
> **ISSUED WITHOUT PREJUDICE**

- "ISSUED WITHOUT PREJUDICE" on its own line, **left-aligned and bold**.
- Add the same block to the React-PDF doc near the signature area.

---

## Out of scope
- The UIIC report variants (`uiic-final-builder.ts`, `UIICReportDocument.tsx`) — they already carry the new-style "concurrent / ISSUED WITHOUT PREJUDICE" wording and are not part of this change.
- Spot and Bill-Check reports.

## Testing
- Unit test `composeFinalSurveyPreamble` with full data, missing place, missing appointing office, zero amounts.
- Render check: preamble appears above the assessment sheet in both renderers; edited text overrides the default; "Reset" restores the composed default.
- Font check: Cause & Nature scales across Compact/Standard/Large and is legible at default.

## Files touched (anticipated)
- `src/types/claim.ts` (+ claim factory default) — add `reportPreamble`
- new composer helper (likely under `src/lib/reports/`)
- `src/lib/reports/standard-report-builder.ts` — preamble, cause font, closing wording
- `src/components/pdf/SurveyReportDocument.tsx` — preamble, cause section, closing wording
- Report tab UI (`src/components/tabs/ReportTab.tsx` or a child card) — preamble editor
