# Session Log: SurveyOS Scan Direct Share Photos (Spot/Final/RI) & Document Field Naming

**Date:** 2026-11-10  
**Agent:** Antigravity  
**Persona Invocation:** `/andrej-karpathy` (First-principles breakdown, bottom-up architecture analysis)

---

## 1. Problem Statement & Surveyor Complaint

A practising surveyor reported a friction point in **SurveyOS Scan** (the Android companion app):
> *"surveyor is able to share documents directly from gallery of any app. and they can be added as documents, but in the same way they are not able to share photos and save it to RI photos or final photos, or select a new document field that they want to name those documents."*

### First-Principles Diagnosis: What was happening under the hood?
1. **The Photo Sharing Gap**:
   - In SurveyOS Scan, photos and documents are distinct entities. Photos are stored with `isPhotos = true`, rendered with `PageFilter.NATURAL`, stamped with GPS/time/vehicle metadata, and organized under three folders: `Spot Photos` (`spotPhotos`), `Final Photos` (`damagePhotos`), and `RI Photos` (`riPhotos`).
   - When an Android intent (`ACTION_SEND` or `ACTION_SEND_MULTIPLE`) arrived from Gallery, WhatsApp, or Google Photos, `ShareSlotPicker` only queried `shareSlotOrder(detail.docs, chase)`.
   - Because photo documents are created on demand and not pre-created as needed slots, they were never listed.
   - Even if selected, `importShared(docId, items)` routed everything through document quality filters (`PageFilter.COLOUR_BOOST`), stripping photo fidelity and categorizing them as PDFs/documents rather than photo collections.
2. **The Hardcoded "Imported document" Trap**:
   - In `ShareSlotPicker`, tapping `+ New document` called `go(null) -> vm.importShared(null, take())`.
   - `ClaimViewModel.importShared` hardcoded:
     `val target = docId ?: repo.addOtherDoc(claimId, "Imported document").also { created = it }`
   - The surveyor was never prompted with `NameSheet` to pick a standard document field (e.g., Estimate, Invoice, Discharge Voucher, FIR, Towing Receipt, Aadhaar, PAN) or supply a custom title.

---

## 2. Architecture & Implementation

### A. Photo Target Routing in `ClaimViewModel.kt`
- Added `importSharedPhotos(kind: String, items: List<SharedItem>)`:
  - Directly resolves or creates the photo doc via `repo.photoDoc(claimId, kind)` (`spotPhotos`, `damagePhotos`, or `riPhotos`).
  - Iterates over `items`: ingests non-PDF images via `ingest(target, listOf(item.uri), Quality.PHOTO, "GALLERY")`.
  - Warns if any PDF files were mixed in and skipped.
  - Cleans up temporary cache files in `finally`.

### B. Named Document Ingestion in `ClaimViewModel.kt`
- Added `importSharedAsNamedDoc(type: String, title: String, items: List<SharedItem>)`:
  - For custom names (`type == DocType.OTHER.key`), provisions a custom doc via `repo.addOtherDoc(claimId, title)`.
  - For standard types (`type != DocType.OTHER.key`), resolves an existing needed slot or inserts a new one via `repo.docForScan(claimId, type, title, null)`.
  - Applies document scan quality (`prefs.quality(claimId)`).
  - Handles transaction rollback and discards empty docs if ingest fails.

### C. UI Evolution in `ShareInScreens.kt` (`ShareSlotPicker`)
- Screen title updated to universal **"Add to claim"**.
- Added `PHOTO_TARGETS` (**Final Photos**, **RI Photos**, and **Spot Photos**) displayed prominently under a `SAVE AS PHOTOS` section whenever images are present in the share intent (`hasImages = true`), complete with camera icons and live photo counters (`X photos` or `Empty`).
- Replaced the direct `go(null)` on `+ New document` with `naming = true`, triggering the app's standard `NameSheet`.
- `NameSheet` displays needed types for this claim (`vm.neededTypes()`), categorized document groups (Insured, Vehicle papers, Garage, Police & other), and custom title input.
- Filtered out photo documents from `shareSlotOrder` in `SharePickOrder.kt` so the `SAVE AS DOCUMENT` section remains focused on document slots.

---

## 3. Verification & Compliance

1. **Android Unit Tests (`./gradlew.bat :app:testDebugUnitTest`)**:
   - 28 actionable tasks, 100% passed.
   - Added `SharePickOrderTest.photoDocsExcludedFromSlots`.
   - All contract drift tests (`PrimeContractTest`, `SpotFieldsTest`, etc.) green.
2. **Prime Vitest Suite**:
   - 327 test files, 2,915 tests passing.
3. **Prime TypeScript Compilation**:
   - `npx tsc --noEmit` exited cleanly with 0 errors.
4. **Prime ↔ Scan Coupling**:
   - Coupling impact: **None** (Scan-internal share intent routing; uses pre-existing `DocType` keys and folder structures).
5. **Git Status**:
   - Scan changes committed directly on `main` (`f775e6f`).
