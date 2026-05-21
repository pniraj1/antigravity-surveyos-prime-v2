# The Antigravity Bible: The Layman's Edition

*Last updated: 2026-05-21 — reflects the actual state of SurveyOS Prime V2*

---

## Chapter 1: What Is SurveyOS?

SurveyOS Prime V2 is a web application built for **Indian motor insurance surveyors**. When someone files an insurance claim after a car accident, a surveyor has to inspect the damage, check documents, calculate costs, and write a detailed report. That whole process — from the moment a claim lands on your desk to the final PDF report you send to the insurance company — is what SurveyOS handles.

### The Workshop Analogy

Think of SurveyOS as a **fully equipped workshop** for surveyors:

- **The Front Desk** — You log in with your Google account. If you're new, the admin has to approve you first (like getting your ID badge).
- **The 13 Workbenches** — Each tab in the app is a workstation for a different part of the job: entering claim details, uploading photos, assessing damage, checking invoices, writing the final report, and so on.
- **The AI Assistant** — Instead of manually typing out data from a Registration Certificate or policy document, you upload it and AI reads it for you, pulling out vehicle numbers, policy dates, and owner details automatically.
- **The Filing Cabinet** — Everything you do is saved locally on your device AND backed up to the cloud (Google Drive + Firestore). Even if your internet goes down, your work is safe.

---

## Chapter 2: The Tech Behind the Curtain

You don't need to understand code to use SurveyOS, but here's what's happening under the hood — explained simply.

### The Building Blocks

| What | Think of it as... | Actual technology |
|------|-------------------|-------------------|
| **The App Framework** | The building's steel frame | Next.js 16 + React 19 |
| **The Language** | The blueprint language | TypeScript 5 |
| **The Look & Feel** | The paint and wallpaper | Tailwind CSS 4 + shadcn/ui |
| **The Login System** | The security gate | Firebase Auth (Google Sign-In) |
| **The Cloud Database** | The central filing cabinet | Google Firestore |
| **The Local Database** | Your desk drawer | IndexedDB (works offline) |
| **The File Backup** | Your personal safe deposit box | Google Drive |
| **The AI Brains** | Your team of assistants | Gemini + Groq + NVIDIA |
| **The Report Printer** | The print shop | React-PDF + exceljs + docx |

### The 4-Layer Safety Net

Your data is protected by **four layers of storage**, like having four copies of every important document:

1. **Layer 1 — Your Screen (Zustand):** What you see right now. Fast, instant, but gone if you close the tab.
2. **Layer 2 — Your Device (IndexedDB):** Saved on your phone/laptop. Survives closing the browser. Works offline.
3. **Layer 3 — The Cloud (Firestore):** Backed up to Google's servers. Available from any device you log into.
4. **Layer 4 — Your Drive (Google Drive):** Your personal backup. Photos, documents, and reports stored in a `SurveyOS` folder in your Google Drive.

> **Key Takeaway:** Even if your phone falls in a lake, your data is safe in Layers 3 and 4. Even if the internet is down, Layers 1 and 2 keep you working.

---

## Chapter 3: The AI Brain — How Document Extraction Works

This is the "magic" part. When you upload a document (like a vehicle Registration Certificate, driving licence, insurance policy, or repair estimate), the AI reads it and fills in the form fields for you.

### The Translation Team Analogy

Imagine you receive a stack of documents in messy handwriting. Instead of reading them yourself, you hand them to a team of translators:

1. **Translator #1 — Gemini 2.5 Flash (Google):** The default. Fast, reliable, and free for moderate use (500 documents/day). She's the one who handles most of your work.
2. **Translator #2 — Llama 4 Scout (Groq):** The backup. If Gemini is busy or you've hit your daily limit, this one takes over. He can also read images (photos of documents).
3. **Translator #3 — Llama 3.2 90B (NVIDIA):** The specialist for tough image-based documents. Used when photos need extra attention.

### How the Fallback Chain Works

```
You upload a document
       |
       v
  Try Gemini 2.5 Flash
       |
  Works? --> Great, done!
       |
  Failed? (quota/error)
       |
       v
  Try Groq Llama 4 Scout
       |
  Works? --> Great, done!
       |
  Failed?
       |
       v
  Try NVIDIA Llama 3.2
       |
  Works? --> Done!
  Failed? --> Show error, ask you to try later
```

