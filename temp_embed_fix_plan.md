# Embed Height Fix Plan – Option 2 (postMessage / ResizeObserver)

## Current State

All three pieces of the plumbing already exist, but the implementation has several reliability bugs that prevent the height from updating consistently.

| Piece | File | Status |
|---|---|---|
| Height broadcaster | `index.html` (inline `<script>` at bottom) | Exists, but flawed |
| Explicit trigger after results render | `script.js` ~line 401 | Exists |
| Explicit trigger after image load | `script.js` ~line 536 | Exists |
| Explicit trigger after clear | `script.js` ~line 566 | Exists |
| iframe listener / resizer | `embed_app_code.html` | Correct, no changes needed |

---

## Root Cause Analysis

### Bug 1 – Wrong measurement node (highest priority)

`sendHeight` currently reads `document.documentElement.scrollHeight`.  
Inside an iframe, `scrollHeight` on `<html>` can be clamped to the iframe's viewport
height if the element has `height: 100%` or `overflow: hidden` set anywhere in the
CSS cascade — meaning it reports the constrained size, not the full content height.

**Fix:** Measure `document.getElementById('cycl3d-app-root').scrollHeight` instead.
The root element is a plain flex container with no height constraint, so its
`scrollHeight` always reflects the true rendered content height.

---

### Bug 2 – Single `requestAnimationFrame` is not always enough

One `rAF` tick fires before the browser has finished painting all layout side effects
(e.g. the results table appearing causes the image container to reflow).  
Reading `scrollHeight` in that same tick can still return the pre-update value.

**Fix:** Use two nested `requestAnimationFrame` calls (double-rAF) so the height is
read after the browser has completed both its layout pass and its paint pass.

```
requestAnimationFrame(() => requestAnimationFrame(sendHeight));
```

---

### Bug 3 – Initial `sendHeight()` fires before CSS is applied

In the current broadcaster, `sendHeight()` is called synchronously the moment the
inline `<script>` tag executes. At that point `style.css` may not have finished
applying, and fonts/images haven't loaded, so the measured height is too small.

**Fix:** Replace the immediate call with a `DOMContentLoaded` + `load` pair:
- Send once on `DOMContentLoaded` (catches fast cases).
- Send again on `window.load` (after images and fonts have rendered).

---

### Bug 4 – ResizeObserver observes the wrong element for the wrong metric

The observer watches `cycl3d-app-root` but the callback reads
`document.documentElement.scrollHeight`. These can diverge if a sibling or ancestor
element changes size independently.

**Fix:** Have the ResizeObserver callback read `root.scrollHeight` directly from the
element it is observing, keeping the measurement and the observation target in sync.

---

## Change Plan

### Change 1 – Rewrite the broadcaster in `index.html`

Replace the existing inline `<script>` broadcaster (the block after `<script src="script.js">`) with the corrected version:

- Detect iframe context (`window.self !== window.top`) — keep as-is.
- Measure `root.scrollHeight` instead of `document.documentElement.scrollHeight`.
- Send on `DOMContentLoaded` (double-rAF) and again on `window.load` (double-rAF).
- ResizeObserver callback reads `root.scrollHeight` and uses double-rAF.
- Export `window.cycl3dSendHeight` using the double-rAF wrapper — keep as-is so
  `script.js` can still call it explicitly.

Approximate line count: ~25 lines (similar to current, just corrected).

---

### Change 2 – Update the three explicit call sites in `script.js`

The three places that call `requestAnimationFrame(window.cycl3dSendHeight)` need
no logic change. Because `window.cycl3dSendHeight` will now internally use
double-rAF, the call sites stay exactly the same — no changes required to `script.js`.

---

### Change 3 – No changes to `embed_app_code.html`

The listener in the embed code is correct. It accepts `cycl3d-height` messages from
the right origin and sets `frame.style.height`. Nothing needs to change here.

---

## Files Changed

| File | Changes |
|---|---|
| `index.html` | Rewrite broadcaster `<script>` block only (~25 lines) |
| `script.js` | No changes required |
| `embed_app_code.html` | No changes required |

---

## Testing Checklist

After implementing the changes, verify each of these in a browser with DevTools open:

- [ ] Open the app directly (not embedded) — nothing should break; the broadcaster bails out at the `window.self === window.top` check.
- [ ] Open `embed_app_code.html` locally via a server. Confirm the iframe height matches the app content on initial load (no cut-off, no extra whitespace).
- [ ] Upload a photo — confirm the iframe grows to fit the image.
- [ ] Place all 7 joint markers — confirm the iframe grows when the results table appears.
- [ ] Click "Clear Canvas & Reset" — confirm the iframe shrinks back.
- [ ] Load the Demo Image — confirm the iframe resizes correctly.
- [ ] Resize the browser window to a narrow width (mobile simulation) — confirm the iframe re-measures and stays correctly sized.
- [ ] Open the app via the live GitHub Pages URL inside the embed — confirm it also works in production (not just localhost).
