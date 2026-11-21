# Copy — Public Site Rev. B

> Source of truth for every user-facing string before sign-in. Phase 2.
> Strings are copied from here into components; do not rewrite them in JSX.

---

## 0 · The thesis — read this before writing any string

**A surveyor's job is to assess and authenticate. Everything else is admin that
grew around the job.**

Retyping the chassis number for the eighth time. Running behind the insured and
the insurer for a document. Rebuilding the fee bill in a spreadsheet. Driving
200 km, coming home, and starting the report at ten at night — on the one
desktop where the report lives, so that standing at a garage the next morning it
may as well not exist.

None of that is surveying. Surveying is looking at a damaged vehicle, deciding
what it will honestly cost to put right, and putting your licence to that
number.

**Motor SurveyOS removes the admin so the surveyor can do the only part that
needs a surveyor.** AI is one tool it uses. The cloud is another. Neither is the
product, and neither is ever the headline.

> This corrects the first draft of this document, which was built around "AI
> reads your documents". That is a mechanism. Leading with it makes the product
> sound like a document scanner and quietly insults the reader by implying the
> valuable part of their day was the typing.

---

## 1 · Who is reading — and who is writing

**Reading.** An IRDAI-licensed independent motor surveyor. Middle-aged, solo or
a small firm, on an Android phone, often on mobile data, frequently standing in
a garage. Charges ₹1,500–5,000 a survey, so ₹799/month is not the objection.

**Their licence is on every report they sign.** Every question they ask is a
version of one question: *can this get me a query from the insurer, or trouble
with IRDAI?*

**Writing.** Niraj Patil — a practising surveyor, B.E. Mechanical, MBA (HTW
Berlin). Son and brother of surveyors. This is not a vendor writing to a market;
it is **a surveyor writing to colleagues**, and the register has to be
peer-to-peer throughout. No sentence should sound like it was written by someone
who has not stood in a workshop with a torch and a measuring tape.

The product is dedicated to **Vikram Patil and Viraj Patil**. That dedication is
not decoration — it is the most credible thing on the site, because nobody
fabricates a father.

---

## 2 · Six rules the copy obeys

**1 · Frame the loss, not the gain.**
Losses weigh roughly twice as much as equivalent gains. The operative loss here
is not time — it is the **reopened file**. "Save two hours" is a weak line.
"That's a query three weeks later, and your name is on the report" is not.

**2 · Never trigger reactance.**
This reader's professional autonomy *is* their identity. Any sentence implying
the software does their job provokes resistance and they leave. Copy must grant
authority back, explicitly and often: *you still sign it · the software does not
decide · you review every figure.* This is the single most important rule on the
page, and it is why the hero headline ends the way it does.

**3 · Concrete beats abstract.**
Concrete nouns are recalled about twice as well as abstract ones, and they
signal insider knowledge. Write `MA3EYD32S00123456`, not "vehicle details."
Write "fee bill", not "billing workflow."

**4 · Easy to read is judged as true.**
Processing fluency is mistaken for truthfulness. Short declaratives. Common
words. One idea per block. No stacked subordinate clauses. This reader may be
working in their second or third language and is often on a phone in bad light.

**5 · Precise numbers, or none.**
`₹7,990` reads as calculated; `₹8,000` reads as invented. "43 surveyors across
11 cities" reads as counted; "thousands of surveyors" reads as claimed — and in
a market this small it gets checked and caught within the hour. One caught
overclaim destroys more trust than ten accurate claims build.

**6 · Speak their vocabulary.**
spot survey · final survey · fee bill · reinspection · salvage · CTL · RC · DL ·
policy schedule · IRDAI · assessed value · depreciation slab. Using these words
signals membership. SaaS vocabulary signals outsider.

---

## 3 · Banned

**Words.** platform · solution · seamless · effortless · powerful · robust ·
cutting-edge · revolutionise · transform · empower · unlock · leverage ·
streamline · supercharge · game-changing · next-generation · delightful ·
magic · lightning fast · blazing · world-class

**Boasts.** Any accuracy percentage. Any user count that has not literally been
counted. "Trusted by" · "industry-leading" · "join thousands."

