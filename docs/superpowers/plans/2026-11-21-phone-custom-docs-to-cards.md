# Phone custom documents reach the Auth Certificate and Load Challan cards

**Goal:** A document the surveyor scans in SurveyOS Scan under a custom name (e.g. "Authorization", "Load Challan") shows on Prime's matching Documents-tab card ("From phone — click to read"), not only in the generic Phone files list.

**Root cause (evidence):**
- Scan has no load-challan or authorisation doc type (`SurveyOS Scan/app/.../contract/PrimeContract.kt` `DocType`). The surveyor uses a custom name; Scan exports it as a root PDF `<Title>.pdf` with manifest type `other` (`export/ExportLayout.kt` `layoutFor`, `otherStem`).
- Prime imports it as an `other` document (`src/lib/scan-import/import.ts` `toDocType`). That works; it lands in the Phone files list.
- Prime's Documents-tab cards `auth` and `load-challan` map to `other` (`src/types/documents.ts` `FIELD_KEY_TO_DOC_TYPE`), and `phoneFileFor` returns `null` for any card whose type is `other` (`src/lib/scan-import/cards.ts:22`). So these two cards never see a phone file.

**Spec:** this file (no separate spec). Contract with Scan is unchanged: no new doc types, no manifest change.

## Global Constraints

- Prime only. Do not edit `../SurveyOS Scan`, `src/types/documents.ts` or the manifest shape.
- Commit directly on `main` (owner rule, no branches). Stage only the files you changed; another session may have edits in this checkout.
- Smallest diff (ponytail). No new dependencies.
- Vitest: `npx vitest run <path>`.
- Commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Task 1: `phoneFileFor` matches `other` phone files to the auth and load-challan cards by file name

**Files:** `src/lib/scan-import/cards.ts`, `src/lib/scan-import/__tests__/cards.test.ts`.

**Behaviour:**
- `phoneFileFor(claim, 'auth')` returns the newest document with `source === 'scan'`, `type === 'other'`, whose file name (last segment of `relPath`, extension dropped) matches `/auth/i` (Auth, Authorization, Authorisation, Authority letter). Otherwise `null`.
- `phoneFileFor(claim, 'load-challan')` does the same with `/load\s*challan|challan|consignment|bilty|e-?way\s*bill|\blr\b/i`.
- Any other card whose type is `other` still returns `null`. Cards with a real type (rc, dl, ...) behave exactly as now.
- Keep the patterns in one small exported map, e.g. `OTHER_CARD_NAMES: Record<string, RegExp>` keyed by card id.
- `phoneListGroups` is unchanged (the file also stays in the Phone files list).
- Update the `CARD_DOC_TYPES` comment if it becomes misleading.

**Tests (write first, see them fail):**
1. A scan `other` doc `Authorization.pdf` → `phoneFileFor(..., 'auth')` returns it; `phoneFileFor(..., 'load-challan')` returns null.
2. A scan `other` doc `Load Challan.pdf` → returned for `load-challan`, not for `auth`.
3. Two matching docs → the newest (last in `claimDocuments` order, i.e. later `addedAt`) is returned.
4. An `other` doc `Insurance letter.pdf` → null for both cards.
5. An `upload`-source `Authorization.pdf` → null (only phone files).
6. A path inside a subfolder, `Other/Authorization 2.pdf`, still matches `auth`.

Done when the cards tests and `npx vitest run src/lib/scan-import src/components/documents` pass, committed on `main`.
