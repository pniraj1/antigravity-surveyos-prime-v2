# 2026-11-21 — Parser-miss samples (Claude Code)

Owner asked for a way to learn from bills the row parser cannot read. The parser now keeps a copy of a declined digital bill so the owner can look at it from Dev Notes.

## What was built (on main, not deployed)
- **Sender:** `src/lib/ai/parser-sample.ts`. When the row parser declines a digital estimate or final bill, the PDF goes to Firestore `parserSamples/{sha256}`. Its bytes are split into `parserSampleChunks` pieces (≤900,000 bytes each, ≤8,000,000 bytes per file). Metadata: uid, docType, fileName, reason, pages, size, chunks, createdAt, expireAt. No claim id, no insurer.
- **Digital-only guard:** `src/lib/ai/parser-first.ts` (`allPagesDigital`). Every page must have a detected text layer. Scanned or image PDFs, and forced Text mode on a scan, are never sent.
- **Hook:** `src/lib/ai/processor.ts`.
- **Surveyor:** sees nothing. All failures are swallowed.
- **Re-send:** the same file is denied (create-only, sha256 id).
- **Rules (`firestore.rules`):** create only by active or trial accounts; pieces must arrive in the same batch as their sample; admin read and delete only; nobody updates.
- **Admin:** Dev Notes tab, "Bills the parser couldn't read" card (`src/components/admin/ParserSamplesCard.tsx`, `src/components/admin/tabs/DevNotesTab.tsx`). Download opens a save dialog first, then loads the sample, checks piece count and size, and saves. Only after a confirmed save does it delete the sample and all pieces, in one batch. Cancel or any error never deletes.

Commits: `38bda1cf`, `ea14609f` (sender and digital-only guard), `06eeb1bc`, `82ac0a9b` (rules), `83e9acbb`, `d93022ba` (admin card).

Tests: `src/lib/ai/__tests__/parser-sample.test.ts`, `src/components/admin/__tests__/parser-samples-card.test.tsx`.

## Decisions
- Silent collection. The owner chose not to tell the surveyor.
- A Terms/Privacy line was offered and not added. Open DPDP item, keep visible.
- Plan: `docs/superpowers/plans/2026-11-21-parser-miss-samples.md`.

## What's unfinished (owner steps)
- [ ] Deploy `firestore.rules` and hosting to `surveyos-v2-antigravity-in`. Never run a bare `firebase deploy`.
- [ ] Turn on TTL so nothing is kept forever:
  - `gcloud firestore fields ttls update expireAt --collection-group=parserSamples --enable-ttl --project=surveyos-v2-antigravity-in`
  - `gcloud firestore fields ttls update expireAt --collection-group=parserSampleChunks --enable-ttl --project=surveyos-v2-antigravity-in`
  - Until TTL is on, nothing auto-expires.
- [ ] Decline one real digital PDF, then download it from Dev Notes and check it.
- [ ] DPDP: decide on a notice line in Terms or Privacy.

## Prime ↔ SurveyOS Scan impact
None. Scan's manifest, folder layout and notes are unchanged.

## Files changed
- `src/lib/ai/parser-sample.ts` (new)
- `src/lib/ai/parser-first.ts` (allPagesDigital)
- `src/lib/ai/processor.ts` (hook)
- `firestore.rules`
- `src/components/admin/ParserSamplesCard.tsx` (new)
- `src/components/admin/tabs/DevNotesTab.tsx`
- `src/lib/ai/__tests__/parser-sample.test.ts` (new)
- `src/components/admin/__tests__/parser-samples-card.test.tsx` (new)
- `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`, `Changelog.md`, this file (docs)
