# Architecture, Workflow, and Status

## 🏗️ Architecture
SurveyOS Prime V2 is built as a highly robust, cloud-native Progressive Web Application (PWA) focused on speed and data safety.

### 1. The Core Stack
*   **Framework**: Next.js (React) operating entirely on the client-side (`use client`). This ensures the app maintains peak performance and responsiveness.
*   **State Management**: We use `Zustand`. It is split into three main areas:
    *   `claim-store`: Holds the massive data model of whatever claim you are actively editing.
    *   `ui-store`: Handles what dialogs are open and what tab you are looking at.
    *   `profile-store`: Keeps track of your surveyor details and numbering sequences.
*   **Storage (The Performance Caching Engine)**: We leverage a sophisticated local-first caching strategy. Everything saves instantly to your browser's local **IndexedDB** (`surveyos-db`) before being synchronized to the cloud. This ensures a zero-latency editing experience and immunity to momentary connectivity drops.

### 2. The Multi-Engine Reporting System
*   **Power Print (PDF)**: We generate pixel-perfect standard layouts using a hidden HTML-to-PDF technique.
*   **Excel Bridge (UIIC)**: For rigid legacy clients like United India Insurance (UIIC), we bypass PDFs and use `exceljs` to inject data perfectly into pre-formatted `.xlsx` templates.

---

## 🔄 The Surveyor Workflow

1.  **Ingestion**: A new claim is created. The system checks the `profile-store` and automatically assigns a rigid, sequential Report Number (e.g., `SPO/2026/001` or `FIN/2026/012`).
2.  **Assessment**: The user navigates through tabs (Spot ➡️ Policy ➡️ Assessment ➡️ Photos).
3.  **Real-Time Save**: Every keystroke triggers an `autosave`. The claim is injected into IndexedDB.
4.  **Dashboard Sync**: `BroadcastChannel` APIs fire a signal across the browser. If you have the Dashboard open in another tab, it instantly updates to show the new claim data.
5.  **Lifecycle Evolution**: 
    *   A Final Survey can expand. By adding data to specific sections, the Dashboard automatically recognizes if the claim is now in the "Reinspection" or "Bill-Check" stage.
6.  **Archiving**: Once generating the final Excel or PDF, the user marks the claim as "Complete" and sends it to the Archive, cleaning up the active Dashboard.

---

## 🟢 Current Status
*The project is completely functional as a high-performance, cloud-native reporting engine.*

*   ✅ **Monolith to Modular**: Transitioned from a single massive HTML file to an organized React/Next.js codebase.
*   ✅ **Spot Survey Reporting**: Complete.
*   ✅ **Final Survey Reporting**: Unified with Reinspection and Bill-Check logic. Complete.
*   ✅ **UIIC Excel Bridge**: Successfully tested against complex merged-cell templates. Complete.
*   ✅ **AI Extraction Engine**: Fully integrated multi-provider gateway (`gemini` & `groq`) executing base64 pipeline logic for OCR & structured data extraction directly via `src/lib/ai/service.ts`.
*   ✅ **Dashboard Mission Control**: Rebuilt to hydrate directly from IndexedDB without server roundtrips. Complete.
*   ✅ **Knowledge Base Integration**: Obsidian "Second Brain" established.

*   ✅ **Image Compression**: Canvas-based inline compression (`compressImage`) runs inside `PhotosTab.tsx` stripping photo weight before they hit the database.
*   ✅ **Firebase Authentication**: User accounts integrated via `useAuth.ts` and `auth-store.ts`.
*   ✅ **Cloud Sync Engine**: Robust IndexedDB-to-Firestore debounced syncing via `sync.ts`, which safely strips photos from payloads to protect Firestore 1MB document quotas while backing up all metadata automatically.

---

## 🚀 The Future
At this stage, SurveyOS Prime V2 is a fully realized, enterprise-grade architecture. Future updates will primarily revolve around maintaining UIIC template compliance, extending to more insurers, and optimizing the LLM prompt contexts based on field testing.
