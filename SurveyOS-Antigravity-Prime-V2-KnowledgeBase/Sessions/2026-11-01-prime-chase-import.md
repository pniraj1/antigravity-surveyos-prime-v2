# Session 2026-11-01 — Scan chase import and Ask (Claude Code)

Plan: Plan 2 in the Scan repo (`SurveyOS Scan/.superpowers/sdd/2026-11-01-prime-chase-import/`).
Contract: `SurveyOS Scan/docs/handover/scan-manifest-chase.md`.
Commits: `155e618c..77bd5faa` on `main`. **Not pushed, not deployed.**

## Why
Scan now lets the surveyor save contacts, reject documents and ask for missing ones on WhatsApp or email. Prime is the reporter, so it needs that state from the manifest `chase` object.

## What changed
- `src/lib/scan-import/chase.ts`: `planChase` plans the merge. Prime's value wins; Scan fills blanks only. Stores `scanChase` (contacts, slot states, asks) and `scanClaimId`. Refuses a zip from a different phone claim.
- `src/lib/scan-import/import.ts`, `manifest.ts`, `src/types/claim.ts`: wire the plan into import and add the types.
- `src/lib/chase/ask-message.ts`: EN/HI/MR ask templates, exported as `ASK_COPY`. Links use `encodeURIComponent`.
- `src/lib/chase/ask-dialog.ts`: document list, pre-ticks, recipients, IST timestamps.
- `src/components/documents/AskForDocumentsDialog.tsx`, `DocumentsTab.tsx`: "Ask for documents" dialog beside "Bring phone scans".

## Decisions
1. Prime's value wins on every blank-check. Scan only fills blanks.
2. Asks are logged in the manifest shape, so a later Scan export round-trips them.
3. Garage documents (Estimate, Supplementary Estimate, Invoice) go to the garage. Everything else goes to the insured.
4. Slot keys like `type:title` and `(n)` suffixes resolve to their base type for the label and default recipient. The original key is still logged.

## What's unfinished
- [ ] Plan 2 says the claim shows slot states and the ask log. Only the Ask dialog reads `scanChase` so far.
- [ ] Rejected slots need a fresh copy in Ask. Not verified.
- [ ] Owner approval to push and deploy.

## Files Changed
- `src/lib/scan-import/chase.ts` (new)
- `src/lib/scan-import/import.ts` (modified)
- `src/lib/scan-import/manifest.ts` (modified)
- `src/types/claim.ts` (modified)
- `src/lib/chase/ask-message.ts` (new)
- `src/lib/chase/ask-dialog.ts` (new)
- `src/components/documents/AskForDocumentsDialog.tsx` (new)
- `src/components/tabs/DocumentsTab.tsx` (modified)
- `src/lib/chase/__tests__/ask-message.test.ts`, `ask-dialog.test.ts`, `src/lib/scan-import/__tests__/chase.test.ts`, `import.test.ts` (new/modified)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`, `Changelog.md`, `Sessions/2026-11-01-prime-chase-import.md` (this log)

## Impact on SurveyOS Scan
Scan's `AskTemplatesTest` reads `ASK_COPY` from `src/lib/chase/ask-message.ts`. Changing the copy strings needs a matching Scan change.