**"AI" as a boast.** It may appear as a plain description of a mechanism. It may
never be the benefit, and it may never appear in the hero.

The reason is not squeamishness about the technology — AI is genuinely what
makes the document reading possible, and the site says so plainly where it is
relevant. The reason is that **leading with AI describes the tool instead of the
reader's day**, and it quietly implies the valuable part of a surveyor's work
was the typing. It was not. The valuable part was always the judgement; the
typing was the tax. Say what the surveyor gets back, not what the software runs
on.

---

## 4 · Landing page — every string

### Nav
| Slot | String |
|---|---|
| Brand | `Motor SurveyOS` |
| Link 1 | `How it works` |
| Link 2 | `What it covers` |
| Link 3 | `Pricing` |
| CTA | `Try it — no account` |

### Hero

**Eyebrow** — `For IRDAI-licensed motor surveyors`
*Qualifies the reader in five words. A visitor who isn't one should leave now;
one who is has just been told this was built for them specifically.*

**Headline** — `Surveying is the assessment.` / `The rest is just typing.` — **LOCKED**

*Chosen 03 Aug 2026. It states the thesis as a fact about the profession rather
than an instruction to the reader, which is why it lands warmer than the
sharper alternate. The first sentence is something a surveyor already believes;
agreeing with it costs them nothing, and having agreed once they read on. The
second sentence does the demotion — "just typing" reduces two hours of nightly
admin to what it actually is. Nothing about AI, because AI is not the point.*

Not chosen:
- `Your licence is for judgement.` / `Not for data entry.` — sharper, more confrontational. Reads slightly as being told about your own job.
- `The report writes itself.` / `You still sign it.` — strong and reactance-safe, but it centres the software, and "writes itself" leans on the AI framing being demoted.
- `Assess. Authenticate. Go home.` — the most emotional option and the biggest risk: flippant if the page has not yet earned it.

**Subhead**
> Reads the documents so you do not retype them. Chases the papers you are
> missing. Keeps the whole claim file on your phone. What is left is the part
> only a surveyor can do.

*Four short declaratives naming the four hurdles in the order the day presents
them: typing, chasing, being tied to a desk, and then — finally — the actual
work. The last clause is the thesis in nine words.*

**Primary CTA** — `Open it — no account needed`
*Names the removed friction instead of naming the commitment. "Start free
trial" implies a wall; this says there isn't one.*

**Secondary CTA** — `See a finished report (PDF)`

**Trust line** — `No card · Data stays in India · Licence verified before activation`

### Trust strip

| Heading | Body |
|---|---|
| `Built by a surveyor` | `Not by a software company that read about the job. Written by a practising surveyor, for his own work first.` |
| `Licence verified` | `Every account is checked by a human against your IRDAI details before it is activated.` |
| `Stored in India` | `Claim records sit in Google Cloud's Mumbai region. Photographs never reach us at all.` |
| `On every device` | `The claim file is on your phone at the garage, not on one desktop at home.` |

*"Built by a surveyor" now leads, ahead of licence verification. It is the one
claim no competitor can copy and no amount of funding can buy, and it reframes
everything read afterwards.*

### Act 01 — Intake

**Eyebrow** `01 — Intake`
**Heading** `Stop typing the RC book.`
**Body**
> Point it at a registration certificate, a driving licence or a policy
> schedule. The fields arrive filled in, each one carrying a link back to the
> line it came from.

**Kicker** `Roughly two hours of a final report is transcription. This is that part.`
*A number about their day, not about the software.*

### Act 02 — The chasing

**Eyebrow** `02 — Collection`
**Heading** `Stop running behind` / `the papers.`
**Body**
> Half a survey is waiting on somebody else. The insured has the licence, the
> workshop has the estimate, the insurer wants the whole file. SurveyOS Sync
> lets them send a document to a Telegram bot, and it lands in the claim ready
> to attach.

**Kicker** `Every pending document across every open claim, on one screen. Chase all of them in one tap, or stop chasing.`

*This was a footnote in the first draft and it should not have been. Chasing
documents is a daily tax on every surveyor, and it is the hurdle they complain
about to each other. Optional by design — connect it if it suits how you work.*

