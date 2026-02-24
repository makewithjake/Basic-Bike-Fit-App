# Mobile Compatibility Plan – Cycl3D Bike Fit App

## Status
- [x] Method selected
- [ ] Phase 1 – Method 2 (Pointer Events) implemented
- [ ] Phase 1 – Method 2 tested
- [x] Phase 2 – Method 3 (Ghost Point) implemented
- [ ] Phase 2 – Method 3 tested

---

## Current Problem Summary

| Issue | Root Cause |
|---|---|
| Dots are hard to place accurately | Finger physically covers the tap point; no visual feedback above the finger |
| Dragging is erratic and inconsistent | `getBoundingClientRect()` is called on every `touchmove` – if the page scrolls or layout reflows mid-drag, the returned `rect` shifts, snapping the point to a wrong position |
| Past loupe attempt broke points 5 & 6 | The loupe triggered extra `draw()` calls during placement; `draw()` runs angle math and updates the canvas – combined with the async nature of the loupe offset, the point was being committed before the loupe math resolved, so the stored `x/y` was stale or incorrect |

---

## What We Know About the Code

- `getPos(e)` calls `canvas.getBoundingClientRect()` live on every event – this is the likely source of erratic drag behavior.
- `handleMove()` calls `draw()` on every `touchmove` frame, which reruns all angle math – fast but must stay that way; anything that slows this loop risks the points 5/6 race condition seen before.
- `handleStart()` has a 25 px grab radius – may be too tight on small screens but works fine on desktop.
- Touch listeners use `passive: false` + `preventDefault()` for scroll blocking – must be preserved.
- Points are stored as live object references (dragging mutates the object directly) – simple and efficient; any solution should keep this pattern.

---

## Three Candidate Methods

---

### Method 1 – Cache the Canvas Rect on Touch Start + Fixed Upward Offset
**Concept:** Two minimal, targeted fixes in `getPos()`:
1. On `touchstart`, snapshot `canvas.getBoundingClientRect()` once and store it in a variable. Reuse that same snapshot for every subsequent `touchmove` in that drag session. On `touchend`, clear the snapshot. This eliminates reflow/scroll-caused coordinate jumps during a drag.
2. Apply a constant Y offset (e.g. `−50px`) to the returned coordinate only for touch events so the dot renders above the fingertip, making it visible and reachable.

**Changes required:** ~5 lines added to the existing `getPos()` / `handleStart()` / `handleEnd()` functions. No new UI, no new rendering, no new state.

**Why it avoids the past problem:** No extra `draw()` calls, no async math. The point is placed exactly where `getPos()` returns – simple subtraction. Angle calculations run the same as today; nothing is deferred.

**Risk:** The fixed offset is a constant estimate. Users with large fingers may need a slightly different offset, but it will be consistent and predictable, which is the goal.

---

### Method 2 – Pointer Events API + `touch-action: none`
**Concept:** Replace the current split mouse/touch listener setup with the unified **Pointer Events API** (`pointerdown`, `pointermove`, `pointerup`) and add the CSS rule `touch-action: none` to the canvas. The browser then handles scroll suppression automatically without requiring `preventDefault()` on every event – the `passive: false` listeners can be removed entirely.

Pointer Events use a consistent coordinate system regardless of device, and do not suffer from the `getBoundingClientRect` drift problem because the coordinates are always relative to the viewport in a stable way. Combine with the same `−50px` visual offset from Method 1 for finger clearance.

**Changes required:** Replace 4–5 event listener lines in the canvas section, remove the two `passive: false` blocks, add one CSS rule. `getPos()` simplifies because `e.clientX / e.clientY` are always present (no `e.touches` branch needed).

**Why it avoids the past problem:** Same reasoning as Method 1 – placement is synchronous, instant, no deferred math. The API is simply more reliable for cross-device coordinates.

**Risk:** Slightly more refactoring than Method 1 (swapping event names and removing the touch-specific branches), but the end result is cleaner and future-proof. Pointer Events are supported by all modern mobile browsers.

---

### Method 3 – Tap-to-Stage, Lift-to-Commit (Ghost Point Pattern)
**Concept:** Decouple *dragging feedback* from *point commitment*. During a drag (`touchmove`), render a "ghost" dot at the offset position above the finger but do **not** update the stored `points` array. Only on `touchend` is the ghost position written into `points`. The `draw()` call during `touchmove` renders the ghost as a visual guide only.

This is the most explicit fix for the points 5/6 issue: since `points` is not mutated until `touchend`, the angle calculations in `draw()` always operate on the last *committed* state – no stale or intermediate values can corrupt the placement.

**Changes required:** Add a `ghostPoint` variable. Split `handleMove()` so it writes to `ghostPoint` instead of `draggingPoint.x/y`. Add a ghost rendering pass in `draw()` (draw ghost dot in a different color/style above the finger). On `touchend`, copy `ghostPoint` into the real point.

**Why it avoids the past problem:** Directly – the loupe problem was caused by math running on a partially-placed point. By keeping `points` frozen during touch-move, all angle math is stable. The ghost is purely visual.

**Risk:** Adds a small amount of state (`ghostPoint`) and a rendering branch in `draw()`. Must ensure the ghost is visually distinct enough that the user knows it is a "preview" not a final placement. Slightly more code than Methods 1 or 2.

---

## Implementation Plan

### Phase 1 – Method 2 (do now)
Method 1 is dropped — it solves the same coordinate drift problem as Method 2 but is a lesser fix. Method 2 supersedes it.

**Goal:** Replace the split mouse/touch listener setup with the Pointer Events API and stabilize drag coordinates.

**Changes:**
- Add `touch-action: none` to the canvas in `style.css`
- In `script.js`, replace `mousedown` / `mousemove` / `mouseup` + `touchstart` / `touchmove` / `touchend` listeners with unified `pointerdown` / `pointermove` / `pointerup` listeners
- Simplify `getPos()` — remove the `e.touches` branch; use `e.clientX` / `e.clientY` directly
- Remove the two `passive: false` touch listener blocks
- Add `canvas.setPointerCapture(e.pointerId)` on `pointerdown` so drag tracking continues if the finger leaves the canvas boundary

**Acceptance criteria:**
- [x] Dragging any point on mobile is smooth and does not jump
- [x] No unwanted page scroll during a drag
- [x] All 7 points place and drag correctly on desktop (regression check)
- [x] PDF export unaffected

### Phase 2 – Method 3 (later)
**Goal:** Prevent mid-drag angle math from corrupting point placement, specifically the points 5 & 6 bug.

**Changes:**
- Add a `ghostPoint` variable
- `handleMove()` writes to `ghostPoint` instead of mutating `points` directly
- `draw()` renders the ghost dot in a distinct style (e.g. dashed outline) above the finger
- `handleEnd()` commits `ghostPoint` into `points` and clears the ghost

**Acceptance criteria:**
- [x] Points 5 and 6 land exactly where the finger lifts
- [x] Ghost dot is clearly visible above the fingertip during drag
- [ ] No regression in angle calculations or PDF export

---

## Next Steps

- [x] Implement Phase 1 (Method 2)
- [x] Test Phase 1 on iOS Safari (most restrictive touch environment)
- [x] Test Phase 1 on Android Chrome
- [x] Confirm stable before starting Phase 2
- [x] Implement Phase 2 (Method 3)
- [ ] Verify points 5 and 6 placement is stable end-to-end
- [ ] Update plan.md mobile section once both phases confirmed working
