# Surveyor feedback, round 1: design

Date: 2026-10-27. Owner: Niraj. Status: draft for owner approval.

## Why

Nine complaints came in from working surveyors. Each was checked against the code before this design was written. Two turned out different from how they were reported:
- Item 7: Bill Check has no Add row button at all.
- Item 9: the UIIC inputs exist, but sit where nobody finds them.

One hides a data-loss bug (item 1). The aim throughout is less admin for the surveyor and no silent changes to their work. The AI may suggest; the surveyor decides (see the owner's rule that the assessment is surveyor-made only).

## Goals

- Fix all nine complaints in a way a surveyor notices on first use.
- Remove the item-1 path that can wipe a surveyor's edited estimate rows.
- Make the policy add-on check impossible to forget, without guessing on the surveyor's behalf.

## Non-goals

- No change to how PDFs print. Item 8 changes the Word file only.
- No new AI calls. Item 1 uses the same single re-read it uses today. Item 4 adds fields to the existing policy read.
- No item-1 style re-read for bills (owner raised it for the assessment only).
- No restyle of other tabs.

## Anti-goals (a failure even if it "works")

- Any AI result that overwrites rows or figures the surveyor typed, without the surveyor ticking it.
- Policy answers filled in by the AI and treated as confirmed.
- A UIIC print step that blocks a surveyor who legitimately has no reinspection dates yet.

## Constraints

- Next.js 16 app, Zustand stores, IndexedDB + Firestore claims. Follow existing patterns.
- The owner wants the smallest diff that works. Reuse what exists before adding.
- Nav and routing (AppTab ids, `useRouteSync`) are the risky part of any UI change. Treat item 2 with care.
- **Prime ↔ SurveyOS Scan rule:** every change states its impact on Scan (see the last section).
- Logic changes leave a unit test behind (vitest, as in the existing `__tests__` folders).
- Auth-gated screens can't be browser-verified here without real login. The owner checks them in the app.

## Build order

The groups are independent, so any order works. Suggested order, smallest risk first:

| Phase | Items | Size |
|---|---|---|
| A | 6, 7, 3, 8 | small |
| B | 2, 9 | small–medium |
| C | 5, 1 | medium |
| D | 4 | medium |

---

## Item 1: "Fix extraction" becomes a proper re-read with a tick-to-apply review

**Today.** `AssessmentChatbot.tsx` is a floating pill fixed at top-left over the sidebar. It re-reads the whole estimate with the surveyor's note, then opens the normal review, and Apply then *replaces* rows.
- After a first Apply, the job holding the surveyor's "re-read / supplementary" choice is cleared. So `reScanLatest` sends `mode = undefined`, which becomes `'replace'`. All `source: 'estimate'` rows are dropped and rebuilt, losing the surveyor's edits on them (`useAIExtraction.ts:194-205`, `aiDataSlice.ts:745-748`).
- After a page refresh the file is gone. The button still shows (`hasFile` checks a saved file name) but only toasts an error.

**Owner's decisions.**
- Problems are often noticed only after the sheet is applied and looked at. So the post-apply fix flow stays, but done properly.
- Issues are not only missing rows. Example: "the amount in the last column is taxable, without GST". The review must handle changed values too.

**Design.**
1. Delete the floating `AssessmentChatbot`. Add a normal toolbar button on the Assessment tab next to Upload Estimate, labelled **"Fix estimate reading"**. It shows once the claim has any estimate rows.
2. It opens a dialog with:
   - a text box: "Tell the AI what it got wrong". Example hints: missing items 38–52; last column is taxable without GST; page 3 not read.
   - if the estimate file is no longer in memory (after refresh), a file picker inside the same dialog: "Choose the estimate file again". No re-read/supplementary question is asked, because this flow never replaces anything.
3. On send: one AI re-read with the note.
   - "Previous data" is built from the **current sheet's estimate-source rows**, not the stale `extractedData.estimate`. So the AI sees what the surveyor sees.
   - The file re-read is the one held in memory, which is the last estimate file uploaded. The dialog names it ("Re-reading: estimate-p2.pdf") and has a **Choose another file** button. An estimate can arrive as several files (original, continuation, supplementary; item 5), and the store keeps only the last one. The surveyor picks the file the problem is in. *My call.*
4. The result is compared with **every row on the sheet in that section**: estimate, supplementary and manual rows alike. That way a row the surveyor typed by hand, or one from another file, is never proposed again as missing.
   - Sections are parts / labour / paint.
   - Each re-read row is matched by serial number, then by description similarity. The builder may reuse the bill matcher in `matchBillItemsToRows` if it fits.

   The review dialog shows two groups:
   - **Missing on the sheet.** Each row has a tick box, on by default. Ticked rows are inserted at their serial position, carrying the same `source` as their neighbours.
   - **Changed.** One line per row, showing old → new for estimated amount, GST %, qty, description and part type. Each row has a tick box, off by default, plus an **Accept all changes** button.

   There is no "not found on re-read" list. A re-read of one file out of several would show most of the sheet there, which misleads. Nothing is ever deleted by this flow. *My call.*
5. When a changed row is accepted:
   - If the surveyor never edited the row's assessed figure (assessed equals the old estimated), assessed follows the new estimate.
   - Otherwise the surveyor's assessed figure stays, and the row gets a remark: "Estimate re-read changed ₹old → ₹new".
   - *Builder:* if there is no reliable "edited by surveyor" signal, the assessed == old estimated comparison is the rule.
6. The existing feedback box inside the first-read `AIReviewDialog` (before Apply) stays as is.

**Tests.** A pure function `planEstimateFix(sheetRows, reReadData) → { missing, changed }`, and `applyEstimateFix(claim, picks)`. Cover these cases:
- missing rows inserted by serial number;
- a manual or supplementary row is not proposed as missing;
- a taxable-vs-gross change shows on every affected row;
- the surveyor-edited assessed figure is kept;
- nothing is deleted.

## Item 2: remove the Site tab

**Today.** Site is a claim tab, the phone landing tab, and the first icon on the phone bottom bar. The owner already decided Scan replaces it (2026-10-24).

**Design.**
- Remove `'site'` from:
  - `AppTab`;
  - `NAV_ITEMS` in `sidebar.tsx`;
  - `MobileBottomBar` (its items become **Details, Documents, Photos, Report**; *my call*);
  - the `Dashboard.tsx` tab switch.
- `claimLandingTab(_, narrow=true)` returns `'details'` (owner's choice).
- A saved or routed `activeTab === 'site'` from before the change (URL, store, session) must land on `'details'`, not a blank screen. Check `useRouteSync` and any persisted UI state.
- Delete `SiteTab.tsx`, `src/components/site/`, and `src/lib/site/` with its tests, **except `path.ts`** (`getAt`/`setAt`), which `src/lib/scan-import/notes.ts` uses. Move `path.ts` to `src/lib/scan-import/path.ts`. This is Scan's ruling D-63: the reusable part leaves when the Site tab retires.
- Update tests that mention `'site'` (`landing-tab.test.ts`, `visible-nav.test.ts` if listed).

## Item 3: Dashboard shows Survey Date and Last Edited

**Today.** The Date column is `updatedAt` (last edited) with no label saying so. The list is sorted by it.

**Design (owner chose "show both").**
- Add `surveyDate: string` to the `claimsList` item (`claimSlice.ts`). It is filled in `useClaimsLoader.ts` by survey type:
  - final → `accident.dateOfSurvey`;
  - spot → date part of `spotDetails.surveyDatetime`;
  - valuation → `valuationDetails.inspectionDate`.

  Put this in one small pure helper with a test.
- Replace the single **Date** column with **Survey Date** and **Last Edited**. A blank survey date shows "—". Use the same date format as today.
- Sorting stays by last edited, so recently worked claims stay on top.

## Item 4: Policy check: Nil Dep, IMT 23, consumables, excess

**Today.**
- The AI policy read does not look for add-ons (`prompts.ts` policy fields stop at `hpa_with`).
- Nil Dep is a dropdown on the Assessment header, defaulting to Standard.
- IMT 23 is a per-row tick.
- Compulsory and voluntary excess are typed in the Assessment summary (`feeBill.compulsoryExcess / voluntaryExcess`).
- Nothing makes the surveyor confirm any of it.

**Owner's decisions.** Check all four points. Show them as a notice so the surveyor remembers. Block the report until they are confirmed.

**Design.**
1. **Data.** Add `policyCheck` to the claim:
   - `nilDep: 'yes'|'no'`
   - `imt23: 'yes'|'no'|'na'`
   - `consumables: 'yes'|'no'`
   - `excessConfirmed: boolean`
   - `aiRead: { nilDep, imt23, consumables, compulsoryExcess, voluntaryExcess }`

   Every field is optional, and absent means not answered. Old claims load with it absent.
2. **AI read.** Add five fields to the existing policy extraction prompt: nil/zero depreciation, IMT 23, consumables cover, compulsory excess, voluntary excess. Each is yes/no/unknown or an amount. This is the same AI call, a few more output tokens. `applyPolicy` stores them in `policyCheck.aiRead` only:
   - It never sets an answer.
   - It fills the excess amounts into `feeBill` only where those are empty or zero, matching how other fields fill.
3. **The notice.** A strip at the top of the Assessment tab and the Report Center. It reads "Policy check: 2 of 4 confirmed" and expands into a small card:
   - Yes/No pills for Nil Dep, IMT 23 (Yes/No/N.A.) and Consumables. Each shows "AI read: Yes" beside it when known.
   - The two excess amounts, editable here and in the summary (same fields), with a **Confirm** tick.

   When all four are answered it shrinks to a green "Policy checked" chip, which can be clicked to reopen.
4. **Answers drive the sheet. Nothing else is auto-changed.**
   - Nil Dep: Yes sets `depreciationType = 'nil'`, No sets `'standard'`. The header dropdown is the same value both ways: changing the dropdown updates the answer.
   - IMT 23: No while any row is ticked IMT 23 shows a warning in the strip ("3 rows ticked IMT 23, policy has no IMT 23"). Yes with no rows ticked shows a reminder.
   - Consumables: No shows a reminder ("consumables not payable, check consumable rows"). No automatic disallowing; the assessment is the surveyor's.
5. **The block.** Print and Word for the **final survey report** (Standard and UIIC) and the **bill check report** (Standard and UIIC) are disabled until all four are answered. The disabled button says why, and clicking it opens the policy card. Spot, valuation, fee bill and reinspection reports are not blocked.
   - These reports print from three places, and all three must go through the gate:
     - `SurveyActions.tsx`;
     - `BillCheckTab.tsx`, including the Word button inside `ReportPreviewPanel`;
     - `FloatingReportPreview.tsx`, whose `handleHtmlPrint` prints UIIC final and UIIC bill check on its own.
   - Build the gate once, as a shared hook or wrapper that item 9's dialog also uses. Don't write it inline in each place.
6. **Re-check.** If a later policy read gives an `aiRead` value that differs from a confirmed answer, that answer is cleared and the strip shows it again ("Policy re-read says Nil Dep: Yes, please confirm"). *My call.*
7. The block applies to claims already in progress too. It costs four clicks once. *My call.*

**Tests.** `policyCheckStatus(claim) → { answered, total, warnings[] }` (pure), the dropdown ↔ answer sync, and the re-check rule.

## Item 5: "Continuation" for estimates and bills

**Today.**
- The estimate question offers "supplementary" (`append`: rows tagged `supplementary`, printed under a "Supplementary Estimate" band) or "re-read" (`replace`).
- Rows with no printed serial number restart at 1 in either mode.
- Bills get no question. A second bill file overwrites bill no., date and total with its own (`applyFinalBill`).

**Design: estimate.**
- Add a third choice to `EstimateModeDialog`: **"More pages of the same estimate"**, with the subtext "Items join the original estimate. Numbering carries on." This is new `EstimateApplyMode` value `'continue'`. Order of choices: Continuation, Supplementary, Re-read.
- `applyEstimate` in `'continue'`:
  - drops nothing;
  - tags new rows `source: 'estimate'`, so no supplementary band;
  - rows without a printed `sr_no` number on from the highest existing estimate-row serial, plus 1. The counter runs across all sections, matching today's single `runningSerial`, so continuation numbering looks like the first read's;
  - rows with a printed `sr_no` keep it.
- Re-read (`replace`) still drops all `estimate` rows, continuation pages included. Its option text says so: "replaces every estimate line, including continuation pages". *My call.*

**Design: bill.**
- When a bill is uploaded and the claim already has a bill read (`billCheck.billNo` set or any row with billed values), ask: **"More pages of the same bill"** or **"Re-read this bill"**. Reuse the same dialog pattern.
- Continuation:
  - bill no. and date keep the first non-empty values;
  - the total is taken from the new file only if it prints one, since the grand total is usually on the last page;
  - rows already matched (`billStatus: 'in-bill'`) are excluded from matching, so page 2 can't re-match page-1 rows;
  - extra items merge as today.

  The surveyor sees the total on Bill Check to verify.
- Re-read keeps today's behaviour.

**Tests.** `applyEstimate` in continue mode (serials continue, no band, nothing dropped), and the bill header and matching rules in continue mode.

## Item 6: Recovered list shows vehicle number

`RecoveredClaimsView.tsx:126`: the heading shows `snap.vehicleNo` (fallback "No vehicle no."), then the report no. as small grey text beside it. Same for the restore toast at line 71.

## Item 7: Add row at the bottom too

- **Assessment** (`AssessmentSectionTable.tsx`): keep the header button, and add the same **Add row** button right below each section's table.
- **Bill Check** (`BillCheckGrid.tsx`): there is no Add row today. Add one below each section, calling the same `addAssessmentRowToSection(section)`. A row added here is an ordinary assessment row and appears in the final report too. *My call.*
- *Builder:* after adding, scroll the new row into view and focus its description cell, if that is cheap.

## Item 8: Word file keeps the PDF's page breaks

**Verified on this machine (Word 16).** The UIIC reports force a new page with an empty `<div style="page-break-before:always;"></div>` before the surveyor-name line:
- `uiic-final-builder.ts:238, 433, 475` (final);
- `uiic-final-builder.ts:885` (bill check).

Chrome honours it; Word ignores an empty block. Test files: the empty-div version opened as **1 page**, the `<br clear=all style="page-break-before:always">` version as **2 pages**.

**Design.**
- In `word-export.ts` (`buildWordDocument`), rewrite every empty page-break div into `<br clear=all style="page-break-before:always">` before wrapping. That is one place, so every report's Word download is fixed and the PDF path is untouched.
- Do not change the builders.

**Tests.** Unit test that `buildWordDocument` turns the empty div into the `<br>` form. Manual check: download UIIC final and UIIC bill check as Word for one claim. Page 2 and on must each start at the surveyor-name line, as in the PDF.

**Not covered.** The standard final and standard bill-check reports have no forced page breaks; they flow naturally. A Word layout difference there (fonts, `display:flex` in the letterhead) is a separate issue if the owner reports one.

## Item 9: UIIC repair dates asked at print time

**Today.** The five fields are on the Reinspection tab (`ReinspectionTab.tsx:134-196`) and already feed both UIIC reports (`uiic-final-builder.ts:231-234, 868-871`):
- RI appointment date
- Repair authorisation date
- Est. repair completion date
- Actual repair completion date
- Repairs as per assessment (YES / NO / PARTIAL)

Surveyors don't find them.

**Design (owner's choice).**
- Clicking Print or Word with the **UIIC** format, on the final report or the bill check, from any of the three print places listed in item 4, first opens a short **"Before printing: UIIC"** dialog:
  - the five fields, filled in from `claim.reinspection` and written straight back (two-way with the Reinspection tab);
  - if the policy check (item 4) is not complete, its card inline, so it can be finished here.
- Buttons: **Print** (or **Download Word**) and **Cancel**. Blank dates are allowed; reinspection may not have happened yet.
- The dialog shows on every UIIC print. *My call:* it's quick, and the dates change across the claim's life.

---

## Prime ↔ SurveyOS Scan impact

| Item | Impact on Scan |
|---|---|
| 1, 3, 5, 6, 7, 8, 9 | None. No doc types, labels, folder layout, report labels or manifest touched. |
| 2 | `planSiteNotes` / Site list retire as Scan's D-63 expects. `getAt`/`setAt` move to `src/lib/scan-import/path.ts`; the notes import keeps working. Note the retirement in `../SurveyOS Scan/docs/handover/prime-notes-import.md` if it mentions the Site tab. |
| 4 | New claim path `policyCheck.*`. Not a Scan field today. If Scan's Notes ever add policy points, use these paths. |

Run Scan's drift tests (`./gradlew :app:testDebugUnitTest`) once after phase B to confirm nothing it reads moved.

## Cost

- No new AI calls. Item 1: one re-read per use, same as today. Item 4: five extra output fields on the existing policy read, a fraction of a paisa per claim on free-tier keys.
- No new dependencies.

## Calls made by Claude (owner to check)

1. Phone bottom bar becomes Details, Documents, Photos, Report.
2. In item 1, a changed estimate amount moves the assessed figure only if the surveyor never edited it.
3. Re-read of an estimate also replaces its continuation pages.
4. The bill continuation takes the total from the later file when it prints one.
5. A row added in Bill Check is a normal assessment row (shows in the final report).
6. The policy block covers final and bill check reports only, and applies to old claims too.
7. A changed AI policy read re-opens that answer.
8. The UIIC "Before printing" dialog shows on every UIIC print; blanks allowed.
9. "Fix estimate reading" re-reads the last uploaded estimate file, with a "Choose another file" option. It compares against every row on the sheet, so it never re-proposes hand-typed or supplementary rows, and it has no "not found" list.
10. Continuation numbering uses one counter across parts, labour and paint, as the first read does.

## Left to the builder

- Exact component placement, styling and copy within the existing look.
- Matching heuristic for item 1 (reuse the bill matcher if it fits).
- Whether "Fix estimate reading" sits in the main toolbar row or the AI controls row.
