# Implementation Plan – Current Focus Items

Reference rules from `plan.md` (Notes / Rules section) apply throughout:
- Vanilla JS only (no frameworks)
- No html2canvas – PDF is built programmatically; any new data shown in the app must also be duplicated in the PDF export path (it cannot read from the live DOM)
- CSP meta tag is enforced – no new CDN scripts needed for these changes
- Preserve `touch-action: none` on the canvas; no layout changes to the canvas or Pointer Events API wiring

---

## Item 1 – Remove Save Button

### What to Remove

**`index.html`**
- Delete the `<button>` element with `id="saveBtn"` and `class="save-btn"` from the `.action-buttons` div.
- In the Help modal (`#help-modal`), remove step 7 ("Use the "Save Session" button…") from the `<p>` tags so the instructions remain accurate.

**`script.js`**
- Delete the entire `saveBtn` click-event listener block (lines ~837–851), including its comment header ("Save Session: stores…").
- The `localStorage.removeItem('cycl3d_save')` call inside `clearBtn`'s handler (line ~600) should also be removed since saving to that key no longer happens. The restore-on-load logic that reads `cycl3d_save` from localStorage at startup should also be located and removed (search for `cycl3d_save` and `JSON.parse` restore block).

**`style.css`**
- Locate and delete the `.save-btn` rule(s) (background colour, hover state, etc.).

### What to Keep
- The `clearBtn` handler otherwise stays intact (only the `localStorage.removeItem` line for `cycl3d_save` is removed).
- No other localStorage usage is affected.

---

## Item 2 – Title & Notes Fields

### UI Changes

**`index.html`**

1. **Title input** – Add a labeled text input (`id="fitTitle"`) directly above the `#container` div (which holds `#displayImg` and `#skeletonCanvas`). Place it inside `#report-wrapper` so it is part of the printable/PDF region visually, but wrap it in a `<div class="no-print-zone">` so it is excluded from the PDF screenshot path (the PDF will read the value programmatically). Placeholder text: `"Session title (optional)"`.

2. **Notes textarea** – Add a labeled textarea (`id="fitNotes"`) below `#results-area` and above `.disclaimer` inside `#report-wrapper`. Same exclusion rule applies: wrap in `.no-print-zone`. Placeholder text: `"Notes (optional)"`. Rows attribute: 4.

> Note: Both fields live inside `#report-wrapper` for visual flow, but are `.no-print-zone` so they are not captured by any screenshot. Their *values* are read by JS and injected into the PDF programmatically (see PDF section below).

**`style.css`**
- Add styles for `.fit-title-wrap` and `.fit-notes-wrap` container divs (label + input/textarea).
- Style the `#fitTitle` input and `#fitNotes` textarea consistently with the existing app aesthetic (border, border-radius, padding, font-size, full width within their container).
- Ensure they are visually separated from adjacent elements.

### PDF Export Changes (`script.js`)

The PDF export must duplicate these values programmatically (per the no-DOM rule in `plan.md`).

**Title field in PDF:**
- After the existing "Cycl3D Basic Bike Fit Report" heading in the PDF, add a second text line that reads the value of `document.getElementById('fitTitle').value.trim()`.
- If the value is non-empty, render it below the main heading (slightly smaller font, e.g. `fontSize: 13`, bold or normal).
- Advance `cursorY` accordingly.

**Notes field in PDF:**
- After the measurements table (after `cursorY = doc.lastAutoTable.finalY + 8`), add a "Notes" section before the legal disclaimer.
- Read `document.getElementById('fitNotes').value.trim()`.
- If non-empty: render a small bold "Notes:" label, then use `doc.splitTextToSize()` to wrap the notes text to `contentW` and render it with `doc.text()`.
- Advance `cursorY` before the disclaimer block.

### Session Save / Restore Impact
- The Save Session button is being removed (Item 1), so there is no existing session persistence to update.
- If auto-save or restore is ever re-added in the future, `fitTitle` and `fitNotes` values should be included in the stored JSON. No action needed now.

---

## Order of Implementation

1. Remove Save Button (HTML, JS, CSS) – self-contained, zero risk to other features.
2. Add Title input above photo (HTML + CSS).
3. Add Notes textarea below results table (HTML + CSS).
4. Update PDF export to include Title and Notes values (JS only).
5. Smoke-test: verify button is gone, fields render correctly, PDF includes both fields, existing features (PDF photo, table, disclaimer, clear/reset) are unaffected.
