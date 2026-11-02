# SurveyOS Scan — Launch Blueprint & Marketing Video Strategy

> Date: 2026-11-02  
> Context: Prepared for mobile/remote continuation via GitHub & Gemini.  
> App: SurveyOS Scan (`in.surveyos.scan`) & Motor SurveyOS Prime (`pniraj1/antigravity-surveyos-prime-v2`).

---

## 1. Google Play Store Launch Blueprint

If the app is built and tested, here is the exact roadmap to get **SurveyOS Scan** live on the Google Play Store:

### 1.1 Accounts & Prerequisites
- **Google Play Console Account**: $25 one-time registration fee.
  - Complete identity & address verification.
  - *Notice for personal developer accounts created after Nov 2023*: Google requires a **14-day Closed Test with at least 12 testers opted in continuously** before production access is unlocked.
- **Google AdMob Setup** (Required by release build guards):
  - Register app in AdMob Console (`SurveyOS Scan`, Android).
  - Create Banner Unit ("Home and Settings banner").
  - Put IDs into `local.properties`:
    ```properties
    ADMOB_APP_ID=ca-app-pub-xxxxxxxxxxxxxxxx~xxxxxxxxxx
    ADMOB_BANNER_ID=ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx
    ```

### 1.2 Signing Key & Keystore
- Generate upload keystore once:
  ```powershell
  & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore surveyos-scan-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
  ```
- Configure `keystore.properties` (git-ignored) with `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
- Build release bundle:
  ```bash
  ./gradlew :app:bundleRelease
  ```
  Produces: `app/build/outputs/bundle/release/app-release.aab` (~9.4 MB upload size).

### 1.3 Public Privacy Policy Hosting
- Play Store strictly requires a public URL.
- The privacy policy is already authored at `SurveyOS Scan/docs/release/privacy-policy.md`.
- Host on Firebase Hosting (e.g., `https://motorsurveyos-in.web.app/scan-privacy`). Fill in the real support email (e.g. `surveyosprime@gmail.com`).

### 1.4 Store Listing & Content Rating
- **Title**: `SurveyOS Scan`
- **Short Description (79 chars)**: `Scan claim papers and photos into a ready-to-use, correctly named claim folder.`
- **Full Description**: Pre-written in `SurveyOS Scan/docs/release/play-listing.md`.
- **Graphics**: 512x512 icon, 1024x500 feature graphic, and phone screenshots.
- **Data Safety Form**: Pre-mapped in `SurveyOS Scan/docs/release/data-safety.md` (on-device processing, no developer server data collection, AdMob SDK declarations).
- **In-App Product**: Create product ID `ad_free` for the one-time ad-removal purchase.

---

## 2. SurveyOS Scan — Feature & Update Dossier (As of Nov 2026)

SurveyOS Scan is built specifically for **IRDAI-licensed motor insurance surveyors in India**:

1. **One-Tap Document Chasing ("Ask for Documents")**:
   - One tap on missing claim documents drafts professional WhatsApp or Email messages to the Insured or Garage.
   - Available in **English, Hindi, and Marathi** with polite reminder templates.
   - Intelligent recipient splitting (Insured papers: RC/DL/Policy/Cheque vs. Garage papers: Estimates/Invoices).
   - Follow-up logging: Tracks *"Asked Insured 2 days ago via WhatsApp"*.
2. **Quality Control & Document Rejection**:
   - Mark substandard scans as **Rejected** with reasons (*Blurry*, *Cut off*, *Wrong document*, *Expired*).
   - Automatically included in subsequent WhatsApp follow-ups with reason specified.
3. **"Waiting For" Filter Chip**:
   - Home screen filter displaying all open claims awaiting documents, sorted by longest waiting.
4. **On-Site Fee Bill Notes & Mobile Rate Memory**:
   - Calculate survey fees, conveyance, and photo rates on-site with stored rate memory; auto-populates in SurveyOS Prime desktop report builders.
5. **Opt-in Google Drive Sync (Text-only & Full)**:
   - Syncs `_surveyos-status.json` and notes directly to Google Drive.
   - Bidirectional sync with SurveyOS Prime: documents received on laptop clear missing flags on the mobile app.
6. **Damage Photo Capture with Geo-Stamping**:
   - Burns date, time (IST), exact GPS coordinates, and reverse-geocoded physical address onto the image.
   - 100% compliant with insurer evidence standards.
7. **ML Kit Camera Document Scanner**:
   - Auto edge detection, keystone correction, multi-page merging, splitting, and reordering.
   - "Small" vs. "Clear" compression (~180 KB/page for portal-compliant uploads).
8. **100% Local-First & Private**:
   - No company servers; works completely offline on remote spots.

---

## 3. Marketing Video Strategy — Problem-First Narrative

### Creative Core
- **Target Audience**: Indian Motor Insurance Surveyors, Loss Assessors, Claims Managers.
- **Core Premise**: *"You became a licensed surveyor to inspect vehicles and assess loss... so why are you spending 4 hours every night acting like a data-entry clerk?"*
- **Brand Identity**: Make the name **SurveyOS** prominent, authoritative, and memorable.

### 5-Act Narrative Sequence

#### Act 1: The Raw Chaos (Current State Without the App)
- **The Garage Floor**: Greasy papers (RC, DL, handwritten estimates) resting on dusty car bonnets. Snapping crooked photos under poor workshop lighting.
- **The Camera Roll Nightmare**: 80+ mixed photos (`IMG_20261101_...`). Which dent was the Swift? Which bumper was the Creta? Personal family photos mixed with accident wrecks.
- **The Late-Night Desk Agony**: 10:30 PM at the laptop. Manually renaming files, rotating pages, compressing PDFs because the insurer portal threw a red error: *"File exceeds 2 MB"*.
- **The WhatsApp Mess**: Frantic scrolling through personal WhatsApp chats trying to track who sent what document.

#### Act 2: The Core Problem Defined
- Pinpoint the bottleneck: Surveying is fast, but document admin eats away the surveyor's life, delays report submissions, and stalls fee disbursements.

#### Act 3: The Turning Point — Introducing SurveyOS
- Dramatic visual transition from dark, cluttered frustration to crisp, modern clarity.
- **Prominent Brand Reveal: SurveyOS**.
- Built *by* surveyors, *for* surveyors. Introducing its field app: **SurveyOS Scan**.

#### Act 4: The Transformation (Step-by-Step Curing the Chaos)
1. **At the Vehicle (Instant Capture & Naming)**: Camera snaps documents; auto-crops and names them into IRDAI slots (`RC Book.pdf`, `Policy.pdf`, `Estimate.pdf`) at portal-ready ~180 KB.
2. **On-Site Evidence (Tamper-Proof Proof)**: Damage photos stamped with GPS, time, and street address.
3. **One-Tap WhatsApp Chasing**: Tapping *"Ask for Documents"* sends ready checklists in Hindi, Marathi, or English. App logs *"Asked 2 days ago"*.
4. **"Waiting For" Radar**: One tap on Home filters claims waiting for documents.

#### Act 5: Resolution & Call to Action
- It’s 6:00 PM instead of midnight. Reports are complete, folders are organized, evenings are reclaimed.
- Bold closing logo: **SurveyOS — Stop chasing papers. Start surveying.**
- Google Play Store badge: Free download.

---

## 4. Next Step: Scene-by-Scene Prompt Writing
Once reviewed on GitHub, the next phase will produce modular, copy-paste prompts for each scene specifying:
- Visual cinematography, camera angles, and lighting.
- On-screen UI elements and text cards.
- Voiceover script (in conversational, authentic Indian English / Hindi / Marathi).
- Sound design and Foley effects.