### The Key Rotation Trick

Each AI provider needs an "API Key" — think of it as a **password** that lets SurveyOS talk to that AI. You can add **multiple keys** for each provider. If one key hits its daily limit, SurveyOS automatically tries the next key. It's like having multiple library cards — when one reaches the borrowing limit, you use the next.

### What Can the AI Extract?

| Document Type | What It Pulls Out |
|---------------|-------------------|
| **Registration Certificate (RC)** | Vehicle number, make/model, engine/chassis numbers, registration date, owner name |
| **Driving Licence (DL)** | Licence number, validity dates, name, vehicle classes |
| **Insurance Policy** | Policy number, insurer name, IDV, premium, coverage dates |
| **Repair Estimate** | Part names, labour charges, part costs, totals |
| **Invoice** | Workshop details, itemized costs, GST amounts |
| **Bank Statement** | Account details for payment processing |

> **Key Takeaway:** You don't have 345 AI models. You have **3 reliable providers** with automatic fallback. Gemini handles 90%+ of your work. The others are safety nets.

---

## Chapter 4: The 13 Workbenches — Your Survey Workflow

Each tab in SurveyOS represents one step of the survey process. You work through them left to right, like stations on an assembly line.

| # | Tab | What You Do There |
|---|-----|-------------------|
| 1 | **Details** | Enter claim info: policy number, vehicle details, insured's name, accident date |
| 2 | **Review** | See the full claim overview and current status at a glance |
| 3 | **Photos** | Capture or upload photos of damage — organized by category |
| 4 | **Assessment** | The damage grid: list every damaged part, enter costs, apply IRDAI depreciation |
| 5 | **Bill Check** | Compare the workshop estimate against your assessment — flag discrepancies |
| 6 | **Valuation** | Calculate vehicle valuation (for total loss / break-in inspections) |
| 7 | **Documents** | Upload documents and let AI extract the data automatically |
| 8 | **Reinspection** | Post-repair reinspection: verify repairs match the approved estimate |
| 9 | **Spot** | Quick spot survey report for straightforward claims |
| 10 | **Fees** | Calculate your surveyor fees based on claim amount |
| 11 | **Report** | Generate the final report — PDF, Word, or Excel — ready to send |
| 12 | **Cloud Vault** | Manage your Google Drive backups: push files, view synced documents |
| 13 | **Profile** | Your settings: API keys, default values, subscription status |

### The Assessment Grid — Where the Money Math Happens

The Assessment tab is the heart of the app. It's a spreadsheet-like grid where you:
- List every damaged part
- Enter replacement cost and repair cost
- SurveyOS auto-applies **IRDAI depreciation** (metal, rubber, plastic, glass — each depreciates differently based on vehicle age)
- Auto-calculates GST (CGST + SGST = 18%)
- Detects **Constructive Total Loss (CTL)** — when repair cost exceeds a percentage of the vehicle's value

You can even **paste data from Excel** (Ctrl+V) directly into the grid.

---

## Chapter 5: Reports — The Final Product

After the survey is complete, SurveyOS generates the official reports. There are **5 report types**, and each can be exported in multiple formats.

### Report Types

| Report | When to Use |
|--------|-------------|
| **Final Survey (Standard)** | The standard survey report for most insurers |
| **Final Survey (UIIC)** | Special format required by United India Insurance Company |
| **Spot Report** | Quick assessment for straightforward, low-value claims |
| **Reinspection Report** | Post-repair verification report |
| **Valuation / Break-In** | Vehicle valuation for total loss or break-in inspection |
| **Fee Bill** | Your invoice for surveyor fees |
| **Photo Sheet** | Organized photo layouts (4-up, 6-up, or 9-up per page) |

### Export Formats

- **PDF** — Generated using React-PDF. Pixel-perfect, print-ready.
- **Word (.docx)** — Editable document format.
- **Excel (.xlsx)** — For UIIC legacy templates that require Excel format.
- **Print** — Direct browser printing with custom CSS.

### The Twin Engine

SurveyOS has two report engines working together:
1. **Power Print** — HTML-based rendering for on-screen preview and browser printing. What you see is what you get.
2. **Excel Bridges** — For insurers like UIIC that require data injected into specific Excel templates. exceljs fills in the cells automatically.

