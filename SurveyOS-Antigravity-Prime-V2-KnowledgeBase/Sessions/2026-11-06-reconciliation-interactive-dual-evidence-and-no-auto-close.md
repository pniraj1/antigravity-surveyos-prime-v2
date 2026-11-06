# Session Log: Reconciliation Interactive Dual Evidence & No Auto-Close

**Date:** 2026-11-06  
**Agent:** Antigravity (Pair programming with User / Niraj Patil)  
**Status:** Complete & Verified  

---

## 1. Context & Motivation
When surveyors encountered data discrepancies in the Data Reconciliation Hub (e.g. Chassis Number or Engine Number differing between RC Book and Insurance Policy), two severe UX friction points occurred:
1. **Premature Auto-Close on Click:** As soon as the surveyor clicked an option, `reconcileField` marked it decided. If that was the only conflict or the last one, an eager `useEffect` in `DocumentsTab.tsx` detected `conflicts.length === 0` while `isReconOpen` was true and immediately shut down the modal (`setIsReconOpen(false)`). The user was thrown back to the documents screen before they could even inspect the evidence.
2. **Instant Row Vanishing:** `getConflictFields()` filtered out decided fields (`!f.isDecided`). Selecting an option instantly caused the row to vanish from the table, preventing the surveyor from comparing the other document source or changing their mind.
3. **Single Document Evidence Slot:** The right-hand evidence panel only showed whatever single document was last clicked (`effectiveDocType`). The surveyor could not easily flip between both document sources (e.g. RC Book vs Insurance Policy) to compare extracted snippets, pages, and values side-by-side.

---

## 2. Changes Made

### 1. `src/lib/ai/reconciliation.ts`
- Added `getAllConflictFields(claim: ClaimData): ReconciliationField[]`:
  Returns all fields with genuine source conflicts (`hasConflict: true`), regardless of whether a decision has been recorded (`f.isDecided`). This keeps conflicting fields stable and visible on screen throughout the reconciliation session.
- Added comprehensive unit test in `src/lib/ai/__tests__/reconciliation.test.ts`.

### 2. `src/components/tabs/DocumentsTab.tsx`
- Removed premature auto-close `useEffect`:
  ```tsx
  // REMOVED:
  useEffect(() => {
    if (isReconOpen && conflicts.length === 0) {
      setIsReconOpen(false);
    }
  }, [conflicts.length, isReconOpen]);
  ```
- Memoized `allConflicts = getAllConflictFields(currentClaim)`.
- Passed `conflictFields={allConflicts}` into `<ReconciliationDialog>`.
- Preserved `conflicts = getConflictFields(currentClaim)` for sidebar badge counts and Documents tab attention banners.

### 3. `src/components/tabs/reconciliation/ReconciliationDialog.tsx`
- **Interactive Document Inspector:**
  - Added `activeFieldPath` and `activeOrigin` state.
  - Automatically focuses the first pending conflict field and loads its document and verbatim context snippet into the evidence panel on mount.
  - Right-hand panel includes a dynamic **Document Source Switcher** above `InlineEvidencePanel` for the active field:
    Displays cards for each conflicting source (e.g. `[ 📄 RC Book ]` and `[ 📄 Policy ]`).
    Clicking either card immediately switches the document iframe/image below AND updates the selected value on the claim!
- **Non-Destructive Live Selection:**
  - Clicking any source option on the table row (or on the right comparison bar) updates the claim live (`reconcileField`) and immediately updates the evidence panel (`showEvidence`).
  - The row **stays on screen** with a green `✓ Resolved` badge and left-border accent (`border-l-emerald-500`).
  - Both options remain visible and clickable so the surveyor can flip between RC and Policy freely.
- **Header Badges & Bulk Action:**
  - Header displays `{pendingCount} PENDING ({resolvedCount} RESOLVED)` or `ALL {totalConflicts} CONFLICTS RESOLVED ✓`.
  - Bulk "Accept Recommended" bar scopes strictly to remaining pending fields and turns into a reassuring confirmation notice when all are resolved.
- **Explicit Finish:**
  - The modal only closes when the surveyor explicitly clicks **"Finish Reconciliation"** in the footer.

---

## 3. Verification & Test Results
- **TypeScript:** `npx tsc --noEmit` clean (0 errors).
- **Unit Tests:** `npx vitest run` across full suite:
  - 281 test files passed (100% green).
  - 2,513 unit tests passed (0 failed).
- **Prime ↔ Scan Coupling Impact:**
  - Coupling checked: None. This is internal Prime reconciliation UI logic and does not touch Scan sync manifests, folder structures, or export DTOs.
