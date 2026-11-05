# SurveyOS Scan Gallery Photo Stamp Modes & In-Viewer Compression — Implementation Plan

> **For Claude / Antigravity:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable motor surveyors to inspect photo size in KB in `PhotoViewer`, choose 1-tap compression targets (`~100 KB`, `~250 KB`, `Original`), and toggle photo stamp modes (`Full`, `No Date`, `No Stamp`) with zero empty lines when GPS is missing and optional batch application to other gallery photos in the claim.

**Architecture:** 
- In-memory lossless re-rendering from untouched `originalFile` (`<id>.orig.jpg`) via `PageFileEdits.restamp` and `JpegEncoder.render`.
- Room persistence via `dao.setPageStamp` and `dao.setPageEdit` with zero schema migrations required (`stamp` uses `t=off;a=M;g=M` and `off` natively parsed by `StampStyle.parse`).
- Dynamic quality resolution preserved across time edits and restamping via `photoQualityForSize`.
- Material 3 Compose UI with `sizeText` header display, 1-tap target pills dialog, and `[ Full ] [ No Date ] [ No Stamp ]` FilterChips.

**Tech Stack:** Kotlin, Android Jetpack Compose (Material 3), Room DB, Java 17 (minSdk 24, Asia/Kolkata timezone via java.util).

---

### Task 1: Quality Enum & Size Detection (`ImageSizing.kt` & `PageEdit.kt`)
**Files:**
- Modify: `app/src/main/java/surveyos/scan/image/ImageSizing.kt`
- Modify: `app/src/main/java/surveyos/scan/image/PageEdit.kt`
- Test: `app/src/test/java/surveyos/scan/image/StampTextTest.kt`

**Steps:**
1. Add `COMPACT_PHOTO(1280, 60)` and `BALANCED_PHOTO(1600, 70)` to `Quality` enum alongside `PHOTO(1920, 75)`.
2. Add `val isPhoto get() = this == PHOTO || this == COMPACT_PHOTO || this == BALANCED_PHOTO` to `Quality`.
3. Add `photoQualityForSize(bytes: Long): Quality` to automatically infer existing compression level from `sizeBytes` on disk.
4. Update `defaultFilter(q: Quality)` in `PageEdit.kt` to check `q.isPhoto`.

---

### Task 2: PageStamp Mode Detection & Serialization (`PageStamp.kt` & `PageFileEdits.kt`)
**Files:**
- Modify: `app/src/main/java/surveyos/scan/data/PageStamp.kt`
- Modify: `app/src/main/java/surveyos/scan/data/PageFileEdits.kt`
- Test: `app/src/test/java/surveyos/scan/image/StampTextTest.kt`

**Steps:**
1. Update `stampStyle()`: return `null` if `stamp == "off"`.
2. Add `fun PageEntity.stampMode(): String`: returns `"full"`, `"no_date"`, or `"none"`.
3. Add `fun PageEntity.withStampMode(mode: String): PageEntity`:
   - `"no_date"`: sets `style.time = null` (`"t=off;a=M;g=M"`).
   - `"full"`: restores `style.time = StampSize.M` (`"t=M;a=M;g=M"`).
   - `"none"`: sets `stamp = "off"`.
4. In `PageFileEdits.restamp`: remove the constraint requiring `page.stampSpec() != null` prior to edit, and allow `next.stampSpec()` to be null so unstamped re-renders and compressions complete cleanly.

---

### Task 3: DAO Queries & Repository Operations (`Dao.kt` & `Repository.kt`)
**Files:**
- Modify: `app/src/main/java/surveyos/scan/data/Dao.kt`
- Modify: `app/src/main/java/surveyos/scan/data/Repository.kt`

**Steps:**
1. In `Dao.kt`, add `@Query("UPDATE pages SET stamp = :stamp, takenAt = :takenAt, timeSource = :timeSource WHERE id = :pageId") suspend fun setPageStamp(...)`.
2. In `Repository.kt`:
   - Expose `suspend fun page(id: String): PageEntity? = dao.page(id)`.
   - Add `suspend fun setPageStampMode(pageId: String, mode: String, quality: Quality)`.
   - Add `suspend fun compressPhoto(pageId: String, quality: Quality)`.
   - Add batch methods `setGalleryStampMode(claimId, mode, quality)` and `compressGalleryPhotos(claimId, quality)` targeting only gallery photos (`source == "GALLERY"` and `originalFile != null`).
   - Protect `setPageTime`, `setPageAddress`, `setPageLocation` to guard unstamped photos with `takeIf { p.stampStyle() != null }`.

---

### Task 4: ViewModel Bindings & Quality Preservation (`ClaimViewModel.kt`)
**Files:**
- Modify: `app/src/main/java/surveyos/scan/ui/claim/ClaimViewModel.kt`

**Steps:**
1. Add `fun setStampMode(pageId: String, mode: String, applyToBatch: Boolean = false)`.
2. Add `fun compressPhoto(pageId: String, quality: Quality, applyToBatch: Boolean = false)`.
3. Update `setPhotoTime`: resolve existing photo quality using `photoQualityForSize(page.sizeBytes)` so editing timestamp preserves chosen compression level.

---

### Task 5: UI Controls in `PhotoViewer` & `ClaimScreen` (`PhotoViewer.kt` & `ClaimScreen.kt`)
**Files:**
- Modify: `app/src/main/java/surveyos/scan/ui/claim/PhotoViewer.kt`
- Modify: `app/src/main/java/surveyos/scan/ui/claim/ClaimScreen.kt`

**Steps:**
1. In `PhotoViewer.kt`:
   - Header: display `${item.name} · ${sizeText(item.page.sizeBytes)}` and `[ Compress ]` button.
   - Compress Dialog: 3 one-tap target buttons:
     - `~100 KB · Sheet / Email Friendly (1280px · 60% quality)`
     - `~250 KB · Balanced (1600px · 70% quality)`
     - `Original Full Resolution (1920px · 75% quality)`
   - Stamp chips row: `[ Full ] [ No Date ] [ No Stamp ]`.
   - Batch apply dialog: prompt when changing a gallery photo if `galleryCount > 1` (`Apply to all` / `Just this one`).
2. In `ClaimScreen.kt`:
   - Compute `galleryCount = photoItems.count { it.page.source == "GALLERY" && it.page.originalFile != null }`.
   - Wire `onStampMode` and `onCompress` callbacks to `ClaimViewModel`.

---

### Task 6: Unit Test Verification & Sibling Impact
**Files:**
- Modify: `app/src/test/java/surveyos/scan/image/StampTextTest.kt`

**Steps:**
1. Run `./gradlew.bat :app:testDebugUnitTest`.
2. Verify:
   - `stampModeDetection`: "full", "no_date", "none" modes.
   - `withStampModeTransitions`: bidirectional transitions between full, no_date, none.
   - `noDateModeWithNoGpsProducesZeroLines`: verifies zero blank lines or empty text boxes when GPS is absent.
   - `photoQualityForSizePresetRanges`: bounds checks for ~100 KB, ~250 KB, and full resolution.
3. Verify coupling impact: SurveyOS Prime V2 is unaffected (no schema or JSON contract changes).
