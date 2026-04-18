# Cloud Sync and Google Drive Backup Logic

This document describes the distinction between automated file uploads (Photos/Documents) and the system-wide Profile Backup mechanism.

## 1. Automated File Uploads (Photos and Documents)
Associated with the **"Auto Push Files"** toggle in the Profile settings.

- **Scope**: Individual media files (JPEG/PNG) and generated PDF documents.
- **Toggle**: `profile.autoUploadDrive` (boolean).
- **Behavior**:
    - **Photos**: When a photo is uploaded in the `PhotosTab`, it is compressed locally and added to IndexedDB. If `autoUploadDrive` is enabled, it is also uploaded to Drive under `SurveyOS/{RegistrationNumber}/photo_...jpg`.
    - **Documents**: When a file is uploaded in the `DocumentsTab`, if `autoUploadDrive` is enabled, it is mirrored to Drive.
- **Implementation**:
    - `src/components/tabs/PhotosTab.tsx` (Lines 134-136)
    - `src/components/tabs/DocumentsTab.tsx` (Lines 125-130)

## 2. Profile and System Backup
This mechanism is **independent** of the "Auto Push Files" toggle. It ensures that critical configuration and user data (signatures, stamps, API keys) are never lost.

- **Scope**:
    - Firebase / Gemini / Groq API Keys
    - Rubber Stamps (Base64)
    - Signatures (Base64)
    - User Preferences
- **Trigger**: Runs every time the profile is updated (via `useEffect` in `useCloudSync`).
- **File Name**: `surveyos_profile_backup.json` (stored in the root of the connected Google Drive).
- **Implementation**:
    - `src/hooks/useCloudSync.ts` (Lines 194-196)
    - Uses `backupProfileToDrive(profile)` helper from `src/lib/drive`.

## 3. Rationale
The distinction exists to prevent high-bandwidth operations (uploading 20+ photos) on slow connections while ensuring that lightweight, critical "system state" (API keys and signatures) is always safely backed up to the cloud.
