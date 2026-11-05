# Specification: SurveyOS Scan Gallery Photo Stamp Modes & Photo Compression (In-Viewer Control)

**Status:** Validated Design (Brainstormed with Owner)  
**Date:** 2026-11-05  
**Target Repository:** `SurveyOS Scan` (Android / Jetpack Compose)  
**Related Components:** `PhotoViewer.kt`, `ClaimViewModel.kt`, `Repository.kt`, `PageStamp.kt`, `StampText.kt`, `ImageSizing.kt`, `JpegEncoder.kt`

---

## 1. Executive Summary & Purpose

When motor surveyors import photos from the device gallery (e.g., photos received from workshops or insureds over WhatsApp), those photos often:
1. **Already have a camera timestamp burned onto them**, creating messy, overlapping stamps if the app stamps them again.
2. **Have unpredictable file sizes** (either bloated 4–8 MB or needing tight compression to stay under insurer email gateway limits of 5 MB / 10 MB for a 24-photo claim).

Because insurance survey reports typically format photos as **6 photos per A4 page** in a photo annexure sheet, each individual photo occupies a small physical space (~6 cm × 8 cm). Extreme high resolution is unnecessary for general damage photos and inflates PDF sizes unnecessarily.

This specification introduces:
1. **Live Photo Size Display in KB** in `PhotoViewer`.
2. **1-Tap Compression Target Pills** (`~100 KB`, `~250 KB`, `Original`).
3. **Per-photo Stamp Mode Chips** (`[ Full ]`, `[ No Date ]`, `[ No Stamp ]`) with zero empty lines when GPS is missing.
4. **Batch Application Action** for other gallery photos in the claim.

---

## 2. Key Requirements & User Decisions

### A. Size in KB & Compression Control
1. **Live Header Display:** Top bar of `PhotoViewer` displays photo name and file size:  
   `← Spot photo 3 · 485 KB` (or `1.2 MB` if > 1024 KB).
2. **Target Compression Pills:**
   - **`[ ~100 KB ]` (Photo Sheet / Email):** Resizes long side to ~1280px at 60% JPEG quality. Perfect for 6-up photo sheets; keeps an entire 24-photo report under ~3 MB.
   - **`[ ~250 KB ]` (Balanced):** Resizes long side to ~1600px at 70% JPEG quality.
   - **`[ Original / Full ]`:** Restores original standard survey quality (~500–800 KB).
3. **Lossless Engine:** Compressing always re-renders from the untouched `originalFile`. Surveyors can step down to `~100 KB` or restore to full resolution at any time.

### B. Stamp Mode Chips
1. **Three Stamp Modes:**
   - **`[ Full ]`**: Date, Time, Address, and GPS coordinates (standard survey stamp).
   - **`[ No Date ]`**: Omits the Date & Time line completely. Only Address and GPS coordinates are printed (if coordinates exist).
   - **`[ No Stamp ]`**: Omits all overlay text, displaying the clean, untouched original photo.
2. **No Empty Lines:** If a photo has no GPS coordinates and `No Date` is chosen, the engine draws nothing. Zero blank lines or empty text boxes are rendered.
3. **Batch Application:** When switching a gallery photo's stamp mode or compression, a prompt offers:  
   *"Apply to all N gallery photos in this claim? [Apply to all] [Just this one]"*.
   - **Safety Boundary:** Only applies to gallery-imported photos (`source == "GALLERY"`). Photos shot live with the camera on-site retain their evidence.

---

## 3. UI Design (`PhotoViewer.kt`)

```text
┌────────────────────────────────────────────────────────┐
│  ←  Final photo 3 · 485 KB             [ ⚡ Compress ] │
│                                                        │
│                  [ PHOTO PREVIEW ]                     │
│                                                        │
│  Date & time: 05-Nov-2026 11:30 AM ✎                  │
│  Tag:    [ Odometer ]  [ Chassis ]  [ None ]          │
│  Kind:   [ Spot ]      [ Final ]    [ RI ]            │
│  Stamp:  [ Full ]      [ No Date ]  [ No Stamp ]      │
└────────────────────────────────────────────────────────┘
```

When tapping **`[ ⚡ Compress ]`**, a bottom sheet/menu presents the target pills:
```text
Compress Photo Size:
  [ ~100 KB (Sheet / Email) ]    [ ~250 KB (Balanced) ]    [ Original (Restore) ]
```
Upon selection, the photo re-encodes instantly in the background, and the header live-updates to e.g. `Final photo 3 · 112 KB`.

---

## 4. Technical Architecture & Data Flow

### A. Resolution & Quality Matrix (`ImageSizing.kt`)
Add compression presets:
```kotlin
enum class PhotoQuality(val longSide: Int, val jpegQuality: Int) {
    COMPACT(1280, 60),  // Targets ~90 - 130 KB
    BALANCED(1600, 70), // Targets ~220 - 280 KB
    FULL(1920, 75);     // Standard survey default (~500 - 800 KB)
}
```

### B. Zero Database Migration Required
- `PageEntity.sizeBytes` is already persisted in Room.
- `PageEntity.stamp` stores `t=off;a=M;g=M` (natively supported by `StampStyle.parse`).
- `Quality` parameter passed to `PageFileEdits.restamp` determines the working image dimensions and compression.

---

## 5. Decision Log

| Date | Topic | Decision | Alternatives Considered | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-05 | Timing of Choice | Post-import inside `PhotoViewer` | Prompt upon picking; global Settings | Avoids interrupting surveyor during multi-photo gallery imports. |
| 2026-11-05 | UI Component | 3rd FilterChip row (`Stamp: Full / No Date / No Stamp`) | Inline toggle button beside timestamp | Matches existing Tag & Kind chip layout and muscle memory. |
| 2026-11-05 | Missing GPS Handling | Skip line completely; no empty line or blank box | Placeholder "GPS unavailable" | User requirement: clean presentation without awkward gaps. |
| 2026-11-05 | Compression Target UI | 1-Tap Pills (`~100 KB`, `~250 KB`, `Original`) | Slider from 80 KB to 500 KB | Fast, ergonomic thumb taps for on-site mobile use. |
| 2026-11-05 | 6-Up Sheet Quality | ~100 KB is safe and optimal | Requiring high-res for all photos | Photos appear at ~6x8 cm on A4 sheet; 100 KB looks identical to 800 KB while keeping claim PDF under 3 MB. |
| 2026-11-05 | Batch Scope | Restricted to `source == "GALLERY"` | Global or all photos in claim | Protects live camera evidence taken by surveyor on-site. |


---

## 6. Verification Plan
1. **Unit Tests:**
   - `StampStyleTest`: Verify `t=off` serialization/deserialization.
   - `StampTextTest`: Verify `stampLines` returns empty list when time is off and GPS is null (no empty lines).
   - `ClaimViewModelTest`: Verify batch apply updates only gallery photos in the claim.
2. **Device Testing:**
   - Import 3 pre-stamped workshop photos from gallery.
   - Tap one in grid -> tap `[ No Date ]` -> confirm timestamp removed, GPS retained.
   - Tap `[ Apply to all ]` -> verify all 3 gallery photos in grid reflect change.
   - Confirm on-site camera photos in same claim remain stamped with date and time.
