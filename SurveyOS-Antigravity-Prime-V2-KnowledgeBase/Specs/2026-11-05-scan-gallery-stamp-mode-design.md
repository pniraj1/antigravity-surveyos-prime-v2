# Specification: SurveyOS Scan Gallery Photo Stamp Modes (In-Viewer Control)

**Status:** Validated Design (Brainstormed with Owner)  
**Date:** 2026-11-05  
**Target Repository:** `SurveyOS Scan` (Android / Jetpack Compose)  
**Related Components:** `PhotoViewer.kt`, `ClaimViewModel.kt`, `Repository.kt`, `PageStamp.kt`, `StampText.kt`

---

## 1. Executive Summary & Purpose

When motor surveyors import photos from the device gallery (e.g., photos received from workshops or insureds over WhatsApp), those photos often already have a camera timestamp burned onto them. 

Currently, SurveyOS Scan applies the global default stamp (Date, Time, Address, GPS) unless the user manually dives into *Settings → Photo stamp*. Stamping a second timestamp over an existing camera stamp creates overlapping, illegible text that looks unprofessional on survey reports.

This specification introduces a **per-photo Stamp mode chip control** inside the full-screen `PhotoViewer`, plus a **one-tap batch action** for other gallery photos in the claim.

---

## 2. Key Requirements & User Decisions

1. **In-Viewer Control:** Located inside `PhotoViewer.kt`, below the existing `Tag` and `Kind` chip rows.
2. **Three Stamp Modes:**
   - **`[ Full ]`**: Date, Time, Address, and GPS coordinates (standard survey stamp).
   - **`[ No Date ]`**: Omits the Date & Time line completely. Only Address and GPS coordinates are printed (if coordinates exist).
   - **`[ No Stamp ]`**: Omits all overlay text, displaying the clean, untouched original photo.
3. **No Empty Lines:** If a photo has no GPS coordinates and `No Date` is chosen, the engine draws nothing. Zero blank lines or empty text boxes are rendered.
4. **Lossless Restamp:** Leverages SurveyOS Scan's existing `PageFileEdits.restamp` and `originalOf(file)`. Toggling between modes is 100% lossless and reversible.
5. **Batch Application:** When switching a gallery photo's stamp mode, a prompt offers:  
   *"Apply to all N gallery photos in this claim? [Apply to all] [Just this one]"*.
   - **Safety Boundary:** Only applies to gallery-imported photos (`source == "GALLERY"`). Photos shot live with the camera on-site are protected to preserve surveyor evidence.

---

## 3. UI Design (`PhotoViewer.kt`)

Below the photo preview and `StampTimeRow`:

```text
Tag:    [ Odometer ]  [ Chassis ]  [ None ]
Kind:   [ Spot ]      [ Final ]    [ RI ]
Stamp:  [ Full ]      [ No Date ]  [ No Stamp ]
```

- Follows standard `oliveChipColors()` styling matching `Tag` and `Kind`.
- Active mode is visibly highlighted.
- Tapping `[ No Date ]` immediately triggers `ClaimViewModel.setStampMode(pageId, "no_date")`.
- Tapping `[ No Stamp ]` immediately triggers `ClaimViewModel.setStampMode(pageId, "none")`.
- Tapping `[ Full ]` immediately triggers `ClaimViewModel.setStampMode(pageId, "full")`.

---

## 4. Technical Architecture & Data Flow

### A. Zero Database Migration Required
`PageEntity` in Room stores the stamp configuration string in the format:
```text
t=M;a=M;g=M;doc
```
- `t`: time size (`XS`, `S`, `M`, `L`, `XL`, or `off`)
- `a`: address size
- `g`: GPS size

Under `StampStyle.parse()` and `StampStyle.encode()`:
- `t=off` is already fully supported by the parser!
- Setting `time = null` automatically serializes to `t=off;a=M;g=M`.
- Setting `stamp = null` signifies `[ No Stamp ]`.

### B. Rendering Logic (`StampText.kt`)
`stampLines()` appends only active, non-null items:
```kotlin
fun stampLines(info: StampInfo, style: StampStyle): List<StampLine> {
    val out = ArrayList<StampLine>(3)
    style.time?.let { out += StampLine(formatStampTime(info.shownAt), TIME_BASE * it.factor, true) }
    val lat = info.lat
    val lng = info.lng
    if (lat != null && lng != null) {
        val addr = info.address
        if (!addr.isNullOrBlank()) style.address?.let { out += StampLine(addr, OTHER_BASE * it.factor, false) }
        style.gps?.let { out += StampLine(formatGps(lat, lng, info.accuracyM), OTHER_BASE * it.factor, false) }
    }
    return out
}
```
- If `style.time == null` (`No Date`), the time line is skipped.
- If `lat` and `lng` are null, address and GPS lines are skipped.
- If `out` is empty, no background or text is drawn. No empty line is ever rendered.

### C. Execution Pipeline
1. `PhotoViewer` triggers `ClaimViewModel.setStampMode(pageId, mode)`.
2. `Repository.setPageStampStyle(pageId, style, Quality.PHOTO)` updates Room database.
3. `PageFileEdits.restamp` reads pristine original JPEG (`originalOf(...)`), generates working JPEG without date/time, and replaces working image.
4. UI updates instantly with visual feedback.

---

## 5. Decision Log

| Date | Topic | Decision | Alternatives Considered | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-05 | Timing of Choice | Post-import inside `PhotoViewer` | Prompt upon picking; global Settings | Avoids interrupting surveyor during multi-photo gallery imports. |
| 2026-11-05 | UI Component | 3rd FilterChip row (`Stamp: Full / No Date / No Stamp`) | Inline toggle button beside timestamp | Matches existing Tag & Kind chip layout and muscle memory. |
| 2026-11-05 | Missing GPS Handling | Skip line completely; no empty line or blank box | Placeholder "GPS unavailable" | User requirement: clean presentation without awkward gaps. |
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
