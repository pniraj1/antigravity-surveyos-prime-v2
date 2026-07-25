# DPDP / IRDAI Launch Compliance Roadmap

**Date:** 2026-07-25 · **Basis:** code-grounded re-audit of `main` (delta vs. `DPDP-Audit-2026-05-30.html`)
**Status:** AWAITING APPROVAL — no code changes made yet. Decisions D1–D4 below need a call before Phase 1 starts.

---

## 1. Where we stand today (verified against current code, not the old audit)

### Fixed since the May 30 audit ✅
| Item | Evidence |
|---|---|
| `/privacy` and `/terms` pages published (were 404) | `src/app/privacy/page.tsx`, `src/app/terms/page.tsx` — real DPDP-aware content, dated 19 June 2026, names both Motor SurveyOS and SurveyOS Sync |
| Per-user Firestore isolation + admin gating | `firestore.rules` — was already sound in May, still sound |

### Still open from the May 30 audit ❌
| # | Gap | Evidence | Severity |
|---|---|---|---|
| B1 | **Bramha copies raw insured PII into a permanent vector store** — `customerName`, `customerPhone`, `policyNumber`, `vehicleRegistration` written to `bramha_memories` with no retention or deletion. This is what makes MotorSurveyOS a **Data Fiduciary** (own-purpose reuse) instead of a mere processor — the single biggest legal exposure in the product. | `functions/bramha.js:157-160` | CRITICAL |
| B2 | **Data residency** — Firestore/Storage still in a US region (no region config anywhere in the repo; needs console confirmation). IRDAI record-keeping rules push insurer-chain data toward India data centres. | no `asia-south1` anywhere | CRITICAL (for insurer procurement, see §3 D2) |
| B3 | **No consent artifact for the surveyor, no attestation covering the insured** — privacy page exists but nothing at signup records "surveyor read and agreed, version X, timestamp Y", and nothing makes the surveyor attest they process insured data under the insurer's instruction. | signup flow | HIGH |
| B4 | Secrets hygiene: profile (incl. tokens) persisted to plaintext `localStorage` (`surveyos-profile`), unencrypted IndexedDB, legacy shared IndexedDB migration leaves old DB behind, Drive backup includes API keys + signature. | `src/stores/profile-store.ts`, `src/lib/storage/indexeddb.ts` | MEDIUM |
| B5 | No data lifecycle: claim deletion doesn't cascade to `bramha_memories`; no retention policy anywhere. | `functions/bramha.js` (`sourceClaimPath` exists but nothing consumes it for deletion) | MEDIUM |

### New since the May 30 audit (the audit never saw these) 🆕
| # | Item | Evidence | Assessment |
|---|---|---|---|
| N1 | **SurveyOS Sync drive** — insured claim documents live on **Telegram's servers** (uploaded by the Sync bot), pulled into Prime via a Cloudflare Worker (`surveyos-sync-worker.pnirajindia.workers.dev`). Cross-border storage of insured PII on a messaging platform, plus a global-edge intermediary. | `src/lib/sync-bridge/client.ts` | HIGH — needs disclosure + a decision (D4) |
| N2 | Long-lived Sync **bridge token stored in plaintext localStorage** via the profile store; revocable only by clearing it in Profile (`ProfileTab.tsx:833`). | `ConnectSyncDialog.tsx:44-45` → `profile-store.ts` | MEDIUM — joins B4 |
| N3 | Announcements/notifications feature | recent commits | LOW — no insured PII, no action |

### Unchanged good news (from the May 30 reframe — still true)
AI extraction runs under the **surveyor's own API key**, browser → provider, transient, nothing stored by MotorSurveyOS. Drive backup goes to the surveyor's **own** Google account. So ~80% of the scary-looking egress is a **transparency + contracts problem, not an architecture problem**. The only flow where MotorSurveyOS itself is the cross-border fiduciary is Bramha (B1). Real engineering surface = `users/{uid}/claims` + `bramha_memories` + the new Sync bridge.

