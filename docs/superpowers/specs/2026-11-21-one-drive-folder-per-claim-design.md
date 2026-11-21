# One Drive folder per claim

Status: design, not built. 2026-11-21.

## The problem in one line

Prime makes its own Drive folder the moment a claim is created, before it knows the phone already made one. So a claim scanned on the phone ends up with two folders, and sometimes three.

## The rule (the whole design)

1. **Each claim has one "home folder" on Drive.** Prime saves everything for the claim there.
2. **Prime picks the home folder the first time it needs one**, not when the claim is created.
3. **When it picks, it uses the phone's folder if there is exactly one for this vehicle.** Otherwise it makes its own.
4. **Once picked, the home folder never changes on its own.**
5. **A phone folder that is not the home folder is an inbox.** "From Phone" brings its files in and moves them to the home folder. This is how Prime and Scan already agree to work.

That's all. Every scenario below follows from these five lines.

## What "Prime needs a folder" means

The first time any of these happen for the claim:

- the surveyor clicks **From Phone**, or
- Prime saves something to Drive (a report, photos, a document, backup).

Before that, the claim has no Drive folder. That's fine: nothing is waiting to go there.

## What "a phone folder for this vehicle" means

- A folder inside `SurveyOS/Phone Scans/` whose name starts with the vehicle number. Scan names them `MH18CE7818 - NIA`, or `MH18CE7818 - NIA - 2` for a second one.
- Spaces and dashes are ignored and case doesn't matter, so `MH 18 CE 7818` matches `MH18CE7818`.
- **A phone folder already used as another Prime claim's home doesn't count.** One phone folder is never shared by two claims.

## Every scenario

| # | Situation | What happens | Folders on Drive |
|---|---|---|---|
| 1 | Phone scan done first, then claim made in Prime, then **From Phone** | Exactly one phone folder matches, so it becomes the home folder automatically. **No picker.** Notes go to the review screen, as today. | 1 |
| 2 | Phone scan done first, claim made in Prime, **From Phone never clicked**, then a report is saved | Prime needs a folder, finds the one phone folder, and makes it home. The report goes into the phone folder. The notes are **not** filled in on their own (the surveyor approves notes, never the app). | 1 |
| 3 | No phone scan at all | Prime makes its own folder (`MH18CE7818_qh0sz9`) the first time it saves. | 1 |
| 4 | Claim made in Prime, a report saved (Prime's own folder made), **then** the phone scan is done later | The home folder is Prime's own (rule 4). The phone folder is an inbox. From Phone uses it straight away when it is the vehicle's only phone folder (otherwise the picker), brings the files in and moves them into the home folder. | 2 (the phone one ends up empty except Scan's own notes files) |
| 5 | Two or more phone folders for the same vehicle (two insurers, or a re-survey) | Prime can't tell which one is right, so it doesn't guess. From Phone shows the picker, and the picked folder becomes home. If a save happens first, Prime makes its own folder and the phone folders are inboxes. | as picked |
| 6 | The surveyor picks a phone folder in the picker, but the claim already has a home folder | The picked folder is an inbox: files come in and move home. **The home folder isn't switched.** (Today it switches and leaves the old one orphaned.) | unchanged |
| 7 | Two saves start at the same moment (e.g. photos and a report) | The second waits for the first to finish picking. Both use the same folder. **This stops the "same name twice" doubles.** | 1 |
| 8 | No internet, or Drive not connected | Nothing changes from today. Saves wait in the upload queue. The folder is picked when the queue runs. | 1 |
| 9 | The vehicle number is typed wrong at Create and fixed later | Fine. The folder isn't made at Create, so the corrected number is used when it's first needed. | 1 |
| 10 | The vehicle number is changed **after** the home folder exists | The home folder stays (rule 4). Its name isn't changed. Same as today. | 1 |
| 11 | A phone folder is the home folder and From Phone is clicked again (new pages scanned) | The notes review and import run as today. Files are already in the home folder, so **nothing is moved.** | 1 |
| 12 | The same claim is open on PC and on the phone at the same time | With a phone folder, both find the same one, so 1 folder. Without one, a rare double is still possible (as today), and both stay usable. | 1 (rarely 2) |
| 13 | Old claims that already have folders | Untouched. Their home folder is whatever Prime already has saved for them. | unchanged |
| 14 | Old doubles already on Drive | Left alone. Nothing is moved, merged or deleted. | unchanged |
| 15 | Drive cleanup of completed claims | Trashes the home folder and the phone folder. When they're the same folder, it's trashed once, which is harmless. | 0 |
| 16 | The phone folder that is home is trashed on Drive by hand | Same as a trashed Prime folder today: saves fail and say so. Not in scope. | — |
| 17 | Scan keeps writing to its folder after it became home | Fine. Scan only writes its own files (`_surveyos-backup.json`, notes, the manifest) and never deletes anything. Prime's reports sit next to them. | 1 |

## What changes in Prime

1. **New Claim** doesn't make a Drive folder any more (remove one call).
2. **Picking the home folder** (`getOrCreateClaimFolder`), in this order:
   - the folder already saved for this claim, as today
   - one phone folder for this vehicle that no other claim uses: use it, and remember its Scan claim id
   - otherwise make Prime's own folder, as today
   - and only one pick runs at a time per claim
3. **From Phone**:
   - with exactly one matching phone folder, skip the picker
   - when the claim already has a home, a picked folder is an inbox and doesn't replace the home
4. **The import** skips moving files when the inbox is the home folder.

About 40 lines plus tests. Nothing to install.

## Not in this design (on purpose)

- **A "phone scan found: bring it in?" reminder** (scenario 2). Notes still need From Phone. Add it later if surveyors forget.
- **Merging or cleaning old doubles.** Risky and hard to undo.
- **Renaming folders when the vehicle number changes.**
- **Matching by insurer as well as vehicle.** Scenario 5 falls back to the picker, which is always safe.

## Impact on SurveyOS Scan

No Scan code change. Scan finds its folder by its own claim id, not by name, so a folder that Prime also uses keeps working. Update `SurveyOS Scan/docs/handover/scan-drive-status.md`: "Prime may use the Scan folder as the claim's only folder; it then moves nothing out of it." Run Scan's unit tests before committing.

## How we'll know it works

Tests for scenarios 1, 2, 3, 5, 6, 7, 9 and 11, plus all existing Prime tests and Scan's tests passing.
