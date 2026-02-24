# Cycl3D Bike Fit App – Change Plan

## Part 1 – Replace Hardcoded Shopify CDN Links with Local Assets

**Files:** `index.html`, `script.js`

### 1a. `index.html` – Banner image src
- Change `src="https://cdn.shopify.com/.../cycl3d_banner_...png"` → `src="Assets/cycl3d_banner.webp"`

### 1b. `index.html` – Content Security Policy
- Remove `https://cdn.shopify.com` from the `img-src` directive since no external image sources remain.
- Result: `img-src 'self' data: blob:`

### 1c. `script.js` – Demo image URL
- Change `const DEMO_URL = 'https://cdn.shopify.com/.../Jake_bike_fit_demo.png...'`
  → `const DEMO_URL = 'Assets/Jake_bike_fit_demo.png';`

### 1d. `script.js` – Remove `crossOrigin` from `loadDemoImage()`
- `img.crossOrigin = 'Anonymous'` is only needed for cross-origin images. Local assets do not require it and setting it unnecessarily can cause issues in some browsers.
- Remove the attribute assignment and associated comment.
- Update the `onerror` alert message to reflect that it is now loading a local file (remove "check your internet connection").

---

## Part 2 – PDF Export Rebuilt from Scratch

**File:** `script.js`

The old implementation (`html2pdf().from(element).save()`) captured the raw DOM without the canvas overlay, producing a broken export. The entire handler is replaced.

### New approach – programmatic canvas compositing + clean HTML template

The new `pdfBtn` click handler is an `async` function that runs the following steps:

#### Step 1 – Validate state
- If no image is loaded, alert the user and abort. No point generating an empty report.

#### Step 2 – Composite photo + skeleton overlay at full natural resolution
- Create a temporary off-screen `<canvas>` sized to the photo's **natural** pixel dimensions (not display size).
- `drawImage(img)` to paint the photo at full resolution.
- Calculate scale factors: `scaleX = naturalWidth / clientWidth`, `scaleY = naturalHeight / clientHeight`.
- Redraw skeleton lines, joint dots, and angle labels using those scale factors so every marker and label lands at exactly the same relative position as seen in the browser, but at full resolution.
- Export to a JPEG data URL via `toDataURL('image/jpeg', 0.92)`.

#### Step 3 – Embed the banner as a data URL
- Draw `document.querySelector('.banner img')` onto a small temporary canvas.
- Export to a PNG data URL. Wrapped in `try/catch` – if it fails for any reason, the banner is omitted gracefully.

#### Step 4 – Build a self-contained HTML report string
Construct a minimal HTML document containing:
- Banner image (embedded as data URL)
- Report title (`Cycl3D Basic Bike Fit Report`)
- Riding style label
- Composited bike-fit photo (`max-width: 100%`)
- Measurements table (`resultsArea.innerHTML`)
- Legal disclaimer
- Inline CSS matching the app's brand colors, font styles, and table design

#### Step 5 – Export via html2pdf with controlled settings
```js
{
  margin:      [10, 10, 10, 10],       // mm – uniform margin on all sides
  filename:    'Cycl3D_Bike_Fit_Report.pdf',
  image:       { type: 'jpeg', quality: 0.95 },
  html2canvas: { scale: 1, useCORS: true, logging: false },
  jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
  pagebreak:   { mode: 'avoid-all' }   // prevents table rows from being split across pages
}
```
- `.from(reportHTML, 'string')` – html2pdf renders the self-contained HTML string, not the live DOM.

#### Step 6 – Button state management
- Button is disabled and label changed to `Generating…` for the duration of the export.
- Restored to `Download PDF Report` in a `finally` block (runs whether export succeeds or fails).
