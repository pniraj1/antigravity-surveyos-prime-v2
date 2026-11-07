# Unified Storage Hub & Cloud Sync Optimization Implementation Plan

> **For Claude / Agent:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SurveyOS Prime's storage and synchronization UX into an intuitive, seamless experience: eliminate redundant "Save to Drive?" popups with automatic background mirroring, reduce Firestore write volume by 40% using tab-switch debouncing/coalescing, replace the scattered header save buttons with a single "All Changes Saved" status pill and Storage & Safety popover, provide clear sidebar helpers for Cloud Vault/Recovered, and offer a 1-click banner to download Drive photos on secondary devices.

**Architecture:**
1. **Firestore Coalescing (`useCloudSync.ts`):** Debounce tab-switch milestone pushes with a 15-second quiet window so rapid tab navigation coalesces into a single write, while immediately flushing on claim change, page hide, or manual sync.
2. **Seamless Drive Mirroring (`useSaveToCloudPrompt.tsx`):** Automatically resolve cloud saves without presenting interrupting modal dialogs whenever Google Drive is connected; mirror silently to the claim's Drive folder in the background.
3. **Unified Storage & Safety Header Pill (`ClaimHeader.tsx` & `StorageSafetyPopover.tsx`):** Replace the blue "Save & Sync" button and disjointed chips with a single interactive status pill `[✓ All Changes Saved]` / `[↻ Saving...]` opening a popover that details Laptop Folder, Google Drive, and Cloud Vault statuses with an on-demand "Sync Now" button.
4. **Sidebar Helper Metadata (`sidebar.tsx`):** Add clear helper descriptions and tooltips to `Cloud Vault` and `Recovered` in the navigation sidebar.
5. **Multi-Device Photos 1-Click Banner (`NewDrivePhotosBanner.tsx` & `PhotosTab.tsx`):** Enhance the Drive photo discovery banner to detect any claim photos present on Google Drive but missing from local IndexedDB and provide a 1-click download with progress feedback.
6. **Unified "From Phone" Action (`FromPhoneButton.tsx`):** Combine "Use Phone Notes" and "Bring Phone Scans" into a single, unambiguous `[📱 From Phone]` dropdown.

**Tech Stack:** TypeScript, Next.js 16 App Router, Zustand (`useClaimStore`, `useUIStore`, `useAuthStore`), Tailwind CSS, Lucide React, Vitest.

---

### Task 1: Firestore Quota Optimization — Tab-Switch Coalescing (`useCloudSync.ts`)
**Files:**
- Modify: `src/hooks/useCloudSync.ts`
- Test: `src/hooks/__tests__/useCloudSync-coalesce.test.ts`

### Task 2: Seamless File & Photo Cloud Sync — Eliminate "Save to Drive?" Popup Modal
**Files:**
- Modify: `src/hooks/useSaveToCloudPrompt.tsx`
- Modify: `src/hooks/usePhotoUpload.ts`
- Modify: `src/components/tabs/DocumentsTab.tsx`
- Modify: `src/components/tabs/AssessmentTab.tsx`
- Test: `src/hooks/__tests__/useSaveToCloudPrompt.test.ts`

### Task 3: Unified Top Header Storage & Safety Status Pill (`ClaimHeader.tsx`)
**Files:**
- Create: `src/components/layout/StorageSafetyPopover.tsx`
- Modify: `src/components/layout/ClaimHeader.tsx`
- Test: `src/components/layout/__tests__/StorageSafetyPopover.test.tsx`

### Task 4: Left Sidebar Helper Tooltips & Subtitles (`sidebar.tsx`)
**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Test: `src/components/layout/__tests__/sidebar-navigation.test.tsx`

### Task 5: Multi-Device Photos 1-Click Download Banner (`NewDrivePhotosBanner.tsx` & `PhotosTab.tsx`)
**Files:**
- Modify: `src/components/layout/NewDrivePhotosBanner.tsx`
- Modify: `src/components/tabs/PhotosTab.tsx`
- Modify: `src/lib/photos/drive-photo-diff.ts`
- Test: `src/lib/photos/__tests__/drive-photo-diff.test.ts`

### Task 6: Unified "From Phone" Action (`FromPhoneButton.tsx` & `DocumentsTab.tsx`)
**Files:**
- Create: `src/components/documents/FromPhoneButton.tsx`
- Modify: `src/components/tabs/DocumentsTab.tsx`
- Test: `src/components/documents/__tests__/FromPhoneButton.test.tsx`

### Task 7: Full System Verification, Build & Knowledge Base Update
**Files:**
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Tasks.md`
- Modify: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Changelog.md`
- Create: `SurveyOS-Antigravity-Prime-V2-KnowledgeBase/Sessions/2026-11-07-unified-storage-hub-and-sync-optimization.md`
