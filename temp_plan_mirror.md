# Plan: Add "Flip Image" Button

## Goal
Add a button between the photo and the results table that mirrors the photo
horizontally. This allows users who uploaded a photo with the rider facing
left to flip it so the rider faces right, which is required for accurate
angle calculations.

---

## Approach: Off-Screen Canvas Redraw

When the button is clicked, draw the current `#displayImg` to a hidden
off-screen canvas with a horizontal `scale(-1, 1)` transform to produce the
mirrored pixel data. Convert the result to a data URL and assign it as the
new `img.src`. This replaces the image in-place with no changes to the
coordinate system or point-handling logic.

**Why this approach:**
- No changes to `getPos()`, `draw()`, or any angle calculations.
- Works identically for uploaded photos and the demo image.
- Clicking again re-flips back (flip is always applied to whatever src is
  currently loaded, so two flips return to the original pixel data).
- Clean, self-contained: the rest of the app remains unaware that a flip
  occurred.

**Trade-off:**
- All placed joint markers must be cleared when the image is flipped,
  because their stored canvas-space coordinates are no longer valid against
  the new image geometry. This matches the expected workflow: user flips
  first, then places markers.

---

## Changes Required

### 1. `index.html` — Insert button between `#container` and `#results-area`

**Location:** Inside `#report-wrapper`, directly after the closing `</div>`
of `#container` and before `<div id="results-area">`.

**Markup to add:**
```html
<div class="no-print-zone mirror-btn-wrap">
    <button type="button" id="mirrorBtn" class="mirror-btn">⇄ Flip Image</button>
</div>
```

- Wrapped in `.no-print-zone` so it is hidden during PDF export and print,
  consistent with all other UI controls.
- Placed inside `#report-wrapper` so it sits visually between the photo and
  the results table.

---

### 2. `style.css` — Style the Flip Image button and its wrapper

**Location:** After the `.advice-box` rule block and before `.action-buttons`
(roughly line 115 area), so it sits with the other results-area-adjacent
styles.

**Rules to add:**

```css
/* Wrapper that positions the Flip Image button between the photo and table. */
.mirror-btn-wrap {
    margin-top: 10px;
    text-align: center;
}

/* Flip Image button: compact, secondary-action appearance. */
.mirror-btn {
    background:    var(--color-slate);
    color:         white;
    padding:       8px 22px;
    border-radius: 6px;
    font-size:     0.88rem;
    font-weight:   600;
    width:         auto;   /* Override the global `button { width: 100% }` rule */
    cursor:        pointer;
}
```

Key detail: the global `button` rule sets `width: 100%`. Setting `width: auto`
on `.mirror-btn` keeps it compact and centred rather than spanning the full
container width.

---

### 3. `script.js` — Add the flip logic and event listener

**New state variable** (add near the other `let` declarations around line 68):
```js
let isMirrored = false; // Tracks whether the current image has been flipped
```
> `isMirrored` is not strictly required for the flip logic (flipping is
> always applied to the current src), but it is useful for potentially
> updating button label state or for future features. Include it for clarity.

**New helper function** (add in the BUTTON ACTIONS section, e.g. after the
`loadHelpImage` function):

```js
/**
 * flipImage()
 *
 * Mirrors the currently loaded photo horizontally by drawing it onto an
 * off-screen canvas with a scaleX(-1) transform and replacing img.src
 * with the resulting data URL. Clears all joint markers because their
 * stored coordinates are no longer valid after the pixel data changes.
 *
 * Guards: does nothing if no real photo is loaded (empty src, hidden img,
 * zero natural width, or the help placeholder is active).
 */
function flipImage() {
    if (!img.src || img.style.display === 'none' || !img.naturalWidth || isHelpImage) return;

    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Create an off-screen canvas at the full natural image resolution.
    const offscreen = document.createElement('canvas');
    offscreen.width  = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');

    // Apply horizontal flip transform before drawing.
    // scale(-1, 1) mirrors on the Y axis; translate(-w, 0) shifts back into view.
    offCtx.translate(w, 0);
    offCtx.scale(-1, 1);
    offCtx.drawImage(img, 0, 0);

    // Clear existing markers – they are no longer valid against the flipped image.
    points = [];

    // Toggle the mirrored state flag.
    isMirrored = !isMirrored;

    // Replace the displayed image with the flipped version.
    img.onload = () => { draw(); };
    img.src    = offscreen.toDataURL('image/png');
}
```

**New event listener** (add after the `demoBtn` listener, around line 713):
```js
document.getElementById('mirrorBtn').addEventListener('click', flipImage);
```

---

### 4. Clear/Reset — ensure `isMirrored` resets on clear

In the existing `clearBtn` click handler (around line 716), add:
```js
isMirrored = false;
```
alongside the other state resets (`points = []`, `demoLoading = false`, etc.).

---

## File Summary

| File | Change |
|---|---|
| `index.html` | Add `<div class="no-print-zone mirror-btn-wrap">` + `<button id="mirrorBtn">` between `#container` and `#results-area` |
| `style.css` | Add `.mirror-btn-wrap` and `.mirror-btn` rules |
| `script.js` | Add `let isMirrored`, `flipImage()` function, `mirrorBtn` event listener, and `isMirrored = false` in the clear handler |

---

## User Flow

1. User uploads a left-facing photo.
2. User clicks **⇄ Flip Image** — the image flips, any existing markers are cleared.
3. User places joint markers on the now right-facing rider.
4. Angles calculate normally.
5. If the user clicks Flip Image again, the image flips back and markers are cleared again.
6. **Clear / Reset** resets `isMirrored` along with everything else.
7. The Flip Image button does **not** appear in the PDF export or print view
   (hidden by `.no-print-zone` + `@media print` rule).
