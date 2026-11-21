# Competitive analysis: SURVEYMASTER (Android) vs SurveyOS

**Date:** 2026-10-24.

**Subject:** SURVEYMASTER, package `com.maquib24.insurance_tagging`, version 2.0.1 (versionCode 33). It was installed from Play on the owner's S23 Ultra on 2026-10-24.

**Method:**
- The APK was pulled to a scratch folder and never run.
- I read the manifest and metadata with `aapt2`, plus the file listing and Expo asset manifest in the APK.
- I read the Play listing, the Play Data-safety page and surveymaster.in.
- No code was decompiled. The Hermes JS bundle and the dex files were not read, per the owner's no-decompile rule, so `morluto/rea` was not used.
- I did no in-app walkthrough: logging in is needed, and that needs the owner (see §9).
- Our side was checked against **source code**, not vault notes. Where the notes and the code disagree, the code wins and the gap is flagged.

A second surveyor app is also on the phone: `com.surveyorpro.app` v1.2 (minSdk 32, installed 2026-03-29). It was not analysed. Say if you want it done the same way.

---

## 1. What SURVEYMASTER is (facts)

| Item | Finding | Source |
|---|---|---|
| Publisher | SurveyMaster, A-279 Asian Games Village, New Delhi. "RC" / Rajiv Chauhan is named in testimonials. Contact: admin@surveymaster.in. | website |
| Scope | Motor, Marine, Fire, Engineering and Livestock (a cattle muzzle-scan AI portal). A multi-line surveying company tool, not motor-first. | listing, website |
| Business model | **B2B / organisation accounts.** The app is a field companion to a web portal ("Login to Survey-Portal"). No public price; it's "Schedule a demo". | listing, website |
| Traction | 5K+ downloads, 4.4★ from 21 reviews. Reviews read like empanelled survey firms, plus one *insured* complaining that Policybazaar made them send photos through it. | Play |
| Update cadence | Play "Updated 6 May 2026". The Expo update in the APK has a commit time of about 2026-05-06. It checks for OTA JS updates **on every launch** (`EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS`), so features ship without Play releases. | listing, manifest |
| Stack | Expo / React Native (Hermes, expo-router, Reanimated, Skia, react-native-svg, VisionCamera, expo-av, expo-image-picker plus the CanHub cropper, expo-location with a background location task service, expo-file-system), and a WebView. | native libs, manifest |
| Size | base.apk 73 MB + arm64 split 35 MB = **about 108 MB installed** (about 78 MB of that is dex). minSdk 24 (Android 7), targetSdk 36. Portrait only. | adb, aapt2 |
| Bundled assets | `Watermark.png`, a product logo and a "no data" image. **Photos are stamped with a watermark.** | Expo asset manifest |

