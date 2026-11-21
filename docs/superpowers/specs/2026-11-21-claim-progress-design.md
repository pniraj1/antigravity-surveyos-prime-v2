# Claim progress: design (short, rev 3)

Date: 2026-11-21. Status: awaiting owner approval. Size: small-to-medium, Prime only.
Rev 3: workflow traced in the code for all three survey types; every step's proof checked against real fields; gaps listed; "Spot survey" removed from the final list (`isSpotCompleted` is never set anywhere).

## Intent and why

A surveyor cannot tell, from the dashboard or from inside a claim, how far a claim has got, why it was left, or whether it has been couriered. Real stops are 2-3 steps: estimate received but bill not received; bill received but reinspection not done (optional); reports done but not couriered or not uploaded to the portal. Courier goes in batches and the courier date matters.

Goal: at a glance, show where each claim is stuck, what it is waiting for and since when, with the least new UI and data entry.

## Goals

- Each claim shows "Waiting: <step> · since <date> · k of N" in the sidebar claim badge and on its dashboard row.
- Sidebar tabs get a status mark (done, waiting, optional, n/a), using the badge slot AI Review and Bill Check already use.
- Courier date typed on the dashboard row; one date can be applied to several ticked claims.
- Portal-uploaded tick; optional one-line hold note ("why left").
- A Next button at the foot of each claim tab, via the existing `getNextClaimTab`.

## Non-goals

- No locked stage pipeline or blocked transitions.
- No change to AppTab IDs, routing or `useRouteSync`.
- No Scan change, no status-file change.
- No courier docket number, receipt photo, or separate history log. Step dates are the trail.

## Anti-goals

- More ticks than today for the same claim. A step the data proves ticks itself.
- Anything that blocks leaving a tab or marking a claim completed.

## Approaches considered

| Approach | Trade-off | Outcome |
|---|---|---|
| A. Ordered steps per survey type, computed from claim data, shown in existing sidebar and dashboard | Additive, no routing risk, old claims work | **Picked** |
| B. Strict stage pipeline with locked transitions | Rigid, needs migration, reinspection optional | Rejected |
| C. Courier and portal fields plus filters only | No "how complete", no "why stuck" | Rejected |

## The workflow as the code has it

The three survey types are separate claims with separate report numbers (`getNextSpotNumber` / `getNextFinalNumber`). Each shows different tabs (`HIDDEN_BY_SURVEY` in `src/lib/navigation/visible-nav.ts`):

| Survey type | Tabs, in `CLAIM_TAB_ORDER` | Reports it prints |
|---|---|---|
| Spot | Documents, AI Review, Claim Details (+ Spot Findings), Report Center, Photo Sheet, Fees | Spot Report, Fee Bill, Photo Sheet |
| Final | Documents, AI Review, Claim Details, Assessment, Bill Check, Reinspection, Report Center, Photo Sheet, Fees | Final Survey Report, Bill Check Report, Reinspection Report, Fee Bill, Photo Sheet |
| Valuation | Claim Details, Valuation, Report Center, Photo Sheet, Fees | Valuation Report, Fee Bill, Photo Sheet |

What already records progress (verified in code):

- **Document checklist** (`DocumentChecklist.tsx`): RC, DL, Permit, Fitness, Load Challan, Fire Report, FIR, each YES / NO / N.A. in `documentVerification`. The surveyor already ticks it.
- **Claim documents index** (`claim.documents`): each file has `type` and `addedAt`; `source` is `upload`, `scan`, `photo` or `generated`. Estimate and invoice land here from upload or Scan import.
- **Printed reports**: every print except the Spot Report goes through `saveReportToClaimFolder` (`src/lib/reports/auto-file-report.ts`), which files the report into `claim.documents` as `generated`. **But** the sink files nothing when no claim folder is connected, and the Spot Report prints through `react-to-print` and is never filed.
- **Bill Check**: `billCheck.verifiedBySurveyor` + `verifiedAt`.
- **Portal upload set** (Claim Document Kit): `uploadSet.builtAt`, per box `written` and `reviewedAt`.
- **Fee**: `feeBill.feePaid`, `paymentDate`.
- **Scan chase** (linked claims): `scanChase` holds asks sent to insured/garage with dates.

## Design

**One step list per survey type** in one table, read by one function `claimProgress(claim)`. It returns per step `done | waiting | optional | n/a` and the step's date when known, plus the first waiting step, k of N, and "since <date>" (date of the last dated done step). The sidebar, dashboard and Next button read only this.

Step shape: `{ id, label, tab, optional?, proof }`. Order plus `optional` is the dependency; the next action is the first non-optional step not done.

**Final survey**

