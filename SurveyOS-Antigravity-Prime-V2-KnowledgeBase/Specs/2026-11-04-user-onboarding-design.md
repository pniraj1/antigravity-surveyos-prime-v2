# User onboarding — design

## Why

Surveyors on trial do not know what Prime does or where to start. The trial is 3 days, so a surveyor must reach a real report in the first session. After Drive connects they land on "No claims yet"; nothing points to Profile, and an empty profile prints "SURVEYOR NAME" on the Spot report.

## Approach

Three layers, because people forget a long tour:

1. Guided setup that does real work (welcome, profile setup, checklist).
2. Short tips the first time each screen opens.
3. Help that is always available.

## The flow

1. Sign in, approval, Drive connect: unchanged.
2. Welcome screen, once.
3. Profile setup, 3 steps: report details, signature and stamp, AI key. Bank, GST, PAN and fee schedule wait for the Fees tab.
4. "Getting started" checklist on the Dashboard, ticked from real data.
5. New claim dialog says when to use each survey type.
6. Each claim tab shows one tip on first open and names the next tab.
7. Report Center panel: each report section, what it is for, which tab fixes it.
8. Help button: what is this screen, replay, FAQ, contact.

## Phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Quick fixes: disabled tabs explained, AI key labels, empty state, survey type lines, blank-profile warning in Report Center | This build |
| 1 | Welcome, profile setup, checklist | This build |
| 2 | Dashboard tour, first-visit tips, Help button (`driver.js` only if needed, confirm size and licence first) | Later |
| 3 | Report section guide, wording reviewed by the owner | Later |
| 4 | Admin column showing each trial surveyor's progress | Later |

## Rules

- Never blocks work. Every step can be skipped or closed with Esc.
- One thing at a time; each shows once.
- Help UI never appears in printouts. Print report components are not touched.
- AppTab IDs and routing are not changed.
- AI provider names stay hidden (deliberate since `6b99a1b4`). Use plain wording: "Main AI key", never the provider's name.
- Lead with less paperwork, not AI. AI drafts, the surveyor decides.
- No AI calls, no paid service, no third-party analytics.

## Decisions

Owner-approved through the plan on 2026-11-04:

- Only name and licence number are needed to finish the details step; the rest can be skipped and stays on the checklist.
- Surveyors use a real claim, not a sample claim.
- English first.

Builder's calls (the owner can overrule):

- **Welcome shows when:** no `welcomeDoneAt` and report details are incomplete. This covers trial surveyors and skips anyone already set up, whatever their claim count.
- **Eligibility:** `active` or `trial` only, after login sync has pulled the profile, and never while the terms re-accept gate is up.
- **Licence prefill:** `licenceNumber` is prefilled from `irdaiLicence` (given at registration), because reports read `licenceNumber`.
- **Checklist wording:** the app does not record report generation or review completion. "See your first report" and "Check what was read" tick when those screens are opened.
- **Valuation:** the document and AI Review items are hidden when every claim is a valuation, since those tabs do not exist there.
- **AI key step:** skippable. The admin-key fallback in `service.ts` may cover keyless surveyors; whether it is on in the live config is unverified. The FAQ says a key is needed, so the checklist still asks.
- **Replay:** "Show setup guide" on Profile reopens the welcome and restores a hidden checklist, so the owner can see it on an admin account.

## Impact on SurveyOS Scan

None. No doc types, labels, insurer table, folder layout, claim paths or manifest change.

## Cost

No recurring cost. One extra small Firestore field on the existing profile document, pushed by the existing debounced sync.
