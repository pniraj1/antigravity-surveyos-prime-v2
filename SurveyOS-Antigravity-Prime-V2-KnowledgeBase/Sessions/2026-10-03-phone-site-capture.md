# Session: 2026-10-03 (Claude) — Phone site capture (P1–P3)

## What changed
Surveyors can capture a whole site survey on a phone, and the laptop sees it without any WhatsApp/cable transfer. Same website; installable.

Spec: `docs/superpowers/specs/2026-10-02-phone-site-capture-design.md`
Plan: `docs/superpowers/plans/2026-10-02-phone-site-capture.md`
Commits: 5db7c5b2..b949bb11 on `main` (13 tasks + review fixes). Not deployed. 1408 tests, tsc clean, build OK.
Executed subagent-driven: per-task spec+quality review, final whole-branch review (Opus) → 18 fixes → re-review "ready to merge".

## Phone checklist (owner, real Android + iPhone, after deploy to motorsurveyos-in)
1. Photos: Camera opens the phone camera; Drive question asked once per claim; a HEIC gallery pick shows an error toast.
2. Document card camera button opens the camera (not the gallery) and goes to the review/crop sheet.
3. Airplane mode → take 2 photos → header chip "2 waiting to upload" → signal back → chip clears.
4. Phone photos → open the claim on the laptop → banner offers exactly those → Add → reopen → no banner; "Not now" keeps it hidden.
5. Share on Photo Sheet / Annexure opens the share sheet with the PDF.
6. Add to Home screen → open the claim and Photos once → airplane mode → reopen from icon → app, claim and Photos open. Sign in on a throttled network works.
7. Opening a claim on a phone lands on Site; the reload keeps it; the laptop still lands on Documents (Details for valuation).
8. Site notes via the Gboard mic → Fill fields from notes → dialog → Apply → fields and damage rows appear; offline → button disabled with the hint.
9. Bottom bar: Site/Details/Photos/Report/More; the last row of every tab is not hidden; the extraction overlay sits above the bar.
10. Generate a Final + Spot report — unchanged.

## Deferred to P4 / owner decisions
- Owner: "Not now" on the photos banner ignores those photos for good on that device — rename to "Ignore"?
- Owner: the remembered "save to Drive?" answer is shared by photos and documents in a claim.
- Owner (info): dictated notes may fill a toggle still at its blank default (e.g. drivable = yes); the review dialog is the safeguard.
- P4: phone restyle of form tabs; header crowding at 360 px; FloatingReportPreview panel on phones (FAB hidden for now); site-notes per-keystroke IndexedDB write (check for lag with 30+ photos); SW cache growth across deploys; marketing pages registering the SW; nested-label camera check.
- Dropped from spec (see spec "Revisions"): "Download today's claims" (sync already stores claims offline); Share for main survey reports (they print through the browser).
