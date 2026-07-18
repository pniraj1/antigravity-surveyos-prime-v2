# SurveyOS Prime V2 — Actual System State (code-grounded, for knowledge graph)

> Source of truth: code in `src/`, `functions/`, `firestore.rules` on branch `main`. MD/spec files ignored. This describes WHAT THE APP DOES, not what docs intend.

## System / Deployment
- Firebase project `surveyos-prime-ce978`, hosting site `motorsurveyos`.
- One `firebase deploy` ships three targets: `hosting` (static export of `src/` → `out/`), `functions` (`functions/index.js`, `functions/bramha.js`), `firestore` (rules + indexes).
- Website is a Next.js static SPA. Auth = Google Sign-In only (`signInWithPopup`).
- Firestore/Storage region is a project setting (not in code); confirmed US multi-region → cross-border for India users.
- `open-design/` folder has a PrivacyConsentModal but is NOT in firebase.json → does not deploy → no real protection.

## Actors (Data Principals)
- SURVEYOR: the paying client; Google-authenticated; consents lightly at `/access-request`. First-party data.
- INSURED: vehicle owner; name/phone/address/policy/registration captured by surveyor; never signs up; no consent; no notice.
- DRIVER (third party): driving-licence number, parent/father name, date of birth, address — AI-extracted from scanned DL; never consents.
- ACCIDENT THIRD PARTY: injury/death/property details in free text.
- WORKSHOP: business contact details.

## DPDP Role of MotorSurveyOS (dual)
- PROCESSOR when generating reports on the surveyor's/insurer's behalf.
- DATA FIDUCIARY when re-using insured data for its own products: `bramha_memories` AI/fraud engine, telemetry analytics. Determines purpose+means → owes notice/consent/rights/erasure/breach directly. Potential Significant Data Fiduciary at volume.

## Firestore collections (what is stored)
- `users/{uid}/profile/current`: surveyor name, email, mobile, city/state, IRDAI licence, referralCode, isAdmin. Admin-gated.
- `users/{uid}/payments/{id}`: UPI payment record (amount, transactionId, date).
- `users/{uid}/claims/{id}`: full ClaimData incl. insured + driver + accident PII, photos.
- `newSignups/{uid}`: surveyor name, IRDAI licence, phone (admin reads).
- `ai_config/routing`: MASTER AI provider API keys (Gemini/Groq/OpenRouter) in PLAINTEXT. Admin-only.
- `ai_usage/{date}`: usage counters; accumulate forever (no retention).
- `bramha_memories/{auto}`: vector embedding + COPIED insured PII (customerName, customerPhone, policyNumber, vehicleRegistration, placeOfAccident) + textSummary + surveyorUid. No deletion path. No retention. Written by Cloud Function via admin SDK.

## Client-side storage (device)
- localStorage `surveyos-profile`: surveyor PAN, GST, bank account/IFSC, signature image, AND Gemini/Groq/NVIDIA API keys in PLAINTEXT.
- IndexedDB `surveyos-v2-{uid}`: full ClaimData (all third-party PII) UNENCRYPTED + photo bytes in driveQueue + telemetry incl. GPS in syncQueue.
- Legacy shared IndexedDB `surveyos-v2` never deleted → third-party PII persists on shared PCs.