### Act 02 — Reconciliation · **the peak**

**Eyebrow** `02 — Reconciliation`
**Heading** `It catches the mismatch` / `before the insurer does.`
**Body**
> Every document says the same things in a different layout. When two of them
> disagree, that is a query three weeks later — and your name is on the report.

**Kicker** `Two digits. That is the whole difference between a clean file and a reopened one.`

*This is the emotional centre of the page and it is built entirely on loss
aversion. "Your name is on the report" is the most important clause on the
site. Everything before it earns attention; this is what converts.*

### Act 04 — The desk at ten at night

**Eyebrow** `04 — Anywhere`
**Heading** `The claim file is on` / `your phone. All of it.`
**Body**
> Two hundred kilometres in a day, and then the report starts at ten at night —
> because the file only exists on one desktop at home. Standing at the garage
> the next morning, it may as well not exist at all.

**Kicker** `Every claim, every photograph, every figure, on whatever you are holding. It syncs when the signal comes back, and it works when it does not.`

*The most human hurdle on the list, and the reason the cloud is in this product
at all. It is written from a specific memory rather than a feature list, which
is why it will land. Note it never says "cloud sync" — it says the file is on
your phone.*

### Act 05 — Assessment

**Eyebrow** `05 — Assessment`
**Heading** `The figures cannot disagree.`
**Body**
> Depreciation, material splits and GST are computed per row. The final report,
> the fee bill and the summary all read from the same numbers.

**Kicker** `You review every figure and put your licence to it. The software does not decide.`
*Second reactance neutraliser, placed immediately after the section where the
software looks most autonomous.*

### Act 04 — Check our work

**Eyebrow** `Check our work`
**Heading** `The depreciation engine,` / `running right here.`
**Body**
> Not a video of it. The engine itself, in your browser, with no account. Change
> the part and the age — check the slabs against what you already know is right.

*Inviting scrutiny is an authority move: only someone confident in the maths
asks to be audited. It also replaces the banned accuracy percentage with
something the reader can verify in ten seconds.*

### Act 05 — Scope

**Eyebrow** `04 — Scope`
**Heading** `One claim file,` / `start to signed.`
**Body**
> Not a document reader with a report bolted on. The whole survey — including
> the parts other tools leave you to rebuild in a spreadsheet.

Tab labels: `Details` `Photos` `Assessment` `Bill Check` `Valuation`
`Documents` `Reinspection` `Spot` `Fees` `Report` `Cloud Vault` `Offline`

### Act 06 — On site

**Eyebrow** `05 — On site`
**Heading** `Spot report,` / `before you leave.`
**Body**
> Capture the damage, list the affected parts, and the spot report assembles
> itself — driver particulars, licence check, accident details, damage schedule.

**Kicker** `A basement parking with no signal does not stop a survey. It stores on the device and syncs when the connection comes back.`

### Act 07 — Pricing

**Eyebrow** `Pricing`
**Heading** `One survey fee covers` / `about three months.`
*Anchors against their own revenue, not against a competitor's price. The
comparison the reader runs is "one job" — which makes the number feel small
without discounting it.*

**Subhead** `14 days free, no card. 28 days if you come in on another surveyor's referral code.`

| Plan | Amount | Period | Note |
|---|---|---|---|
| `Monthly` | `₹799` | `per month` | — |
| `3 months` | `₹2,199` | `for 3 months` | `Save ₹198` |
| `12 months` | `₹7,990` | `for 12 months` | `2 months free` |

**Referral** — `Refer a surveyor and you both gain: they get 14 extra trial days, you get 30 days added when their first payment clears. No cap.`

> All amounts and durations must be read from `src/lib/subscription/plans.ts`
> (`PLANS`, `TRIAL_DAYS`, `REFERRAL_TRIAL_BONUS_DAYS`, `REFERRER_REWARD_DAYS`),
> never hardcoded. The current live site hardcodes them and contradicts itself
> — the nav says 14 days, the pricing card says 30.

### Act 09 — Why this exists · **the ending**