| # | Step | Proof | Date from |
|---|---|---|---|
| 1 | Documents verified | every `documentVerification` item YES or N.A. | none |
| 2 | Estimate received | `documents` has `estimate`, or `assessmentRows` non-empty | `addedAt` |
| 3 | Survey report printed | `printedAt.survey` | itself |
| 4 | Bill received | `documents` has `invoice`, or `billCheck.billTotal > 0` | `addedAt` |
| 5 | Bill checked | `billCheck.verifiedBySurveyor` | `verifiedAt` |
| 6 | Reinspection (optional) | needed = `reinspectionNeeded`; done = `printedAt.reinspection` | itself |
| 7 | Bill check report printed | `printedAt.billCheck` | itself |
| 8 | Photo sheet and fee bill printed | `printedAt.photoSheet` and `printedAt.feeBill` | later of the two |
| 9 | Portal files ready (only if `uploadSet` exists) | every written box has `reviewedAt` | latest `reviewedAt` |
| 10 | Couriered | `courieredAt` | itself |
| 11 | Uploaded to portal | `portalUploadedAt` | itself |
| 12 | Fee received | `feeBill.feePaid` | `paymentDate` |

**Spot survey**

| # | Step | Proof |
|---|---|---|
| 1 | Documents verified | as final |
| 2 | Spot findings recorded | `spotDamageRows` non-empty (builder confirms which `spotDetails` fields start blank) |
| 3 | Spot photos | a photo tagged `spot`, or `documents` has `spotPhotos` |
| 4 | Spot report printed | `printedAt.spot` (needs the hook below) |
| 5 | Photo sheet and fee bill printed | as final |
| 6 | Couriered / uploaded to portal | as final |
| 7 | Fee received | as final |

**Valuation**

| # | Step | Proof |
|---|---|---|
| 1 | Inspection recorded | `valuationDetails.inspectionDate` set |
| 2 | Photos | any damage/vehicle photo |
| 3 | Valuation report printed | `printedAt.valuation` |
| 4 | Photo sheet and fee bill printed | as final |
| 5 | Couriered / uploaded to portal | as final |
| 6 | Fee received | as final |

**Print hook (closes the two gaps).** `saveReportToClaimFolder` is the one function all report prints route through. It also writes `printedAt[kind] = now` on the claim, before the folder check, so a print is recorded with or without a claim folder. The Spot Report's `react-to-print` path calls the same small recorder. No other print path changes.

**New claim fields** (all optional, no migration):
`printedAt?: Partial<Record<'survey' | 'billCheck' | 'reinspection' | 'spot' | 'valuation' | 'photoSheet' | 'feeBill', string>>`, `courieredAt?: string`, `portalUploadedAt?: string`, `reinspectionNeeded?: boolean`, `heldNote?: string`.

**Dashboard.** Each row: "Waiting: <step> · since <date>", a progress mark, a native `<input type="date">` for the courier date, a portal tick, and the hold note when present. Ticking several rows shows one date field that writes `courieredAt` to all of them.

**Sidebar.** One per-tab mark from `claimProgress`, replacing the two hard-coded badges (the AI Review conflict count stays). One line under the claim badge.

**Next button.** At the foot of each claim tab, via `getNextClaimTab`.

## Problems found in the current code

- **Two "completed" flags.** The dashboard's Mark Completed toggles `isCompleted`; the claim header's Mark completed sets `completedAt` (and syncs to Scan). A claim completed in one place shows Active in the other. This design treats `completedAt` as the truth and the dashboard toggle must use `completionPatch` too. Pre-existing bug; it partly explains why the dashboard status feels unreliable.
- **`isSpotCompleted` is never set** anywhere (only defaulted and read). Not used as a proof. Left alone.
- **Reports without a claim folder leave no trace** in `documents`; fixed by `printedAt`.

## Prime and Scan impact

None by design: new fields are on the claim, not in the status file or manifest. Fixing the dashboard toggle to use `completionPatch` makes it sync to Scan like the header does, which is the intended behaviour. Builder runs Scan's unit tests and reports the impact.

## Cost

No AI calls, no new Firestore reads; fields sit on the claim already saved. Effort: one function plus tests, one recorder in the print path, one dashboard change, one sidebar change, one Next component, the completed-flag fix.

## My calls (please check)

- Courier and portal apply to all three survey types. If spot or valuation reports are never couriered, those steps are dropped from those lists.
- Reinspection only becomes "waiting" when "reinspection needed" is ticked.
- "Since <date>" uses the last dated step; undated steps (document checklist) show no date.
- "Survey report printed" comes before the bill, because the final survey report can be printed after assessment, before the invoice exists.

## Left to the builder

- Confirm each proof against real claims, especially `spotDetails` defaults and photo tags.
- Visual form of marks, using existing tokens; phone layout of the dashboard row.
- Tests for `claimProgress`, per survey type: nothing done; final waiting for bill; bill checked, reinspection optional; printed, not couriered; fully done.