---

## 2. The legal frame in four sentences

1. **DPDP Act 2023 + DPDP Rules 2025** (Rules notified Nov 2025): most substantive obligations — notice format, security safeguards, breach intimation to the Data Protection Board, retention/erasure — phase in over ~18 months from notification (≈ mid-2027). ⚠️ *Verify exact effective dates with counsel; this is the runway assumption the phasing below relies on.*
2. The **insured/driver/third-party never consents in our app and never can** — the lawful basis must be **inherited from the insurer** (insurer → surveyor appointment → our processor role), which is a paperwork chain, not a feature.
3. **IRDAI residency** pressure does not come from DPDP (which permits cross-border transfer unless a country is negative-listed) — it comes from insurance-sector record-keeping rules and, practically, from **insurer procurement/security questionnaires** that will ask "where is the data?"
4. Bramha's own-purpose reuse of insured PII is the one thing that makes us a **Data Fiduciary** with full-stack obligations; remove the PII and we collapse back to (mostly) a processor + a fiduciary only for the surveyor's own account data.

---

## 3. Decisions needed (options + tradeoffs) — THIS IS THE APPROVAL GATE

### D1 — Bramha PII (fixes B1)
| Option | What | Cost | Tradeoff |
|---|---|---|---|
| **A. De-identify (RECOMMENDED)** | Drop `customerName`, `customerPhone`, `policyNumber`, `vehicleRegistration` from the `bramha_memories` write; keep `sourceClaimPath` for traceability. One-time cleanup of existing vectors. | ~half a day + backfill script | Loses direct cross-claim matching by phone/vehicle. If fraud-matching matters, store **salted HMAC hashes** of phone + vehicleReg instead (matchable, not readable) — +1 hour. |
| B. Keep PII, build the full fiduciary stack | Consent records, retention engine, erasure API, breach process for Bramha specifically | weeks | Not justified while Bramha is in shadow mode; permanent legal surface. |
| C. Pause Bramha entirely until post-launch | Comment out the trigger | ~zero | Delays the fraud/intelligence roadmap; easiest possible launch posture. |

### D2 — Data residency (fixes B2)
| Option | What | Cost | Tradeoff |
|---|---|---|---|
| **A. Migrate to `asia-south1` (Mumbai) now (RECOMMENDED)** | Firebase regions can't change in place → new Firebase project in asia-south1, export/import Firestore + Storage, re-point config, migrate the (few) auth users. | 1–2 days of ops work; Mumbai pricing ~10–20% above US but still ≈ ₹0 at current scale (free tier) | **Pre-launch is the cheapest this will ever be** — near-zero data and users to move. Doing it after launch means migrating live customer data. |
| B. Stay US + legal position | Argue IRDAI residency binds insurers, not a surveyor's SaaS tool; DPDP itself allows the transfer | zero engineering | Every insurer security review becomes a fight; one "data must be in India" contract clause forces a live migration later. |
| C. Defer with a trigger | Stay US; migrate when the first insurer contract demands it | zero now | Same migration, but bigger and riskier later. Acceptable only if launch customers are individual surveyors, not insurer-driven. |

### D3 — Lawful basis for the insured (fixes B3)
| Option | What | Cost | Tradeoff |
|---|---|---|---|
| **A. Attestation checkbox at signup + DPA page (RECOMMENDED)** | One checkbox: "I am an IRDAI-licensed surveyor and process claim data under instruction of the appointing insurer" + store `{uid, tosVersion, privacyVersion, timestamp}` in Firestore + a static `/dpa` processor-terms page. | ~half a day | None meaningful. This is the minimum viable consent artifact. |
| B. ToS clause only, no checkbox/record | Just text on `/terms` | ~zero | No proof any given surveyor agreed — weak in a dispute or DPB inquiry. Not worth the saving. |

