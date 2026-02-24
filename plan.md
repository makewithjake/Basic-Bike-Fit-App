# Cycl3D Bike Fit App – Change Plan

## Core Stack
- Vanilla JS (ES2015+, strict mode) – no frameworks
- HTML5 Canvas API – skeleton overlay + angle labels
- jsPDF + jsPDF-AutoTable (CDN) – programmatic PDF export, no html2canvas
- CSS3 custom properties – shared colour tokens across stylesheet
- Browser localStorage – session save / restore

## Current Focus
- **Mobile compatibility** – touch targets too small, layout breaks on narrow viewports; needs responsive button grid, larger hit areas, and pinch-to-zoom safe canvas handling
- **Bike type selector** – add Road / Gravel / MTB dropdown; each type carries its own ideal angle ranges (MTB upright geometry differs from road aero)
- **Adjustment recommendations** – upgrade vague advice ("RAISE saddle height") to specific, actionable guidance (e.g. "Raise saddle ~5–10 mm") and tailor advice per bike type

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

## Notes / Rules
- No external JS frameworks – keep it vanilla
- No html2canvas – PDF is built programmatically; angle logic must be duplicated in the PDF path (it cannot read from the live DOM)
- CSP meta tag is enforced in `index.html` – any new CDN script needs a matching `integrity` hash
- Bike type and riding style are **separate axes** – MTB + Aggressive is a valid combination; ranges are keyed `IDEAL_RANGES[joint][bikeType][ridingStyle]` e.g. `IDEAL_RANGES.Knee.MTB.Relaxed → [145, 155]`; Road and Gravel ranges sit closer together, MTB skews more upright across all styles
- Touch events already have `passive: false` on `touchstart` / `touchmove` for drag support – preserve this when adding mobile layout changes
