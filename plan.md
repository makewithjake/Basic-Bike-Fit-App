# Cycl3D Bike Fit App – Change Plan

## Core Stack
- Vanilla JS (ES2015+, strict mode) – no frameworks
- HTML5 Canvas API – skeleton overlay + angle labels
- jsPDF + jsPDF-AutoTable (CDN) – programmatic PDF export, no html2canvas
- CSS3 custom properties – shared colour tokens across stylesheet
- Browser localStorage – session save / restore

## Current Focus
-**help screen update** - instead of displaying help_screenshot.png, display the help text in this area until user uploads a photo or loads the demo image.

## Completed
- [x] Photo upload (FileReader → base64 → `<img>`)
- [x] Click-to-place + drag joint markers (7 points: Toe → Ankle → Knee → Hip → Shoulder → Elbow → Hand)
- [x] Angle calculations: Knee, Back, Shoulder, Elbow, Ankle
- [x] Riding style selector: Relaxed / Balanced / Aggressive
- [x] Results table – measured angle, ideal range, corrective advice
- [x] PDF report export – jsPDF direct (`addImage` + `autoTable`), no html2canvas
- [x] Session save / restore (localStorage)
- [x] Demo image loader
- [x] Help modal
- [x] Clear / reset (wipes markers, image, and localStorage)
- [x] Mobile Phase 1 – Pointer Events API (`pointerdown/move/up`, `touch-action: none`); stable drag coordinates on iOS & Android
- [x] Mobile Phase 2 – Ghost Point pattern; points 5 & 6 placement race condition resolved
- [x] Mobile Phase 3 – Drag Loupe; magnified canvas crop above finger during touch drag, clamped to canvas bounds (all phases tested on iOS Safari & Android Chrome)
- [x] Removed save button
- [x] Added Notes fields
- [x] Mobile Phase 4 – Responsive layout; table wrapped in horizontal scroll container; `body` overflow-x guarded; mobile media query tightens padding, forces text wrap, and collapses action-buttons to 2-column grid
- [x] Move PDF button – sits inline with Help & Demo (all 3 side by side on one row; Clear still spans full width)
- [x] Clear update – Clear Canvas & Reset now also wipes the session title and notes fields
- [x] Load help – `Assets/help_screenshot.png` is shown in the image area on first load; replaced by any uploaded photo or Demo Image; restored by Clear; `isHelpImage` flag prevents marker placement and PDF export on the placeholder

## Notes / Rules
- No external JS frameworks – keep it vanilla
- No html2canvas – PDF is built programmatically; angle logic must be duplicated in the PDF path (it cannot read from the live DOM)
- CSP meta tag is enforced in `index.html` – any new CDN script needs a matching `integrity` hash
- Bike type and riding style are **separate axes** – MTB + Aggressive is a valid combination; ranges are keyed `IDEAL_RANGES[joint][bikeType][ridingStyle]` e.g. `IDEAL_RANGES.Knee.MTB.Relaxed → [145, 155]`; Road and Gravel ranges sit closer together, MTB skews more upright across all styles
- Canvas drag events now use the Pointer Events API (`pointerdown / pointermove / pointerup`) with `touch-action: none` on the canvas – the old `touchstart / touchmove` passive:false blocks have been removed; preserve `touch-action: none` when making layout changes