### Permissions and what they imply
- **Location:** `CAMERA` + `ACCESS_FINE/COARSE_LOCATION`, plus a background `LocationTaskService`. These give GPS-stamped photos. Location may also be tracked during a job.
- **Microphone and video:** `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `READ_MEDIA_VIDEO` and video-capture intents, plus `isoparser` (an MP4 library). Video and/or voice recording of inspections.
- **Login:** `USE_BIOMETRIC`/`USE_FINGERPRINT` give a fingerprint app lock or login. Google Sign-In (`SignInHubActivity`, auth-api-phone) gives Google login and SMS OTP auto-read.
- **Ads:** `AD_ID` + AdServices (Topics, Attribution) + **AdMob** (`ca-app-pub-5265535981052267`) + the UMP consent SDK. **They show ads in a B2B claims app.**
- **Barcode and QR:** ML Kit barcode and code-scanner, likely for QR job tags, VINs or document codes. **No ML Kit text recognition (OCR) is bundled.** The "AI damage detection" runs server-side, if at all.
- **Maps:** Google Maps (`play-services-maps`, the maps package query). A job location or route map.
- **Payments:** `org.chromium.intent.action.PAY`, a web payment (UPI) flow, likely in-WebView.
- **Calendar, SMS and dialler intents:** add the survey appointment to the calendar, plus SMS and call the insured from the job.
- **Folder access:** `OPEN_DOCUMENT_TREE` lets the user pick a whole folder (export or import).
- **Background work:** WorkManager with power, network and boot receivers, plus Room. This is the queued **offline upload** that resumes when the network returns.
- **Other bundled libraries:** BouncyCastle (crypto or signing) and Apache Commons Codec.

### Claimed features (Play listing, paraphrased)
- A guided **photo wizard** with compulsory angles, auto timestamps and annotations.
- A **share wizard**.
- **AI damage tags** "where enabled".
- A **6-stage claim tracker:** intimation, survey, under repair, processing, assessment, report submitted.
- **Offline mode** with automatic sync.
- **PDF and Excel** exports.
- **Customer signature** captured on site.
- GPS, time and device metadata on every submission.
- **User and role management** for teams.
- "API endpoints" for back-office integration.

### Data handling red flags (from public facts)
1. The Play Data-safety form says **"Data isn't encrypted… not transferred over a secure connection"**. The listing itself claims "encrypted uploads".
2. Data safety says **"No data shared with third parties"**, but the app ships AdMob with Advertising ID and Topics. The Google ad SDK sends device identifiers to Google.
3. The privacy-policy URL in the listing (`surveymaster.in/privacy`) returns **404**, and the nginx version is exposed.
4. It collects precise location, name, email, phone, files and photos. For motor claims those include the insured's RC, DL and KYC.

Under DPDP 2023 these are real exposures for any insurer or surveyor using it: no reachable notice, unencrypted transit as self-declared, and an ad SDK on KYC data. They're also an honest sales point for us, as long as **our** gaps are closed first (§5).

---

## 2. Our products, verified in code

| Product | What the code actually does (checked 2026-10-24) |
|---|---|
| **Prime** (`src/`, about 60k lines) | Claim tabs: Site, Details, Photos, Documents, Assessment, Bill Check, Reinspection, Valuation, Spot, Review, Report, Fees, Insured Report, Cloud Vault. Survey types: spot, final, reinspection, valuation (`lib/navigation/visible-nav.ts`). Reports: UIIC final (HTML and Excel), standard final, spot plus fee bill, reinspection, valuation, IRDAI summary, NIA assessment Excel, Word export (`lib/reports/`). Multi-provider BYOK AI extraction (RC, DL, policy, estimate, invoice) with evidence page tags. Claim Document Kit (portal upload sets plus an identity check). An IRDAI calc engine (depreciation, GST). A PWA service worker that warms the Site, Details, Photos and Documents tabs for offline use (`components/pwa/ServiceWorkerRegistrar.tsx`). Storage runs IndexedDB → Firestore → Drive. Site screen checklist per survey type (`lib/site/site-checklist.ts`). |
| **SurveyOS Scan** (Kotlin) | ML Kit **document scanner** (edge detection and crop), photos via the **system camera app** (`capture/PhotoCapture.kt`), Room storage, Prime-contract doc types and slots, Spot / Final / RI photo groups, odometer and chassis slots, a plate-format warning (regex only, no OCR), share, zip, folder export (SAF), Drive sync worker, a missing-documents message, trash, ads (banner) plus an ad-free purchase or promo code. Permissions: internet and ads only, **no camera, location or microphone permission at all**. |
| **Portal Fill extension** v0.4.0 | MV3 extension. Fills **NIA non-tieup** and **UIIC claim survey** from a Prime claim, with a read-only Check page. Never submits and never touches logins. Host access is limited to our site and those two portals. |

**Gaps in Prime, from the code:**
- **No GPS or time stamping or watermark on photos.** There's no `geolocation` or EXIF use anywhere in `src/`. Photos come in through `<input capture="environment">` only.
- **No customer e-signature.** "Signature" in the code is the surveyor's profile signature and stamp printed on reports.
- **No team or role model.** There's one surveyor per account, plus the owner's admin console.
- **Note drift:** the vault `Subscription_System.md` says a 60-day trial, but the live pricing code says **₹799/month (₹2,199/quarter) after a 14-day trial**. The note should be fixed.

---

## 3. Feature by feature

Legend: ✅ has it · ◐ partial · ❌ no · ? unverified (needs an in-app look).

| Area | SURVEYMASTER | Prime | Scan | Extension |
|---|---|---|---|---|
| Lines covered | Motor, Marine, Fire, Engg, Livestock | Motor only | Motor docs | NIA, UIIC motor |
| Claim / job creation | ✅ (org-assigned, intimation) | ✅ | ✅ (reg + insurer, under 15 s) | – |
| Stage tracker (intimation → report) | ✅ 6 stages | ◐ survey-type stages + fee status | ❌ | – |
| Guided photo capture, compulsory angles | ✅ wizard | ◐ Site checklist ("≥1 damage photo") | ◐ slots (4 sides, odometer, chassis, damage) | – |
| GPS / time watermark on photos | ✅ | ❌ | ❌ | – |
| Photo annotation | ✅ (claimed) | ❌ | ❌ (crop and rotate only) | – |
| Video / voice | ✅ likely | ◐ dictated notes via Gboard | ❌ | – |
| Document scanning (edge and perspective) | ◐ crop only (CanHub) | ❌ (upload) | ✅ ML Kit scanner | – |
| OCR / reading documents | ❌ on device; ? server AI | ✅ BYOK AI extraction with evidence pages | ❌ | – |
| AI damage detection | ◐ server, "where enabled" | ❌ (by design: surveyor assesses) | ❌ | – |
| Assessment grid, depreciation, GST | ? (web portal) | ✅ IRDAI engine | – | – |
| Bill check, reinspection, valuation | ? | ✅ | – | – |
| Insurer-specific report formats | ◐ "IRDA-compliant" generic PDF and Excel | ✅ UIIC final (HTML and Excel), NIA assessment Excel, standard, spot, RI, valuation, IRDAI summary, fee bill, Word | – | – |
| Customer signature on site | ✅ | ❌ | ❌ | – |
| Fill insurer portals | ❌ | – | – | ✅ NIA, UIIC |
| Portal upload set (one file per box, identity-checked) | ❌ | ✅ Document Kit | ✅ Prime-ready folder | – |
| Collect docs from the insured | ✅ (the insured uses the app, per a review) | ◐ via SurveyOS Sync (Telegram) | ❌ | – |
| Offline | ✅ native, queued sync | ◐ PWA warm cache for 4 tabs; IndexedDB first | ✅ fully local | – |
| Teams and roles | ✅ | ❌ | ❌ | – |
| Calendar, call and SMS from the job | ✅ | ◐ contact links (`lib/site/contact-links.ts`) | ❌ | – |
| QR / barcode | ✅ | ❌ | ❌ | – |
| App size | about 108 MB | web | small (target ≤ 6 MB) | tiny |
| Ads | AdMob, in a paid B2B app | none | banner on Home and Settings, non-personalised, ad-free code | none |

---

## 4. Workflow

**SURVEYMASTER:** an organisation-centric flow.
1. The back office creates or receives the intimation and assigns it to a surveyor.
2. The surveyor follows a checklist, shoots the compulsory angles (GPS and time watermarked), and gets the customer's signature.
3. Everything syncs to the web portal, where the office verifies it, assesses it and issues the report.

This suits survey **firms** with field staff and a desk. The individual surveyor is a data collector.

**SurveyOS:** a surveyor-centric flow.
1. The surveyor collects documents (Sync on Telegram, or Scan on the phone).
2. Prime reads them with AI and the surveyor confirms.
3. The surveyor assesses (IRDAI engine) and generates the insurer's own format.
4. The Document Kit builds the portal upload set, and the extension fills the portal.

The surveyor stays the author (IRDAI liability) and the admin goes away.

**Where each loses time:**
- SURVEYMASTER leaves the hardest admin (the portal entry and the insurer-format report) to the web desk.
- We leave on-site **evidence integrity** (proof of where and when the photo was taken) and customer sign-off undone.

---

## 5. Data handling and privacy (DPDP)

| | SURVEYMASTER | SurveyOS |
|---|---|---|
| Notice / privacy policy | Listing link is 404 | Live privacy page plus a legal versions module (`lib/legal/versions.ts`) |
| Transit encryption | Self-declared **not encrypted** | HTTPS (Firebase Hosting, Firestore, Drive) |
| Ad SDK near KYC | AdMob with ad ID, in the claims app | Prime: none. Scan: AdMob banner, non-personalised, **never on doc or scan screens**, ad-free route |
| Data location | Unknown | Firebase project `-in` (India); files in the surveyor's own Drive |
| Insured (non-consenting) PII | Collected directly from the insured | Same issue. The 3 launch-blocking gaps in `docs/compliance/` are still open |

**Conclusion:** we can credibly claim better privacy, but only once our own DPDP launch blockers are closed. Don't market it before that.

---

## 6. Pricing and monetisation

- **SURVEYMASTER:** an enterprise sale (demo, organisation accounts), price not public, plus AdMob revenue on top. The free Play app is useless without an organisation login.
- **Prime:** ₹799/month or ₹2,199/quarter after a 14-day trial (manual UPI). BYOK AI keeps the running cost about ₹0.
- **Scan:** free with ads, ad-free by purchase or promo code.
- **Extension:** free.

**Our edge:** a single surveyor can start in minutes for less than ₹30 a day, with no sales call.

---

## 7. What they do better / where we win

**They do better:**
1. GPS and time watermarked photos, the evidence standard insurers increasingly ask for.
2. Compulsory-angle photo wizard.
3. Customer e-signature on site.
4. Claim stage tracker.
5. Teams and roles for survey firms.
6. Multi-line coverage.
7. OTA updates on every launch.
8. A store presence that comes up for "survey master" searches.

**We win:**
1. **Insurer formats:** UIIC and NIA exact reports and Excel.
2. **Portal fill**, which nobody else does.
3. The **Document Kit** portal upload set with an identity check.
4. **AI reading documents** with page evidence, while the surveyor stays the assessor (IRDAI-safe).
5. The IRDAI assessment, bill check, RI and valuation engine.
6. A small app versus 108 MB.
7. No ads near KYC in Prime.
8. Practically free (BYOK).
9. Built by a practising surveyor for the individual surveyor.

---

## 8. Ideas for us, ranked

Effort is counted in build sessions. One session is roughly one focused Claude Code session plus a review. Running cost assumes the free tiers.

| # | Idea | Why | Effort | Running cost |
|---|---|---|---|---|
| 1 | **GPS + time stamp on Scan photos.** Take location only on capture (on-tap permission, never background). Burn a small text strip (date, time, lat/long, reg no.) into the JPEG, and write the same into the EXIF and the export manifest. Toggle per claim, default on for damage photos. | Closes their #1 evidence advantage. Insurers ask for it. The surveyor's own phone, so no new server. | 1–2 sessions (needs a Scan camera-permission decision: keep the system camera intent, then stamp after capture) | ₹0 (Fused Location, on device) |
| 2 | **Compulsory-angle checklist in Scan and Prime Site.** Show front, rear, left, right, odometer, chassis and damage as must-have slots with ✓ and a "missing" count. Mostly already there as slots; make them required per survey type. | Matches their wizard at almost no cost. Reuses `Slots.kt` and `site-checklist.ts`. | 0.5–1 session | ₹0 |
| 3 | **Same stamp in Prime Site and Photos.** Use `navigator.geolocation` on capture and draw on a canvas in `compress-image.ts`. | Parity on the web and PWA. | 1 session | ₹0 |
| 4 | **Customer e-signature** (canvas pad) on the Site screen. Store it as an image on the claim and print it in the spot and final reports ("Insured / driver acknowledgement"). | They have it, and spot surveys benefit. | 1 session | ₹0 |
| 5 | **Simple stage tracker** on the claim list: Intimated → Surveyed → Under repair → RI → Report sent → Fee received, using existing fee status and survey type. | Their tracker is a visible selling point; ours is implicit. | 1 session | ₹0 |
| 6 | **Close the DPDP launch blockers, then publish a privacy comparison** (encrypted transit, India region, no ads on KYC, working notice). | Turns their red flags into our advantage. Must come before any claim. | Per the existing `docs/compliance/` roadmap | ₹0 |
| 7 | **Photo annotation** (circle or arrow on damage) in Scan's edit page. | Nice to have, claimed by them. | 1 session | ₹0 |
| 8 | **Small-firm team mode** (owner plus 2–5 surveyors sharing claims). | Their core market. A big change to auth and sync. Only if firms ask. | 4–6 sessions | Firestore reads; likely still within the free tier for small firms |

**Not recommended:**
- AI damage detection. It goes against assessment being surveyor-made, and it costs money per image.
- Marine, Fire or Livestock lines. Off-focus.
- Background location tracking. A privacy cost with no admin saving.

---

## 9. Not covered / next step

- No in-app look. Screens, report samples and the real photo wizard are unverified ("?" above). If the owner logs in and opens screens, I can capture `uiautomator dump` and screenshots without tapping inside the account.
- `com.surveyorpro.app` was not analysed.
- Scratch copies of the APKs are kept outside the repo (session scratchpad). Delete them when done.