---

## Chapter 6: Security & Access Control

### Who Gets In?

SurveyOS uses a **three-gate security model**:

```
Gate 1: Google Sign-In
  "Do you have a Google account?"
       |
       v
Gate 2: Admin Approval
  "Has the admin approved your account?"
  (New users land on a 'Pending' screen until approved)
       |
       v
Gate 3: Subscription Check
  "Is your subscription active?"
  (60-day free trial, then admin sets expiry)
       |
       v
  You're in! Full access to SurveyOS.
```

### Subscription Lifecycle

1. **New signup** — You get 60 days free (trial period).
2. **5 days before expiry** — An amber warning bar appears: "Your subscription expires soon."
3. **After expiry** — A full-screen overlay blocks editing. You can still VIEW your data, but not change it. A payment form appears to renew.
4. **Admin renewal** — The admin updates your expiry date, and you're back in.

### Your API Keys Are Yours

Each surveyor enters their own free-tier AI API keys in the Profile tab. Your keys are stored in your Firestore profile — nobody else can see or use them. This means:
- You control your own AI usage limits
- If one surveyor exhausts their Gemini quota, it doesn't affect anyone else
- You can add multiple keys to multiply your daily limit

---

## Chapter 7: Google Drive — Your Personal Cloud Vault

When you link your Google account's Drive to SurveyOS, the app creates a `SurveyOS` folder in your Drive. Inside, each claim gets its own subfolder.

### What Gets Synced

- Photos you capture or upload
- Documents you feed to the AI
- Generated reports (PDF, Word, Excel)
- Your profile backup

### How Sync Works

- **Auto Push:** When enabled, new files are automatically uploaded to Drive in the background.
- **Queue System:** If the upload fails (bad connection, token expired), it goes into a retry queue (up to 3 attempts).
- **Token Management:** The Google Drive access token expires every 58 minutes. SurveyOS silently refreshes it. If that fails, it asks you to re-link.

> **Key Takeaway:** Drive is your personal backup. Even if SurveyOS went down tomorrow, every document and report would still be sitting safely in your Google Drive folder.

---

## Chapter 8: The Admin Dashboard

If you are the admin (the person who manages surveyors), you get an extra tab with powerful controls:

### What Admin Can Do

| Action | How |
|--------|-----|
| **Approve new surveyors** | New Signups tab → Review → Set expiry → Approve |
| **Suspend a surveyor** | All Surveyors tab → Hover → Suspend |
| **Extend subscription** | Click the date next to any surveyor → Pick new expiry |
| **Update surveyor ID** | Click the ID field → Type new ID |
| **Send custom email** | Click email icon next to any surveyor |

### Status Badges

| Color | Meaning |
|-------|---------|
| Green | Active — full access |
| Yellow | Pending — waiting for approval |
| Red | Suspended — manually blocked |
| Orange | Expired — subscription date passed |

---

## Chapter 9: Working Offline

SurveyOS is built **offline-first**. This means:

1. **No internet? No problem.** All your claim data is stored locally in IndexedDB (Layer 2). You can continue entering data, taking photos, and filling assessments.
2. **When you reconnect,** the sync queue pushes everything to Firestore (Layer 3) and Drive (Layer 4) automatically.
3. **Even reports work offline** — PDF generation happens entirely in your browser, not on a server.

### The Restaurant Kitchen Analogy

Think of it like a restaurant kitchen with a walk-in fridge (local storage) and a supply warehouse (cloud):
- During service (working), the chef uses what's in the kitchen (local data).
- Between shifts (when online), new supplies are delivered from the warehouse (cloud sync).
- If the delivery truck is late (no internet), the kitchen keeps running fine on what it has.

---

## Chapter 10: Glossary — Scary Terms Made Simple

