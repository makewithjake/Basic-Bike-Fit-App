# Magnification Implementation Plan

## Items from plan.md

1. **Better Magnification** – Currently uses a blue circle (ghost dot) to locate a point on desktop. Consider adding a magnifying glass / loupe to the desktop version as well as mobile.
2. **Move Mag Glass** – Move the mag glass to the lower-right corner of the image for all platforms so it is always easy to see.

---

## Current State (baseline)

- `drawLoupe()` in `script.js` renders a circular magnified crop of the photo above the user's finger during a touch drag.
- The loupe is **touch-only**: it is gated by `isTouchDrag === true`, which is set when `e.pointerType === 'touch'` in `handleStart()`.
- On desktop (mouse), the user sees only the cyan ghost dot (`rgba(0,220,255,0.35)` filled circle, radius 12 px) while dragging – no loupe.
- Loupe position: centred 150 px above `ghostPoint`, then clamped to stay inside the canvas.

---

## Item 1 – Better Magnification (extend loupe to desktop/mouse)

### Goal
Show the same drag loupe on desktop (mouse and trackpad) that currently appears on touch, giving desktop users the same precision placement experience.

### Approach

#### 1a. Remove the touch-only gate in `drawLoupe()`
- The early-exit check `if (!ghostPoint || !isTouchDrag || ...)` currently skips the loupe for mouse drags.
- Replace `isTouchDrag` guard with a more general "drag is active" flag (e.g. rename to `isDragging`), or simply remove the `isTouchDrag` condition from `drawLoupe()` so the loupe renders whenever `ghostPoint` is set and a drag is in progress.

#### 1b. Keep `isTouchDrag` for any touch-specific behaviour (if any remains)
- Audit remaining uses of `isTouchDrag`; if it is only used for the loupe gate, it can be removed entirely. If other touch-specific logic exists, keep it under a separate flag.

#### 1c. Loupe position offset for desktop
- The current 150 px upward offset works well for touch (finger obscures the photo). For mouse, the cursor itself is small, so the offset can stay the same **or** be reduced (e.g. 120 px). Decide via visual testing.
- No separate code path is strictly required; the existing clamping logic handles edge cases.

#### 1d. Ghost dot on desktop
- Decide whether to keep the cyan ghost dot alongside the loupe on desktop or suppress it when the loupe is visible.
- Recommendation: suppress the ghost dot while the loupe is showing (already the case on touch because the loupe visually replaces it). Add a shared `isLoupeVisible` derived boolean to control this.

#### Files to change
| File | Change |
|------|--------|
| `script.js` | Remove / relax `isTouchDrag` guard in `drawLoupe()`; adjust ghost-dot draw condition |

---

## Item 2 – Move Mag Glass to Lower-Right Corner

### Goal
Relocate the loupe from its current position (above the finger/cursor) to the **lower-right corner** of the canvas for all platforms, so it never overlaps the area being worked on and is always visible.

### Approach

#### 2a. Fixed anchor position
- Instead of computing `loupeX / loupeY` relative to `ghostPoint`, pin the loupe to a fixed position inside the canvas:
  ```
  loupeX = canvas.width  - LOUPE_RADIUS - MARGIN   // e.g. MARGIN = 15px
  loupeY = canvas.height - LOUPE_RADIUS - MARGIN
  ```
- Remove the current `rawLoupeX / rawLoupeY` and clamping logic – no longer needed since the position is fixed.

#### 2b. Source rect is still centred on ghostPoint
- The **magnified region that is displayed** inside the loupe must still sample the area around `ghostPoint` (the actual drag position).
- The existing `srcX / srcY / srcW / srcH` calculation already does this correctly and does not depend on loupe position – no change needed there.

#### 2c. Crosshair / pointer line (optional enhancement)
- Because the loupe is no longer directly above the cursor, a thin line or arrow from the loupe to `ghostPoint` could help users understand the relationship.
- This is optional and can be deferred; note it here for future consideration.

#### 2d. Responsive sizing
- On very small canvases (mobile, narrow viewport) `LOUPE_RADIUS = 60` plus margin may overflow or feel cramped. Consider reducing `LOUPE_RADIUS` to 48 px on viewports narrower than 480 px, or computing a responsive radius:
  ```javascript
  const LOUPE_RADIUS = Math.min(60, canvas.width * 0.12);
  ```

#### 2e. Platform consistency
- With a fixed corner position the loupe behaves identically on touch and mouse, which satisfies the "all platforms" requirement without any platform branching.

#### Files to change
| File | Change |
|------|--------|
| `script.js` | Replace dynamic loupe XY calculation with fixed lower-right anchor; optionally add responsive radius |

---

## Implementation Order

1. **Item 2 first** (move to lower-right): self-contained coordinate change, easy to verify visually.
2. **Item 1 second** (extend to desktop): remove the `isTouchDrag` gate; test mouse drag on desktop to confirm loupe appears and ghost dot handling is correct.

This order means the position is correct before the loupe is exposed to more interaction types.

---

## Testing Checklist

- [ ] Desktop mouse drag: loupe appears in lower-right, samples correct region, disappears on release.
- [ ] Mobile touch drag: loupe appears in lower-right (same position as desktop), samples correct region.
- [ ] Canvas near lower-right edge: loupe does not clip outside canvas bounds.
- [ ] Small viewport (< 480 px wide): loupe radius is appropriate.
- [ ] Ghost dot: not drawn while loupe is visible (or intentionally retained – confirm desired behaviour).
- [ ] Placing near bottom-right corner of canvas: verify ghostPoint sampling still correct even when loupe overlaps that region.
