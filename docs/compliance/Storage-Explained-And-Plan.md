# Where Your Data Lives, and What To Do About It

**Written:** 2026-07-25 · **Status:** awaiting approval — nothing in Part 3 has been built yet
**Plain-language companion to** `DPDP-Launch-Roadmap-2026-07-25.md`

---

# PART 1 — Bramha vs Cloud Vault, in one page

## Cloud Vault (this is fine)

"Cloud Vault" is the name your app shows for **the surveyor's own claim storage**. Technically it's `users/{uid}/claims` in Firestore.

- The surveyor puts in claim data because **they need it to write their report**.
- Only that surveyor can read it. Firestore rules block everyone else.
- If they delete a claim, it's gone.
- You are holding it **for them**, like a filing cabinet you rent out.

In legal terms you are a **processor** — a tool. The insurer appointed the surveyor, the surveyor uses your tool. The purpose of storing the data is the same purpose it was collected for: assessing this claim. Nothing about this is a problem.

## Bramha memory (this is the problem)

`bramha_memories` is a **second copy** of some of that same data, in a separate collection that belongs to you.

- It's created automatically when a claim is archived — the surveyor isn't asked and isn't told.
- It sits in a **shared, top-level collection**, not under any surveyor.
- **Nobody can read it — not even the surveyor whose claim created it.** Only your server code.
- It exists to power **your** product ideas (fraud detection, intelligence).

So the same information becomes something different: not a filing cabinet you rent to a customer, but **a private library you are building out of your customers' clients' personal details.**

## The difference in one line

> **Cloud Vault** = storing the surveyor's data **so the surveyor can do their job**.
> **Bramha memory** = copying the insured's data **so you can build your own product**.

Same bytes. Same database. Different purpose — and *you* chose the second purpose, not the surveyor, not the insurer, and definitely not the insured person whose name and phone number it is.

## "But the surveyor agreed to our terms"

They can agree to things about **their own** data and about you serving **them**. They cannot agree on behalf of the **insured person** — the vehicle owner or accident victim whose name, phone, policy number and licence are in the claim. That data was given to the surveyor by the insurer for one job. It isn't the surveyor's to hand over for a different purpose.

Compare: your doctor accepting a software vendor's terms doesn't make it OK for that vendor to mine your medical records for a product.

## What's actually inside Bramha memory today

| Field | Personal data? | Needed for the useful features? |
|---|---|---|
| `embedding` (the AI vector) | no | **yes** |
| `textSummary` (vehicle, damage, costs, place) | no | **yes** |
| `vehicleMake`, `Model`, `Year`, `fuelType` | no | **yes** |
| `assessmentTotal`, `surveyType` | no | **yes** |
| `placeOfAccident` | no (weakly) | yes |
| `customerName` | **YES** | no |
| `customerPhone` | **YES** | no |
| `policyNumber` | **YES** | no |
| `vehicleRegistration` | **YES** | no |
| `sourceClaimPath` (pointer back to the original) | no | **yes** |

**Only 4 fields are the problem.** Everything that makes Bramha useful is already personal-data-free. Note the AI summary itself was built without names or phone numbers — that part was designed correctly.

**And right now the collection is completely empty.** Bramha has never written a single record. There is nothing to clean up, nothing to lose. This is the cheapest possible moment to fix it.

---

# PART 2 — Every place your data lives

There are **8 places**. Here they are, simply.

### 1. The phone/laptop itself (IndexedDB)
- **What:** the working copy of claims — including **all photos**
- **Where:** inside the surveyor's browser, on that device
- **Note:** photos are deliberately **never** sent to your servers
- **Risk:** not encrypted; if the laptop is stolen, the data is readable. Also tied to the website address — which is why moving to the new URL made everyone's local cache look empty.

### 2. Cloud Vault (Firestore `users/{uid}/claims`) — **India, asia-south1**
- **What:** claim text data — insured name, phone, policy, vehicle, damage, costs. **No photos.**
- **Who can read:** that surveyor only
- **Status:** ✅ correct and necessary

### 3. Surveyor profile & session (Firestore) — **India**
- **What:** name, email, IRDAI licence number, subscription status, device session
- **Status:** ✅ fine

### 4. Bramha memory (Firestore `bramha_memories`) — **India**
- **What:** described above
- **Status:** ⚠️ **the problem** — currently empty

### 5. Google Drive — **the surveyor's own account**
- **What:** finished reports, photos, a `claim.json` backup
- **Important:** this is **their** Drive, not yours. You never see it. You can only touch files your app created (`drive.file` permission).
- **Status:** ✅ good design. One clean-up: the backup currently includes API keys and signature — should be excluded.