**Eyebrow** `Why this exists`
**Heading** `I watched my father` / `type until midnight.`
**Body**
> He has been a motor surveyor for most of my life. I have watched him drive two
> hundred kilometres in a day, come home, eat, and then start the report at ten
> at night. The report lived on one desktop computer. If he needed it at a
> garage the next morning, it may as well not have existed.
>
> I am a surveyor too. So is my brother. Between the three of us we have typed
> the same chassis number into the same form more times than I can count.
>
> None of that is surveying. Surveying is looking at a damaged vehicle, deciding
> what it will honestly cost to put right, and putting your licence to that
> number. Everything else is admin that grew around the job.
>
> Motor SurveyOS exists to take the admin away. Documents are read so nobody
> retypes them. The claim file is on your phone, not on a desktop at home. What
> is left is the part that needs a surveyor — and that part stays yours. The
> software extracts, reconciles and flags. It does not decide. Your name and
> your licence are on the report, so the judgement has to be too.

**Signature** `Niraj Patil · B.E. Mechanical · MBA, HTW Berlin · practising surveyor, Pune`

**Dedication** `For Vikram Patil and Viraj Patil — and for every surveyor in India still typing at eleven at night.`

> Both names are used **with their consent**, confirmed 03 Aug 2026. If that
> ever changes, the line still works as "For my father and my brother" and
> loses very little.

*This is the ending, and it is deliberately the last thing read. The peak-end
rule says the strongest moment and the final moment are what get remembered:
the peak is the caught mismatch, the end is this.*

*It works for reasons no amount of marketing spend can replicate. **Nobody
fabricates a father.** The specific detail — 200 km, ten at night, one desktop —
is unfalsifiable-feeling in the way real memory is and invented copy never is.
And it converts the founder from "one person in Pune", which reads as a
limitation, into a practising surveyor with an engineering degree who built the
tool his own family needed, which reads as the only credential that matters
here.*

*The dedication line does the heaviest lifting of anything on the site. It
tells the reader this was not built to capture a market. It was built for
someone.*

### Close

**Heading** `Do a real survey in it.` / `Decide after.`
**Subhead** `No account, no card. Everything stays on your device until you want the report out.`
**Primary CTA** `Open Motor SurveyOS`
**Secondary CTA** `See a finished report (PDF)`

*Ends on reassurance, not pressure. The last thing read is disproportionately
what is remembered, and for a risk-averse reader the strongest closing note is
"you cannot lose anything by trying this."*

---

## 5 · Microcopy

### Buttons
Say what happens. `Open Motor SurveyOS` · `See a finished report` · `Start free trial` ·
`Copy referral code` → on success, `Copied`.

### Sign-in states
| State | String |
|---|---|
| Pop-up blocked | `Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.` |
| Cancelled | *(silent — cancelling is a choice, not an error)* |
| Network | `Could not reach the sign-in service. Check your connection and try again.` |
| Awaiting approval | `Your licence details are with us. Accounts are usually activated within a working day, and you will get an email.` |
| Trial ended | `Your trial has ended. Every claim is still here and nothing has been deleted — you can read them, but not edit until you subscribe.` |

*No apologies, no "oops", no "something went wrong". Each says what happened
and what to do.*

### Alt text
Describe what the image shows a surveyor, not what the file is.
- ✓ `A completed final survey report, with the assessed total and the surveyor's licence number`
- ✗ `Screenshot of report`

---

## 6 · SEO strings

**Title** `Motor survey reporting for IRDAI surveyors | Motor SurveyOS`
**Description**
> Reads the RC, licence and policy, reconciles them, and drafts your spot and
> final survey reports. Works offline. 14 days free, no card.

*Note what is absent: "AI-powered", "revolutionary", and any accuracy figure.
The current description leads with "AI-powered" and targets a category name
nobody in India searches for.*

**OG title** `The report writes itself. You still sign it.`
**OG description** `Motor survey reporting built for IRDAI-licensed surveyors. Reads your documents, catches mismatches between them, drafts the report. 14 days free.`

---

## 7 · Voice, in one line

**Write like a competent colleague explaining something, not like a company
selling something.** If a sentence would sound strange said out loud to a
surveyor over tea, it is wrong.
