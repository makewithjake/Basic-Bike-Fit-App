# Embed Height Fix Plan – Option 2 (postMessage / ResizeObserver)

## Current State

> **Broadcaster rewrite (Section 1) is COMPLETE.** The remaining work is the three items in Section 2 (Shopify fixes).

| Piece | File | Status |
|---|---|---|
| Height broadcaster | `index.html` (inline `<script>` at bottom) | **Fixed – all 4 bugs resolved** |
| Explicit trigger after results render | `script.js` ~line 401 | Needs double-rAF upgrade (Section 2 Step 2) |
| Explicit trigger after image load | `script.js` ~line 536 | Needs double-rAF upgrade (Section 2 Step 2) |
| Explicit trigger after clear | `script.js` ~line 566 | Needs double-rAF upgrade (Section 2 Step 2) |
| iframe listener / resizer | `embed_app_code.html` | Correct, no changes needed |

---

## Root Cause Analysis (all four bugs below are now fixed in `index.html`)

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

### Change 1 – Rewrite the broadcaster in `index.html` ✅ COMPLETE

All four bugs have been fixed. The current broadcaster in `index.html` already:

- Measures `root.scrollHeight` (Bug 1 fix)
- Uses double-rAF via `scheduleHeight()` (Bug 2 fix)
- Fires on `DOMContentLoaded` + `window.load` (Bug 3 fix)
- `ResizeObserver` calls `scheduleHeight()` which reads `root.scrollHeight` (Bug 4 fix)
- Exports `window.cycl3dSendHeight = scheduleHeight` for `script.js` call sites

No further changes needed to `index.html` broadcaster.

---

### Change 2 – Upgrade the three explicit call sites in `script.js` ⬅ STILL NEEDED

See Section 2, Step 2. The three call sites still use single-rAF and need to be
upgraded to double-rAF. (Note: `window.cycl3dSendHeight` is already double-rAF
internally, so the outer double-rAF in the call site adds an extra buffer pass,
guarding against layout reflows that occur between the call and the first inner rAF.)

---

### Change 3 – No changes to `embed_app_code.html` broadcaster listener

The `postMessage` listener is correct. The only change to this file is raising the
fallback `height` attribute (Section 2, Step 3).

---

## Files Changed (Section 1 only — broadcaster fix)

| File | Changes |
|---|---|
| `index.html` | **Already done** — broadcaster rewritten with all 4 bug fixes |
| `script.js` | Remaining — see Section 2 Step 2 |
| `embed_app_code.html` | Remaining — see Section 2 Step 3 |

---

---

# Shopify Embed Cutting Off + Missing PDF Button – Fix Plan

*Diagnosed: 2026-02-24*

## Symptoms (reported)

1. PDF button is cut off / not visible on the Shopify embed page before any photo is loaded.
2. When a photo is loaded, the entire app is clipped inside the iframe.
3. PDF button appears to be missing entirely.

---

## Root Cause Analysis

### Issue 1 – PDF button cut off at initial load

The iframe in `embed_app_code.html` starts with a fixed `height="640"`. The app's full initial render (banner, disclaimer, upload controls, all button rows including the PDF button) requires ~700-750 px. The iframe is clipped before the PDF button row renders, and the `ResizeObserver` broadcaster has not yet fired to expand it. The user sees the app cut off even before interacting with it.

**Fix:** Raise the fallback `height` attribute on the iframe from `640` to `900`. This is only the initial size before the auto-resize kicks in -- it just needs to be tall enough to show the complete app at rest.

---

### Issue 2 – Entire app clipped after a photo is loaded (`70vh` instability)

`#displayImg` in `style.css` has `max-height: 70vh`. Inside an iframe, `vh` units are relative to the **iframe's current height**, not the parent page viewport. This creates a circular dependency:

1. Iframe is 640 px tall, so `70vh` = 448 px max image height.
2. Image loads, content grows, `sendHeight` fires, iframe expands to ~1 100 px.
3. `70vh` is now 770 px, so image re-flows taller, and content is now larger than what was just reported.
4. ResizeObserver fires again with the new (larger) height, but the timing may race with the next paint, causing the iframe to be set to the wrong size or oscillate.

**Fix:** Remove `max-height: 70vh` from `#displayImg` in `style.css`. Let the image size naturally with `width: 100%; height: auto`, so content height is stable and predictable before `sendHeight` measures it.

---

### Issue 3 – Why the PDF button appears "entirely missing"

Two possible causes (to confirm via Step 4 below):

- **Most likely:** Same as Issue 1 -- the button exists in `index.html` but is always below the iframe clipping boundary, so it was never visible on Shopify.
- **Less likely:** A git deploy pushed a version of `index.html` or `style.css` that omitted the button. Verifiable via `git log`.

---

## Fix Steps

### Step 1 – Remove `max-height: 70vh` from `style.css` (ROOT CAUSE FIX)

In `style.css`, remove the `max-height: 70vh` line from `img#displayImg`:

```css
/* BEFORE */
img#displayImg {
    width: 100%;
    height: auto;
    max-height: 70vh;   /* REMOVE this line */
    object-fit: contain;
}

/* AFTER */
img#displayImg {
    width: 100%;
    height: auto;
    object-fit: contain;
}
```

This eliminates the circular `vh` dependency and makes the content height stable before `sendHeight` reads it.

---

### Step 2 – Upgrade single-rAF call sites to double-rAF in `script.js`

The three explicit `sendHeight` call sites currently use:

```js
requestAnimationFrame(window.cycl3dSendHeight);
```

After an image load there is a layout reflow. One rAF fires before that reflow is complete. Upgrade all three to:

```js
requestAnimationFrame(() => requestAnimationFrame(window.cycl3dSendHeight));
```

Locations: ~line 401, ~line 537, ~line 567.

Note: `window.cycl3dSendHeight` already uses double-rAF internally (via `scheduleHeight`), so wrapping it again is safe -- it just ensures the outer call also waits for layout to settle before entering the double-rAF sequence.

---

### Step 3 – Raise the iframe fallback height in `embed_app_code.html`

Change `height="640"` to `height="900"` on the `<iframe>` element. This ensures the full app -- including all button rows and the PDF button -- is visible immediately, before the auto-resize broadcaster fires.

---

### Step 4 – Verify PDF button is present in the live GitHub Pages deploy

Run `git log --oneline -10` and check that the currently deployed commit includes the `pdf-btn` in `index.html`. If the deployed version is behind, committing and pushing the code changes above will also push the current `index.html` (which already contains the PDF button).

---

## Files Changed

| File | Change |
|---|---|
| `style.css` | Remove `max-height: 70vh` from `#displayImg` |
| `script.js` | Upgrade 3 single-rAF `sendHeight` calls to double-rAF |
| `embed_app_code.html` | Raise iframe fallback `height` from `640` to `900` |
| `index.html` | No changes required (PDF button already present) |

---

## Testing Checklist

- [ ] Open the app directly (not embedded) -- no visual regression; image fills width naturally.
- [ ] Open `embed_app_code.html` locally. Confirm all buttons including PDF are visible at initial load with no scrollbar.
- [ ] Upload a photo -- confirm the iframe expands smoothly to fit the image, no oscillation.
- [ ] Place all 7 joint markers -- confirm the iframe grows when the results table appears.
- [ ] Click "Clear Canvas & Reset" -- confirm the iframe shrinks back.
- [ ] Load the Demo Image -- confirm the iframe resizes correctly.
- [ ] Test on a narrow viewport (mobile) -- confirm no clipping.
- [ ] Verify PDF button is visible and functional on the live Shopify page after deploy.
