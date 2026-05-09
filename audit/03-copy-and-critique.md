# Pass 3 — UX Copy & Design Critique

**Audit date:** 2026-05-07
**Scope:** User-facing strings + screen-level critique on Login, Dashboard chrome (Sidebar, ClaimHeader, SaveStatusBar), NewClaimDialog, claim flow, status messaging.

---

## Summary

| Category | Findings |
|---|---:|
| Terminology inconsistency (same concept, multiple names) | 11 |
| Vague / generic error messages | 7 |
| Missing or weak empty states | 6 |
| CTA wording or hierarchy issues | 9 |
| Information-density problems (screen critique) | 8 |
| Voice / tone misalignment | 5 |
| **Total** | **46** |

**Headline:** The product has two distinct voices — a confident, modern marketing voice on the landing page and a workmanlike, slightly cramped utility voice inside the app. Inside the app, **terminology drifts** (Cloud Vault vs Drive vs Cloud Linked vs Drive Unlinked vs Not Linked all describe the same connection across four files), error messages are generic ("Sign in failed. Please try again."), and the in-app brand-voice payoff (luxury "Executive Platinum") is undercut by status messages that read like build logs.

The single highest-leverage fix is **a 1-page terminology glossary** that the team commits to. Most copy issues below trace back to that one missing artifact.

---

## 1. Terminology Inconsistency

The same concept appears under multiple names. Pick one for each row and propagate.