### D4 — Telegram Sync flow (addresses N1)
| Option | What | Cost | Tradeoff |
|---|---|---|---|
| **A. Disclose + attribute (RECOMMENDED for launch)** | Privacy policy section naming Telegram + Cloudflare as sub-processors of the *surveyor's chosen* storage channel; connect-dialog disclosure line; Sync is opt-in per surveyor already. | ~1 hour of copy | Insured docs remain on Telegram servers (Netherlands/global). Defensible because the *surveyor* chooses the channel — same posture as their own Google Drive — but a conservative insurer may balk. |
| B. Encrypt files before Telegram upload (Sync-side) | Sync bot encrypts with a key held in the Worker/Prime; Telegram stores ciphertext only | days, in the Sync codebase, breaks in-Telegram previews | Strongest posture; queue as post-launch hardening, not a launch blocker. |
| C. Drop Telegram storage | Kill the Sync drive feature | zero code, big product loss | Only if an insurer contract ever forbids it. |

---

## 4. Roadmap (assuming recommended options A/A/A/A)

### Phase 0 — Decisions & verification (this week, no code)
- [ ] You approve/override D1–D4.
- [ ] **Confirm actual Firestore/Storage region in the Firebase console** (repo has no region marker — I can't see this from code).
- [ ] Confirm whether any launch conversation with an insurer/broker has a residency or security-questionnaire requirement (decides how urgent D2 really is).
- [ ] Skim `/privacy` + `/terms` copy vs. reality: it must mention Bramha-style internal AI use **or** we ship D1 and it doesn't need to; must mention Telegram/Cloudflare (D4-A).

### Phase 1 — Launch blockers (~2–3 days of code, my work)
- [ ] **T1: De-identify `bramha_memories`** — remove the four PII fields at `functions/bramha.js:157-160` (+ optional HMAC hashes), one-time script to strip existing vectors. *(D1-A)*
- [ ] **T2: Signup attestation + consent record** — checkbox + versioned consent doc in Firestore. *(D3-A)*
- [ ] **T3: Privacy/terms deltas** — Telegram/Cloudflare sub-processor section, grievance contact block, simple retention statement ("claim data retained until the surveyor deletes it; account data deleted on account deletion"). *(D4-A)*
- [ ] **T4: Footer links** — verify `/privacy` `/terms` are reachable from the logged-in app, not just the landing page.
- [ ] **T5: Cascade deletion** — when a claim is deleted, delete matching `bramha_memories` docs via `sourceClaimPath` (the field already exists; nothing consumes it). Fixes B5's worst half.

### Phase 2 — Residency migration — ⏳ IN PROGRESS (started 2026-07-25)

**Confirmed before starting:** old project `surveyos-v2-antigravity` Firestore was in **`nam5` (US multi-region)**, verified via `firebase firestore:databases:get`. Storage SDK is unused by the app (files go to the surveyor's own Drive / Telegram Sync), so **no Storage migration was needed** — Firestore + Auth + Functions + Hosting only.

New project: **`surveyos-v2-antigravity-in`** (alias `india` in `.firebaserc`).

- [x] Create India project + register web app
- [x] Firestore `(default)` database created in **`asia-south1`**
- [x] `firestore.rules` deployed
- [x] `firestore.indexes.json` deployed — *removed two single-field indexes (`payments.submittedAt`, `profile.referralCode`) that Firestore now auto-manages and rejects as explicit composites*
- [x] Cloud Functions deployed to **`asia-south1`** (`callAI`, `nvidiaProxy`, `onClaimArchived`) — added `setGlobalOptions({ region: "asia-south1" })` in `functions/index.js`; they defaulted to `us-central1`, which would have recreated the residency split we were migrating away from
- [x] New Google OAuth client for Drive (`drive.file` scope) created on the India project
- [x] Deployed + runtime-verified at **https://motorsurveyos-in.web.app** — auth confirmed hitting `surveyos-v2-antigravity-in.firebaseapp.com`, no console errors
- [x] Firebase **Authentication provisioned** — creating a project via CLI does *not* provision Auth; until someone opens Authentication in the console the Identity Toolkit returns `CONFIGURATION_NOT_FOUND` and sign-in popups open then close instantly with no console error
- [x] Authorized domains include `motorsurveyos-in.web.app` **and** `motorsurveyos.web.app` (pre-authorized for the reclaim)
- [x] `authDomain` set to the **branded** `motorsurveyos-in.web.app`, matching the old project's behaviour — Firebase Hosting serves `/__/auth/handler` on every site in the project (verified 200). Consequence: the Firebase-auto-created OAuth client needs `https://<domain>/__/auth/handler` added under Authorized redirect URIs, or Google returns `Error 400: redirect_uri_mismatch`
- [x] **Auth accounts migrated with UIDs preserved** — `auth:export` → `auth:import` (all 8 accounts, Google-only, no password hashes). This is why `MASTER_ADMIN_UID` stays `QCgRlZdGF3etljVitH8xq3KsTqB2` and every `users/{uid}/...` path remains valid
- [x] **Firestore data migrated: 193 docs / 21 collections**, verified by path-level diff (zero missing). `ai_config` came across, so AI provider keys did *not* need re-entering
- [x] `NEXT_PUBLIC_MASTER_ADMIN_UID` set, rebuilt, redeployed

**Migration gotcha worth keeping:** the copy script initially reported only 5 docs because it iterated `collection.get()`, which omits "missing" parent documents — `users/{uid}` holds no fields of its own and exists purely to carry `claims`/`profile` subcollections. Using `listDocuments()` instead surfaced the real 193. Any future Firestore copy must do the same or it will silently drop every claim.

`bramha_memories` **does not exist** in the source database — Bramha has never written a vector. So gap B1 is currently theoretical: fixing `functions/bramha.js:157-160` before Bramha leaves shadow mode prevents the PII from ever being written, rather than requiring a cleanup.
- [ ] Attempt `motorsurveyos.web.app` reclaim (delete site on old project → immediately create on new); fall back to keeping `motorsurveyos-in.web.app` if the name doesn't release
- [ ] Once cut over and verified: fold `.env.india` into `.env.production`, delete `.env.production.local`, decommission the old project

⚠️ **Active footgun:** `.env.production.local` currently holds the India config and silently overrides `.env.production` for **every** production build. While the old US site is still live, any rebuild-and-deploy to `motorsurveyos` would ship India config to the US URL. Delete it the moment cutover completes.

⚠️ Also cleared `.firebase/hosting.b3V0.cache` (backed up to scratchpad) — the hosting hash cache is keyed only on the `out/` dir, not the project, so the stale cache from the US project broke uploads with a confusing `paths[1] must be of type string` error.

### Phase 2b — Full problem map as of 2026-07-25 (post-migration)

**OAuth / sign-in**
| # | Problem | Status |
|---|---|---|
| O1 | Auth never provisioned on new project (`CONFIGURATION_NOT_FOUND`; popup opens then closes silently) | ✅ fixed |
| O2 | `motorsurveyos-in.web.app` not in authorized domains | ✅ fixed (both domains added) |
| O3 | `redirect_uri_mismatch` — branded `authDomain` requires `https://<domain>/__/auth/handler` on the **Firebase-auto-created** OAuth client (not the Drive client) | ✅ fixed |
| O4 | Consent screen stuck in **Testing** → only whitelisted testers can sign in; would have locked out 7 of 8 surveyors at cutover | ⬜ **publish to Production** |

**O4 correction:** an earlier version of this doc called `drive.file` a *sensitive* scope and recommended staying in Testing. That was wrong. Google classifies `drive.file` as **non-sensitive** and recommends it precisely because it avoids verification. Full scope list is `drive.file`, `userinfo.email`, `openid`, `profile` — all non-sensitive, so **publishing to Production needs no verification, shows no "unverified app" warning, and has no 100-user cap.** Testing mode was never the right posture here.

**Migration / cutover**
| # | Problem | Status |
|---|---|---|
| M1 | Firestore data (193 docs) | ✅ migrated, path-diff verified |
| M2 | Auth accounts + UIDs | ✅ 8 imported, UIDs preserved |
| M3 | Functions in wrong region | ✅ pinned to `asia-south1` |
| M4 | `.env.production.local` silently overrides `.env.production` for every prod build | ⬜ delete at cutover |
| M5 | `motorsurveyos.web.app` still served by the old US project | ⬜ reclaim after sign-in verified |
| M6 | Unused `motorsurveyos-legacy` site on old project | ⬜ harmless; delete whenever |
| M7 | **Old US project still holds a full copy of all insured PII** — residency isn't actually achieved until it's deleted | ⬜ decommission after cutover soak |

**Platform / operational**
| # | Problem | Status |
|---|---|---|
| P1 | Functions on **Node 20**, decommissioned **2026-10-30** — deploys start failing after that date | ⬜ upgrade to Node 22 |
| P2 | `firebase-functions` SDK outdated (deploy warns; upgrade has breaking changes) | ⬜ plan upgrade with P1 |
| P3 | **"Potential violation of our Acceptable Use Policy"** banner on *both* GCP projects — appears account-level, unresolved AUP flags can suspend projects | ⬜ **investigate — highest ops risk** |

### Phase 3 — Hygiene hardening (post-launch OK, ~1 week total, interleave with feature work)
- [ ] Exclude secrets (API keys, `syncBridgeToken`, signature) from the Drive backup payload.
- [ ] Delete the legacy shared IndexedDB after successful migration (code already tracks migration state — just add the cleanup).
- [ ] Breach-response runbook: one markdown page — who emails whom, DPB intimation template, 72-hour clock. Paperwork, not code.
- [ ] Data-principal rights channel = the grievance email. **No in-app DSR portal** — email is compliant and proportionate at this scale.
- [ ] (Optional, from D4-B) Sync-side encryption before Telegram upload.

### Phase 4 — Ongoing / paperwork (no code)
- [ ] One-page Records of Processing + vendor list (Google/Firebase, Cloudflare, Telegram, and the surveyor-keyed AI providers as *surveyor's* processors).
- [ ] DPA template to hand insurers/surveyors on request.
- [ ] Annual review; watch for Significant Data Fiduciary designation (extremely unlikely at this scale — SDF brings DPO + audits, not applicable now).

---

## 5. What we are deliberately NOT building (and why that's compliant)

- **No consent-manager integration** — consent managers serve data principals; our only consenting principal is the surveyor, handled by D3-A.
- **No in-app consent flow for the insured** — structurally impossible (they never touch the app); the lawful basis is inherited via the insurer chain (D3-A + DPA). This was the May-30 conclusion and it stands.
- **No cookie banner** — nothing on the landing/app sets third-party ad/tracking cookies today (re-check if analytics is ever added).
- **No DPO appointment** — mandatory only for Significant Data Fiduciaries.
- **No redaction of ID documents pre-extraction** — you cannot blur the field you're extracting; the surveyor-key/transient-processing posture is the mitigation.

## 6. Cost estimate (BYOK promise intact)

Every Phase 1/3 item is ₹0 incremental infra. Phase 2 (Mumbai region) raises Firestore unit prices ~10–20% vs. US but usage stays inside the free tier at launch scale. No new paid services, no new dependencies.

## 7. Open questions for Niraj

1. What region does the Firebase console actually show for Firestore/Storage? (blocks Phase 2 planning)
2. Does Bramha's fraud roadmap need phone/vehicle **matching** across claims? (decides plain-drop vs. HMAC-hash in T1)
3. Any insurer/broker conversation already imposing residency or a security questionnaire? (decides D2 urgency: A vs. C)
4. Is `surveyosprime@gmail.com` the official grievance contact for the policy, or do you want a dedicated address?
5. Any analytics/tracking script on the landing page I should know about? (cookie disclosure check)