## Data egress flows (where PII leaves)
1. AI document extraction (RC/DL/policy/FIR): raw page images + PII text → Gemini/Groq/NVIDIA (US/global). DL image carries face+DOB.
2. Damage-photo analysis: raw photos (plates, faces) → AI providers. No redaction.
3. Bank-statement extraction: up to 6 statement pages as images → AI providers.
4. Insured-report narrative: claim JSON (insured name, reg, financials, accident place) → AI providers.
5. Google Drive upload: original ID docs + photos + PROFILE BACKUP with API keys & signature plaintext → surveyor's own Drive (OAuth, US/global).
6. Bramha embedding: claim text → Google text-embedding-004; stores insured PII in bramha_memories.
7. Telemetry: GPS lat/lng + region + cause + vehicle + insurer → telemetry endpoint.
8. On-device IndexedDB cache: full claim incl third-party PII unencrypted.
- Active AI path = browser → provider directly using surveyor's own keys, EXCEPT NVIDIA (see next section) which transits the operator's Cloud Function. `callAI` Cloud Function (operator's master keys) exists but is dormant (client uses direct/BYOK path). Gemini safetySettings = BLOCK_NONE; code notes SAFETY block fires because model "detected personal info" → knowing PII transmission.
- No redaction, no minimization, no consent gate, no region pinning anywhere before egress.

## AI proxy data-flow — `nvidiaProxy` (recorded 2026-07-18)
- NVIDIA's REST API sends no CORS headers, so the browser cannot call it directly. When the surveyor uses NVIDIA (a last-resort fallback provider; skipped entirely if no NVIDIA key configured), the request is relayed: browser → `functions/index.js` `nvidiaProxy` (operator Cloud Function, us-central1) → NVIDIA (US/global).
- CONSEQUENCE: the operator's own infrastructure sits in the transit path of BOTH (a) the surveyor's NVIDIA API key (`nvapi-…`, passed in the callable request body) and (b) the insured/driver PII payload (RC/DL/invoice/bank-statement images + claim text). Gemini and Groq do NOT transit the operator (direct browser→provider); NVIDIA is the exception.
- Current code forwards verbatim and does NOT log or persist the key or the body (`nvidiaProxy` has no logging of `key`/`body`). Risk is latent, not active: a modified/compromised function COULD capture surveyor credentials and non-consenting insured PII at this chokepoint.
- Access now gated: `nvidiaProxy` and `callAI` require an active/trial subscription (`assertActiveSubscription`, `functions/subscription.js`) — non-subscribers can no longer transmit PII through the operator's AI functions.
- DPDP relevance: adds the OPERATOR as an additional processing point for cross-border PII egress (§16) and concentrates a security-safeguard obligation (§8(5)) at the Cloud Function; strengthens the case for a DPA covering operator-mediated AI transit.

## DPDP gap findings (severity)
- CRITICAL: Insured/driver never notified or consented (§5-6). No consent UI in shipping app.
- CRITICAL: Privacy policy & terms links exist in footer but routes 404 (dead links).
- CRITICAL: Purpose limitation breach — insured data re-used for AI/fraud (bramha_memories) without basis.
- HIGH: Right to erasure — admin-only, incomplete (leaves Auth, Drive, bramha_memories); insured has none.
- HIGH: No retention/auto-delete anywhere (storage limitation §8(7)).
- HIGH: No data minimization — full-res photos/ID scans to AI.
- HIGH: Cross-border transfer to US with no notice/safeguard (§16).
- HIGH: Security safeguards — API keys + PAN/bank in plaintext localStorage; profile+keys plaintext Drive backup; master keys plaintext in ai_config; unencrypted device cache (§8(5)).
- MEDIUM: Children's data (§9) — DOB captured, no age-gating.
- MEDIUM: No breach notification mechanism (§8(6)).
- MEDIUM: No Data-Processor contracts/DPA with AI providers (§8(2)).
- MEDIUM: No grievance/withdrawal/export UI (§13).

## IRDAI sectoral flag (beyond DPDP)
- Insurance records historically require India data-residency (IRDAI Maintenance of Insurance Records Regs). US Firebase region may breach this independent of DPDP.
- Surveyors are IRDAI-licensed; survey reports are statutory. Sending claim docs to foreign AI may conflict with insurer/licence mandates.

## Good (working) controls
- firestore.rules: per-user isolation under users/{uid}; blocks self-promotion to admin; gates payments/profile; bramha_memories and ai_config not client-readable.
- Access-control hardening (2026-07-18, deployed): subscription/approval now SERVER-enforced, not just client UI. Money fields (`subscriptionStatus/Expiry`, `trial*`, `lastPaymentDate`) are admin-write-only in rules; all claim-data WRITES require an active/trial subscription (`hasActiveAccess()`); AI Cloud Functions (`callAI`, `nvidiaProxy`) gated by `assertActiveSubscription`. Closes: rejected user using app for free; unpaid user self-restoring access by editing own profile; non-subscriber burning AI. See `docs/security/ACCESS_CONTROL_HARDENING.md`.
- Data-access model is sound; the missing layer is compliance + data lifecycle.

## Remediation priorities
- CRITICAL: build consent+notice layer; publish real /privacy + /terms; stop silent re-use (de-identify bramha_memories); decide India data residency.
- HIGH: redact before AI egress; retention TTL + cascading delete; move secrets off localStorage/Drive, route via callAI with server keys, encrypt device cache; sign DPAs.
- MEDIUM: self-service export/delete/withdrawal/grievance; breach logging; age-handling; DPO/DPIA if SDF.