| Concept | Variants found in code | Recommended canonical |
|---|---|---|
| Persistent storage of claim data | "Cloud Vault" (Firestore), "Drive" / "Google Drive" (Drive folder) | Keep both — they're genuinely different systems — but **prefix every status message** with which one is being referred to. Don't say "Saved" alone. |
| Connection state to Drive | "Cloud Linked", "Drive Unlinked", "Drive — Not Linked", "Google Drive — Not Linked", "Drive up to date", "Drive — Session Expired" | **"Drive: connected" / "Drive: not connected" / "Drive: session expired" / "Drive: up to date"** — single template with `Drive: <state>`. |
| Unit of work | "Claim" (NewClaimDialog), "Survey" (`surveyType`), "Report" (`reportNo`, "Report Center") | The user creates a **claim**; inside it they perform a **survey**; the deliverable is a **report**. Document this 3-tier hierarchy and use the right word everywhere. |
| User auth action | "Sign in" (most), "Login" (landing nav button) | **Sign in / Sign out** everywhere. Update landing nav. |
| Creating a claim | "New Claim" (sidebar button, dialog title via card), "Create New Claim" (dialog title), "Create Claim" (CTA) | **"New claim"** for the entry point (nav, button labels), **"Create claim"** for the action that commits. Title sentence: "New claim". |
| Photos | "Photo Sheet" (sidebar nav), "Photos" (tab id, files), "PhotosTab" (component) | **"Photo sheet"** as the deliverable name (it's the printable artifact); **"Photos"** for the working area. Pick one for the tab label. |
| Bill check | "Bill Check" (label), "BillCheck" / "bill-check" (component / id) | **"Bill check"** (sentence-case, two words). |
| Re-link / link Drive | "→ Link Drive", "Re-link", "Manage Drive" (tooltip), "linkGoogleDrive" (function) | **"Connect Drive" / "Reconnect Drive" / "Manage Drive"**. Drop the inline arrow `→`. |
| The "Insured" report | "Insured Report" (tab label), "InsuredReport" (component), "Report for the Insured" (intent) | "Insured Report" reads as "report *about* the insured." Rename to **"Customer summary"** or **"Summary for insured"**. |
| AI conflicts | "AI Review" (sidebar tab), "AI data discrepancies" (toast), "Reconciliation" (file name, dialog) | Pick one user-facing term: **"Document conflicts"** or **"AI flags"**. Drop "discrepancies" (jargon) and "reconciliation" (back-end term). |
| Active vs archived claim | "Active claims", "completed claim" (archive copy), "Archive" (button) | **"Open" / "Archived"**. The button verb is **"Archive"** (correct); the noun for not-archived should be "open" not "active." Adjust ArchiveFirstScreen body: "You've reached the limit of 50 open claims." |

**Severity: HIGH.** Terminology drift is the primary driver of the second voice problem (§6 below).

---

## 2. Microcopy — Errors

Structure errors as: **What happened → Why → How to fix.**

| Location | Current | Issue | Recommended |
|---|---|---|---|
| `LoginForm.tsx:21` | "Sign in failed. Please try again." | Generic. No reason. User can only retry the same way and hope. | **"Couldn't sign you in. Check your internet connection, or try a different Google account."** Add a "Show details" toggle that reveals the actual error code for support. |
| `ClaimHeader.tsx:56` | "Save failed — queued for next sync" | "Next sync" is undefined. Implies time-based but the system actually retries on the next save action. | **"Couldn't save right now — your changes are safe and will sync when you reconnect."** |
| `ClaimHeader.tsx:40` | "Saved to Cloud Vault · Drive sync failed (photos queued)" | Mixes success + failure in one toast. Mentions two systems user may not distinguish. Dot separator buries the failure. | **"Saved. Photos are still uploading to Drive (we'll retry automatically)."** Ditch "Cloud Vault" in toasts entirely — user sees one thing called "saved." |
| `ClaimHeader.tsx:46` | "Saved to Cloud Vault · Drive photos pending (retry later)" | "Retry later" — by whom? | **"Saved. Some photos haven't uploaded to Drive yet. Tap Retry in the status bar."** |
| `sidebar.tsx:100` | "You have N unresolved AI data discrepancies that need attention." | "Discrepancies" is jargon. "AI data" is vague. Long. | **"AI flagged N conflict\[s\] in your documents. Review before continuing."** + make the toast clickable to jump to the AI Review tab. |
| `sidebar.tsx:388` | "Sign in failed" (toast.error) | Same generic problem as LoginForm but worse — no recovery hint. | **"Couldn't sign in. Try again or check your network."** |
| `LoginForm.tsx` (loading) | (no copy — only spinner) | SR users get silence; sighted users get an unlabeled spinner | Add **"Signing in…"** as visible text alongside the spinner; SR users hear it via aria-live. |

**Severity: HIGH.** Error copy is where users decide whether to trust the product.

---

## 3. Microcopy — Empty States

| Location | Current | Issue | Recommended |
|---|---|---|---|
| Dashboard, no claim selected | (Most sidebar nav items disabled in gray; no other guidance) | New users land on a maze of disabled items. The single "New Claim" CTA in the top-left corner is the only way out, and it competes for attention with auth status, profile, and 17 nav items. | **Render a centered empty state in the main pane:** *"No claim open. Create your first claim, or open an existing one."* with two buttons: **New claim** (primary) and **Open existing** (secondary). |
| Cloud Vault tab (claims list?) when empty | (unknown; needs verification) | Likely missing | **"No claims saved yet. Create a claim to start tracking."** |
| Photo sheet tab with no photos | (unknown; needs verification) | Likely missing | **"No photos yet. Upload from your phone, drag here, or use the Camera button."** |
| Bill Check tab before upload | (unknown; needs verification) | Likely missing | **"Upload the workshop bill (PDF or image) to begin auto-checking line items."** |
| Documents tab before docs uploaded | (unknown; needs verification) | Likely missing | **"Upload claim documents — RC, DL, policy, FIR — and we'll extract the details automatically."** |
| Reinspection tab when not applicable | (likely shows blank) | Confusing for surveyors | **"Reinspection isn't required for this claim type. \[Explain why\]"** — context-aware skip notice. |

**Severity: MEDIUM.** Each empty state is a teaching moment that the product currently skips.

---

## 4. Microcopy — CTAs

| Location | Current | Issue | Recommended |
|---|---|---|---|
| Landing hero (3 states) | "Launch App" / "Go to App" / "Enter Dashboard" | Three labels for the same action. | **"Open SurveyOS"** when authenticated, **"Start free trial"** when not. Two states max. |
| Landing nav | "Login" + "Launch App" | Inconsistent verb (sign in vs launch); "Launch App" is unfocused. | **"Sign in"** + **"Get started"**. |
| `NewClaimDialog.tsx:413` | "Confirm duplicate ↑" | Arrow points at the checkbox above — clever but ambiguous on first read. | Hide the Create button until checkbox is checked; once checked, label flips to **"Create duplicate claim"**. The unidirectional reveal is clearer than an arrow. |
| Survey type selector | "Spot / Final / Valuation" — equal-weight buttons | "Final" is the most common case but visually equal. "Final" is also a vague word; could mean "final report" or "final inspection." | Re-label: **"Final survey" / "Spot survey" / "Valuation"**. Reorder so "Final survey" is first (most common). Or pick a default. |
| Vehicle type selector | "Private Vehicle / Commercial Goods / Commercial Passenger" | Manual line breaks (`<br/>`) hardcoded for layout — fragile to translation. | Drop the manual `<br/>`; let CSS handle wrapping. Labels become **"Private" / "Commercial — goods" / "Commercial — passenger"**. |
| `SaveStatusBar.tsx:146` | "→ Link Drive" | Arrow inside text. | **"Connect Drive"**. |
| `SaveStatusBar.tsx:165` | "Re-link" | Truncated word. | **"Reconnect"**. |
| Sidebar | "Open Claim" (folder icon) | Sounds like "open this claim"; actually opens a list of existing claims. | **"Open existing"** or **"My claims"** — clearer that it's a list. |
| `ClaimHeader.tsx` save button | (cut off — "Save"?) | Verify and ensure label is **"Save"** (verb), not "Saving" (uses spinner state). |

**Severity: MEDIUM.**

---

## 5. Microcopy — Status & Toasts

The "Cloud Vault + Drive" save toasts are a maze. Current matrix from `ClaimHeader.tsx`:

| Condition | Current toast |
|---|---|
| Save OK, Drive disconnected | "Saved to Cloud Vault" |
| Save OK, Drive connected, no pending | "Saved to Cloud Vault · Drive up to date" |
| Save OK, Drive connected, photos flushed | "Cloud Vault saved · N photo(s) synced to Drive" |
| Save OK, Drive connected, flush errored | "Saved to Cloud Vault · Drive sync failed (photos queued)" |
| Save OK, Drive connected, no flush yet | "Saved to Cloud Vault · Drive photos pending (retry later)" |
| Save failed | "Save failed — queued for next sync" |

**Problem:** The user only does one mental action ("save"). They get six different sentences, all subtly different, mentioning two systems that look identical to them.

**Recommended template:**

| Condition | Recommended toast |
|---|---|
| Save OK (any Drive state) | **"Saved."** — one word. Drive state lives in the persistent status bar, not the toast. |
| Save OK + photos uploaded | **"Saved. N photo\[s\] uploaded."** |
| Save failed | **"Couldn't save. Your changes are safe locally."** + show retry chip in status bar. |

The persistent status bar handles the long tail (queued, expired, not-linked) — toasts shouldn't repeat that.

**Severity: HIGH.** The current toast set is a cognitive load tax on every save.

---

## 6. Voice & Tone

**Brand voice signals from globals.css comments:** "Executive Platinum", "Racing Gold", "VIP accents", "Premium card shadow."

**Brand voice signals from landing page:** "Motor surveying, powered by AI." / "Built for the field. Designed for speed." / "What takes 2 hours manually now happens in under 10 minutes." → Confident, modern, slightly aspirational. Apple-adjacent.

**Brand voice signals inside the app:**
- "Save failed — queued for next sync"
- "Cloud Vault — Saved"
- "v0.42.1" version pill always visible in sidebar
- "Surveyor" / "V2 · Executive" labels under user name (placeholders?)
- "OUTPUT" group label

The in-app voice reads like a build dashboard. Two voices for the same product erode trust on entry to the app.

| Voice attribute | Landing page | In-app today | Recommended |
|---|---|---|---|
| Tone | Confident, modern | Utilitarian, clipped | **Confident, calm, technical** — same temperature as Stripe, Linear. |
| Vocabulary | Accessible | Mixed (jargon: "discrepancies", "reconciliation") | Plain language, short sentences. Reserve technical terms for the Profile / Admin views. |
| Punctuation | Standard | Em-dashes everywhere, mid-sentence ellipses, dot separators | One separator pattern — pick em-dash *or* middle-dot, not both. |
| Brand mentions | "SurveyOS Prime" | "SurveyOS", "V2 · Executive", "v0.42.1" | Drop version + tier from default sidebar UI. Move to Profile page. |
| Capitalization | Sentence case | Mixed — "Cloud Vault — Saved" (Title), "Save failed" (sentence) | **Sentence case** for everything except product names. Reserve UPPERCASE for section labels (already used). |

**Severity: HIGH.** Voice consistency is what makes a product feel like one piece.

---

## 7. Screen-Level Critique

### 7.1 Dashboard / Sidebar

| Issue | Severity | Recommendation |
|---|---|---|
| 17 nav items in a single sidebar; many disabled until a claim is open. Cognitive overload on first run. | 🟡 | Hide Output items entirely until a claim exists, rather than showing them disabled. Group label "OUTPUT" then disappears too. New-user view = 3 active items: Dashboard, Profile, Cloud Vault + the New Claim CTA. |
| Brand header packs avatar + name + "Surveyor" tag + version pill into a 60px-tall row | 🟡 | Move version pill to footer or Profile. Drop "Surveyor" placeholder if it's not real role data. |
| Active claim badge and footer status block both compete for attention near the bottom | 🟢 | Move active-claim badge into the ClaimHeader (top of content area) where it belongs; sidebar stays focused on nav. |
| Disabled items are visually nearly identical to enabled items (just gray) — users repeatedly click them | 🟡 | Add a lock icon and tooltip "Open a claim to enable" on disabled items, or hide entirely (preferred — see first row). |

### 7.2 ClaimHeader (sticky navy bar)

| Issue | Severity | Recommendation |
|---|---|---|
| Reg number and insured name truncated at 120/140px | 🟡 | Vehicle reg is a fixed pattern (10 chars max) — give it 100px guaranteed. Insured name should expand to use available width before truncating. |
| Separator dots use color `#4A5568` on `#0D1B2A` = **1.5:1** — invisible | 🟡 | Use a visible separator: `#8D99AE` at lower opacity, or replace dots with `· ` characters with proper spacing. |
| "• Unsaved" pill is amber-on-amber, easy to miss | 🟡 | Make this sticky and slightly larger. Use it as the implicit save trigger — clicking the pill saves. |
| Save button is gold-on-navy, big visual weight, but the user has no clear answer to "do I have to save manually?" | 🟢 | If the app autosaves (it does — `setSaveStatus('saving')` triggers automatically?), make manual Save secondary. If it doesn't, document why. The current UI suggests both. |

### 7.3 NewClaimDialog

| Issue | Severity | Recommendation |
|---|---|---|
| Three concepts on one screen: vehicle no, survey type, vehicle type. No visible progress / no breadcrumb of fields. | 🟢 | Acceptable for power users, but consider auto-focusing first empty field after duplicate confirmation; today the focus stays in the input. |
| Duplicate-detection block expands the dialog vertically; on small screens the survey-type buttons get pushed off | 🟡 | Wrap the dialog body in `max-h-[80vh] overflow-y-auto`. |
| Three survey-type buttons of equal weight — "Final" should win by default for most users | 🟡 | Default-select "Final" (already does — verify); reorder visually so Final is leftmost. |
| "Break-in inspection — RC upload auto-fills vehicle details, surveyor fills condition manually." (when Valuation chosen) | 🟢 | Sentence packs three concepts. Recommend: **"Valuation surveys: upload the RC and we'll extract vehicle details automatically. You'll fill in condition and value manually."** |
| Vehicle type uses `<br/>` for layout | 🟢 | Remove and use CSS as discussed in §4. |

### 7.4 SaveStatusBar (bottom-left floating badges)

| Issue | Severity | Recommendation |
|---|---|---|
| Up to 3 stacked badges visible simultaneously: Cloud Vault save state + Drive Not Linked + N pending | 🟡 | Collapse into a single status pill that expands on hover/focus. Field surveyors on mobile lose 30%+ of bottom screen real estate to this stack. |
| Different background colors per state (navy, slate, orange, blue) without a key | 🟢 | Document the color semantics or unify into 2 states (OK / attention). |
| `.pulse-dot` animation infinite, no reduced-motion guard (also in Pass 2) | 🟡 | See Pass 2 P10. |
| "Manage Drive in Profile" hidden in `title=` attribute on a small "(driveEmail-prefix)" label | 🟢 | Make it a real button. |

### 7.5 Login screen

| Issue | Severity | Recommendation |
|---|---|---|
| "Welcome back" assumes returning user — first-time signed-in users see this | 🟢 | **"Sign in to SurveyOS Prime"** — works for both. |
| "New to SurveyOS? Learn more" link points at landing — fine, but small (`text-xs`) and gray | 🟢 | Keep small but make the link (`Learn more`) slightly more prominent. Also: landing page is a long page; consider deep-linking to features section. |
| Single Google sign-in option only — no alternatives | 🟢 | Acceptable if intentional. State explicitly: "We use Google to keep your data in your own Drive." Reassures privacy-conscious users (this is a brand strength on landing — surface it on login). |
| Loading spinner replaces all text | 🟡 | Show **"Signing in…"** alongside the spinner. |

### 7.6 Data grids (BillCheckGrid, AssessmentGrid)

These weren't deeply read this pass but are flagged from Pass 1's component inventory:

| Issue | Severity | Recommendation |
|---|---|---|
| Dense data grids on mobile | 🟡 | Add sticky header row, freeze first column on horizontal scroll, show scroll affordance (fade gradient on right edge). |
| No bulk actions visible at a glance | 🟢 | If common, add a sticky action bar that appears when 1+ rows selected. |
| Per-cell editing pattern unknown | 🟢 | Verify follows WAI-ARIA grid pattern (Pass 2 O5). |

### 7.7 Insured Report tab

| Issue | Severity | Recommendation |
|---|---|---|
| Tab labeled "Insured Report" — ambiguous (report *about* insured vs report *for* insured) | 🟢 | Rename to **"Summary for insured"** or **"Customer summary"**. |
| Audience-mismatch risk: copy likely written for surveyors but rendered for end-customers | 🟡 | Apply plain-language pass to all copy that the insured will read. Pair with §6 voice work. |

---

## 8. Quick Reference — Common Replacements

| Replace | With |
|---|---|
| "Cloud Vault" (in toasts) | "Saved" / drop entirely |
| "Drive Unlinked" / "Not Linked" / "Drive — Not Linked" | "Drive: not connected" |
| "Re-link" | "Reconnect" |
| "Cloud Linked" | "Drive: connected" |
| "discrepancies" | "conflicts" |
| "reconciliation" | "AI review" / "conflict review" |
| "Insured Report" | "Customer summary" |
| "Active claims" / "completed claim" | "Open claims" / "archived claim" |
| "Login" (verb) | "Sign in" |
| "Launch App" / "Enter Dashboard" / "Go to App" | "Open SurveyOS" |
| "Photo Sheet" / "Photos" | "Photo sheet" (deliverable), "Photos" (working area) — pick one for nav |
| "Confirm duplicate ↑" | (hide button until checkbox checked, then "Create duplicate claim") |

---

## 9. Priority Fixes (ranked by impact × ease)

| # | Action | Effort | Why |
|---|---|---|---|
| 1 | **Write a 1-page terminology glossary** (§1 above) and circulate to team | XS | Single source of truth; prevents future drift. Should be a `docs/copy/glossary.md` checked into the repo. |
| 2 | **Collapse the save toast matrix to 3 strings** (§5) | S | Fixes the most-frequent UX paper-cut in the app. |
| 3 | **Rewrite all error toasts in "what happened → why → how to fix" format** (§2) | S | High user-trust dividend; touches ~7 strings. |
| 4 | **Add 5–6 empty states** for Dashboard-no-claim, Photo Sheet, Bill Check, Documents, Cloud Vault, Reinspection (§3) | M | Each empty state is a teaching moment currently wasted. |
| 5 | **Hide disabled nav items entirely until a claim is open** (§7.1) | S | Cuts cognitive load on first run from 17 items to 3. |
| 6 | **Fix dialog that's not a Dialog** (overlap with Pass 2 O1) — this gets you focus trap + a11y + cleaner code | M | Pairs with Pass 2 work. |
| 7 | **Voice & tone alignment pass** — convert in-app strings to landing-page voice (§6) | M | Makes the product feel like one product. ~80–120 strings to touch. |
| 8 | **Tighten ClaimHeader** — fix separator contrast, reg/name layout, save button hierarchy (§7.2) | S | Sticky bar is on every claim screen — most visible chrome. |
| 9 | **Survey-type CTA reorder + relabel** ("Final survey" first; valuation copy split) (§7.3) | XS | One-file change, removes ambiguity for the most-common path. |
| 10 | **Convert long-running toasts (warnings/errors) to persistent banners with manual dismiss** | S | Pairs with Pass 2 U4. |

---

## 10. Recommended Sequencing

1. **Glossary + style guide (1 session, no code):** §1, §6, §8 → ship as docs PR.
2. **Status & toast cleanup (1 session):** §2, §5 → big perceived improvement. Touch ClaimHeader, SaveStatusBar, sidebar toasts.
3. **Empty states (1–2 sessions):** §3 → also requires the `EmptyState` primitive from Pass 1.
4. **Dialog & form copy (1 session):** §4, §7.3, §7.5 → small touches across NewClaimDialog, LoginForm, claim forms.
5. **Voice migration (rolling):** §7.7, §6 → tackle one surface per session, prioritized by user volume (start with sidebar + ClaimHeader since they're visible everywhere).

---

## 11. Out of Scope

- Plain-language pass for the InsuredReport content itself (the document insureds receive) — separate plan; involves legal/compliance review of phrasing.
- Email templates and notifications (e.g. approval email mentioned in recent commits) — separate copy pass.
- Translation / localization strategy — string extraction has not happened yet; copy work should precede i18n.
- Exhaustive PDF / print-report copy review (fee bills, valuation reports) — large surface, separate pass.
- Voice scripting for any voice / video onboarding content.

---

## 12. Open Questions for You

1. **Audience split:** Is the Insured Report viewed by end-customers (insureds) or just surveyors? If by insureds, voice/tone for that surface needs to be different (calm, plain, no jargon, larger type). Confirms scope of §7.7.
2. **Autosave vs manual save:** Does the app autosave on field change, or only on the explicit Save button? The toast logic + "Unsaved" pill suggest both — clarify so I can rewrite ClaimHeader confidently.
3. **Drop "Cloud Vault" in user-facing copy?** It's a marketing term for Firestore that the user can't act on. Recommendation is to drop it from toasts and the status bar, retain it as a tab label only.
4. **Voice direction:** "Confident, calm, technical" (Stripe-adjacent) is my recommendation given the surveyor audience. Or do you want it warmer (Mailchimp-adjacent), more luxurious (Aesop-adjacent), or more playful (Notion-adjacent)? Pick one before voice migration starts.
5. **Version pill / "V2 · Executive" / "Surveyor" tag in sidebar:** real labels or placeholders? If placeholders, what's intended?

These don't block Pass 4.