| Term | What It Actually Means |
|------|------------------------|
| **API Key** | A password that lets SurveyOS talk to AI services. You get free ones from Google, Groq, and NVIDIA. |
| **Firestore** | Google's cloud database. Where your claim data lives in the cloud. |
| **IndexedDB** | A mini database built into your web browser. Where your data lives locally. |
| **Zustand** | The system that keeps your screen up-to-date as you type. Like a whiteboard that everyone can see. |
| **IRDAI** | Insurance Regulatory and Development Authority of India. They set the rules for depreciation percentages. |
| **CTL** | Constructive Total Loss. When repair costs are so high that it makes more sense to write off the vehicle. |
| **IDV** | Insured Declared Value. The maximum amount the insurance will pay for a total loss. |
| **GST** | Goods and Services Tax. CGST (9%) + SGST (9%) = 18% on parts and labour. |
| **OAuth** | The secure way SurveyOS connects to your Google Drive without knowing your Google password. |
| **React-PDF** | The library that turns your survey data into beautiful PDF reports right in your browser. |
| **Firebase** | Google's platform that provides login, database, and hosting — the backbone of SurveyOS. |
| **Tailwind CSS** | The system that makes SurveyOS look clean and modern. |
| **Next.js** | The web framework SurveyOS is built on. Think of it as the foundation of the building. |

---

## Chapter 11: The AI Models — What You Actually Have

Unlike the old Bible which listed 345 imaginary models, here is the **real, verified** list of AI models available in SurveyOS as of May 2026:

### Primary: Google Gemini (Default)

| Model | Speed | Daily Limit (Free) | Best For |
|-------|-------|---------------------|----------|
| **Gemini 2.5 Flash** | Fast | 500 requests/day | Default for everything. Best balance of speed and quality. |
| **Gemini 2.5 Flash-Lite** | Fastest | 1,000 requests/day | Quick extractions when you need volume over depth. |
| **Gemini 2.5 Pro** | Slower | Lower limits | Complex documents that need deep reasoning. |

### Backup #1: Groq (Llama Models)

| Model | Speed | Best For |
|-------|-------|----------|
| **Llama 4 Scout** | ~400 tokens/sec | Vision + text. Can read document images directly. |
| **Llama 3.3 70B** | Fast | Text-only extraction. Reliable production model. |
| **Llama 3.1 8B** | Fastest | Quick text tasks. Smallest and fastest. |

### Backup #2: NVIDIA NIM

| Model | Best For |
|-------|----------|
| **Llama 3.2 90B** | Best vision model for tough image-based documents. |
| **Llama 3.2 11B** | Smaller, faster alternative for image tasks. |

### Deprecated Models (Auto-Migrated)

These old models are no longer available. If your profile still references them, SurveyOS automatically upgrades you to the current default:

- `gemini-2.0-flash` → migrated to `gemini-2.5-flash`
- `gemini-3-pro-preview` → shut down March 2026
- `llama-4-maverick` → deprecated, migrated to `llama-4-scout`
- `llama-3.2-90b-vision-preview` → removed by Groq

> **Total: 8 verified, functional models across 3 providers.** Not 345. Quality over quantity.

---

## Chapter 12: Project Bramha — The Future

Project Bramha is an **agentic RAG (Retrieval-Augmented Generation) intelligence engine** currently running in shadow mode. Think of it as SurveyOS's future brain — it will be able to:

- Automatically learn from past claims to suggest assessments
- Cross-reference similar claims to detect inconsistencies
- Generate draft reports from minimal input

It uses Firebase Cloud Functions, Firestore Vector DB, and Gemini embeddings. It's built and working in the background but not yet exposed to surveyors. When activated, it will make SurveyOS significantly smarter.

---

## Chapter 13: Quick Reference — Your Daily Checklist

1. **Before starting work:** Make sure you're logged in and your subscription is active (check Profile tab).
2. **For AI extraction:** Upload documents in the Documents tab. Gemini handles it automatically. If it fails, it retries with Groq, then NVIDIA.
3. **For assessments:** Use the Assessment tab grid. Paste from Excel if you have existing data. IRDAI depreciation is automatic.
4. **For reports:** Go to the Report tab, pick your format (Standard/UIIC/Spot), and export as PDF, Word, or Excel.
5. **For backups:** Enable "Auto Push Files" in Cloud Vault tab. Your data syncs to Google Drive automatically.
6. **If something breaks:** Your data is safe in 4 layers. Close and reopen the browser. If AI fails, check your API keys in Profile tab.

---

### Status: OPERATIONAL

**SurveyOS Prime V2 — Version 1.0.3**
**AI Providers: 3 (Gemini, Groq, NVIDIA) with 8 verified models**
**Report Types: 5+ across 4 export formats**
**Storage: 4-layer offline-first architecture**