### 6. SurveyOS Sync → **Telegram servers**
- **What:** claim documents (RC, licence, policy) collected via the Telegram bot
- **Where:** Telegram's servers, reached through your Cloudflare Worker
- **Status:** ⚠️ already disclosed in your privacy policy (correctly). Optional, opt-in per surveyor. Main improvement is to present Sync as a **separate product with its own terms** that the surveyor chooses to connect.

### 7. Browser localStorage
- **What:** login tokens, Drive token, SurveyOS Sync token, cached profile
- **Status:** ⚠️ plain text. Low-ish risk (tokens expire) but worth tightening.

### 8. The **old US project** — still exists
- **What:** a **complete copy of everything** — all 175 claims, all 8 accounts, all insured personal data — sitting in Google's US data centres
- **Status:** ⚠️ **You do not have data residency until this is deleted.** Keeping it as a safety net is sensible for now; leaving it forever defeats the whole migration.

## Which of these are actually a problem?

| Place | Problem? |
|---|---|
| Cloud Vault, profile, Drive | ✅ no |
| Bramha memory | ❌ **yes** — 4 fields |
| Old US copy | ❌ **yes** — once you're confident, delete it |
| Device storage, localStorage | 🔸 hygiene, not launch-blocking |
| Telegram/Sync | 🔸 already disclosed; tidy up the product framing |

---

# PART 3 — The plan (nothing here is built yet)

## Step 1 — Fix Bramha ⏱️ ~1 hour

Remove the 4 personal fields from `functions/bramha.js`. Keep `sourceClaimPath`.

**What you keep:** cost benchmarking, missed-part detection, outlier flags, damage-pattern search, duplicate-claim detection — **5 of 6 capabilities**.
**What you lose:** matching the same person/vehicle across claims.

**Why this doesn't actually lose you anything permanently:**
The full details stay in Cloud Vault forever. Bramha only stores a **pointer** to them. So if one day an insurer contracts you for fraud detection, you run a script and rebuild the full index from the original claims in an afternoon — legally, with their contract as the basis. **You keep the option without holding the risk.**

## Step 2 — Delete Bramha records when a claim is deleted ⏱️ ~1 hour
Today, deleting a claim leaves the Bramha copy behind forever. The pointer needed to fix this already exists; nothing uses it yet.

## Step 3 — Signup attestation ⏱️ ~half a day
One checkbox at signup: *"I am an IRDAI-licensed surveyor and I process claim data under the instruction of the appointing insurer."* Save who agreed, to which version, and when.
This is what properly covers your relationship with the surveyor.

## Step 4 — Small privacy-policy updates ⏱️ ~1 hour
Telegram and Cloudflare are **already** disclosed — that part is done. Still to add: a grievance contact, a plain retention statement, and describing SurveyOS Sync as a separate optional product.

## Step 5 — Housekeeping ⏱️ ~half a day
- Stop including API keys and signature in the Drive backup
- Delete the old leftover local database after migration
- Write a one-page "what to do if there's a breach" note

## Step 6 — Delete the old US project ⏱️ minutes, after you're confident
**This is what actually completes data residency.** Suggested: wait until surveyors have used the India system without issues, then delete.

## Not doing (and why that's fine)
- **No encryption of Bramha data** — encryption hides data from outsiders; the issue is what *you* do with it. It solves the wrong problem.
- **No consent screen for the insured** — they never use your app. The basis comes through the insurer.
- **No cookie banner** — you don't set tracking cookies.
- **No Data Protection Officer** — only required for very large operators.

## Cost
₹0 extra. No new services, no new subscriptions.

---

# What I need from you

| # | Decision | My recommendation |
|---|---|---|
| 1 | Remove the 4 personal fields from Bramha? | **Yes** — empty collection, costs nothing, keeps 5 of 6 features |
| 2 | Build steps 2–5? | **Yes** — about 1.5 days total |
| 3 | When to delete the old US project? | After a week of clean use |
| 4 | Sync as a separate product with its own terms? | **Yes** — honest, and decouples the two products |

## Still open, not covered here
- **The Google "Acceptable Use Policy" warning** on both projects — still unexplained. Biggest unknown risk; a suspension would take the system down.
- **`motorsurveyos.web.app`** — still reserved and unusable. Canonical URL is `motorsurveyos-in.web.app`.
- **Surveyors haven't been told the new URL** — they can't log in until they are.
